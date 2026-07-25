/**
 * Adiciona OKRs de múltiplos tipos SAFe para demonstrar a view de Árvore.
 *
 * Uso:
 *   cd apps/app
 *   npx tsx scripts/seed-okr-tree-demo.ts
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../../../packages/database/generated";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const tenant = await db.tenant.findUnique({ where: { slug: "cosmos-dev" } });
  if (!tenant) {
    console.error("Tenant cosmos-dev não encontrado. Rode seed:e2e primeiro.");
    process.exit(1);
  }
  const T = tenant.id;

  const [piPlan, team, art] = await Promise.all([
    db.pIPlan.findFirst({ where: { tenantId: T } }),
    db.team.findFirst({ where: { tenantId: T } }),
    db.aRT.findFirst({ where: { tenantId: T } }),
  ]);

  // Remove OKRs não-tema anteriores (limpeza)
  await db.keyResult.deleteMany({
    where: { tenantId: T, okr: { type: { not: "portfolio_theme" } } },
  });
  await db.oKR.deleteMany({
    where: { tenantId: T, type: { not: "portfolio_theme" } },
  });

  // ── pi_art — OKR ligado a um PI + ART ──────────────────────────────────────
  if (piPlan && art) {
    const okr = await db.oKR.create({
      data: {
        tenantId: T,
        type: "pi_art",
        piPlanId: piPlan.id,
        artId: art.id,
        title: "Entregar Portfolio Kanban + OKRs no PI 2026-Q2",
        status: "ON_TRACK",
        horizon: piPlan.name,
      },
    });
    await db.keyResult.createMany({
      data: [
        {
          tenantId: T,
          okrId: okr.id,
          title: "Features entregues no PI",
          current: 3,
          target: 4,
          unit: "features",
        },
        {
          tenantId: T,
          okrId: okr.id,
          title: "Predictability do PI",
          current: 80,
          target: 85,
          unit: "%",
        },
      ],
    });
    console.log("✓ OKR pi_art criado");
  }

  // ── team_pi — OKR de time dentro de um PI ──────────────────────────────────
  if (piPlan && team) {
    const okr = await db.oKR.create({
      data: {
        tenantId: T,
        type: "team_pi",
        piPlanId: piPlan.id,
        teamId: team.id,
        title: `Aumentar velocidade do ${team.name} em 20%`,
        status: "AT_RISK",
        horizon: piPlan.name,
      },
    });
    await db.keyResult.createMany({
      data: [
        {
          tenantId: T,
          okrId: okr.id,
          title: "Velocity média por sprint",
          current: 32,
          target: 48,
          unit: "SP",
        },
        {
          tenantId: T,
          okrId: okr.id,
          title: "Bug escape rate",
          current: 8,
          target: 3,
          unit: "bugs/sprint",
        },
      ],
    });
    console.log("✓ OKR team_pi criado");
  }

  // ── improvement — OKR de melhoria contínua ─────────────────────────────────
  const okrImpr = await db.oKR.create({
    data: {
      tenantId: T,
      type: "improvement",
      scope: "portfolio",
      title: "Reduzir tempo de ciclo de deploy para < 10 min",
      status: "BEHIND",
      horizon: "2026",
    },
  });
  await db.keyResult.createMany({
    data: [
      {
        tenantId: T,
        okrId: okrImpr.id,
        title: "Tempo médio de deploy",
        current: 24,
        target: 10,
        unit: "min",
      },
      {
        tenantId: T,
        okrId: okrImpr.id,
        title: "Taxa de sucesso de deploy",
        current: 78,
        target: 99,
        unit: "%",
      },
    ],
  });
  console.log("✓ OKR improvement criado");

  console.log(
    "\n🎉 OKRs de demonstração criados! Acesse /portfolio/okrs e mude para view Árvore.\n"
  );
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
