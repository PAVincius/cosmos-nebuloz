/**
 * scripts/seed-personas.ts
 *
 * Cria 5 usuários demo com roles SAFe distintas no tenant "COSMOS Dev".
 * Cada role mapeia automaticamente para uma persona bento diferente.
 *
 * Personas criadas:
 *   rte@cosmos.demo   → RTE   → cockpit: Flow Efficiency + ROAM
 *   sm@cosmos.demo    → SM    → cockpit: Team Health + Sprint
 *   pm@cosmos.demo    → PO    → cockpit: OKRs + PI Objectives
 *   lpm@cosmos.demo   → ADMIN → cockpit: Portfolio + LeanBudget
 *   dev@cosmos.demo   → DEV   → cockpit: Global Overview
 *
 * Uso:
 *   cd apps/app
 *   DATABASE_URL="postgresql://..." \
 *   BETTER_AUTH_SECRET="cosmos-dev-secret-key-min-32-chars-placeholder" \
 *   BETTER_AUTH_URL="http://localhost:3012" \
 *   npx tsx scripts/seed-personas.ts
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

const DEMO_PASSWORD = "Demo@Cosmos2026!";
const TENANT_SLUG = "cosmos-dev";

const PERSONAS = [
  {
    email: "rte@cosmos.demo",
    name: "Ricardo RTE",
    role: "RTE" as const,
    persona: "rte",
  },
  {
    email: "sm@cosmos.demo",
    name: "Sara SM",
    role: "SM" as const,
    persona: "team",
  },
  {
    email: "pm@cosmos.demo",
    name: "Pedro PM",
    role: "PO" as const,
    persona: "pm",
  },
  {
    email: "lpm@cosmos.demo",
    name: "Laura LPM",
    role: "ADMIN" as const,
    persona: "lpm",
  },
  {
    email: "dev@cosmos.demo",
    name: "Diego Dev",
    role: "DEV" as const,
    persona: "global",
  },
] as const;

async function main() {
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
    baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3012",
  });

  const ctx = await auth.$context;

  console.log("🌱 seed-personas — criando usuários demo...\n");

  // Tenant deve existir (rode seed-admin.ts primeiro)
  const tenant = await db.tenant.findUnique({ where: { slug: TENANT_SLUG } });
  if (!tenant) {
    console.error(
      `❌ Tenant "${TENANT_SLUG}" não encontrado. Rode seed-admin.ts primeiro.`
    );
    process.exit(1);
  }

  const hashedPassword = await ctx.password.hash(DEMO_PASSWORD);

  for (const p of PERSONAS) {
    // Upsert user
    let user = await db.user.findUnique({ where: { email: p.email } });
    if (user) {
      console.log(`ℹ️  User já existe: ${p.email}`);
    } else {
      user = await db.user.create({
        data: {
          email: p.email,
          name: p.name,
          emailVerified: true,
          accounts: {
            create: {
              accountId: p.email,
              providerId: "credential",
              password: hashedPassword,
            },
          },
        },
      });
      console.log(`✅ User: ${p.email}`);
    }

    // Upsert membership
    const existing = await db.tenantMember.findFirst({
      where: { userId: user.id, tenantId: tenant.id },
    });
    if (!existing) {
      await db.tenantMember.create({
        data: { userId: user.id, tenantId: tenant.id, role: p.role },
      });
      console.log(`   └─ membership: ${p.role} → persona: ${p.persona}`);
    } else if (existing.role !== p.role) {
      await db.tenantMember.update({
        where: { id: existing.id },
        data: { role: p.role },
      });
      console.log(`   └─ role atualizado: ${existing.role} → ${p.role}`);
    } else {
      console.log(`   └─ membership ok: ${p.role}`);
    }
  }

  console.log("\n─────────────────────────────────────────────────────────");
  console.log("🎉 Pronto! Acesse http://localhost:3012 e logue com:\n");
  console.log("  Senha de todos: Demo@Cosmos2026!\n");
  console.log("  EMAIL                  ROLE    HOME PERSONA");
  console.log("  ─────────────────────────────────────────────");
  for (const p of PERSONAS) {
    const pad = p.email.padEnd(22);
    console.log(`  ${pad}  ${p.role.padEnd(7)} ${p.persona}`);
  }
  console.log("─────────────────────────────────────────────────────────\n");
  console.log("  Tenant: COSMOS Dev (slug: cosmos-dev)");
  console.log("  Para trocar persona: /profile → aba Workspace\n");

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
