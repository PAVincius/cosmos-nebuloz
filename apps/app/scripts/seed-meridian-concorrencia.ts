/**
 * scripts/seed-meridian-concorrencia.ts
 *
 * Fixture pro k6 de concorrência do Meridian (SC-011, T006-T008 da spec 007
 * — escopo ajustado pelo Norte: dois cenários de pico, consultores e onda de
 * respondentes, não só PI Planning). Planta:
 *
 *   - persona consultora (login por senha, pro cenário "consultores")
 *   - um assessment com N respondentes já atribuídos, token em claro
 *     conhecido (pro cenário "respondentes" — k6 não navega, só faz HTTP puro
 *     com o token, então precisa dele de antemão)
 *
 * Escreve os tokens em `apps/app/load/k6/.fixtures/meridian-concorrencia.json` — arquivo
 * local, gitignorado (`.gitignore`), nunca comitado.
 *
 *   pnpm seed:meridian:concorrencia                → tenant "cosmos-dev", 200 respondentes
 *   pnpm seed:meridian:concorrencia outro-slug 500  → outro tenant, outro N
 *
 * Idempotente: apaga e recria só o que este script criou (prefixo `CONC-`
 * no template/assessment/respondentes) — não toca em nada de outro seed.
 */

import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  MERIDIAN_BATTERY,
  MERIDIAN_TEMPLATE_NAME,
} from "@repo/provisioning/src/meridian";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { Pool } from "pg";
import type {
  MeridianAxis,
  PrismaClient as PrismaClientType,
} from "../../../packages/database/generated";
import { PrismaClient } from "../../../packages/database/generated";
import { hashToken, issueToken } from "../lib/meridian/respondent-token";
import { findServerActionId } from "../load/k6/find-action-id";
import { assertLocalDatabaseUrl, pinPersonaToTenant } from "./seed-meridian";

const TENANT_SLUG = process.argv[2] ?? "cosmos-dev";
const RESPONDENT_COUNT = Number(process.argv[3] ?? 200);
const PERSONA_EMAIL = "carga.concorrencia@nebuloz.exemplo";
const PERSONA_PASSWORD = process.env.MERIDIAN_SEED_PASSWORD ?? "meridian123";
const AXES: MeridianAxis[] = [
  "DATA",
  "PROCESS",
  "PEOPLE",
  "GOVERNANCE",
  "INFRASTRUCTURE",
];
const OUTPUT_PATH = "../load/k6/.fixtures/meridian-concorrencia.json";

async function main() {
  assertLocalDatabaseUrl(process.env.DATABASE_URL);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({
    adapter: new PrismaPg(pool),
  }) as PrismaClientType;

  const tenant = await db.tenant.findUnique({ where: { slug: TENANT_SLUG } });
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
    `\n🌊  Seed de concorrência Meridian → ${tenant.name} (${tenant.slug}), ${RESPONDENT_COUNT} respondentes\n`
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

  // Persona consultora — cenário "consultores" faz login por senha com ela.
  const user = await db.user.upsert({
    where: { email: PERSONA_EMAIL },
    create: {
      email: PERSONA_EMAIL,
      name: "Carga Concorrência",
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
  console.log(`  ✓ persona consultora (senha: ${PERSONA_PASSWORD})`);

  // Limpeza — só o que este script cria (versão "v-concorrencia"), respeitando FK.
  const previousTemplate = await db.meridianTemplate.findUnique({
    where: { tenantId_version: { tenantId, version: "v-concorrencia" } },
    select: { id: true },
  });
  if (previousTemplate) {
    const previousAssessments = await db.meridianAssessment.findMany({
      where: { tenantId, templateId: previousTemplate.id },
      select: { id: true },
    });
    const ids = previousAssessments.map((a) => a.id);
    if (ids.length > 0) {
      await db.meridianResponse.deleteMany({
        where: { tenantId, respondent: { assessmentId: { in: ids } } },
      });
      await db.meridianRespondent.deleteMany({
        where: { tenantId, assessmentId: { in: ids } },
      });
      await db.meridianAssessment.deleteMany({ where: { id: { in: ids } } });
    }
    await db.meridianQuestion.deleteMany({
      where: { templateId: previousTemplate.id },
    });
    await db.meridianTemplate.delete({ where: { id: previousTemplate.id } });
  }
  console.log("  ✓ corrida anterior de concorrência removida");

  const template = await db.meridianTemplate.create({
    data: {
      tenantId,
      name: `${MERIDIAN_TEMPLATE_NAME} (carga)`,
      version: "v-concorrencia",
      lockedAt: new Date(),
    },
  });
  for (const q of MERIDIAN_BATTERY) {
    await db.meridianQuestion.create({
      data: {
        tenantId,
        templateId: template.id,
        code: q.code,
        axis: q.axis,
        ordinal: q.ordinal,
        type: q.type,
        text: q.text,
        weight: q.weight,
        inverted: q.inverted,
        scaleLabels: q.scaleLabels,
      },
    });
  }
  const questionRows = await db.meridianQuestion.findMany({
    where: { templateId: template.id },
    select: { id: true, axis: true },
  });
  console.log(`  ✓ template de carga · ${questionRows.length} perguntas`);

  const deadline = new Date(Date.now() + 60 * 86_400_000);
  const assessment = await db.meridianAssessment.create({
    data: {
      tenantId,
      code: "CONC-001",
      orgName: "Carga de Concorrência (sintético)",
      sector: "Carga",
      sizeBand: "n/a",
      templateId: template.id,
      status: "COLLECTING",
      consultantId: user.id,
      deadline,
      benchmarkOptIn: false,
    },
  });

  const respondents: {
    token: string;
    axis: MeridianAxis;
    respondentId: string;
  }[] = [];
  for (let i = 0; i < RESPONDENT_COUNT; i++) {
    const axis = AXES[i % AXES.length];
    const token = issueToken();
    const r = await db.meridianRespondent.create({
      data: {
        tenantId,
        assessmentId: assessment.id,
        name: `Respondente de carga ${i + 1}`,
        role: "Carga sintética",
        email: `carga-respondente-${i + 1}@nebuloz.exemplo`,
        axis,
        status: "INVITED",
        tokenHash: hashToken(token),
        tokenExpiresAt: deadline,
      },
      select: { id: true },
    });
    respondents.push({ token, axis, respondentId: r.id });
  }
  console.log(`  ✓ ${respondents.length} respondentes criados (CONC-001)`);

  const questionsByAxis = new Map<MeridianAxis, string[]>();
  for (const q of questionRows) {
    const list = questionsByAxis.get(q.axis) ?? [];
    list.push(q.id);
    questionsByAxis.set(q.axis, list);
  }

  // O id da action muda a cada build; sem o manifesto (app ainda não compilou
  // a tela do respondente) o fixture sai sem ele e o k6 recusa rodar com uma
  // mensagem que manda repetir o seed.
  let saveDraftActionId: string | null = null;
  try {
    saveDraftActionId = findServerActionId(
      "saveDraft",
      "(meridian)/actions/respondent"
    );
  } catch (err) {
    console.warn(
      `  ! ${err instanceof Error ? err.message : String(err)}\n    Fixture gravado sem saveDraftActionId.`
    );
  }

  const output = {
    generatedAt: new Date().toISOString(),
    saveDraftActionId,
    tenantSlug: tenant.slug,
    assessmentId: assessment.id,
    consultant: { email: PERSONA_EMAIL, password: PERSONA_PASSWORD },
    questionsByAxis: Object.fromEntries(questionsByAxis),
    respondents,
  };
  const outPath = new URL(OUTPUT_PATH, import.meta.url).pathname;
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`  ✓ fixture escrita em ${outPath}`);

  console.log("\n✅ Seed de concorrência concluído.\n");
  await db.$disconnect();
}

main().catch((err) => {
  console.error("❌ seed-meridian-concorrencia falhou:", err);
  process.exit(1);
});
