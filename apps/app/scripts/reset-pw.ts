import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@repo/database/generated/client";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { Pool } from "pg";

const NEW_PASSWORD = process.env.NEW_PASSWORD ?? "cosmos123";
const EMAIL = process.env.E2E_EMAIL ?? "admin@cosmos.local";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const db = new PrismaClient({ adapter });
  const auth = betterAuth({
    database: prismaAdapter(db, { provider: "postgresql" }),
    emailAndPassword: { enabled: true },
    secret:
      process.env.BETTER_AUTH_SECRET ??
      "cosmos-dev-secret-key-min-32-chars-placeholder",
    baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  });

  const ctx = await auth.$context;
  const hash = await ctx.password.hash(NEW_PASSWORD);

  const result = await db.account.updateMany({
    where: { accountId: EMAIL, providerId: "credential" },
    data: { password: hash },
  });

  console.log(`Updated ${result.count} account(s) for ${EMAIL}`);
  console.log("New password:", NEW_PASSWORD);
  await pool.end();
}
main();
