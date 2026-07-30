/**
 * Schema constraint tests for Flow Intelligence P0 models.
 *
 * Uses raw pg.Pool queries throughout — bypassing the PrismaPg driver adapter
 * which keeps beforeAll fixture data in an implicit open transaction, causing
 * FK-check waits to hang when constraint tests use a separate pool connection.
 *
 * Requires a running Postgres instance. DATABASE_URL falls back to the dev
 * default when not set. All created records are removed in afterAll.
 *
 * When DATABASE_URL is absent or points to a placeholder, the entire suite is
 * skipped via describe.skip so that no Pool connection is attempted.
 */

// @vitest-environment node

import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// ── DB client ─────────────────────────────────────────────────────────────

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/cosmos_dev";

// Managed Postgres (Supabase/Neon/etc.) sits behind a pooler whose cert chain
// Node's default trust store doesn't carry — local/CI Postgres has no TLS at
// all, and forcing `ssl` there breaks the handshake instead of fixing it.
const IS_LOCAL_DB = /localhost|127\.0\.0\.1/.test(DATABASE_URL);
const POOL_SSL = IS_LOCAL_DB ? undefined : { rejectUnauthorized: false };

// Guard: skip the entire suite when no real Postgres is available.
// The default fallback URL points to localhost which does not exist in CI.
// Treat any URL that contains "localhost" without an explicit opt-in env var
// as a placeholder so CI/local runs without a DB skip cleanly.
// A localhost URL is a placeholder unless RUN_DB_TESTS opts in: the Vercel build
// env sets DATABASE_URL to a localhost value with no Postgres behind it, so
// presence alone is not proof of a reachable database.
const LOCAL_HOST_RE = /@(localhost|127\.0\.0\.1)[:/]/;
const rawDbUrl = process.env.DATABASE_URL;
const hasExplicitDb = Boolean(
  rawDbUrl && (!LOCAL_HOST_RE.test(rawDbUrl) || process.env.RUN_DB_TESTS)
);
const maybDescribe = hasExplicitDb ? describe : describe.skip;

if (!hasExplicitDb) {
  console.log(
    "[flow-intelligence] no reachable DATABASE_URL — skipping DB integration suite."
  );
}

// Top-level regex constant required by biome/useTopLevelRegex.
const UNIQUE_VIOLATION_RE = /unique/i;

let pool: Pool;

// ── Suite (skipped when DATABASE_URL is not explicitly provided) ──────────

maybDescribe("Flow Intelligence schema constraints", () => {
  // ── Stable IDs (created once per test run) ────────────────────────────

  const TS = Date.now();
  const TEST_TENANT_ID = `test-fi-${TS}`;
  const TEAM_A = `team-a-${TS}`;
  const TEAM_B = `team-b-${TS}`;
  const SPRINT_A = `sprint-a-${TS}`;
  const SPRINT_B = `sprint-b-${TS}`;
  // USER_ID_1 sorts before USER_ID_2 (lexicographic: "aaa" < "zzz")
  const USER_1 = `user-aaa-${TS}`;
  const USER_2 = `user-zzz-${TS}`;

  // ── Setup / teardown ──────────────────────────────────────────────────

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, ssl: POOL_SSL });

    const now = new Date().toISOString();
    const twoWeeks = new Date(
      Date.now() + 14 * 24 * 60 * 60 * 1000
    ).toISOString();

    // Each pool.query() is autocommit — immediately visible to all connections.
    await pool.query(
      `INSERT INTO "Tenant" (id, name, slug, "updatedAt")
       VALUES ($1, $2, $3, now())`,
      [TEST_TENANT_ID, "FI Constraint Test Tenant", `fi-test-${TS}`]
    );

    await pool.query(
      `INSERT INTO "Team" (id, "tenantId", name, "updatedAt")
       VALUES ($1, $2, $3, now()), ($4, $2, $5, now())`,
      [TEAM_A, TEST_TENANT_ID, "Team Alpha", TEAM_B, "Team Beta"]
    );

    await pool.query(
      `INSERT INTO "Sprint" (id, "tenantId", "teamId", name, "startDate", "endDate", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, now()),
              ($7, $2, $3, $8, $5, $6, now())`,
      [
        SPRINT_A,
        TEST_TENANT_ID,
        TEAM_A,
        "Sprint A",
        now,
        twoWeeks,
        SPRINT_B,
        "Sprint B",
      ]
    );
  });

  afterAll(async () => {
    // Delete in FK-safe order (children before parents).
    // Tenant has ON DELETE CASCADE on most children — delete tenant last.
    await pool.query(
      `DELETE FROM "PersonSkillProfile"        WHERE "tenantId" = $1`,
      [TEST_TENANT_ID]
    );
    await pool.query(
      `DELETE FROM "PairSynergy"               WHERE "tenantId" = $1`,
      [TEST_TENANT_ID]
    );
    await pool.query(
      `DELETE FROM "GroupSynergy"              WHERE "tenantId" = $1`,
      [TEST_TENANT_ID]
    );
    await pool.query(
      `DELETE FROM "MemberThroughputBaseline"  WHERE "tenantId" = $1`,
      [TEST_TENANT_ID]
    );
    await pool.query(
      `DELETE FROM "TeamCapacitySnapshot"      WHERE "tenantId" = $1`,
      [TEST_TENANT_ID]
    );
    await pool.query(
      `DELETE FROM "StalenessAuditLog"         WHERE "tenantId" = $1`,
      [TEST_TENANT_ID]
    );
    await pool.query(
      `DELETE FROM "FlowMetricSnapshot"        WHERE "tenantId" = $1`,
      [TEST_TENANT_ID]
    );
    await pool.query(`DELETE FROM "Sprint"  WHERE "tenantId" = $1`, [
      TEST_TENANT_ID,
    ]);
    await pool.query(`DELETE FROM "Team"    WHERE "tenantId" = $1`, [
      TEST_TENANT_ID,
    ]);
    await pool.query(`DELETE FROM "Tenant"  WHERE id = $1`, [TEST_TENANT_ID]);

    await pool.end();
  });

  // ── Tests ──────────────────────────────────────────────────────────────

  describe("FlowMetricSnapshot", () => {
    it("staleness defaults to FRESH when not supplied", async () => {
      const { rows } = await pool.query(
        `INSERT INTO "FlowMetricSnapshot"
           (id, "tenantId", scope, "scopeId", period, "periodRef")
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5)
         RETURNING staleness`,
        [TEST_TENANT_ID, "team", TEAM_A, "sprint", SPRINT_A]
      );
      expect(rows[0].staleness).toBe("FRESH");
    });
  });

  describe("MemberThroughputBaseline", () => {
    it("rejects duplicate [tenantId, teamId, userId]", async () => {
      await pool.query(
        `INSERT INTO "MemberThroughputBaseline" (id, "tenantId", "teamId", "userId")
         VALUES (gen_random_uuid()::text, $1, $2, $3)`,
        [TEST_TENANT_ID, TEAM_A, USER_1]
      );
      await expect(
        pool.query(
          `INSERT INTO "MemberThroughputBaseline" (id, "tenantId", "teamId", "userId")
           VALUES (gen_random_uuid()::text, $1, $2, $3)`,
          [TEST_TENANT_ID, TEAM_A, USER_1]
        )
      ).rejects.toThrow(UNIQUE_VIOLATION_RE);
    });
  });

  describe("TeamCapacitySnapshot", () => {
    it("allows two different teams in the same sprint", async () => {
      const { rows } = await pool.query(
        `INSERT INTO "TeamCapacitySnapshot" (id, "tenantId", "sprintId", "teamId")
         VALUES (gen_random_uuid()::text, $1, $2, $3),
                (gen_random_uuid()::text, $1, $2, $4)
         RETURNING "teamId"`,
        [TEST_TENANT_ID, SPRINT_A, TEAM_A, TEAM_B]
      );
      const teamIds = rows.map((r: { teamId: string }) => r.teamId).sort();
      expect(teamIds).toEqual([TEAM_A, TEAM_B].sort());
    });

    it("rejects duplicate [sprintId, teamId]", async () => {
      await pool.query(
        `INSERT INTO "TeamCapacitySnapshot" (id, "tenantId", "sprintId", "teamId")
         VALUES (gen_random_uuid()::text, $1, $2, $3)`,
        [TEST_TENANT_ID, SPRINT_B, TEAM_A]
      );
      await expect(
        pool.query(
          `INSERT INTO "TeamCapacitySnapshot" (id, "tenantId", "sprintId", "teamId")
           VALUES (gen_random_uuid()::text, $1, $2, $3)`,
          [TEST_TENANT_ID, SPRINT_B, TEAM_A]
        )
      ).rejects.toThrow(UNIQUE_VIOLATION_RE);
    });
  });

  describe("PairSynergy canonical ordering", () => {
    it("inserts a sorted pair and rejects a duplicate", async () => {
      // USER_1 ("user-aaa-…") < USER_2 ("user-zzz-…") by construction.
      const [u1, u2] = [USER_1, USER_2].sort();

      const { rows } = await pool.query(
        `INSERT INTO "PairSynergy" (id, "tenantId", "userId1", "userId2")
         VALUES (gen_random_uuid()::text, $1, $2, $3)
         RETURNING "userId1", "userId2"`,
        [TEST_TENANT_ID, u1, u2]
      );
      expect(rows[0].userId1).toBe(u1);
      expect(rows[0].userId2).toBe(u2);

      // Same pair + same default taskType ("any") → unique constraint fires.
      await expect(
        pool.query(
          `INSERT INTO "PairSynergy" (id, "tenantId", "userId1", "userId2")
           VALUES (gen_random_uuid()::text, $1, $2, $3)`,
          [TEST_TENANT_ID, u1, u2]
        )
      ).rejects.toThrow(UNIQUE_VIOLATION_RE);
    });
  });

  describe("PersonSkillProfile", () => {
    it("rejects duplicate [tenantId, userId, competency]", async () => {
      await pool.query(
        `INSERT INTO "PersonSkillProfile"
           (id, "tenantId", "userId", competency, "skillLevel")
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4)`,
        [TEST_TENANT_ID, USER_1, "TEAM_TECHNICAL_AGILITY", 3]
      );
      await expect(
        pool.query(
          `INSERT INTO "PersonSkillProfile"
             (id, "tenantId", "userId", competency, "skillLevel")
           VALUES (gen_random_uuid()::text, $1, $2, $3, $4)`,
          [TEST_TENANT_ID, USER_1, "TEAM_TECHNICAL_AGILITY", 3]
        )
      ).rejects.toThrow(UNIQUE_VIOLATION_RE);
    });
  });
});
