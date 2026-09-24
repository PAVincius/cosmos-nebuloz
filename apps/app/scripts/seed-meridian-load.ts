/**
 * scripts/seed-meridian-load.ts
 *
 * M10 do roteiro (docs/qualidade/dogfood/meridian/roteiro.md): 200
 * assessments / 2.000 gaps, só pra medir tempo de resposta da carteira
 * (`/meridian`) e do registro de gaps (`/meridian/registry`) sob carga
 * (SC-010, < 2s). Script separado do `seed-meridian.ts` de propósito — este
 * é sujeira de volume pra descartar, não fixture determinística pro E2E
 * funcional; misturar os dois faria um `pnpm seed:meridian` normal arrastar
 * 2.000 gaps sem necessidade, ou o load apagar dados que o dogfood depende.
 *
 *   pnpm seed:meridian:load                → tenant "techcorp-sa" (dedicado,
 *                                             módulo MERIDIAN não usado por
 *                                             nenhum outro seed)
 *   pnpm seed:meridian:load outro-slug     → outro tenant
 *
 * Idempotente: apaga e recria só os assessments/gaps com prefixo `LOAD-`
 * deste tenant a cada corrida — não toca em nada que outro seed tenha
 * criado no mesmo tenant.
 */

import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { PrismaPg } from "@prisma/adapter-pg";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { Pool } from "pg";
import type {
  MeridianAxis,
  PrismaClient as PrismaClientType,
} from "../../../packages/database/generated";
import { PrismaClient } from "../../../packages/database/generated";
import { assertLocalDatabaseUrl, pinPersonaToTenant } from "./seed-meridian";

const TENANT_SLUG = process.argv[2] ?? "techcorp-sa";
const ASSESSMENT_COUNT = 200;
const GAPS_PER_ASSESSMENT = 10; // 200 × 10 = 2.000
const PERSONA_EMAIL = "carga.performance@nebuloz.exemplo";
const PERSONA_PASSWORD = process.env.MERIDIAN_SEED_PASSWORD ?? "meridian123";
const AXES: MeridianAxis[] = [
  "DATA",
  "PROCESS",
  "PEOPLE",
  "GOVERNANCE",
  "INFRASTRUCTURE",
];
const SEVERITIES = ["HIGH", "MEDIUM", "LOW"] as const;
const EFFORTS = ["S", "M", "L"] as const;

async function main() {
  assertLocalDatabaseUrl(process.env.DATABASE_URL);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({
    adapter: new PrismaPg(pool),
  }) as PrismaClientType;

  const tenant = await db.tenant.findUnique({
    where: { slug: TENANT_SLUG },
  });
  if (!tenant) {
    throw new Error(
      `Tenant "${TENANT_SLUG}" não encontrado. Slugs disponíveis: ${(
        await db.tenant.findMany({ select: { slug: true } })
      )
        .map((t) => t.slug)
        .join(", ")}`
    );
  }
  const tenantId = tenant.id;

  console.log(
    `\n🧱  Seed de carga Meridian → ${tenant.name} (${tenant.slug})\n`
  );

  await db.tenantModule.upsert({
    where: { tenantId_module: { tenantId, module: "MERIDIAN" } },
    create: {
      tenantId,
      module: "MERIDIAN",
      status: "ACTIVE",
      contractedAt: new Date("2026-01-01"),
    },
    update: { status: "ACTIVE" },
  });

  const user = await db.user.upsert({
    where: { email: PERSONA_EMAIL },
    create: {
      email: PERSONA_EMAIL,
      name: "Carga Performance",
      emailVerified: true,
    },
    update: {},
  });
  await db.tenantMember.upsert({
    where: { tenantId_userId: { tenantId, userId: user.id } },
    create: { tenantId, userId: user.id, role: "MEMBER" },
    update: {},
  });
  await db.meridianMembership.upsert({
    where: { tenantId_userId: { tenantId, userId: user.id } },
    create: { tenantId, userId: user.id, role: "CONSULTANT" },
    update: { role: "CONSULTANT" },
  });
  // Persona dedicada a este tenant — nunca compartilhada com seed-meridian.ts,
  // então não há risco de `pinPersonaToTenant` arrancar a sessão de outro
  // seed (o motivo do atrito que essa função corrige em 509071e7).
  await pinPersonaToTenant(db, user.id, tenantId);

  const auth = betterAuth({
    database: prismaAdapter(db, { provider: "postgresql" }),
    emailAndPassword: { enabled: true },
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3012",
  });
  const passwordHash = await (await auth.$context).password.hash(
    PERSONA_PASSWORD
  );
  const existingAccount = await db.account.findFirst({
    where: { accountId: PERSONA_EMAIL, providerId: "credential" },
    select: { id: true },
  });
  if (existingAccount) {
    await db.account.update({
      where: { id: existingAccount.id },
      data: { password: passwordHash },
    });
  } else {
    await db.account.create({
      data: {
        accountId: PERSONA_EMAIL,
        providerId: "credential",
        userId: user.id,
        password: passwordHash,
      },
    });
  }
  console.log(`  ✓ persona de carga (senha: ${PERSONA_PASSWORD})`);

  const template = await db.meridianTemplate.upsert({
    where: { tenantId_version: { tenantId, version: "v-load" } },
    create: {
      tenantId,
      name: "Bateria de carga (sintética)",
      version: "v-load",
      lockedAt: new Date(),
    },
    update: {},
  });

  // Limpeza — só o que este script cria (prefixo LOAD-), respeitando FK
  // (gap antes de assessment, Restrict).
  const previous = await db.meridianAssessment.findMany({
    where: { tenantId, code: { startsWith: "LOAD-" } },
    select: { id: true },
  });
  const previousIds = previous.map((a) => a.id);
  if (previousIds.length > 0) {
    await db.meridianGap.deleteMany({
      where: { tenantId, assessmentId: { in: previousIds } },
    });
    await db.meridianAssessment.deleteMany({
      where: { id: { in: previousIds } },
    });
  }
  console.log(
    `  ✓ ${previousIds.length} assessment(s) de carga anteriores removidos`
  );

  const assessmentsData = Array.from({ length: ASSESSMENT_COUNT }, (_, i) => ({
    tenantId,
    code: `LOAD-${String(i + 1).padStart(4, "0")}`,
    orgName: `Carga Sintética ${i + 1}`,
    sector: "Carga",
    sizeBand: "n/a",
    templateId: template.id,
    status: "COLLECTING" as const,
    consultantId: user.id,
    deadline: new Date(Date.now() + 60 * 86_400_000),
    benchmarkOptIn: false,
  }));

  const createdAssessments = await db.meridianAssessment.createManyAndReturn({
    data: assessmentsData,
    select: { id: true },
  });
  console.log(`  ✓ ${createdAssessments.length} assessments criados`);

  const gapsData = createdAssessments.flatMap((a, ai) =>
    Array.from({ length: GAPS_PER_ASSESSMENT }, (_, gi) => ({
      tenantId,
      code: `LOAD-${String(ai + 1).padStart(4, "0")}-G${gi + 1}`,
      assessmentId: a.id,
      axis: AXES[gi % AXES.length],
      statement: `Gap sintético ${gi + 1} do assessment de carga ${ai + 1}.`,
      severity: SEVERITIES[gi % SEVERITIES.length],
      effort: EFFORTS[gi % EFFORTS.length],
      costOfDelay: (gi * 7) % 100,
      ownerLabel: "Dono sintético",
      derived: false,
    }))
  );

  const BATCH = 500;
  let gapsCreated = 0;
  for (let i = 0; i < gapsData.length; i += BATCH) {
    const batch = gapsData.slice(i, i + BATCH);
    const res = await db.meridianGap.createMany({ data: batch });
    gapsCreated += res.count;
  }
  console.log(`  ✓ ${gapsCreated} gaps criados`);

  console.log("\n✅ Seed de carga concluído.");
  console.log(`  Login:  ${PERSONA_EMAIL} / ${PERSONA_PASSWORD}`);
  console.log("  Abrir:  /meridian e /meridian/registry\n");

  await db.$disconnect();
}

main().catch((err) => {
  console.error("❌ seed-meridian-load falhou:", err);
  process.exit(1);
});
