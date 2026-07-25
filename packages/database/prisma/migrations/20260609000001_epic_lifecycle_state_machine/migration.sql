-- Story-011: Epic Lifecycle State Machine
-- Adds SAFe lifecycle fields to Epic and extends StateTransitionHistory

-- Epic lifecycle status (separate from kanban statusId)
ALTER TABLE "Epic"
  ADD COLUMN IF NOT EXISTS "lifecycleStatus" TEXT NOT NULL DEFAULT 'FUNNEL',
  ADD COLUMN IF NOT EXISTS "investScoreOverridden" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "investScoreOutdated" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "hypothesis" TEXT,
  ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT,
  ADD COLUMN IF NOT EXISTS "hypothesisResolution" TEXT,
  ADD COLUMN IF NOT EXISTS "leanBudgetAllocation" DOUBLE PRECISION;

-- StateTransitionHistory audit extensions
ALTER TABLE "StateTransitionHistory"
  ADD COLUMN IF NOT EXISTS "reason" TEXT,
  ADD COLUMN IF NOT EXISTS "externalRef" TEXT;

-- DB trigger: enforce valid SAFe lifecycle transitions at DB level (AC-006)
CREATE OR REPLACE FUNCTION check_epic_lifecycle_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- No-op when status unchanged
  IF OLD."lifecycleStatus" = NEW."lifecycleStatus" THEN
    RETURN NEW;
  END IF;

  IF (OLD."lifecycleStatus", NEW."lifecycleStatus") NOT IN (
    ('FUNNEL', 'ANALYZING'),
    ('FUNNEL', 'REJECTED'),
    ('ANALYZING', 'PORTFOLIO_BACKLOG'),
    ('ANALYZING', 'REJECTED'),
    ('PORTFOLIO_BACKLOG', 'IMPLEMENTING'),
    ('PORTFOLIO_BACKLOG', 'REJECTED'),
    ('IMPLEMENTING', 'DONE'),
    ('IMPLEMENTING', 'REJECTED')
  ) THEN
    RAISE EXCEPTION 'INVALID_EPIC_LIFECYCLE_TRANSITION: % -> %',
      OLD."lifecycleStatus", NEW."lifecycleStatus";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS epic_lifecycle_guard ON "Epic";

CREATE TRIGGER epic_lifecycle_guard
BEFORE UPDATE OF "lifecycleStatus" ON "Epic"
FOR EACH ROW EXECUTE FUNCTION check_epic_lifecycle_transition();

-- RLS: StateTransitionHistory already has tenant-scoped RLS via base migration
-- Index for lifecycle status lookups
CREATE INDEX IF NOT EXISTS "Epic_tenantId_lifecycleStatus_idx"
  ON "Epic"("tenantId", "lifecycleStatus");
