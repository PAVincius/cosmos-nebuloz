/**
 * seed-admin.ts — Seed executado de dentro de packages/database
 * onde o cliente Prisma gerado está disponível.
 *
 * Uso (da raiz do monorepo):
 *   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/cosmos_dev" \
 *   BETTER_AUTH_SECRET="cosmos-dev-secret-key-min-32-chars-placeholder" \
 *   BETTER_AUTH_URL="http://localhost:3000" \
 *   node --import tsx/esm ../../apps/app/scripts/seed-admin.ts
 *
 * OU via pnpm na raiz:
 *   pnpm seed:admin
 */

import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "./generated/index.js";

const ADMIN_EMAIL = process.env.E2E_EMAIL ?? "admin@cosmos.local";
const ADMIN_PASSWORD = process.env.E2E_PASSWORD ?? "Cosmos@2026!";
const ADMIN_NAME = "Admin Cosmos";
const TENANT_NAME = "COSMOS Dev";
const TENANT_SLUG = "cosmos-dev";

async function main() {
  const { Pool } = require("pg");
  const { PrismaPg } = require("@prisma/adapter-pg");
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

  console.log("🌱 Iniciando seed do banco COSMOS...\n");

  // 1. Hash da senha com o algoritmo do Better Auth (scrypt)
  const ctx = await auth.$context;
  const hashedPassword = await ctx.password.hash(ADMIN_PASSWORD);

  // 2. Upsert do usuário
  const user = await db.user.upsert({
    where: { email: ADMIN_EMAIL },
    create: {
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      emailVerified: true,
      accounts: {
        create: {
          accountId: ADMIN_EMAIL,
          providerId: "credential",
          password: hashedPassword,
        },
      },
    },
    update: {
      name: ADMIN_NAME,
      emailVerified: true,
    },
  });
  console.log(`✅ Usuário: ${user.email} (id: ${user.id})`);

  // 3. Upsert da account (senha) — caso já exista o user mas não a account
  const existingAccount = await db.account.findFirst({
    where: { userId: user.id, providerId: "credential" },
  });
  if (existingAccount) {
    // Atualiza o hash (em caso de rotação de senha)
    await db.account.update({
      where: { id: existingAccount.id },
      data: { password: hashedPassword },
    });
    console.log("   → Account credential atualizada");
  } else {
    await db.account.create({
      data: {
        accountId: ADMIN_EMAIL,
        providerId: "credential",
        userId: user.id,
        password: hashedPassword,
      },
    });
    console.log("   → Account credential criada");
  }

  // 4. Upsert do Tenant
  const tenant = await db.tenant.upsert({
    where: { slug: TENANT_SLUG },
    create: {
      name: TENANT_NAME,
      slug: TENANT_SLUG,
      metadata: { plan: "enterprise", safeTier: "full" },
    },
    update: { name: TENANT_NAME },
  });
  console.log(`✅ Tenant: ${tenant.name} (id: ${tenant.id})`);

  // 5. TenantMember
  const existing = await db.tenantMember.findFirst({
    where: { userId: user.id, tenantId: tenant.id },
  });
  if (existing) {
    console.log(`ℹ️  Membership já existe (role: ${existing.role})`);
  } else {
    await db.tenantMember.create({
      data: { userId: user.id, tenantId: tenant.id, role: "ADMIN" },
    });
    console.log(`✅ Membership: ${ADMIN_EMAIL} → ${TENANT_NAME} (ADMIN)`);
  }

  console.log("\n─────────────────────────────────────────");
  console.log("🎉 Seed concluído!\n");
  console.log("  Login:");
  console.log(`  Email:    ${ADMIN_EMAIL}`);
  console.log(`  Senha:    ${ADMIN_PASSWORD}`);
  console.log(`  Tenant:   ${TENANT_NAME}`);
  console.log("\n  Variáveis para E2E:");
  console.log(`  E2E_EMAIL="${ADMIN_EMAIL}"`);
  console.log(`  E2E_PASSWORD="${ADMIN_PASSWORD}"`);
  console.log("─────────────────────────────────────────\n");

  await db.$disconnect();
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
