/**
 * scripts/seed-catalogo-e2e.ts
 *
 * Fixture do E2E do catálogo pós-login (spec 004, US2, cenário 2 do
 * quickstart): um tenant `isInternalTenant = true`, com o módulo MERIDIAN
 * habilitado e uma persona de senha conhecida — só o que
 * `e2e/catalogo-pos-login.spec.ts` precisa pra logar e ver o catálogo.
 *
 * Tenant dedicado (`nebuloz-e2e-interno`), não o `nebuloz` real: esta é
 * fixture de teste, não o workspace de dogfood do CEO
 * (`scripts/seed-nebuloz.ts`, que é convite, sem senha — por isso não serve
 * pra sign-in automatizado).
 *
 * Idempotente: upsert por chave natural (slug do tenant, email do usuário) —
 * reexecutável a qualquer momento, inclusive depois de o Postgres local ser
 * recriado a partir das migrations.
 */

import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { Pool } from "pg";
import type { PrismaClient as PrismaClientType } from "../../../packages/database/generated";
import { PrismaClient } from "../../../packages/database/generated";
import { assertLocalDatabaseUrl, pinPersonaToTenant } from "./seed-meridian";

const TENANT_SLUG = "nebuloz-e2e-interno";
const TENANT_NAME = "Nebuloz E2E (interno)";

const PERSONA_EMAIL = "interno.catalogo@nebuloz.exemplo";
const PERSONA_NAME = "Usuária Catálogo E2E";
const PERSONA_PASSWORD = process.env.CATALOGO_SEED_PASSWORD ?? "catalogo123";

async function main() {
  assertLocalDatabaseUrl(process.env.DATABASE_URL);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({
    adapter: new PrismaPg(pool),
  }) as PrismaClientType;

  console.log(`\n🧭  Seed Catálogo E2E → ${TENANT_NAME} (${TENANT_SLUG})\n`);

  const tenant = await db.tenant.upsert({
    where: { slug: TENANT_SLUG },
    create: { name: TENANT_NAME, slug: TENANT_SLUG, isInternalTenant: true },
    update: { isInternalTenant: true },
  });
  const tenantId = tenant.id;
  console.log("  ✓ tenant isInternalTenant=true");

  await db.tenantModule.upsert({
    where: { tenantId_module: { tenantId, module: "MERIDIAN" } },
    create: {
      tenantId,
      module: "MERIDIAN",
      status: "ACTIVE",
      contractedAt: new Date(),
    },
    update: { status: "ACTIVE" },
  });
  console.log("  ✓ módulo MERIDIAN contratado");

  const auth = betterAuth({
    database: prismaAdapter(db, { provider: "postgresql" }),
    emailAndPassword: { enabled: true },
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3012",
  });
  // Hash pela própria lib do Better Auth — nunca um hash calculado à mão
  // (FR-013: nenhuma escrita de senha fora do fluxo padrão de autenticação).
  const passwordHash = await (await auth.$context).password.hash(
    PERSONA_PASSWORD
  );

  const user = await db.user.upsert({
    where: { email: PERSONA_EMAIL },
    create: { email: PERSONA_EMAIL, name: PERSONA_NAME, emailVerified: true },
    update: { name: PERSONA_NAME },
  });

  await db.tenantMember.upsert({
    where: { tenantId_userId: { tenantId, userId: user.id } },
    create: { tenantId, userId: user.id, role: "MEMBER" },
    update: {},
  });
  await pinPersonaToTenant(db, user.id, tenantId);

  const existing = await db.account.findFirst({
    where: { accountId: PERSONA_EMAIL, providerId: "credential" },
    select: { id: true },
  });
  if (existing) {
    await db.account.update({
      where: { id: existing.id },
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
  console.log(`  ✓ persona (senha: ${PERSONA_PASSWORD})`);

  console.log(`
✅ Seed Catálogo E2E concluído.

  Login:  ${PERSONA_EMAIL} / ${PERSONA_PASSWORD}
  Abrir:  /produto (catálogo pós-login)
`);

  await db.$disconnect();
  await pool.end();
}

const isEntrypoint =
  !!process.argv[1] &&
  import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;

if (isEntrypoint) {
  main().catch((err) => {
    console.error("❌ seed-catalogo-e2e falhou:", err);
    process.exit(1);
  });
}
