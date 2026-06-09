-- Story-015: WSJF Scoring Engine
-- Adds explicit WSJF fields to Feature and creates immutable ScoringEvent table

ALTER TABLE "Feature"
  ADD COLUMN IF NOT EXISTS "wsjfCostOfDelay"     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "wsjfNormalizedScore"  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "wsjfConfidence"       TEXT,
  ADD COLUMN IF NOT EXISTS "wsjfScoredBy"         TEXT,
  ADD COLUMN IF NOT EXISTS "wsjfScoredAt"         TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "wsjfJobSizeLockedBy"  TEXT,
  ADD COLUMN IF NOT EXISTS "wsjfJobSizeLockedAt"  TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "ScoringEvent" (
  "id"              TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "tenantId"        TEXT NOT NULL,
  "epicId"          TEXT,
  "featureId"       TEXT,
  "prevBv"          DOUBLE PRECISION,
  "prevTc"          DOUBLE PRECISION,
  "prevRr"          DOUBLE PRECISION,
  "prevJs"          DOUBLE PRECISION,
  "prevScore"       DOUBLE PRECISION,
  "bv"              DOUBLE PRECISION,
  "tc"              DOUBLE PRECISION,
  "rr"              DOUBLE PRECISION,
  "js"              DOUBLE PRECISION,
  "wsjfScore"       DOUBLE PRECISION,
  "normalizedScore" DOUBLE PRECISION,
  "confidence"      TEXT,
  "source"          TEXT NOT NULL DEFAULT 'MANUAL',
  "userId"          TEXT,
  "justification"   TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ScoringEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ScoringEvent_tenantId_idx" ON "ScoringEvent"("tenantId");
CREATE INDEX IF NOT EXISTS "ScoringEvent_featureId_idx" ON "ScoringEvent"("featureId");
CREATE INDEX IF NOT EXISTS "ScoringEvent_epicId_idx"   ON "ScoringEvent"("epicId");

-- Prevent UPDATE and DELETE on ScoringEvent (append-only)
CREATE OR REPLACE FUNCTION prevent_scoring_event_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'ScoringEvent is append-only and cannot be modified or deleted';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_scoring_event_update ON "ScoringEvent";
CREATE TRIGGER trg_prevent_scoring_event_update
  BEFORE UPDATE OR DELETE ON "ScoringEvent"
  FOR EACH ROW EXECUTE FUNCTION prevent_scoring_event_mutation();
