-- Reverte 20260929010500_signal_frozen_terminal: volta à função de
-- 20260929010100 (só meta e baseline).
CREATE OR REPLACE FUNCTION prevent_signal_frozen_target_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."state" = 'FROZEN' AND (
    NEW."targetValue" IS DISTINCT FROM OLD."targetValue" OR
    NEW."baselineValue" IS DISTINCT FROM OLD."baselineValue"
  ) THEN
    RAISE EXCEPTION 'SignalPlanMetric % is FROZEN: target and baseline cannot change. Request a target review from Scaffold.', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
