/**
 * Upgrade tenant plan to UNIVERSE for a given user email.
 *
 * Usage:
 *   cd apps/app
 *   npx tsx scripts/upgrade-plan.ts vinicius.pratesaraujo@gmail.com
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { PrismaClient } from "@repo/database/generated/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

const email = process.argv[2];
if (!email) {
  console.error("Usage: npx tsx scripts/upgrade-plan.ts <email>");
  process.exit(1);
}

async function main() {
  // Find user by email
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, name: true },
  });

  if (!user) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }

  // Find tenant memberships for this user
  const memberships = await db.tenantMember.findMany({
    where: { userId: user.id },
    include: { tenant: { select: { id: true, name: true, slug: true, plan: true } } },
  });

  if (memberships.length === 0) {
    console.error(`No tenants found for user: ${email}`);
    process.exit(1);
  }

  console.log(`User: ${user.name} (${email})`);
  console.log(`Tenants found: ${memberships.length}`);

  for (const m of memberships) {
    const { tenant } = m;
    console.log(`\n  → Upgrading "${tenant.name}" (${tenant.slug}) from ${tenant.plan} → UNIVERSE`);

    await db.tenant.update({
      where: { id: tenant.id },
      data: { plan: "UNIVERSE" },
    });

    console.log(`  ✓ Done`);
  }

  console.log("\nAll tenants upgraded to UNIVERSE.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => pool.end());
