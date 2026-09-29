/**
 * scripts/seed-scaffold-e2e.ts
 *
 * Prepara o Scaffold no tenant do e2e local (`cosmos-dev`) para
 * `e2e/scaffold-track-lifecycle.spec.ts`:
 *
 *   - catálogo de templates publicado (`seed:scaffold` do @repo/database, que só
 *     insere);
 *   - módulo SCAFFOLD contratado;
 *   - `admin@cosmos.local` como CONSULTANT e `po@cosmos.local` como
 *     PROCESS_OWNER (as duas sessões que o globalSetup já grava).
 *
 * Nenhuma trilha é semeada: a spec cria a sua pela tela e percorre o ciclo até
 * o gate da Fase 2, sem atalho por SQL. Só roda em banco local.
 */

import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { execSync } from "node:child_process";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import type { PrismaClient as PrismaClientType } from "../../../packages/database/generated";
import { PrismaClient } from "../../../packages/database/generated";
import { assertLocalDatabaseUrl } from "./seed-meridian";

const TENANT_SLUG = "cosmos-dev";
const CONSULTANT_EMAIL = "admin@cosmos.local";
const OWNER_EMAIL = "po@cosmos.local";

async function main() {
  assertLocalDatabaseUrl(process.env.DATABASE_URL);

  // Catálogo primeiro: só insere, e a spec cria a trilha na versão mais nova.
  execSync("pnpm --filter @repo/database exec tsx scripts/seed-scaffold.mts", {
    stdio: "inherit",
    env: process.env,
  });

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({
    adapter: new PrismaPg(pool),
  }) as PrismaClientType;

  try {
    const tenant = await db.tenant.findUnique({
      where: { slug: TENANT_SLUG },
      select: { id: true },
    });
    if (!tenant) {
      throw new Error(`Tenant ${TENANT_SLUG} não existe. Rode seed:e2e antes.`);
    }
    const tenantId = tenant.id;
    const [consultant, owner] = await Promise.all(
      [CONSULTANT_EMAIL, OWNER_EMAIL].map((email) =>
        db.user.findUnique({
          where: { email },
          select: { id: true, name: true },
        })
      )
    );
    if (!(consultant && owner)) {
      throw new Error("Usuários do e2e ausentes. Rode seed:e2e antes.");
    }

    await db.tenantModule.upsert({
      where: { tenantId_module: { tenantId, module: "SCAFFOLD" } },
      create: { tenantId, module: "SCAFFOLD", status: "ACTIVE" },
      update: { status: "ACTIVE" },
    });
    for (const [user, role] of [
      [consultant, "CONSULTANT"],
      [owner, "PROCESS_OWNER"],
    ] as const) {
      await db.scaffoldMembership.upsert({
        where: { tenantId_userId: { tenantId, userId: user.id } },
        create: { tenantId, userId: user.id, role },
        update: { role },
      });
    }
    console.log("  ✓ módulo SCAFFOLD e papéis de adoção");
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
