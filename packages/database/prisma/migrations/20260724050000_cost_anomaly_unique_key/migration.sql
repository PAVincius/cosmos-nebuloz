-- Track 2 review fix (MEDIUM): CostAnomaly's only DB unique constraint is
-- (tenantId, themeId, service, period), but detect-cost-anomalies.ts always
-- writes themeId: null and groups by (service, accountId) — Postgres treats
-- NULL as distinct in unique indexes, so that constraint never deduped rows
-- sharing (tenantId, service, period) with different accountId. Detection
-- instead relied on an explicit find-then-create keyed on
-- (tenantId, service, accountId, period) before every insert — a race
-- window: two concurrent "Detectar agora" calls (or a double-submitted
-- click) can have both findFirst calls return null and both create()
-- succeed, writing duplicate CostAnomaly rows.
--
-- This mirrors FlowMetricSnapshot's fix (20260724020000): service/accountId
-- are nullable in the schema, but BillingEntry.service and
-- BillingEntry.accountId are both non-nullable, and detect-cost-anomalies.ts
-- is CostAnomaly's only write path — so every row written by that path
-- already has non-null service/accountId, making a plain (non-partial)
-- unique index sufficient here (no NULL-distinct problem in practice).
--
-- Existing rows may already violate the new key (from the race this fix
-- closes), so de-duplicate FIRST — keep the most recent row per key
-- (detectedAt desc, id desc as a deterministic tiebreak) — THEN create the
-- unique index. Creating the index before de-duping would fail on dup data.

WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "tenantId", "service", "accountId", "period"
      ORDER BY "detectedAt" DESC, "id" DESC
    ) AS rn
  FROM "CostAnomaly"
)
DELETE FROM "CostAnomaly"
WHERE "id" IN (SELECT "id" FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX "CostAnomaly_tenantId_service_accountId_period_key"
  ON "CostAnomaly"("tenantId", "service", "accountId", "period");
