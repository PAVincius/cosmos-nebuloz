-- Story-024: Defects, impediments & anomaly escalation

ALTER TABLE "Defect"
  ADD COLUMN IF NOT EXISTS "sprintId" TEXT,
  ADD COLUMN IF NOT EXISTS "originSprintId" TEXT,
  ADD COLUMN IF NOT EXISTS "reopenReason" TEXT,
  ADD COLUMN IF NOT EXISTS "isStale" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "staleAt" TIMESTAMP(3);

ALTER TABLE "Impediment"
  ADD COLUMN IF NOT EXISTS "artId" TEXT,
  ADD COLUMN IF NOT EXISTS "linkedRiskId" TEXT,
  ADD COLUMN IF NOT EXISTS "resolutionNote" TEXT,
  ADD COLUMN IF NOT EXISTS "resolutionTime" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "severity" INTEGER NOT NULL DEFAULT 3;

ALTER TABLE "Risk"
  ADD COLUMN IF NOT EXISTS "impedimentId" TEXT;

ALTER TABLE "SprintReview"
  ADD COLUMN IF NOT EXISTS "defectCount" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "Defect_sprintId_idx" ON "Defect"("sprintId");
CREATE INDEX IF NOT EXISTS "Impediment_tenantId_status_idx" ON "Impediment"("tenantId", "status");
