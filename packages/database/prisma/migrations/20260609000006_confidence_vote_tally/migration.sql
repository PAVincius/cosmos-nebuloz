-- Story-018: Anonymous confidence vote tally

ALTER TABLE "ConfidenceVoteSession"
  ADD COLUMN IF NOT EXISTS "averageScore"    DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "facilitatorNote" TEXT;

CREATE TABLE IF NOT EXISTS "ConfidenceVoteTally" (
  "id"               TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId"         TEXT NOT NULL,
  "voteSessionId"    TEXT NOT NULL,
  "piPlanId"         TEXT NOT NULL,
  "round"            INTEGER NOT NULL DEFAULT 1,
  "score1Count"      INTEGER NOT NULL DEFAULT 0,
  "score2Count"      INTEGER NOT NULL DEFAULT 0,
  "score3Count"      INTEGER NOT NULL DEFAULT 0,
  "score4Count"      INTEGER NOT NULL DEFAULT 0,
  "score5Count"      INTEGER NOT NULL DEFAULT 0,
  "totalVotes"       INTEGER NOT NULL DEFAULT 0,
  "participantCount" INTEGER NOT NULL DEFAULT 0,
  "participationRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "aggregateScore"   DOUBLE PRECISION,
  "revealedAt"       TIMESTAMP(3),
  "closedAt"         TIMESTAMP(3),
  "facilitatorNote"  TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

ALTER TABLE "ConfidenceVoteTally"
  ADD CONSTRAINT "ConfidenceVoteTally_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "ConfidenceVoteTally_voteSessionId_fkey"
    FOREIGN KEY ("voteSessionId") REFERENCES "ConfidenceVoteSession"("id") ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "ConfidenceVoteTally_voteSessionId_round_key"
  ON "ConfidenceVoteTally"("voteSessionId", "round");

CREATE INDEX IF NOT EXISTS "ConfidenceVoteTally_tenantId_idx"
  ON "ConfidenceVoteTally"("tenantId");

CREATE INDEX IF NOT EXISTS "ConfidenceVoteTally_piPlanId_idx"
  ON "ConfidenceVoteTally"("piPlanId");
