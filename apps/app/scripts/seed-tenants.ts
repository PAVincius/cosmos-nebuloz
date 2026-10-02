/**
 * scripts/seed-tenants.ts
 *
 * Popula o banco com 4 tenants em planos distintos para testar feature flags.
 *
 * Tenants criados:
 *   UNIVERSE  → Nebuloz          (admin@nebuloz.ai)
 *   NEBULA    → TechCorp SA      (admin@techcorp.com)
 *   GALAXY    → Startup XP       (admin@startupxp.com)
 *   ORBIT     → AgileFirst       (admin@agilefirst.com)
 *
 * Uso:
 *   cd apps/app
 *   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/cosmos_dev" \
 *   BETTER_AUTH_SECRET="cosmos-dev-secret-key-min-32-chars-placeholder" \
 *   BETTER_AUTH_URL="http://localhost:3000" \
 *   npx tsx scripts/seed-tenants.ts
 */

import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@repo/database/generated/client";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: { enabled: true },
  session: {
    additionalFields: {
      activeTenantId: { type: "string", nullable: true, input: false },
    },
  },
  secret:
    process.env.BETTER_AUTH_SECRET ??
    "cosmos-dev-secret-key-min-32-chars-placeholder",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
});

// ── Tenant definitions ────────────────────────────────────────────

type TenantDef = {
  name: string;
  slug: string;
  plan: "ORBIT" | "GALAXY" | "NEBULA" | "UNIVERSE";
  adminEmail: string;
  adminName: string;
  password: string;
  arts: ArtDef[];
};

type ArtDef = {
  name: string;
  cadence: number;
  pis: PIDef[];
};

type PIDef = {
  name: string;
  startDate: Date;
  endDate: Date;
};

const now = new Date();
const addWeeks = (d: Date, w: number) =>
  new Date(d.getTime() + w * 7 * 24 * 60 * 60 * 1000);

const TENANTS: TenantDef[] = [
  {
    name: "Nebuloz",
    slug: "nebuloz",
    plan: "UNIVERSE",
    adminEmail: "admin@nebuloz.ai",
    adminName: "Vinicius Prates",
    password: "Nebuloz@2026!",
    arts: [
      {
        name: "Platform ART",
        cadence: 10,
        pis: [
          {
            name: "PI-1 · Foundation",
            startDate: addWeeks(now, -20),
            endDate: addWeeks(now, -10),
          },
          { name: "PI-2 · Scale", startDate: addWeeks(now, -10), endDate: now },
          {
            name: "PI-3 · AI Layer",
            startDate: now,
            endDate: addWeeks(now, 10),
          },
        ],
      },
      {
        name: "Product ART",
        cadence: 10,
        pis: [
          {
            name: "PI-1 · MVP",
            startDate: addWeeks(now, -20),
            endDate: addWeeks(now, -10),
          },
          {
            name: "PI-2 · Growth",
            startDate: addWeeks(now, -10),
            endDate: now,
          },
        ],
      },
      {
        name: "DevOps ART",
        cadence: 10,
        pis: [
          {
            name: "PI-1 · Pipeline",
            startDate: addWeeks(now, -15),
            endDate: addWeeks(now, -5),
          },
          {
            name: "PI-2 · Observability",
            startDate: addWeeks(now, -5),
            endDate: addWeeks(now, 5),
          },
        ],
      },
    ],
  },
  {
    name: "TechCorp SA",
    slug: "techcorp-sa",
    plan: "NEBULA",
    adminEmail: "admin@techcorp.com",
    adminName: "Roberto Almeida",
    password: "TechCorp@2026!",
    arts: [
      {
        name: "Digital Transformation ART",
        cadence: 10,
        pis: [
          {
            name: "PI-1 · Discovery",
            startDate: addWeeks(now, -10),
            endDate: now,
          },
          {
            name: "PI-2 · Delivery",
            startDate: now,
            endDate: addWeeks(now, 10),
          },
        ],
      },
      {
        name: "Data Platform ART",
        cadence: 10,
        pis: [
          {
            name: "PI-1 · Ingestion",
            startDate: addWeeks(now, -10),
            endDate: now,
          },
        ],
      },
      {
        name: "Mobile ART",
        cadence: 10,
        pis: [
          {
            name: "PI-1 · Beta",
            startDate: addWeeks(now, -8),
            endDate: addWeeks(now, 2),
          },
        ],
      },
    ],
  },
  {
    name: "Startup XP",
    slug: "startup-xp",
    plan: "GALAXY",
    adminEmail: "admin@startupxp.com",
    adminName: "Camila Souza",
    password: "StartupXP@2026!",
    arts: [
      {
        name: "Core ART",
        cadence: 10,
        pis: [
          {
            name: "PI-1 · Launch",
            startDate: addWeeks(now, -5),
            endDate: addWeeks(now, 5),
          },
        ],
      },
    ],
  },
  {
    name: "AgileFirst",
    slug: "agilefirst",
    plan: "ORBIT",
    adminEmail: "admin@agilefirst.com",
    adminName: "Pedro Lima",
    password: "Agile@2026!",
    arts: [
      {
        name: "Engineering ART",
        cadence: 10,
        pis: [
          {
            name: "PI-1 · Kickoff",
            startDate: now,
            endDate: addWeeks(now, 10),
          },
        ],
      },
    ],
  },
];

// ── Epic/Feature seed data per plan ─────────────────────────────

type EpicSeed = {
  title: string;
  statusId: string;
  features: FeatureSeed[];
};

type FeatureSeed = {
  title: string;
  statusId: string;
  bv: number;
  tc: number;
  rr: number;
  js: number;
};

const EPIC_DATA: Record<string, EpicSeed[]> = {
  UNIVERSE: [
    {
      title: "AI-Powered Risk Management",
      statusId: "IN_PROGRESS",
      features: [
        {
          title: "pgvector semantic search for risks",
          statusId: "DONE",
          bv: 9,
          tc: 8,
          rr: 7,
          js: 3,
        },
        {
          title: "Risk recommendation copilot UI",
          statusId: "IN_PROGRESS",
          bv: 8,
          tc: 7,
          rr: 9,
          js: 5,
        },
        {
          title: "Historical embedding pipeline",
          statusId: "BACKLOG",
          bv: 7,
          tc: 5,
          rr: 8,
          js: 4,
        },
      ],
    },
    {
      title: "Real-time Portfolio Collaboration",
      statusId: "IN_PROGRESS",
      features: [
        {
          title: "Yjs CRDT Kanban sync",
          statusId: "DONE",
          bv: 10,
          tc: 9,
          rr: 5,
          js: 8,
        },
        {
          title: "Presence indicators",
          statusId: "IN_PROGRESS",
          bv: 7,
          tc: 6,
          rr: 3,
          js: 2,
        },
        {
          title: "Conflict resolution UI",
          statusId: "BACKLOG",
          bv: 6,
          tc: 5,
          rr: 4,
          js: 3,
        },
      ],
    },
    {
      title: "Solution Train Coordination",
      statusId: "BACKLOG",
      features: [
        {
          title: "STE dashboard",
          statusId: "BACKLOG",
          bv: 8,
          tc: 4,
          rr: 6,
          js: 6,
        },
        {
          title: "Cross-ART dependency map",
          statusId: "BACKLOG",
          bv: 9,
          tc: 7,
          rr: 8,
          js: 7,
        },
      ],
    },
    {
      title: "DevOps Integration Hub",
      statusId: "IN_PROGRESS",
      features: [
        {
          title: "GitHub Actions webhook listener",
          statusId: "IN_PROGRESS",
          bv: 8,
          tc: 8,
          rr: 5,
          js: 4,
        },
        {
          title: "Deployment frequency dashboard",
          statusId: "BACKLOG",
          bv: 7,
          tc: 6,
          rr: 4,
          js: 3,
        },
      ],
    },
    {
      title: "Enterprise Security",
      statusId: "DONE",
      features: [
        {
          title: "SAML SSO integration",
          statusId: "DONE",
          bv: 9,
          tc: 9,
          rr: 8,
          js: 5,
        },
        {
          title: "SCIM provisioning",
          statusId: "DONE",
          bv: 8,
          tc: 8,
          rr: 7,
          js: 4,
        },
        {
          title: "Audit log export",
          statusId: "IN_PROGRESS",
          bv: 7,
          tc: 7,
          rr: 9,
          js: 3,
        },
      ],
    },
  ],
  NEBULA: [
    {
      title: "PI Planning Automation",
      statusId: "IN_PROGRESS",
      features: [
        {
          title: "Automated ART capacity calculation",
          statusId: "DONE",
          bv: 9,
          tc: 8,
          rr: 6,
          js: 4,
        },
        {
          title: "Program board digital twin",
          statusId: "IN_PROGRESS",
          bv: 8,
          tc: 7,
          rr: 5,
          js: 5,
        },
        {
          title: "PI objectives tracker",
          statusId: "BACKLOG",
          bv: 7,
          tc: 6,
          rr: 4,
          js: 3,
        },
      ],
    },
    {
      title: "BPMN Workflow Designer",
      statusId: "IN_PROGRESS",
      features: [
        {
          title: "BPMN canvas with bpmn-js",
          statusId: "IN_PROGRESS",
          bv: 8,
          tc: 7,
          rr: 6,
          js: 6,
        },
        {
          title: "XML persistence API",
          statusId: "BACKLOG",
          bv: 7,
          tc: 6,
          rr: 5,
          js: 3,
        },
      ],
    },
    {
      title: "Advanced Analytics",
      statusId: "BACKLOG",
      features: [
        {
          title: "Flow metrics dashboard",
          statusId: "BACKLOG",
          bv: 8,
          tc: 5,
          rr: 6,
          js: 5,
        },
        {
          title: "Predictive PI delivery score",
          statusId: "BACKLOG",
          bv: 9,
          tc: 6,
          rr: 7,
          js: 7,
        },
      ],
    },
  ],
  GALAXY: [
    {
      title: "WSJF Prioritization Engine",
      statusId: "IN_PROGRESS",
      features: [
        {
          title: "WSJF calculator UI",
          statusId: "DONE",
          bv: 8,
          tc: 7,
          rr: 6,
          js: 3,
        },
        {
          title: "Auto-sort backlog by WSJF",
          statusId: "IN_PROGRESS",
          bv: 7,
          tc: 6,
          rr: 5,
          js: 2,
        },
      ],
    },
    {
      title: "Agile Team Workspace",
      statusId: "BACKLOG",
      features: [
        {
          title: "Sprint board",
          statusId: "BACKLOG",
          bv: 7,
          tc: 5,
          rr: 4,
          js: 3,
        },
        {
          title: "Retrospective templates",
          statusId: "BACKLOG",
          bv: 5,
          tc: 4,
          rr: 3,
          js: 2,
        },
      ],
    },
  ],
  ORBIT: [
    {
      title: "Core SAFe Setup",
      statusId: "IN_PROGRESS",
      features: [
        {
          title: "ART configuration wizard",
          statusId: "IN_PROGRESS",
          bv: 7,
          tc: 6,
          rr: 5,
          js: 3,
        },
        {
          title: "Basic PI Planning board",
          statusId: "BACKLOG",
          bv: 6,
          tc: 5,
          rr: 4,
          js: 3,
        },
      ],
    },
  ],
};

// ── Helpers ──────────────────────────────────────────────────────

async function upsertUser(email: string, name: string, password: string) {
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return existing.id;
  }

  const ctx = await auth.$context;
  const hashedPassword = await ctx.password.hash(password);

  const user = await db.user.create({
    data: {
      email,
      name,
      emailVerified: true,
      accounts: {
        create: {
          accountId: email,
          providerId: "credential",
          password: hashedPassword,
        },
      },
    },
  });

  return user.id;
}

async function upsertTenant(def: TenantDef) {
  const existing = await db.tenant.findUnique({ where: { slug: def.slug } });
  if (existing) {
    // Update plan in case it changed
    await db.tenant.update({
      where: { id: existing.id },
      data: { plan: def.plan },
    });
    return existing.id;
  }

  const tenant = await db.tenant.create({
    data: {
      name: def.name,
      slug: def.slug,
      plan: def.plan,
      metadata: { seeded: true },
    },
  });

  return tenant.id;
}

async function seedTenant(def: TenantDef) {
  console.log(`\n▶ ${def.name} [${def.plan}]`);

  const userId = await upsertUser(def.adminEmail, def.adminName, def.password);
  console.log(`  ✓ user  ${def.adminEmail}`);

  const tenantId = await upsertTenant(def);
  console.log(`  ✓ tenant ${def.slug} (${tenantId})`);

  // Membership
  const existing = await db.tenantMember.findFirst({
    where: { userId, tenantId },
  });
  if (!existing) {
    await db.tenantMember.create({ data: { userId, tenantId, role: "ADMIN" } });
  }
  console.log("  ✓ membership ADMIN");

  // ARTs + PIs
  for (const artDef of def.arts) {
    let art = await db.aRT.findFirst({
      where: { tenantId, name: artDef.name },
    });
    if (!art) {
      art = await db.aRT.create({
        data: { tenantId, name: artDef.name, cadence: artDef.cadence },
      });
    }

    for (const piDef of artDef.pis) {
      const piExists = await db.pIPlan.findFirst({
        where: { artId: art.id, name: piDef.name },
      });
      if (!piExists) {
        await db.pIPlan.create({
          data: {
            tenantId,
            artId: art.id,
            name: piDef.name,
            startDate: piDef.startDate,
            endDate: piDef.endDate,
          },
        });
      }
    }
    console.log(`  ✓ ART "${artDef.name}" + ${artDef.pis.length} PIs`);
  }

  // Epics + Features
  const epicSeeds = EPIC_DATA[def.plan] ?? [];
  for (const epicDef of epicSeeds) {
    let epic = await db.epic.findFirst({
      where: { tenantId, title: epicDef.title },
    });
    if (!epic) {
      epic = await db.epic.create({
        data: { tenantId, title: epicDef.title, statusId: epicDef.statusId },
      });
    }

    for (const feat of epicDef.features) {
      const wsjfScore = (feat.bv + feat.tc + feat.rr) / feat.js;
      const featExists = await db.feature.findFirst({
        where: { tenantId, epicId: epic.id, title: feat.title },
      });
      if (!featExists) {
        await db.feature.create({
          data: {
            tenantId,
            epicId: epic.id,
            title: feat.title,
            statusId: feat.statusId,
            bv: feat.bv,
            tc: feat.tc,
            rr: feat.rr,
            js: feat.js,
            wsjfScore,
          },
        });
      }
    }
    console.log(
      `  ✓ Epic "${epicDef.title}" + ${epicDef.features.length} features`
    );
  }
}

// ── Main ─────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Seed multi-tenant COSMOS\n");
  console.log("  Planos: ORBIT → GALAXY → NEBULA → UNIVERSE\n");
  console.log("─".repeat(50));

  for (const def of TENANTS) {
    await seedTenant(def);
  }

  console.log(`\n${"─".repeat(50)}`);
  console.log("🎉 Seed concluído!\n");
  console.log("Credenciais:");
  for (const def of TENANTS) {
    console.log(
      `  [${def.plan.padEnd(8)}] ${def.adminEmail.padEnd(28)} ${def.password}`
    );
  }
  console.log();
}

// Guarda de entrypoint: sem ela, um `import` deste módulo roda o seed.
const isEntrypoint =
  !!process.argv[1] &&
  import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;

if (isEntrypoint) {
  main()
    .catch((err) => {
      console.error("❌ Seed falhou:", err);
      process.exit(1);
    })
    .finally(() => db.$disconnect());
}
