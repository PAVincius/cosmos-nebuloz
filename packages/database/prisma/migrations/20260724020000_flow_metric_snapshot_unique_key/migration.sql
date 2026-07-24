-- Track 2 review fix (HIGH): FlowMetricSnapshot had no uniqueness — only
-- @@index entries — so originateFlowSnapshot's findFirst->create is not
-- race-safe. backfillPeriodSnapshots running while closeSprint fires for the
-- same sprint (or a double-submitted close) can have both findFirst calls
-- return null and both create() succeed, writing two snapshots for the same
-- (tenantId, scope, scopeId, period, periodRef) and rendering that sprint
-- twice in getFlowMetricsSeries' CFD/throughput history.
--
-- Mirrors TeamCapacitySnapshot's @@unique([sprintId, teamId]), which already
-- makes its identical find-then-create race-safe: the concurrent loser hits
-- P2002, caught by the caller's try/catch (lifecycle.ts / backfill-snapshots.ts
-- both wrap the origination call and log-only on failure).
--
-- Existing rows may already violate the new key (from the race this fix
-- closes), so de-duplicate FIRST — keep the most recent row per key
-- (recordedAt desc, id desc as a deterministic tiebreak) — THEN create the
-- unique index. Creating the index before de-duping would fail on dup data.

WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "tenantId", "scope", "scopeId", "period", "periodRef"
      ORDER BY "recordedAt" DESC, "id" DESC
    ) AS rn
  FROM "FlowMetricSnapshot"
)
DELETE FROM "FlowMetricSnapshot"
WHERE "id" IN (SELECT "id" FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX "FlowMetricSnapshot_tenantId_scope_scopeId_period_periodRef_key"
  ON "FlowMetricSnapshot"("tenantId", "scope", "scopeId", "period", "periodRef");
