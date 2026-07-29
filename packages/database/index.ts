import "server-only";

import { PrismaClient } from "./generated/client";
import { keys } from "./keys";

const globalForPrisma = global as unknown as {
  prisma_cosmos_v10: PrismaClient;
};

const DATABASE_URL = keys().DATABASE_URL;

function createPrismaClient(): PrismaClient {
  const isNeon =
    DATABASE_URL.includes("neon.tech") ||
    DATABASE_URL.includes("neon.database.azure.com");

  if (isNeon) {
    const { neonConfig } = require("@neondatabase/serverless");
    const { PrismaNeon } = require("@prisma/adapter-neon");
    const ws = require("ws");
    neonConfig.webSocketConstructor = ws;
    const adapter = new PrismaNeon({ connectionString: DATABASE_URL });
    return new PrismaClient({ adapter });
  }

  // Local Postgres — pg driver adapter (Prisma v7 client engine)
  const { Pool } = require("pg");
  const { PrismaPg } = require("@prisma/adapter-pg");
  const pool = new Pool({ connectionString: DATABASE_URL });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const database =
  globalForPrisma.prisma_cosmos_v10 || createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma_cosmos_v10 = database;
}

// TODO(NEB-115): Prevent auditLog.update/delete at the Prisma client layer via $extends
// so that application code gets a type error if it attempts mutation on AuditLog.
// The database trigger (migration 20260603000002_audit_log_immutable_trigger) already
// blocks it at the DB level; the $extends guard adds a second layer and surfaces errors
// earlier (compile-time). Do NOT add this extension until the trigger is deployed and
// integration-tested against the staging DB.

export * from "./generated/client";
export { withTenantDb } from "./tenant-db";
export * from "./vector-search";
