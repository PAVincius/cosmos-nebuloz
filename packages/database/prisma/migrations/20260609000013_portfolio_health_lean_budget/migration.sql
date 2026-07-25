-- Story-025: Strategic themes, lean budget & portfolio health report

-- LeanBudget: add CapEx/OpEx split, piPlanId, immutableAt, unique constraint
ALTER TABLE "LeanBudget"
  ADD COLUMN IF NOT EXISTS "capexPct"   DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "opexPct"    DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "piPlanId"   TEXT,
  ADD COLUMN IF NOT EXISTS "immutableAt" TIMESTAMP(3);

-- Unique per ART/PI (only when both are set)
CREATE UNIQUE INDEX IF NOT EXISTS "LeanBudget_artId_piPlanId_key"
  ON "LeanBudget"("artId", "piPlanId")
  WHERE "artId" IS NOT NULL AND "piPlanId" IS NOT NULL;

-- LeanBudgetReallocation: immutable audit trail
CREATE TABLE IF NOT EXISTS "LeanBudgetReallocation" (
  "id"           TEXT NOT NULL,
  "tenantId"     TEXT NOT NULL,
  "leanBudgetId" TEXT NOT NULL,
  "fromAmount"   DOUBLE PRECISION NOT NULL,
  "toAmount"     DOUBLE PRECISION NOT NULL,
  "reason"       TEXT NOT NULL,
  "authorUserId" TEXT NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LeanBudgetReallocation_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "LeanBudgetReallocation"
  ADD CONSTRAINT "LeanBudgetReallocation_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "LeanBudgetReallocation_leanBudgetId_fkey"
    FOREIGN KEY ("leanBudgetId") REFERENCES "LeanBudget"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "LeanBudgetReallocation_tenantId_idx"     ON "LeanBudgetReallocation"("tenantId");
CREATE INDEX IF NOT EXISTS "LeanBudgetReallocation_leanBudgetId_idx" ON "LeanBudgetReallocation"("leanBudgetId");

-- Immutable trigger (AC-003)
CREATE OR REPLACE FUNCTION prevent_reallocation_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'LeanBudgetReallocation entries are immutable.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS reallocation_immutable ON "LeanBudgetReallocation";
CREATE TRIGGER reallocation_immutable
  BEFORE UPDATE OR DELETE ON "LeanBudgetReallocation"
  FOR EACH ROW EXECUTE FUNCTION prevent_reallocation_mutation();

-- PortfolioAnalysisReport: batch INVEST analysis results (AC-006/007/008)
CREATE TABLE IF NOT EXISTS "PortfolioAnalysisReport" (
  "id"               TEXT NOT NULL,
  "tenantId"         TEXT NOT NULL,
  "artId"            TEXT NOT NULL,
  "jobId"            TEXT,
  "completionStatus" TEXT NOT NULL DEFAULT 'QUEUED',
  "epicCount"        INTEGER NOT NULL DEFAULT 0,
  "skippedCount"     INTEGER NOT NULL DEFAULT 0,
  "reportJson"       JSONB,
  "expiresAt"        TIMESTAMP(3),
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PortfolioAnalysisReport_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PortfolioAnalysisReport"
  ADD CONSTRAINT "PortfolioAnalysisReport_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "PortfolioAnalysisReport_jobId_key" ON "PortfolioAnalysisReport"("jobId") WHERE "jobId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "PortfolioAnalysisReport_tenantId_idx"             ON "PortfolioAnalysisReport"("tenantId");
CREATE INDEX IF NOT EXISTS "PortfolioAnalysisReport_tenantId_artId_idx"        ON "PortfolioAnalysisReport"("tenantId", "artId");
CREATE INDEX IF NOT EXISTS "PortfolioAnalysisReport_tenantId_artId_createdAt_idx" ON "PortfolioAnalysisReport"("tenantId", "artId", "createdAt");
