/**
 * scripts/seed-charter-nebuloz.ts
 *
 * Aplica o Charter interno da Nebuloz num tenant existente, a partir do
 * inventário real do runbook `docs/runbooks/charter-nebuloz.md` (§5
 * fornecedores, §6 casos de uso) — não dado fictício.
 *
 *   pnpm seed:charter:nebuloz            → tenant "nebuloz"
 *   pnpm seed:charter:nebuloz outro-slug → outro slug
 *
 * O que faz, nesta ordem:
 *   1. Resolve o tenant pelo slug — falha se não existir. NUNCA cria tenant.
 *   2. Garante TenantModule CHARTER via `contractModule` (packages/provisioning).
 *   3. Resolve o ator: `admin@nebuloz.com` se existir, senão o primeiro
 *      TenantMember com role ADMIN do tenant.
 *   4. Chama `bootstrapCharter` (papel COMPLIANCE, CharterSettings, política
 *      com as 9 seções em DRAFT) com o e-mail do ator — o runbook §3 não
 *      nomeia um e-mail de compliance distinto do admin da conta.
 *   5. Upsert por `(tenantId, code)` de `NEBULOZ_VENDORS` e depois de
 *      `NEBULOZ_USE_CASES` (packages/provisioning/src/charter-nebuloz.ts),
 *      resolvendo `vendorId` pelo `vendorCode` quando presente.
 *
 * Idempotente por upsert — NUNCA `deleteMany`. Diferente de seed-charter.ts
 * (que apaga e recria dado fictício), este é dado real que alguém vai editar
 * na tela: um wipe destruiria essa edição a cada reexecução.
 */

import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { PrismaPg } from "@prisma/adapter-pg";
// Caminho profundo para os módulos do provisioning, não o índice do pacote:
// o índice reexporta `platformDb`, que importa "@repo/database" por valor —
// e esse módulo tem `import "server-only"` no topo. Fora do Next isso lança
// incondicionalmente, e o script morreria antes da primeira linha (mesmo
// motivo já documentado em seed-meridian.ts). charter.ts e modules.ts não
// importam nada assim — só tipos e o próprio audit.ts/errors.ts.
import { bootstrapCharter } from "@repo/provisioning/src/charter";
import {
  NEBULOZ_USE_CASES,
  NEBULOZ_VENDORS,
} from "@repo/provisioning/src/charter-nebuloz";
import { contractModule } from "@repo/provisioning/src/modules";
import { Pool } from "pg";
import type {
  Prisma,
  PrismaClient as PrismaClientType,
} from "../../../packages/database/generated";
import { PrismaClient } from "../../../packages/database/generated";

type Tx = Prisma.TransactionClient;

const TENANT_SLUG = process.argv[2] ?? "nebuloz";
const COMPLIANCE_EMAIL = "admin@nebuloz.com";

/** Mesma lógica de `@repo/rbac`'s `invalidateModuleCache`, reimplementada sem
 *  o import direto: aquele módulo também tem `import "server-only"` no topo.
 *  Sem Redis configurado (caso comum de banco de ensaio local), é um no-op —
 *  igual ao original. */
async function invalidateModuleCache(tenantId: string): Promise<void> {
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return;
  }
  const { redis } = await import("@repo/rate-limit");
  await redis.del(`modules:${tenantId}`);
}

/** Reimplementação local de `withTenantDb`: abre transação, define
 *  `app.tenant_id` via `SET LOCAL` (RLS do Charter está FORCE) e roda `fn`.
 *  Não importamos a versão real de `@repo/database` pelo mesmo motivo acima. */
function withTenantDb<T>(
  db: PrismaClientType,
  tenantId: string,
  fn: (tx: Tx) => Promise<T>
): Promise<T> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    return fn(tx);
  });
}

type Actor = { id: string; email: string; source: string };

async function resolveActor(
  db: PrismaClientType,
  tenantId: string
): Promise<Actor> {
  const admin = await db.user.findUnique({
    where: { email: COMPLIANCE_EMAIL },
    select: { id: true, email: true },
  });
  if (admin) {
    return { id: admin.id, email: admin.email, source: admin.email };
  }

  const member = await db.tenantMember.findFirst({
    where: { tenantId, role: "ADMIN" },
    select: { userId: true, user: { select: { email: true } } },
  });
  if (!member) {
    throw new Error(
      `Nenhum usuário admin@nebuloz.com nem membro ADMIN encontrado para o tenant "${TENANT_SLUG}". Não há ator para o bootstrap.`
    );
  }
  return {
    id: member.userId,
    email: member.user.email,
    source: `primeiro TenantMember ADMIN (${member.user.email})`,
  };
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({
    adapter: new PrismaPg(pool),
  }) as PrismaClientType;

  const tenant = await db.tenant.findUnique({ where: { slug: TENANT_SLUG } });
  if (!tenant) {
    throw new Error(
      `Tenant "${TENANT_SLUG}" não encontrado. Este script não cria tenant — provisione antes (ex.: /clientes/novo ou seed:tenants).`
    );
  }
  const tenantId = tenant.id;

  console.log(`\n🛡  Charter Nebuloz → ${tenant.name} (${tenant.slug})\n`);

  const actor = await resolveActor(db, tenantId);
  console.log(`  ator: ${actor.source}`);

  await contractModule(
    db,
    { invalidateModuleCache },
    {
      tenantId,
      module: "CHARTER",
      actorUserId: actor.id,
      actorName: actor.email,
    }
  );
  console.log("  ✓ módulo CHARTER contratado");

  const bootstrap = await bootstrapCharter(
    { withTenantDb: (tid, fn) => withTenantDb(db, tid, fn) },
    {
      tenantId,
      complianceEmail: actor.email,
      actorUserId: actor.id,
      actorName: actor.email,
    }
  );
  console.log(
    `  ✓ política ${bootstrap.created ? "criada" : "já existia"} (${bootstrap.policyId})`
  );

  // ── Fornecedores ──────────────────────────────────────────────────────────
  let vendorsCreated = 0;
  let vendorsUpdated = 0;
  const vendorIdByCode: Record<string, string> = {};

  await withTenantDb(db, tenantId, async (tx) => {
    const existingCodes = new Set(
      (
        await tx.charterVendor.findMany({
          where: { tenantId },
          select: { code: true },
        })
      ).map((v) => v.code)
    );

    for (const v of NEBULOZ_VENDORS) {
      const data: Omit<
        Prisma.CharterVendorUncheckedCreateInput,
        "tenantId" | "code"
      > = {
        name: v.name,
        category: v.category,
        ...(v.tier ? { tier: v.tier } : {}),
        ...(v.notes !== undefined ? { notes: v.notes } : {}),
      };
      const row = await tx.charterVendor.upsert({
        where: { tenantId_code: { tenantId, code: v.code } },
        create: { tenantId, code: v.code, ...data },
        update: data,
      });
      vendorIdByCode[v.code] = row.id;
      if (existingCodes.has(v.code)) {
        vendorsUpdated++;
      } else {
        vendorsCreated++;
      }
    }
  });
  console.log(
    `  ✓ fornecedores: ${vendorsCreated} criados, ${vendorsUpdated} atualizados (total ${NEBULOZ_VENDORS.length})`
  );

  // ── Casos de uso ──────────────────────────────────────────────────────────
  let casesCreated = 0;
  let casesUpdated = 0;
  const missingVendorCodes: string[] = [];

  await withTenantDb(db, tenantId, async (tx) => {
    const existingCodes = new Set(
      (
        await tx.charterUseCase.findMany({
          where: { tenantId },
          select: { code: true },
        })
      ).map((c) => c.code)
    );

    for (const uc of NEBULOZ_USE_CASES) {
      const vendorId = uc.vendorCode ? vendorIdByCode[uc.vendorCode] : null;
      if (uc.vendorCode && !vendorId) {
        missingVendorCodes.push(`${uc.code} → ${uc.vendorCode}`);
      }

      const data: Omit<
        Prisma.CharterUseCaseUncheckedCreateInput,
        "tenantId" | "code"
      > = {
        title: uc.title,
        objective: uc.objective,
        vendorId: vendorId ?? null,
        dataClass: uc.dataClass,
        exposure: uc.exposure,
        criticality: uc.criticality,
        approvalPath: uc.approvalPath,
        slaTotal: uc.slaTotal,
        hitl: uc.hitl,
        riskPrivacy: uc.risk.privacy.risk,
        probPrivacy: uc.risk.privacy.prob,
        riskRegulatory: uc.risk.regulatory.risk,
        probRegulatory: uc.risk.regulatory.prob,
        riskSecurity: uc.risk.security.risk,
        probSecurity: uc.risk.security.prob,
        riskBias: uc.risk.bias.risk,
        probBias: uc.risk.bias.prob,
        riskIp: uc.risk.ip.risk,
        probIp: uc.risk.ip.prob,
        riskOperational: uc.risk.operational.risk,
        probOperational: uc.risk.operational.prob,
        riskReputational: uc.risk.reputational.risk,
        probReputational: uc.risk.reputational.prob,
      };
      await tx.charterUseCase.upsert({
        where: { tenantId_code: { tenantId, code: uc.code } },
        create: { tenantId, code: uc.code, ...data },
        update: data,
      });
      if (existingCodes.has(uc.code)) {
        casesUpdated++;
      } else {
        casesCreated++;
      }
    }
  });
  console.log(
    `  ✓ casos de uso: ${casesCreated} criados, ${casesUpdated} atualizados (total ${NEBULOZ_USE_CASES.length})`
  );
  if (missingVendorCodes.length > 0) {
    console.log(
      `  ⚠ vendorCode sem fornecedor correspondente: ${missingVendorCodes.join(", ")}`
    );
  }

  await pool.end();
  console.log("\nConcluído.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
