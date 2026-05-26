// apps/app/__tests__/finops/schema-sanity.test.ts
// @vitest-environment node
//
// Smoke tests: verify the generated Prisma client exposes the finops models.
// Imports directly from the generated package to avoid server-only / keys() guard.
// Uses PrismaPg adapter (same pattern as flow-intelligence.test.ts).
// No actual DB query is made — only method existence is checked.

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@repo/database/generated";
import { Pool } from "pg";
import { describe, expect, it } from "vitest";

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:5432/cosmos_dev",
});
const adapter = new PrismaPg(pool);
const client = new PrismaClient({ adapter });

describe("finops schema sanity", () => {
  it("BillingEntry model exists on database client", () => {
    expect(typeof client.billingEntry.findMany).toBe("function");
  });

  it("CostSnapshot model exists on database client", () => {
    expect(typeof client.costSnapshot.findMany).toBe("function");
  });

  it("TagRule model exists on database client", () => {
    expect(typeof client.tagRule.findMany).toBe("function");
  });

  it("BillingSyncRun model exists on database client", () => {
    expect(typeof client.billingSyncRun.findMany).toBe("function");
  });

  it("BillingEntryStaging model exists on database client", () => {
    expect(typeof client.billingEntryStaging.findMany).toBe("function");
  });
});
