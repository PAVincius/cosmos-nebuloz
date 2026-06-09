-- Story-016: Epic Governance multi-step workflow
-- Adds multi-step fields and DecisionLogEntry immutability trigger

ALTER TABLE "GovernedEpic"
  ADD COLUMN IF NOT EXISTS "currentStepIndex"     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "submittedBy"           TEXT,
  ADD COLUMN IF NOT EXISTS "submittedAt"           TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "bypassedAt"            TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "bypassedBy"            TEXT,
  ADD COLUMN IF NOT EXISTS "slaBreachAt"           TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "allowApprovalBypass"   BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ApprovalRequest"
  ADD COLUMN IF NOT EXISTS "stepIndex"    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "assignedTo"   TEXT,
  ADD COLUMN IF NOT EXISTS "decision"     TEXT,
  ADD COLUMN IF NOT EXISTS "reason"       TEXT,
  ADD COLUMN IF NOT EXISTS "decidedAt"    TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "slaBreachedAt" TIMESTAMP(3);

-- DecisionLogEntry: immutability trigger
CREATE OR REPLACE FUNCTION prevent_decision_log_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Decision log entries are immutable. Type: %, Entry ID: %', TG_OP, OLD.id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS decision_log_immutable ON "DecisionLogEntry";
CREATE TRIGGER decision_log_immutable
  BEFORE UPDATE OR DELETE ON "DecisionLogEntry"
  FOR EACH ROW EXECUTE FUNCTION prevent_decision_log_mutation();
