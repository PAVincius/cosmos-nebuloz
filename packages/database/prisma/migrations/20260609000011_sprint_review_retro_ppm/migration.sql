-- Story-023: Sprint review accepted points guard, retro phases, PPM

ALTER TABLE "SprintReview"
  ADD COLUMN IF NOT EXISTS "completedPoints" INTEGER,
  ADD COLUMN IF NOT EXISTS "acceptedPoints" INTEGER;

ALTER TABLE "Retrospective"
  ADD COLUMN IF NOT EXISTS "teamId" TEXT,
  ADD COLUMN IF NOT EXISTS "phase" TEXT NOT NULL DEFAULT 'INPUT',
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS "anonymousInput" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "votesPerMember" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3);

ALTER TABLE "PIObjective"
  ADD COLUMN IF NOT EXISTS "plannedValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "achievedValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "sprintContributions" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "PIPlan"
  ADD COLUMN IF NOT EXISTS "ppm" DOUBLE PRECISION;

CREATE TABLE IF NOT EXISTS "RetroItem" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "retroId" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'WENT_WELL',
  "text" TEXT NOT NULL,
  "authorId" TEXT,
  "voteCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RetroItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RetroVote" (
  "itemId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RetroVote_pkey" PRIMARY KEY ("itemId", "userId")
);

CREATE TABLE IF NOT EXISTS "RetroActionItem" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "retroId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "carriedFromRetroId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RetroActionItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Retrospective_teamId_idx" ON "Retrospective"("teamId");
CREATE INDEX IF NOT EXISTS "RetroItem_tenantId_idx" ON "RetroItem"("tenantId");
CREATE INDEX IF NOT EXISTS "RetroItem_retroId_idx" ON "RetroItem"("retroId");
CREATE INDEX IF NOT EXISTS "RetroVote_userId_idx" ON "RetroVote"("userId");
CREATE INDEX IF NOT EXISTS "RetroActionItem_tenantId_idx" ON "RetroActionItem"("tenantId");
CREATE INDEX IF NOT EXISTS "RetroActionItem_retroId_idx" ON "RetroActionItem"("retroId");
