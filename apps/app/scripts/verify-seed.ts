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
import { PrismaClient } from "../../../packages/database/generated";
import { parseTaskBlocks } from "../app/(cosmos)/actions/epic-tree.constants";

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

  // Contrato real é o da UI (parseTaskBlocks), não "coluna não é SQL NULL":
  // um noteBlocks presente mas corrompido passaria numa checagem de nulidade
  // e a UI abriria a nota mostrando os blocos padrão em silêncio.
  await check(
    "existe Task nativa com noteBlocks que a UI consegue ler",
    async () => {
      const rows = await prisma.task.findMany({
        where: { tenantId: t, externalSource: null },
        select: { noteBlocks: true },
      });
      const n = rows.filter(
        (r) => parseTaskBlocks(r.noteBlocks) !== null
      ).length;
      return n > 0
        ? null
        : "nenhuma Task nativa tem noteBlocks que passe em parseTaskBlocks";
    }
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

  // ─── Task 4: Large Solution ────────────────────────────────────────────
  for (const [label, count] of [
    [
      "SolutionTrain",
      () => prisma.solutionTrain.count({ where: { tenantId: t } }),
    ],
    ["Capability", () => prisma.capability.count({ where: { tenantId: t } })],
    ["LACE", () => prisma.lACE.count({ where: { tenantId: t } })],
    ["Supplier", () => prisma.supplier.count({ where: { tenantId: t } })],
    [
      "SolutionRisk",
      () => prisma.solutionRisk.count({ where: { tenantId: t } }),
    ],
  ] as const) {
    await check(`${label} semeado`, () => expectRows(label, count));
  }

  await check("Capability ligada a Feature", () =>
    expectRows("Feature com capabilityId", () =>
      prisma.feature.count({
        where: { tenantId: t, capabilityId: { not: null } },
      })
    )
  );

  // ─── Task 5: Estratégia, horizontes e roadmap ──────────────────────────
  for (const [label, count] of [
    [
      "StrategyPillar",
      () => prisma.strategyPillar.count({ where: { tenantId: t } }),
    ],
    [
      "InvestmentHorizon",
      () => prisma.investmentHorizon.count({ where: { tenantId: t } }),
    ],
    ["RoadmapItem", () => prisma.roadmapItem.count({ where: { tenantId: t } })],
    [
      "EpicValueMetric",
      () => prisma.epicValueMetric.count({ where: { tenantId: t } }),
    ],
  ] as const) {
    await check(`${label} semeado`, () => expectRows(label, count));
  }

  await check("StrategicTheme ligada a StrategyPillar", () =>
    expectRows("StrategicTheme com pillarId", () =>
      prisma.strategicTheme.count({
        where: { tenantId: t, pillarId: { not: null } },
      })
    )
  );

  await check("existe Epic com EpicValueMetric", async () => {
    const metrics = await prisma.epicValueMetric.findMany({
      where: { tenantId: t },
      select: { epicId: true },
    });
    if (!metrics.length) {
      return "nenhuma EpicValueMetric semeada";
    }
    const epicIds = metrics.map((m) => m.epicId);
    const n = await prisma.epic.count({
      where: { tenantId: t, id: { in: epicIds } },
    });
    return n > 0 ? null : "nenhum Epic corresponde a epicId de EpicValueMetric";
  });

  await check(
    "existe EpicValueMetric com plannedValue e actualValue divergentes",
    async () => {
      // Prisma não compara duas colunas diretamente em `where`; busca em
      // memória para a divergência real.
      const rows = await prisma.epicValueMetric.findMany({
        where: { tenantId: t, actualValue: { not: null } },
        select: { plannedValue: true, actualValue: true },
      });
      const diverges = rows.some((r) => r.actualValue !== r.plannedValue);
      return diverges
        ? null
        : `nenhuma EpicValueMetric com actualValue != plannedValue (checadas ${rows.length})`;
    }
  );

  await check("LeanBudget referencia InvestmentHorizon", () =>
    expectRows("LeanBudget com horizonId", () =>
      prisma.leanBudget.count({
        where: { tenantId: t, horizonId: { not: null } },
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
