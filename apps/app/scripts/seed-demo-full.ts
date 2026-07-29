/**
 * scripts/seed-demo-full.ts
 *
 * Cria hierarquia SAFe completa + 3 registros PAE demo para o tenant "cosmos-dev".
 *
 * Entidades criadas (idempotente — skip se já existe pelo nome):
 *   ART → Team → PIPlan → LeanBudget
 *   PIObjectives (3) → Sprints (3) → Stories (6) → Tasks (4) → Risks (2)
 *   AccessExceptionRequest (3 — deleteMany por tenantId antes de recriar)
 *
 * Uso:
 *   cd apps/app
 *   npx tsx scripts/seed-demo-full.ts
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@repo/database/generated/client";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });
const TENANT_SLUG = "cosmos-dev";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function skip(label: string) {
  console.log(`  ↩  skip  ${label} (já existe)`);
}

function created(label: string) {
  console.log(`  ✔  new   ${label}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("\n🌱 seed-demo-full — iniciando...\n");

  // Tenant
  const tenant = await db.tenant.findUnique({ where: { slug: TENANT_SLUG } });
  if (!tenant) {
    console.error(
      `❌ Tenant "${TENANT_SLUG}" não encontrado. Rode seed-admin.ts primeiro.`
    );
    process.exit(1);
  }
  const tenantId = tenant.id;
  console.log(`  tenant: ${tenant.name} (${tenantId})\n`);

  // Users needed for ownership / PAE
  const rteUser = await db.user.findUnique({
    where: { email: "rte@cosmos.demo" },
  });
  const smUser = await db.user.findUnique({
    where: { email: "sm@cosmos.demo" },
  });
  const devUser = await db.user.findUnique({
    where: { email: "dev@cosmos.demo" },
  });

  const rteUserId = rteUser?.id ?? null;
  const smUserId = smUser?.id ?? null;
  const devUserId = devUser?.id ?? null;

  // -------------------------------------------------------------------------
  // ART
  // -------------------------------------------------------------------------
  console.log("── ART");
  let art = await db.aRT.findFirst({ where: { tenantId, name: "COSMOS ART" } });
  if (art) {
    skip(`ART: ${art.name} (${art.id})`);
  } else {
    art = await db.aRT.create({
      data: {
        tenantId,
        name: "COSMOS ART",
        status: "ACTIVE",
        cadence: 10,
        piCadenceWeeks: 10,
        sprintLengthWeeks: 2,
      },
    });
    created(`ART: ${art.name} (${art.id})`);
  }
  const artId = art.id;

  // -------------------------------------------------------------------------
  // Team
  // -------------------------------------------------------------------------
  console.log("── Team");
  let team = await db.team.findFirst({
    where: { tenantId, name: "Team Nebula" },
  });
  if (team) {
    skip(`Team: ${team.name} (${team.id})`);
  } else {
    team = await db.team.create({
      data: {
        tenantId,
        artId,
        name: "Team Nebula",
        velocity: 40,
        sprintLengthDays: 14,
        members: [
          {
            name: "Diego Dev",
            role: "DEV",
            skills: ["TypeScript", "React"],
            hoursPerWeek: 40,
          },
          {
            name: "Sara SM",
            role: "SM",
            skills: ["Scrum", "SAFe"],
            hoursPerWeek: 40,
          },
        ],
      },
    });
    created(`Team: ${team.name} (${team.id})`);
  }
  const teamId = team.id;

  // -------------------------------------------------------------------------
  // PIPlan
  // -------------------------------------------------------------------------
  console.log("── PIPlan");
  let piPlan = await db.pIPlan.findFirst({
    where: { tenantId, name: "PI 2026-Q2" },
  });
  if (piPlan) {
    skip(`PIPlan: ${piPlan.name} (${piPlan.id})`);
  } else {
    piPlan = await db.pIPlan.create({
      data: {
        tenantId,
        artId,
        name: "PI 2026-Q2",
        status: "EXECUTING",
        startDate: new Date("2026-04-01"),
        endDate: new Date("2026-06-30"),
        velocity: 160,
      },
    });
    created(`PIPlan: ${piPlan.name} (${piPlan.id})`);
  }
  const piPlanId = piPlan.id;

  // -------------------------------------------------------------------------
  // LeanBudget — upsert on [artId, piPlanId]
  // -------------------------------------------------------------------------
  console.log("── LeanBudget");
  const leanBudget = await db.leanBudget.upsert({
    where: { artId_piPlanId: { artId, piPlanId } },
    update: {},
    create: {
      tenantId,
      artId,
      piPlanId,
      name: "Budget COSMOS ART Q2",
      amount: 500_000,
      capexPct: 60,
      opexPct: 40,
      period: "PI-2026-Q2",
      spentSource: "MANUAL",
    },
  });
  created(`LeanBudget: ${leanBudget.name} (${leanBudget.id})`);

  // -------------------------------------------------------------------------
  // PIObjectives
  // -------------------------------------------------------------------------
  console.log("── PIObjectives");
  const piObjDefs = [
    {
      title: "Entregar Risk Copilot GA",
      businessValue: 9,
      status: "IN_PROGRESS",
      plannedValue: 9,
      achievedValue: 4,
      isStretch: false,
    },
    {
      title: "Fechar compliance SOC2",
      businessValue: 8,
      status: "IN_PROGRESS",
      plannedValue: 8,
      achievedValue: 5,
      isStretch: false,
    },
    {
      title: "Lançar BPMN Editor em beta",
      businessValue: 7,
      status: "NOT_STARTED",
      plannedValue: 7,
      achievedValue: 0,
      isStretch: true,
    },
  ];

  for (const def of piObjDefs) {
    const existing = await db.pIObjective.findFirst({
      where: { tenantId, piPlanId, title: def.title },
    });
    if (existing) {
      skip(`PIObjective: ${def.title}`);
    } else {
      const obj = await db.pIObjective.create({
        data: {
          tenantId,
          piPlanId,
          teamId,
          title: def.title,
          businessValue: def.businessValue,
          isStretch: def.isStretch,
          status: def.status,
          plannedValue: def.plannedValue,
          achievedValue: def.achievedValue,
        },
      });
      created(`PIObjective: ${obj.title}`);
    }
  }

  // -------------------------------------------------------------------------
  // Sprints
  // -------------------------------------------------------------------------
  console.log("── Sprints");
  const sprintDefs = [
    {
      name: "Sprint 1",
      goal: "Risk score engine MVP",
      status: "CLOSED",
      startDate: new Date("2026-04-01"),
      endDate: new Date("2026-04-14"),
      velocity: 38,
    },
    {
      name: "Sprint 2",
      goal: "Dashboard riscos + BPMN editor",
      status: "ACTIVE",
      startDate: new Date("2026-04-15"),
      endDate: new Date("2026-04-28"),
      velocity: null,
    },
    {
      name: "Sprint 3",
      goal: "SAML SSO + SCIM",
      status: "PLANNING",
      startDate: new Date("2026-04-29"),
      endDate: new Date("2026-05-12"),
      velocity: null,
    },
  ] as const;

  const sprintIds: Record<string, string> = {};

  for (const def of sprintDefs) {
    let sprint = await db.sprint.findFirst({
      where: { tenantId, teamId, name: def.name },
    });
    if (sprint) {
      skip(`Sprint: ${sprint.name} (${sprint.id})`);
    } else {
      sprint = await db.sprint.create({
        data: {
          tenantId,
          teamId,
          piPlanId,
          name: def.name,
          goal: def.goal,
          status: def.status,
          startDate: def.startDate,
          endDate: def.endDate,
          velocity: def.velocity ?? undefined,
        },
      });
      created(`Sprint: ${sprint.name} (${sprint.id})`);
    }
    sprintIds[def.name] = sprint.id;
  }

  // -------------------------------------------------------------------------
  // Stories
  // -------------------------------------------------------------------------
  console.log("── Stories");

  // Try to resolve a featureId from any existing feature
  const anyFeature = await db.feature.findFirst({ where: { tenantId } });
  const featureId = anyFeature?.id ?? null;

  const sprint1Id = sprintIds["Sprint 1"];
  const sprint2Id = sprintIds["Sprint 2"];

  const storyDefs = [
    // Sprint 1 — DONE
    {
      title: "Implementar API de scoring",
      sprintId: sprint1Id,
      storyPoints: 8,
      status: "DONE",
    },
    {
      title: "Conectar historico ao engine",
      sprintId: sprint1Id,
      storyPoints: 5,
      status: "DONE",
    },
    {
      title: "Testes de integracao",
      sprintId: sprint1Id,
      storyPoints: 3,
      status: "DONE",
    },
    // Sprint 2 — mixed
    {
      title: "Dashboard de riscos por ART",
      sprintId: sprint2Id,
      storyPoints: 5,
      status: "IN_PROGRESS",
    },
    {
      title: "Alertas proativos de risco",
      sprintId: sprint2Id,
      storyPoints: 3,
      status: "TODO",
    },
    {
      title: "Editor BPMN base",
      sprintId: sprint2Id,
      storyPoints: 8,
      status: "IN_PROGRESS",
    },
  ];

  const storyIds: Record<string, string> = {};

  for (const def of storyDefs) {
    let story = await db.story.findFirst({
      where: { tenantId, sprintId: def.sprintId, title: def.title },
    });
    if (story) {
      skip(`Story: ${def.title}`);
    } else {
      story = await db.story.create({
        data: {
          tenantId,
          sprintId: def.sprintId,
          featureId,
          title: def.title,
          storyPoints: def.storyPoints,
          status: def.status,
        },
      });
      created(`Story: ${story.title} [${story.status}]`);
    }
    storyIds[def.title] = story.id;
  }

  // -------------------------------------------------------------------------
  // Tasks
  // -------------------------------------------------------------------------
  console.log("── Tasks");

  const taskDefs = [
    // Dashboard de riscos por ART
    {
      storyTitle: "Dashboard de riscos por ART",
      title: "Criar RiskHeatmap",
      status: "IN_PROGRESS",
      estimateHours: 8,
    },
    {
      storyTitle: "Dashboard de riscos por ART",
      title: "Query riscos piPlanId",
      status: "DONE",
      estimateHours: 4,
    },
    // Editor BPMN base
    {
      storyTitle: "Editor BPMN base",
      title: "Configurar bpmn-js",
      status: "DONE",
      estimateHours: 2,
    },
    {
      storyTitle: "Editor BPMN base",
      title: "Renderizar XML BPMN",
      status: "IN_PROGRESS",
      estimateHours: 6,
    },
  ];

  for (const def of taskDefs) {
    const storyId = storyIds[def.storyTitle];
    if (!storyId) {
      console.log(`  ⚠  skip Task "${def.title}" — story not found`);
      continue;
    }
    const existing = await db.task.findFirst({
      where: { tenantId, storyId, title: def.title },
    });
    if (existing) {
      skip(`Task: ${def.title}`);
    } else {
      const task = await db.task.create({
        data: {
          tenantId,
          storyId,
          title: def.title,
          status: def.status,
          estimateHours: def.estimateHours,
        },
      });
      created(`Task: ${task.title} [${task.status}]`);
    }
  }

  // -------------------------------------------------------------------------
  // Risks
  // -------------------------------------------------------------------------
  console.log("── Risks");

  const riskDefs = [
    {
      title: "Dependencia: API Risk Score instavel",
      roamStatus: "OWNED",
      severity: 4,
      category: "TECHNICAL",
      impact: "high",
      probability: "medium",
      ownerUserId: rteUserId,
    },
    {
      title: "Atraso sign-off compliance SOC2",
      roamStatus: "ACCEPTED",
      severity: 3,
      category: "COMPLIANCE",
      impact: "medium",
      probability: "high",
      ownerUserId: null,
    },
  ];

  for (const def of riskDefs) {
    const existing = await db.risk.findFirst({
      where: { tenantId, piPlanId, title: def.title },
    });
    if (existing) {
      skip(`Risk: ${def.title}`);
    } else {
      const risk = await db.risk.create({
        data: {
          tenantId,
          piPlanId,
          title: def.title,
          roamStatus: def.roamStatus,
          severity: def.severity,
          category: def.category,
          impact: def.impact,
          probability: def.probability,
          ownerUserId: def.ownerUserId ?? undefined,
        },
      });
      created(`Risk: ${risk.title} [${risk.roamStatus}]`);
    }
  }

  // -------------------------------------------------------------------------
  // AccessExceptionRequest — deleteMany first, then recreate
  // -------------------------------------------------------------------------
  console.log("── AccessExceptionRequest (PAE)");

  await db.accessExceptionRequest.deleteMany({ where: { tenantId } });
  console.log("  ⟳  cleared existing PAE records for tenant");

  if (devUserId && smUserId && rteUserId) {
    const paeDefs = [
      // PENDING
      {
        requesterId: devUserId,
        entityType: "epic",
        action: "create",
        justification:
          "Preciso criar epico de spike para CRDT offline-first antes do Sprint 3",
        duration: "4h",
        status: "PENDING",
        approverId: null,
        approvedAt: null,
        expiresAt: null,
      },
      // APPROVED
      {
        requesterId: smUserId,
        entityType: "epic",
        action: "update",
        justification: "SM precisa ajustar epico SAML SSO para PI review",
        duration: "1h",
        status: "APPROVED",
        approverId: rteUserId,
        approvedAt: new Date(Date.now() - 30 * 60 * 1000),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
      // DENIED
      {
        requesterId: devUserId,
        entityType: "feature",
        action: "create",
        justification: "Criar feature exportacao CSV no PI Planning",
        duration: "8h",
        status: "DENIED",
        approverId: rteUserId,
        approvedAt: null,
        expiresAt: null,
      },
    ];

    for (const def of paeDefs) {
      const req = await db.accessExceptionRequest.create({
        data: {
          tenantId,
          requesterId: def.requesterId,
          entityType: def.entityType,
          action: def.action,
          justification: def.justification,
          duration: def.duration,
          status: def.status,
          approverId: def.approverId ?? undefined,
          approvedAt: def.approvedAt ?? undefined,
          expiresAt: def.expiresAt ?? undefined,
        },
      });
      created(
        `PAE [${req.status}]: ${req.entityType}::${req.action} by ${def.requesterId.slice(0, 8)}…`
      );
    }
  } else {
    console.warn(
      "  ⚠  Personas não encontradas — PAE records requerem seed-personas.ts primeiro."
    );
    console.warn(
      `     devUserId=${devUserId} smUserId=${smUserId} rteUserId=${rteUserId}`
    );
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log("\n─────────────────────────────────────────────────────────");
  console.log("🎉 seed-demo-full concluído!\n");

  const counts = await Promise.all([
    db.aRT.count({ where: { tenantId } }),
    db.team.count({ where: { tenantId } }),
    db.pIPlan.count({ where: { tenantId } }),
    db.leanBudget.count({ where: { tenantId } }),
    db.pIObjective.count({ where: { tenantId } }),
    db.sprint.count({ where: { tenantId } }),
    db.story.count({ where: { tenantId } }),
    db.task.count({ where: { tenantId } }),
    db.risk.count({ where: { tenantId } }),
    db.accessExceptionRequest.count({ where: { tenantId } }),
  ]);

  const labels = [
    "ARTs",
    "Teams",
    "PIPlans",
    "LeanBudgets",
    "PIObjectives",
    "Sprints",
    "Stories",
    "Tasks",
    "Risks",
    "PAE Requests",
  ];

  for (let i = 0; i < labels.length; i++) {
    console.log(`  ${labels[i].padEnd(16)} ${counts[i]}`);
  }
  console.log("─────────────────────────────────────────────────────────\n");

  await db.$disconnect();
  await pool.end();
}

// Guarda de entrypoint: sem ela, um `import` deste módulo roda o seed.
const isEntrypoint =
  !!process.argv[1] &&
  import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;

if (isEntrypoint) {
  main().catch((err) => {
    console.error("❌ Seed falhou:", err);
    process.exit(1);
  });
}
