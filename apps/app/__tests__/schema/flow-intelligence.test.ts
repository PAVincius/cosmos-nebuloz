/**
 * Schema constraint tests for Flow Intelligence P0 models.
 *
 * Imports PrismaClient from the generated package (via the @repo alias) and
 * @prisma/adapter-pg (available in apps/app devDependencies) to avoid the
 * `server-only` + `keys()` guard in @repo/database/index.ts.
 *
 * Requires a running Postgres instance.  DATABASE_URL falls back to the dev
 * default when not set.  All created records are removed in afterAll.
 */

// @vitest-environment node

import { PrismaPg } from "@prisma/adapter-pg";
// PrismaClient lives in the generated package — accessible via the @repo alias
// without pulling in server-only / keys().
import { PrismaClient } from "@repo/database/generated";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// ── DB client ─────────────────────────────────────────────────────────────

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/cosmos_dev";

let pool: Pool;
let prisma: InstanceType<typeof PrismaClient>;

// ── Stable IDs (created once per test run) ────────────────────────────────

const TS = Date.now();
const TEST_TENANT_ID = `test-fi-${TS}`;
const TEAM_A = `team-a-${TS}`;
const TEAM_B = `team-b-${TS}`;
const SPRINT_A = `sprint-a-${TS}`;
const SPRINT_B = `sprint-b-${TS}`;
// USER_ID_1 sorts before USER_ID_2 (lexicographic: "aaa" < "zzz")
const USER_1 = `user-aaa-${TS}`;
const USER_2 = `user-zzz-${TS}`;

// ── Setup / teardown ──────────────────────────────────────────────────────

beforeAll(async () => {
  pool = new Pool({ connectionString: DATABASE_URL });
  const adapter = new PrismaPg(pool);
  // The Prisma v7 adapter constructor signature differs from PrismaClient's
  // default — cast to satisfy TypeScript without touching generated types.
  prisma = new PrismaClient({ adapter } as Parameters<typeof PrismaClient>[0]);
  const db = prisma as any;

  // Tenant
  await db.tenant.create({
    data: {
      id: TEST_TENANT_ID,
      name: "FI Constraint Test Tenant",
      slug: `fi-test-${TS}`,
    },
  });

  // Teams (artId optional — omit to keep fixture minimal)
  await db.team.createMany({
    data: [
      { id: TEAM_A, tenantId: TEST_TENANT_ID, name: "Team Alpha" },
      { id: TEAM_B, tenantId: TEST_TENANT_ID, name: "Team Beta" },
    ],
  });

  // Sprints (two separate sprints, both belonging to TEAM_A for simplicity)
  const now = new Date();
  const twoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  await db.sprint.createMany({
    data: [
      {
        id: SPRINT_A,
        tenantId: TEST_TENANT_ID,
        teamId: TEAM_A,
        name: "Sprint A",
        startDate: now,
        endDate: twoWeeks,
      },
      {
        id: SPRINT_B,
        tenantId: TEST_TENANT_ID,
        teamId: TEAM_A,
        name: "Sprint B",
        startDate: now,
        endDate: twoWeeks,
      },
    ],
  });
});

afterAll(async () => {
  const db = prisma as any;
  // Delete in FK-safe order (children before parents).
  await db.personSkillProfile.deleteMany({
    where: { tenantId: TEST_TENANT_ID },
  });
  await db.pairSynergy.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
  await db.groupSynergy.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
  await db.memberThroughputBaseline.deleteMany({
    where: { tenantId: TEST_TENANT_ID },
  });
  await db.teamCapacitySnapshot.deleteMany({
    where: { tenantId: TEST_TENANT_ID },
  });
  await db.stalenessAuditLog.deleteMany({
    where: { tenantId: TEST_TENANT_ID },
  });
  await db.flowMetricSnapshot.deleteMany({
    where: { tenantId: TEST_TENANT_ID },
  });
  // Sprints and teams cascade from tenant, but delete explicitly to be safe.
  await db.sprint.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
  await db.team.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
  // Tenant cascade cleans up any remaining children.
  await db.tenant.deleteMany({ where: { id: TEST_TENANT_ID } });

  await prisma.$disconnect();
  await pool.end();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("FlowMetricSnapshot", () => {
  it("staleness defaults to FRESH when not supplied", async () => {
    const db = prisma as any;
    const snap = await db.flowMetricSnapshot.create({
      data: {
        tenantId: TEST_TENANT_ID,
        scope: "team",
        scopeId: TEAM_A,
        period: "sprint",
        periodRef: SPRINT_A,
      },
    });
    expect(snap.staleness).toBe("FRESH");
  });
});

describe("MemberThroughputBaseline", () => {
  it("rejects duplicate [tenantId, teamId, userId]", async () => {
    const db = prisma as any;
    const base = { tenantId: TEST_TENANT_ID, teamId: TEAM_A, userId: USER_1 };
    await db.memberThroughputBaseline.create({ data: base });
    await expect(
      db.memberThroughputBaseline.create({ data: base })
    ).rejects.toThrow();
  });
});

describe("TeamCapacitySnapshot", () => {
  it("allows two different teams in the same sprint", async () => {
    const db = prisma as any;
    const [a, b] = await Promise.all([
      db.teamCapacitySnapshot.create({
        data: { tenantId: TEST_TENANT_ID, sprintId: SPRINT_A, teamId: TEAM_A },
      }),
      db.teamCapacitySnapshot.create({
        data: { tenantId: TEST_TENANT_ID, sprintId: SPRINT_A, teamId: TEAM_B },
      }),
    ]);
    expect(a.teamId).toBe(TEAM_A);
    expect(b.teamId).toBe(TEAM_B);
  });

  it("rejects duplicate [sprintId, teamId]", async () => {
    const db = prisma as any;
    await db.teamCapacitySnapshot.create({
      data: { tenantId: TEST_TENANT_ID, sprintId: SPRINT_B, teamId: TEAM_A },
    });
    await expect(
      db.teamCapacitySnapshot.create({
        data: { tenantId: TEST_TENANT_ID, sprintId: SPRINT_B, teamId: TEAM_A },
      })
    ).rejects.toThrow();
  });
});

describe("PairSynergy canonical ordering", () => {
  it("inserts a sorted pair and rejects a duplicate", async () => {
    const db = prisma as any;
    // USER_1 ("user-aaa-…") < USER_2 ("user-zzz-…") by construction.
    const [u1, u2] = [USER_1, USER_2].sort();
    const row = await db.pairSynergy.create({
      data: { tenantId: TEST_TENANT_ID, userId1: u1, userId2: u2 },
    });
    expect(row.userId1).toBe(u1);
    expect(row.userId2).toBe(u2);

    // Same pair again must violate the unique constraint.
    await expect(
      db.pairSynergy.create({
        data: { tenantId: TEST_TENANT_ID, userId1: u1, userId2: u2 },
      })
    ).rejects.toThrow();
  });
});

describe("PersonSkillProfile", () => {
  it("rejects duplicate [tenantId, userId, competency]", async () => {
    const db = prisma as any;
    const base = {
      tenantId: TEST_TENANT_ID,
      userId: USER_1,
      competency: "TEAM_TECHNICAL_AGILITY",
      skillLevel: 3,
    };
    await db.personSkillProfile.create({ data: base });
    await expect(
      db.personSkillProfile.create({ data: base })
    ).rejects.toThrow();
  });
});
