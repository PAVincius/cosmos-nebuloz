-- Story-022: Sprint lifecycle, overcommitment guard, standup blocker link

ALTER TABLE "Sprint"
  ADD COLUMN IF NOT EXISTS "velocity" INTEGER,
  ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "overcommitmentOverride" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "overcommitmentJustification" TEXT;

ALTER TABLE "StandupEntry"
  ADD COLUMN IF NOT EXISTS "linkedImpedimentId" TEXT;

CREATE INDEX IF NOT EXISTS "Sprint_teamId_status_idx" ON "Sprint"("teamId", "status");
CREATE INDEX IF NOT EXISTS "StandupEntry_teamId_date_idx" ON "StandupEntry"("teamId", "date");
