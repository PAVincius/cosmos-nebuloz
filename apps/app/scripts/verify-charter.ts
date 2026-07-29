/**
 * scripts/verify-charter.ts
 *
 * Confere o banco semeado contra os critérios de aceite do SRD-Charter.md.
 * Não é substituto dos testes unitários (que provam as fórmulas): prova que o
 * dado no banco exercita cada regra, e que RLS e entitlement estão de pé.
 *
 *   pnpm verify:charter [slug]
 *
 * Sai com código 1 se qualquer verificação falhar — serve de gate de CI.
 */

import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../../../packages/database/generated";
import {
  dataClassWeight,
  deriveVendorMaxClass,
  policyPublishBlockers,
  riskScore,
  slaRemaining,
} from "../lib/charter/rules";

const TENANT_SLUG = process.argv[2] ?? "medcore";
const NOW = new Date("2026-07-28T12:00:00Z");

let failures = 0;

function check(label: string, pass: boolean, detail = "") {
  if (pass) {
    console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failures++;
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });

  const tenant = await db.tenant.findUnique({ where: { slug: TENANT_SLUG } });
  if (!tenant) {
    throw new Error(`Tenant "${TENANT_SLUG}" não encontrado.`);
  }
  const tenantId = tenant.id;
  console.log(`\n🔍 Verificação Charter → ${tenant.name}\n`);

  // ── Entitlement (ADR-0001) ──
  console.log("Entitlement");
  const modules = await db.tenantModule.findMany({ where: { tenantId } });
  check(
    "módulo CHARTER contratado e ativo",
    modules.some((m) => m.module === "CHARTER" && m.status === "ACTIVE")
  );
  check(
    "app-switcher tem o que mostrar (≥2 módulos)",
    modules.length >= 2,
    modules.map((m) => m.module).join(" + ")
  );
  const otherTenants = await db.tenant.findMany({
    where: { id: { not: tenantId }, isSystem: false },
    select: { id: true, slug: true },
  });
  for (const t of otherTenants) {
    const hasCharter = await db.tenantModule.count({
      where: { tenantId: t.id, module: "CHARTER" },
    });
    check(
      `tenant "${t.slug}" NÃO tem Charter (default deny)`,
      hasCharter === 0
    );
  }

  // ── RBAC (ADR-0002) ──
  console.log("\nRBAC");
  const memberships = await db.charterMembership.findMany({
    where: { tenantId },
    include: { user: { select: { email: true } } },
  });
  const roles = new Set(memberships.map((m) => m.role));
  check(
    "4 papéis de governança distintos atribuídos",
    roles.size >= 4,
    [...roles].join(", ")
  );
  const admins = await db.tenantMember.findMany({
    where: { tenantId, role: "ADMIN" },
    select: { userId: true },
  });
  for (const a of admins) {
    check(
      "ADMIN do tenant tem CharterMembership explícita (não herda)",
      memberships.some((m) => m.userId === a.userId)
    );
  }

  // ── RLS (NFR-1.1) ──
  console.log("\nIsolamento");
  // relkind='r' é obrigatório: sem ele o LIKE pega os índices
  // (CharterUseCase_tenantId_idx e companhia), que não têm RLS e nunca terão.
  const rls = await db.$queryRawUnsafe<
    { relname: string; rls: boolean; forced: boolean; policies: bigint }[]
  >(`
    SELECT c.relname, c.relrowsecurity AS rls, c.relforcerowsecurity AS forced,
           (SELECT count(*) FROM pg_policies p
             WHERE p.schemaname='public' AND p.tablename=c.relname) AS policies
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r'
      AND (c.relname LIKE 'Charter%' OR c.relname='TenantModule')
  `);
  const badRls = rls.filter(
    (r) => !(r.rls && r.forced) || Number(r.policies) < 1
  );
  check(
    "RLS enabled+forced+policy em toda tabela do Charter",
    badRls.length === 0 && rls.length === 15,
    `${rls.length - badRls.length}/${rls.length}`
  );

  // Policy correta não basta: um papel com BYPASSRLS ignora toda a política.
  // Superuser tem BYPASSRLS implícito. Ver ADR-0012.
  const role = await db.$queryRawUnsafe<
    { rolname: string; rolsuper: boolean; rolbypassrls: boolean }[]
  >(
    "SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user"
  );
  const bypasses = role[0]?.rolsuper || role[0]?.rolbypassrls;
  check(
    "papel de conexão NÃO tem BYPASSRLS (NFR-1.1)",
    !bypasses,
    `current_user=${role[0]?.rolname} super=${role[0]?.rolsuper} bypassrls=${role[0]?.rolbypassrls}`
  );

  // Leitura sem contexto de tenant deve voltar vazia. Com BYPASSRLS ela não
  // volta — e o resultado abaixo é a demonstração do risco, não ruído.
  const leaked = await db.charterUseCase.count();
  check(
    "query sem app.tenant_id não vaza caso algum",
    leaked === 0,
    bypasses
      ? `${leaked} linhas visíveis — consequência do BYPASSRLS acima, não de policy ausente`
      : `${leaked} linhas visíveis`
  );

  // ── Domínio, dentro do contexto de tenant ──
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;

    // FR-2.3 — bloqueio de publicação
    console.log("\nPolítica (FR-2)");
    const policy = await tx.charterPolicy.findFirst({
      where: { tenantId },
      include: { sections: true, versions: true },
    });
    if (!policy) {
      check("política existe", false);
      return;
    }
    const blockers = policyPublishBlockers(
      policy.sections.map((s) => ({ id: s.id, name: s.name, status: s.status }))
    );
    check(
      "existe estado que exercita o bloqueio de publicação (FR-2.3)",
      blockers.length > 0,
      `${blockers.length} bloqueadores: ${blockers.map((b) => `S${b.name.slice(0, 12)}…`).join(", ")}`
    );
    check("9 seções", policy.sections.length === 9);
    check(
      "versões com snapshot para diff (FR-2.6)",
      policy.versions.every((v) => Array.isArray(v.snapshot)),
      `${policy.versions.length} versões`
    );

    // FR-4.4 / FR-8.5 — gate de fornecedor
    console.log("\nFornecedores (FR-8, FR-9)");
    const vendors = await tx.charterVendor.findMany({
      where: { tenantId },
      include: { clauses: { include: { clause: { select: { code: true } } } } },
    });
    let derivationOk = 0;
    for (const v of vendors) {
      const expected = deriveVendorMaxClass({
        tier: v.tier,
        dpa: v.dpa,
        clauseCodes: v.clauses.map((c) => c.clause.code),
      }).maxClass;
      if (v.maxClass === expected) {
        derivationOk++;
      }
    }
    check(
      "maxClass persistido bate com a derivação (ADR-0003)",
      derivationOk === vendors.length,
      `${derivationOk}/${vendors.length}`
    );
    check(
      "existe fornecedor sem DPA (alimenta alerta da Visão Geral)",
      vendors.some((v) => !v.dpa)
    );
    check(
      "existe fornecedor bloqueado (maxClass nulo)",
      vendors.some((v) => v.maxClass === null)
    );
    check(
      "existe fornecedor apto a dado Restrito",
      vendors.some((v) => v.maxClass === "RESTRICTED")
    );

    // FR-3, FR-5, FR-7
    console.log("\nCasos e risco (FR-3, FR-5, FR-7)");
    const cases = await tx.charterUseCase.findMany({
      where: { tenantId },
      include: { vendor: true, decisions: true },
    });
    check("12 casos", cases.length === 12);

    const statuses = new Set(cases.map((c) => c.status));
    check(
      "todo status do ciclo representado",
      statuses.size >= 7,
      [...statuses].join(", ")
    );

    const restricted = cases.filter((c) => c.status === "RESTRICTED");
    check(
      "aprovação com restrições tem ≥1 condição (FR-6.3)",
      restricted.length > 0 &&
        restricted.every((c) => c.restrictions.length > 0),
      `${restricted.length} caso(s)`
    );
    const blocked = cases.filter((c) => c.status === "BLOCKED");
    check(
      "caso bloqueado tem motivo e saiu da fila de SLA (FR-6.5)",
      blocked.every((c) => c.blockReason && c.slaTotal === null)
    );
    const changes = cases.filter((c) => c.status === "CHANGES");
    check(
      "pedido de ajuste tem descrição (FR-6.4)",
      changes.every((c) => c.changeRequest)
    );
    check(
      "toda decisão tem justificativa (FR-6.2)",
      cases.every((c) =>
        c.decisions.every((dec) => dec.rationale.trim() !== "")
      )
    );

    // Só caso em aberto conta como fora de SLA. Um caso aprovado em junho tem
    // SLA "vencido" aritmeticamente e não é problema de ninguém — a Visão Geral
    // filtra por status, e esta verificação precisa filtrar igual, senão passa
    // por motivo errado.
    const OPEN: string[] = ["SUBMITTED", "REVIEW", "CHANGES"];
    const overdue = cases.filter((c) => {
      if (!OPEN.includes(c.status)) {
        return false;
      }
      const rem = slaRemaining(c.submittedAt, c.slaTotal, NOW);
      return rem !== null && rem < 0;
    });
    // Exatamente um: o dataset precisa de um caso estourado para exercitar o
    // alerta vermelho, e de nenhum a mais — quatro casos vermelhos na Visão
    // Geral ensinam o usuário a ignorar a cor.
    check(
      "exatamente 1 caso em aberto fora de SLA (alerta vermelho da Visão Geral)",
      overdue.length === 1,
      overdue.map((c) => c.code).join(", ") || "nenhum"
    );
    const nearDeadline = cases.filter((c) => {
      if (!OPEN.includes(c.status)) {
        return false;
      }
      const rem = slaRemaining(c.submittedAt, c.slaTotal, NOW);
      return rem !== null && rem >= 0 && rem <= 2;
    });
    check(
      "existe caso perto do vencimento (tom âmbar de SLA — FR-3.3)",
      nearDeadline.length > 0,
      nearDeadline.map((c) => c.code).join(", ")
    );
    check(
      "caso fora de SLA está sem revisor (alerta de atribuição)",
      overdue.every((c) => c.reviewerId === null),
      overdue
        .map((c) => `${c.code}:${c.reviewerId ? "com revisor" : "sem"}`)
        .join(", ")
    );

    const flagged = cases.filter((c) => c.vendorIneligible);
    check(
      "casos com fornecedor inelegível sinalizados (DATA-MODEL §6)",
      flagged.length > 0,
      flagged.map((c) => c.code).join(", ")
    );
    // Cada sinalização precisa ser verdadeira, não decorativa
    const wrongFlags = cases.filter((c) => {
      const max = c.vendor?.maxClass ?? null;
      const truly =
        max === null || dataClassWeight(max) < dataClassWeight(c.dataClass);
      return c.vendorIneligible !== truly;
    });
    check(
      "nenhuma sinalização falsa nem faltante",
      wrongFlags.length === 0,
      wrongFlags.map((c) => c.code).join(", ")
    );

    const heat = cases.map((c) =>
      riskScore({
        privacy: c.riskPrivacy,
        regulatory: c.riskRegulatory,
        security: c.riskSecurity,
        bias: c.riskBias,
        ip: c.riskIp,
        operational: c.riskOperational,
        reputational: c.riskReputational,
      })
    );
    const cells = new Set(heat.map((h) => `${h.severity}-${h.likelihood}`));
    check(
      "heatmap tem ≥4 células ocupadas (célula clicável útil)",
      cells.size >= 4,
      `${cells.size} células`
    );
    check(
      "existe caso crítico",
      heat.some((h) => h.label === "Crítico")
    );

    // FR-7.4
    const mitigations = await tx.charterMitigation.findMany({
      where: { tenantId },
    });
    const mitOverdue = mitigations.filter(
      (m) => m.status !== "DONE" && m.dueDate !== null && m.dueDate < NOW
    );
    check(
      "exatamente 1 mitigação atrasada (sinal não afogado)",
      mitOverdue.length === 1,
      mitOverdue.map((m) => m.code).join(", ")
    );

    // FR-10
    console.log("\nOnboarding (FR-10)");
    const tracks = await tx.charterTrack.findMany({
      where: { tenantId },
      include: { acknowledgments: { select: { status: true } } },
    });
    check("5 trilhas", tracks.length === 5);
    const assigned = tracks.reduce((s, t) => s + t.acknowledgments.length, 0);
    const done = tracks.reduce(
      (s, t) =>
        s + t.acknowledgments.filter((a) => a.status === "ACKNOWLEDGED").length,
      0
    );
    check(
      "cobertura é agregado real de aceites, não contador",
      assigned > 0,
      `${done}/${assigned} = ${Math.round((done / assigned) * 100)}%`
    );
    check(
      "existe trilha exigindo reatribuição (FR-2.5 / FR-10.5)",
      tracks.some((t) => t.needsReassignment),
      tracks
        .filter((t) => t.needsReassignment)
        .map((t) => t.code)
        .join(", ")
    );
    check(
      "toda trilha vinculada a uma versão de política",
      tracks.every((t) => t.policyVersionId !== null)
    );

    // FR-11
    console.log("\nAuditoria (FR-11)");
    const audit = await tx.auditLog.findMany({
      where: { tenantId, entityType: { startsWith: "charter." } },
    });
    check(
      "trilha do Charter povoada",
      audit.length >= 8,
      `${audit.length} entradas`
    );
    check(
      "entradas carregam papel de governança do ator",
      audit.every(
        (a) => (a.metadata as { charterRole?: string } | null)?.charterRole
      )
    );
    const withDiff = audit.filter(
      (a) => Array.isArray(a.diff) && (a.diff as unknown[]).length > 0
    );
    check(
      "diff campo-a-campo presente (FR-11.2)",
      withDiff.length > 0,
      `${withDiff.length} com diff`
    );

    // Sequências
    console.log("\nSequências");
    const seqs = await tx.charterSequence.findMany({ where: { tenantId } });
    const ucSeq = seqs.find((s) => s.kind === "usecase");
    const maxUc = Math.max(
      ...cases.map((c) => Number(c.code.replace("UC-", "")))
    );
    check(
      "contador de caso aponta além do último semeado",
      (ucSeq?.next ?? 0) > maxUc,
      `next=${ucSeq?.next} > UC-${maxUc}`
    );
  });

  await db.$disconnect();
  await pool.end();

  console.log(
    failures === 0
      ? "\n✅ Todas as verificações passaram.\n"
      : `\n❌ ${failures} verificação(ões) falharam.\n`
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("❌ verify-charter falhou:", e);
  process.exit(1);
});
