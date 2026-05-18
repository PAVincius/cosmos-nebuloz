import "server-only";

import { keys } from "./keys";
import { PrismaClient } from "./generated/client";

const globalForPrisma = global as unknown as { prisma_cosmos_v10: PrismaClient };

const DATABASE_URL = keys().DATABASE_URL;

function createPrismaClient(): PrismaClient {
  const isNeon = DATABASE_URL.includes("neon.tech") || DATABASE_URL.includes("neon.database.azure.com");

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

export const database = globalForPrisma.prisma_cosmos_v10 || createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma_cosmos_v10 = database;
}

// biome-ignore lint/performance/noBarrelFile: re-exporting
export * from "./generated/client";
export * from "./vector-search";
