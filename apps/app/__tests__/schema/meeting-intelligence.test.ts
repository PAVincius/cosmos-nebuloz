/**
 * Schema constraint tests for Meeting Intelligence (epic-009, story-046) models.
 *
 * Uses raw pg.Pool queries throughout — same approach as flow-intelligence.test.ts
 * (bypasses PrismaPg driver adapter to avoid FK-check waits hanging across a
 * separate pool connection).
 *
 * Requires a running Postgres instance. When DATABASE_URL is absent the suite is
 * skipped via describe.skip so no Pool connection is attempted. All created
 * records are removed in afterAll.
 */

// @vitest-environment node

import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/cosmos_dev";

// Managed Postgres (Supabase/Neon/etc.) sits behind a pooler whose cert chain
// Node's default trust store doesn't carry — local/CI Postgres has no TLS at
// all, and forcing `ssl` there breaks the handshake instead of fixing it.
const IS_LOCAL_DB = /localhost|127\.0\.0\.1/.test(DATABASE_URL);
const POOL_SSL = IS_LOCAL_DB ? undefined : { rejectUnauthorized: false };

// Mesmo opt-in de flow-intelligence: a suíte escreve em Tenant e Integration,
// e a DATABASE_URL do build da Vercel aponta para produção. Só RUN_DB_TESTS
// libera a escrita.
const hasExplicitDb = Boolean(
  process.env.DATABASE_URL && process.env.RUN_DB_TESTS
);
const maybDescribe = hasExplicitDb ? describe : describe.skip;

if (!hasExplicitDb) {
  console.log(
    "[meeting-intelligence] RUN_DB_TESTS não setado — pulando suíte de integração com banco."
  );
}

const UNIQUE_VIOLATION_RE = /unique/i;

let pool: Pool;

maybDescribe("Meeting Intelligence schema constraints", () => {
  const TS = Date.now();
  const TEST_TENANT_ID = `test-mi-${TS}`;
  const INTEGRATION_ID = `mi-integration-${TS}`;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, ssl: POOL_SSL });

    await pool.query(
      `INSERT INTO "Tenant" (id, name, slug, "updatedAt")
       VALUES ($1, $2, $3, now())`,
      [TEST_TENANT_ID, "MI Constraint Test Tenant", `mi-test-${TS}`]
    );

    await pool.query(
      `INSERT INTO "MeetingIntegration" (id, "tenantId", provider, name, config, "updatedAt")
       VALUES ($1, $2, $3, $4, $5, now())
       RETURNING status`,
      [INTEGRATION_ID, TEST_TENANT_ID, "fireflies", "Fireflies", "{}"]
    );
  });

  afterAll(async () => {
    await pool.query(
      `DELETE FROM "MeetingInsight"      WHERE "tenantId" = $1`,
      [TEST_TENANT_ID]
    );
    await pool.query(
      `DELETE FROM "MeetingTranscript"   WHERE "tenantId" = $1`,
      [TEST_TENANT_ID]
    );
    await pool.query(
      `DELETE FROM "MeetingIntegration"  WHERE "tenantId" = $1`,
      [TEST_TENANT_ID]
    );
    await pool.query(`DELETE FROM "Tenant"              WHERE id = $1`, [
      TEST_TENANT_ID,
    ]);
    await pool.end();
  });

  describe("MeetingIntegration", () => {
    it("status defaults to ACTIVE when not supplied", async () => {
      const { rows } = await pool.query(
        `SELECT status FROM "MeetingIntegration" WHERE id = $1`,
        [INTEGRATION_ID]
      );
      expect(rows[0].status).toBe("ACTIVE");
    });
  });

  describe("MeetingTranscript", () => {
    it("rejects duplicate [tenantId, meetingId] (idempotency)", async () => {
      await pool.query(
        `INSERT INTO "MeetingTranscript"
           (id, "tenantId", "integrationId", "meetingId", "updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, now())`,
        [TEST_TENANT_ID, INTEGRATION_ID, `meeting-${TS}`]
      );
      await expect(
        pool.query(
          `INSERT INTO "MeetingTranscript"
             (id, "tenantId", "integrationId", "meetingId", "updatedAt")
           VALUES (gen_random_uuid()::text, $1, $2, $3, now())`,
          [TEST_TENANT_ID, INTEGRATION_ID, `meeting-${TS}`]
        )
      ).rejects.toThrow(UNIQUE_VIOLATION_RE);
    });
  });

  describe("MeetingInsight", () => {
    it("status defaults to PENDING when not supplied", async () => {
      const { rows: tx } = await pool.query(
        `INSERT INTO "MeetingTranscript"
           (id, "tenantId", "integrationId", "meetingId", "updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, now())
         RETURNING id`,
        [TEST_TENANT_ID, INTEGRATION_ID, `meeting-insight-${TS}`]
      );
      const { rows } = await pool.query(
        `INSERT INTO "MeetingInsight"
           (id, "tenantId", "transcriptId", type, text, "updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, now())
         RETURNING status`,
        [TEST_TENANT_ID, tx[0].id, "ACTION", "Follow up with Team Alpha"]
      );
      expect(rows[0].status).toBe("PENDING");
    });
  });
});
