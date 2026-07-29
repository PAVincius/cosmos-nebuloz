/**
 * scripts/seed-admin.ts
 *
 * Cria um usuário admin + tenant "COSMOS Dev" para testes E2E.
 *
 * O Better Auth usa scrypt para hash. Este script usa a API interna
 * `auth.$context` para garantir compatibilidade com o algoritmo.
 *
 * Uso:
 *   cd apps/app
 *   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/cosmos_dev" \
 *   BETTER_AUTH_SECRET="cosmos-dev-secret-key-min-32-chars-placeholder" \
 *   BETTER_AUTH_URL="http://localhost:3000" \
 *   npx tsx scripts/seed-admin.ts
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

const ADMIN_EMAIL = process.env.E2E_EMAIL ?? "admin@cosmos.local";
const ADMIN_PASSWORD = process.env.E2E_PASSWORD;
if (!ADMIN_PASSWORD) {
  console.error("❌ E2E_PASSWORD env var is required");
  process.exit(1);
}
const ADMIN_PASSWORD_VALUE: string = ADMIN_PASSWORD as string;
const ADMIN_NAME = "Admin Cosmos";
const TENANT_NAME = "COSMOS Dev";
const TENANT_SLUG = "cosmos-dev";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const db = new PrismaClient({ adapter });

  // Instância do auth para usar o hasher correto (scrypt)
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

  // ─── 1. Verificar se usuário já existe ───────────────────────────
  const existingUser = await db.user.findUnique({
    where: { email: ADMIN_EMAIL },
  });

  let userId: string;

  if (existingUser) {
    console.log(
      `ℹ️  Usuário já existe: ${ADMIN_EMAIL} (id: ${existingUser.id})`
    );
    userId = existingUser.id;
  } else {
    // ─── 2. Criar usuário via API do Better Auth (hash correto) ───
    // Usamos ctx interno para hashear a senha com scrypt
    const ctx = await auth.$context;
    const hashedPassword = await ctx.password.hash(ADMIN_PASSWORD_VALUE);

    const newUser = await db.user.create({
      data: {
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
    });

    userId = newUser.id;
    console.log(`✅ Usuário criado: ${ADMIN_EMAIL} (id: ${userId})`);
  }

  // ─── 3. Criar Tenant se não existir ──────────────────────────────
  let tenant = await db.tenant.findUnique({
    where: { slug: TENANT_SLUG },
  });

  if (tenant) {
    console.log(`ℹ️  Tenant já existe: ${TENANT_NAME} (id: ${tenant.id})`);
  } else {
    tenant = await db.tenant.create({
      data: {
        name: TENANT_NAME,
        slug: TENANT_SLUG,
        metadata: { plan: "enterprise", safeTier: "full" },
      },
    });
    console.log(`✅ Tenant criado: ${TENANT_NAME} (id: ${tenant.id})`);
  }

  // ─── 4. Vincular usuário ao tenant como ADMIN ─────────────────────
  const existingMembership = await db.tenantMember.findFirst({
    where: { userId, tenantId: tenant.id },
  });

  if (existingMembership) {
    console.log(`ℹ️  Membership já existe com role: ${existingMembership.role}`);
  } else {
    await db.tenantMember.create({
      data: {
        userId,
        tenantId: tenant.id,
        role: "ADMIN",
      },
    });
    console.log(
      `✅ Membership criado: ${ADMIN_EMAIL} → ${TENANT_NAME} (ADMIN)`
    );
  }

  // ─── 5. Resumo ────────────────────────────────────────────────────
  console.log("\n─────────────────────────────────────────");
  console.log("🎉 Seed concluído com sucesso!\n");
  console.log("  Credenciais de login:");
  console.log(`  Email:    ${ADMIN_EMAIL}`);
  console.log("  Senha:    [redacted — use E2E_PASSWORD env var]");
  console.log(`  Tenant:   ${TENANT_NAME} (${TENANT_SLUG})`);
  console.log("  Role:     ADMIN");
  console.log("\n  Use no E2E:");
  console.log(`  E2E_EMAIL="${ADMIN_EMAIL}" E2E_PASSWORD="<your-password>"`);
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
