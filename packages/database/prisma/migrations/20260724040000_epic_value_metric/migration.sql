-- EpicValueMetric — links a delivered epic to a business-value metric with
-- planned vs. actual realization (Value Realization screen, design handoff
-- screen-bundle-1.jsx:1283). Genuinely new sub-domain — no backing model
-- existed anywhere before this migration. epicId is a plain app-layer
-- tenant-guarded reference (no FK constraint), matching the existing
-- RoadmapItem.epicId / LeanBudget.artId precedent — not every FK in this
-- schema is enforced at the DB level.

CREATE TABLE "EpicValueMetric" (
  "id"           TEXT NOT NULL,
  "tenantId"     TEXT NOT NULL,
  "epicId"       TEXT NOT NULL,
  "metricLabel"  TEXT NOT NULL,
  "unit"         TEXT,
  "plannedValue" DOUBLE PRECISION NOT NULL,
  "actualValue"  DOUBLE PRECISION,
  "status"       TEXT NOT NULL DEFAULT 'pending',
  "measuredAt"   TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EpicValueMetric_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "EpicValueMetric" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EpicValueMetric" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "EpicValueMetric"
  USING ("tenantId" = current_tenant_id());

CREATE INDEX "EpicValueMetric_tenantId_idx"
  ON "EpicValueMetric"("tenantId");
CREATE INDEX "EpicValueMetric_tenantId_epicId_idx"
  ON "EpicValueMetric"("tenantId", "epicId");

ALTER TABLE "EpicValueMetric" ADD CONSTRAINT "EpicValueMetric_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;
