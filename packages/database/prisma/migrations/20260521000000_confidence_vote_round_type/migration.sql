-- AddColumn: roundType to ConfidenceVoteSession
ALTER TABLE "ConfidenceVoteSession"
  ADD COLUMN IF NOT EXISTS "roundType" TEXT NOT NULL DEFAULT 'CONFIDENCE';
