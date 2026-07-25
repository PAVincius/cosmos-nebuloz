-- Story-019: ROAM risk management extended fields

ALTER TABLE "Risk"
  ADD COLUMN IF NOT EXISTS "roamStatus"           TEXT NOT NULL DEFAULT 'UNCLASSIFIED',
  ADD COLUMN IF NOT EXISTS "severity"             INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS "ownerId"              TEXT,
  ADD COLUMN IF NOT EXISTS "ownedAt"              TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "mitigationPlan"       TEXT,
  ADD COLUMN IF NOT EXISTS "resolutionNote"       TEXT,
  ADD COLUMN IF NOT EXISTS "resolvedAt"           TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "source"               TEXT NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS "aiConfidence"         DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "aiJustification"      TEXT,
  ADD COLUMN IF NOT EXISTS "overdue"              BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "escalatedToPortfolio" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "dueDate"              TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Risk_tenantId_roamStatus_idx" ON "Risk"("tenantId", "roamStatus");
CREATE INDEX IF NOT EXISTS "Risk_tenantId_overdue_idx" ON "Risk"("tenantId", "overdue");
