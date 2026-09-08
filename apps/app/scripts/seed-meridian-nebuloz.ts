/**
 * scripts/seed-meridian-nebuloz.ts
 *
 * Popula o Meridian da própria Nebuloz: um assessment com as iniciativas reais
 * do lançamento comercial como lacunas e plano — não dado fictício.
 *
 *   pnpm seed:meridian:nebuloz              → tenant "nebuloz"
 *   pnpm seed:meridian:nebuloz outro-slug    → outro tenant
 *
 * O dado mora em `@repo/provisioning/src/meridian-nebuloz` — este script só o
 * grava. Cada lacuna e cada item de plano vêm de um documento já escrito no
 * repositório (mapa de processo, RoPA de LGPD, índice mestre, PRD do Scaffold,
 * spec do Signal, ADR-0012, design de 2FA); a rastreabilidade mora no `fonte`
 * de cada lacuna no módulo de dados, não em coluna de banco.
 *
 * Idempotente por upsert — nunca `deleteMany`. Diferente de
 * `seed-meridian.ts`: este script roda contra dado real que alguém vai editar
 * na tela, então rodar duas vezes não pode apagar edição feita entre as duas
 * execuções. Toda entidade tem `@@unique` que a chave de upsert usa:
 *   - TenantModule       → (tenantId, module)
 *   - MeridianTemplate   → (tenantId, version) — reusa se o tenant já tiver a
 *                           versão atual da bateria, cria com as perguntas
 *                           senão.
 *   - MeridianAssessment → (tenantId, code)
 *   - MeridianGap        → (tenantId, code)
 *   - MeridianPlanItem   → (assessmentId, gapId)
 *   - MeridianAxisScore  → (assessmentId, axis)
 *
 * Falha se o tenant ou o consultor não existirem — não cria nenhum dos dois.
 * Não toca em `Charter*` nem roda `seed:tenants`/`seed:meridian`.
 */

import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
// Caminho profundo, não o índice do pacote — mesmo motivo documentado em
// scripts/seed-meridian.ts: o índice reexporta platform-db.ts, que importa
// "server-only", e este script roda por tsx, fora do Next.
import {
  MERIDIAN_BATTERY,
  MERIDIAN_TEMPLATE_NAME,
  MERIDIAN_TEMPLATE_VERSION,
} from "@repo/provisioning/src/meridian";
import {
  computeDeclaredAxisScore,
  NEBULOZ_ASSESSMENT,
  NEBULOZ_AXIS_SCORE_CONFIDENCE,
  NEBULOZ_AXIS_SCORE_NOTE,
  NEBULOZ_GAPS,
  NEBULOZ_PLAN,
  type NebulozAxis,
} from "@repo/provisioning/src/meridian-nebuloz";
import { Pool } from "pg";
import type { PrismaClient as PrismaClientType } from "../../../packages/database/generated";
import { PrismaClient } from "../../../packages/database/generated";
import { AXIS_IDS } from "../lib/meridian/axes";

const TENANT_SLUG = process.argv[2] ?? "nebuloz";
const CONSULTANT_EMAIL = process.argv[3] ?? "admin@nebuloz.com";

const d = (iso: string) => new Date(`${iso}T12:00:00Z`);

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({
    adapter: new PrismaPg(pool),
  }) as PrismaClientType;

  const tenant = await db.tenant.findUnique({ where: { slug: TENANT_SLUG } });
  if (!tenant) {
    throw new Error(
      `Tenant "${TENANT_SLUG}" não encontrado. Este script não cria tenant — rode seed:tenants antes, ou aponte para um slug existente.`
    );
  }
  const tenantId = tenant.id;

  // Igual ao seed do Charter: o e-mail é preferência, não exigência. Em produção
  // o admin da Nebuloz não é admin@nebuloz.com, e o script não pode abortar por
  // isso — cai no primeiro membro ADMIN do tenant.
  const consultant =
    (await db.user.findUnique({ where: { email: CONSULTANT_EMAIL } })) ??
    (
      await db.tenantMember.findFirst({
        where: { tenantId, role: "ADMIN" },
        include: { user: true },
      })
    )?.user ??
    null;
  if (!consultant) {
    throw new Error(
      `Usuário "${CONSULTANT_EMAIL}" não encontrado. Este script não cria usuário — informe um e-mail de conta já existente como segundo argumento.`
    );
  }

  console.log(
    `\n🧭  Seed Meridian (Nebuloz real) → ${tenant.name} (${tenant.slug})\n`
  );

  await db.tenantModule.upsert({
    where: { tenantId_module: { tenantId, module: "MERIDIAN" } },
    create: { tenantId, module: "MERIDIAN", status: "ACTIVE" },
    update: { status: "ACTIVE" },
  });
  console.log("  ✓ módulo MERIDIAN contratado");

  // Template: reusa se o tenant já tiver a versão atual da bateria.
  let template = await db.meridianTemplate.findFirst({
    where: { tenantId, version: MERIDIAN_TEMPLATE_VERSION },
  });
  let templateCreated = false;
  if (template) {
    console.log(`  ✓ template ${MERIDIAN_TEMPLATE_VERSION} reaproveitado`);
  } else {
    template = await db.meridianTemplate.create({
      data: {
        tenantId,
        name: MERIDIAN_TEMPLATE_NAME,
        version: MERIDIAN_TEMPLATE_VERSION,
        lockedAt: new Date(),
      },
    });
    await db.meridianQuestion.createMany({
      data: MERIDIAN_BATTERY.map((q) => ({
        tenantId,
        templateId: (template as { id: string }).id,
        code: q.code,
        axis: q.axis,
        ordinal: q.ordinal,
        type: q.type,
        text: q.text,
        weight: q.weight,
        inverted: q.inverted,
        scaleLabels: q.scaleLabels,
      })),
    });
    templateCreated = true;
    console.log(
      `  ✓ template ${MERIDIAN_TEMPLATE_VERSION} criado · ${MERIDIAN_BATTERY.length} perguntas`
    );
  }

  const assessment = await db.meridianAssessment.upsert({
    where: {
      tenantId_code: { tenantId, code: NEBULOZ_ASSESSMENT.code },
    },
    create: {
      tenantId,
      code: NEBULOZ_ASSESSMENT.code,
      orgName: NEBULOZ_ASSESSMENT.orgName,
      sector: NEBULOZ_ASSESSMENT.sector,
      sizeBand: NEBULOZ_ASSESSMENT.sizeBand,
      templateId: template.id,
      status: "REVIEW",
      consultantId: consultant.id,
      openedAt: d(NEBULOZ_ASSESSMENT.openedAt),
      deadline: d(NEBULOZ_ASSESSMENT.deadline),
      benchmarkOptIn: false,
    },
    update: {
      orgName: NEBULOZ_ASSESSMENT.orgName,
      sector: NEBULOZ_ASSESSMENT.sector,
      sizeBand: NEBULOZ_ASSESSMENT.sizeBand,
      deadline: d(NEBULOZ_ASSESSMENT.deadline),
    },
  });
  console.log(
    `  ✓ assessment ${assessment.code} (status ${assessment.status})`
  );

  const gapIdByCode = new Map<string, string>();
  for (const gap of NEBULOZ_GAPS) {
    const row = await db.meridianGap.upsert({
      where: { tenantId_code: { tenantId, code: gap.code } },
      create: {
        tenantId,
        code: gap.code,
        assessmentId: assessment.id,
        axis: gap.axis,
        statement: gap.statement,
        severity: gap.severity,
        effort: gap.effort,
        costOfDelay: gap.costOfDelay,
        confidence: gap.confidence,
        ownerLabel: gap.ownerLabel,
        derived: false,
      },
      update: {
        axis: gap.axis,
        statement: gap.statement,
        severity: gap.severity,
        effort: gap.effort,
        costOfDelay: gap.costOfDelay,
        confidence: gap.confidence,
        ownerLabel: gap.ownerLabel,
      },
    });
    gapIdByCode.set(gap.code, row.id);
  }
  console.log(`  ✓ ${NEBULOZ_GAPS.length} lacunas (upsert por código)`);

  for (const item of NEBULOZ_PLAN) {
    const gapId = gapIdByCode.get(item.gapCode);
    if (!gapId) {
      throw new Error(
        `Item de plano aponta para lacuna inexistente: ${item.gapCode}`
      );
    }
    await db.meridianPlanItem.upsert({
      where: {
        assessmentId_gapId: { assessmentId: assessment.id, gapId },
      },
      create: {
        tenantId,
        assessmentId: assessment.id,
        gapId,
        quarter: item.quarter,
        seq: item.seq,
        capacityNote: item.capacityNote,
      },
      update: {
        quarter: item.quarter,
        seq: item.seq,
        capacityNote: item.capacityNote,
      },
    });
  }
  console.log(`  ✓ ${NEBULOZ_PLAN.length} itens de plano (upsert por lacuna)`);

  let scoresWritten = 0;
  for (const axis of AXIS_IDS as readonly NebulozAxis[]) {
    const score = computeDeclaredAxisScore(axis);
    if (score === null) {
      console.log(`  · eixo ${axis} sem lacuna — nenhum score gravado`);
      continue;
    }
    await db.meridianAxisScore.upsert({
      where: { assessmentId_axis: { assessmentId: assessment.id, axis } },
      create: {
        tenantId,
        assessmentId: assessment.id,
        axis,
        computed: score,
        confidence: NEBULOZ_AXIS_SCORE_CONFIDENCE,
        respondentCount: 0,
        spread: 0,
        status: "COMPUTED",
        note: NEBULOZ_AXIS_SCORE_NOTE,
      },
      update: {
        computed: score,
        confidence: NEBULOZ_AXIS_SCORE_CONFIDENCE,
        note: NEBULOZ_AXIS_SCORE_NOTE,
      },
    });
    scoresWritten++;
  }
  console.log(`  ✓ ${scoresWritten} scores por eixo (regra declarada)`);

  const byAxis = new Map<string, number>();
  for (const gap of NEBULOZ_GAPS) {
    byAxis.set(gap.axis, (byAxis.get(gap.axis) ?? 0) + 1);
  }
  console.log(`
✅ Seed Meridian (Nebuloz real) concluído${templateCreated ? "" : " — template reaproveitado"}.

  Tenant:      ${tenant.slug}
  Assessment:  ${assessment.code} (${assessment.id})
  Lacunas por eixo:
${AXIS_IDS.map((axis) => `    ${axis}: ${byAxis.get(axis) ?? 0}`).join("\n")}
  Itens de plano: ${NEBULOZ_PLAN.length}
  Abrir: /meridian
`);

  await db.$disconnect();
  await pool.end();
}

const isEntrypoint =
  !!process.argv[1] &&
  import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;

if (isEntrypoint) {
  main().catch((err) => {
    console.error("❌ seed-meridian-nebuloz falhou:", err);
    process.exit(1);
  });
}
