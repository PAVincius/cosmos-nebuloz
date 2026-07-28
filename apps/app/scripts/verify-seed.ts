/**
 * verify-seed.ts — critério de sucesso executável do seed.
 *
 * Não testa código: testa que o BANCO SEMEADO contém o que cada tela e cada
 * fluxo precisam. Roda depois do seed. Sai com 1 se qualquer asserção falhar,
 * para poder entrar em CI.
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { Prisma, PrismaClient } from "../../../packages/database/generated";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const TENANT_SLUG = process.env.SEED_TENANT_SLUG ?? "cosmos-dev";

type Failure = { name: string; detail: string };
const failures: Failure[] = [];
let passed = 0;

async function check(name: string, fn: () => Promise<string | null>) {
  try {
    const detail = await fn();
    if (detail === null) {
      passed++;
    } else {
      failures.push({ name, detail });
    }
  } catch (error) {
    failures.push({
      name,
      detail: `lançou: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

// Helper: falha com contagem quando não há linha alguma.
// biome-ignore lint/correctness/noUnusedVariables: usado pelas asserções que as próximas tasks do plano de seed acrescentam a este arquivo.
async function expectRows(
  label: string,
  count: () => Promise<number>,
  min = 1
): Promise<string | null> {
  const n = await count();
  return n >= min ? null : `${label}: esperado >= ${min}, encontrado ${n}`;
}

async function main() {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: TENANT_SLUG },
    select: { id: true },
  });
  if (!tenant) {
    process.stdout.write(
      `FALHA: tenant "${TENANT_SLUG}" não existe. Rode o seed primeiro.\n`
    );
    process.exit(1);
  }
  const t = tenant.id;

  // ─── Task 1: papéis ────────────────────────────────────────────────────
  await check("os sete MemberRole têm usuário", async () => {
    const roles = ["ADMIN", "STE", "RTE", "SM", "PO", "DEV", "MEMBER"];
    const found = await prisma.tenantMember.findMany({
      where: { tenantId: t },
      select: { role: true },
    });
    const have = new Set(found.map((m) => m.role));
    const missing = roles.filter((r) => !have.has(r as never));
    return missing.length ? `papéis sem usuário: ${missing.join(", ")}` : null;
  });

  // As tasks seguintes acrescentam blocos aqui, na mesma forma.

  // ─── Task 2: integrations e tasks importadas ───────────────────────────
  await check("existe Integration ACTIVE", () =>
    expectRows("Integration ACTIVE", () =>
      prisma.integration.count({ where: { tenantId: t, status: "ACTIVE" } })
    )
  );

  await check("existe Integration não-ACTIVE", () =>
    expectRows("Integration inativa", () =>
      prisma.integration.count({
        where: { tenantId: t, status: { not: "ACTIVE" } },
      })
    )
  );

  await check("existe Task importada de provider conectado", async () => {
    const active = await prisma.integration.findMany({
      where: { tenantId: t, status: "ACTIVE" },
      select: { source: true },
    });
    const sources = active.map((i) => i.source);
    if (!sources.length) {
      return "nenhuma Integration ACTIVE para casar com Task";
    }
    const n = await prisma.task.count({
      where: { tenantId: t, externalSource: { in: sources } },
    });
    return n > 0
      ? null
      : `nenhuma Task com externalSource em ${sources.join("/")}`;
  });

  await check("existe Task importada de provider NÃO conectado", async () => {
    const active = await prisma.integration.findMany({
      where: { tenantId: t, status: "ACTIVE" },
      select: { source: true },
    });
    const sources = active.map((i) => i.source);
    const n = await prisma.task.count({
      where: {
        tenantId: t,
        externalSource: {
          not: null,
          notIn: sources.length ? sources : ["__none__"],
        },
      },
    });
    return n > 0 ? null : "nenhuma Task importada de provider desconectado";
  });

  await check("existe Task nativa com noteBlocks", () =>
    expectRows("Task nativa com nota", () =>
      prisma.task.count({
        where: {
          tenantId: t,
          externalSource: null,
          noteBlocks: { not: Prisma.DbNull },
        },
      })
    )
  );

  // ─── Task 3: cadeia completa do drill-down ─────────────────────────────
  await check("existe Epic → Feature → Story → Task completa", async () => {
    const epic = await prisma.epic.findFirst({
      where: {
        tenantId: t,
        features: { some: { stories: { some: { tasks: { some: {} } } } } },
      },
      select: { id: true, title: true },
    });
    return epic ? null : "nenhum Epic tem Feature com Story com Task";
  });

  await check("toda Feature semeada tem pelo menos uma Story", async () => {
    const n = await prisma.feature.count({
      where: { tenantId: t, stories: { none: {} } },
    });
    return n === 0 ? null : `${n} Feature(s) sem Story`;
  });

  await check("toda Story semeada tem pelo menos uma Task", async () => {
    const n = await prisma.story.count({
      where: { tenantId: t, tasks: { none: {} } },
    });
    return n === 0 ? null : `${n} Story(ies) sem Task`;
  });

  await check("existe Story com acceptanceCriteria preenchido", () =>
    expectRows("Story com AC", () =>
      prisma.story.count({
        where: { tenantId: t, acceptanceCriteria: { not: null } },
      })
    )
  );

  // ─── Relatório ─────────────────────────────────────────────────────────
  process.stdout.write(`\n${passed} asserções passaram\n`);
  if (failures.length) {
    process.stdout.write(`${failures.length} FALHARAM:\n`);
    for (const f of failures) {
      process.stdout.write(`  ✗ ${f.name}\n    ${f.detail}\n`);
    }
    await prisma.$disconnect();
    process.exit(1);
  }
  await prisma.$disconnect();
}

main().catch(async (error) => {
  process.stdout.write(`erro fatal: ${String(error)}\n`);
  await prisma.$disconnect();
  process.exit(1);
});
