-- Story-020: Program Board — Sprint piPlanId + DependencyLink boardStatus

ALTER TABLE "Sprint"
  ADD COLUMN IF NOT EXISTS "piPlanId"   TEXT,
  ADD COLUMN IF NOT EXISTS "isIPSprint" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "DependencyLink"
  ADD COLUMN IF NOT EXISTS "boardStatus"  TEXT NOT NULL DEFAULT 'IDENTIFIED',
  ADD COLUMN IF NOT EXISTS "criticalPath" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "Sprint_piPlanId_idx" ON "Sprint"("piPlanId");
CREATE INDEX IF NOT EXISTS "DependencyLink_boardStatus_idx" ON "DependencyLink"("boardStatus");
CREATE INDEX IF NOT EXISTS "DependencyLink_tenantId_boardStatus_idx" ON "DependencyLink"("tenantId", "boardStatus");
