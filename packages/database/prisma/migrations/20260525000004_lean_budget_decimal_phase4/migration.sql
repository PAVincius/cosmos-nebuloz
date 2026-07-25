-- Phase 4: Parity check before switching reads to spentDecimal
-- Aborts if any row has spent vs spentDecimal divergence > 0.01
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "LeanBudget"
    WHERE "spentDecimal" IS NOT NULL
      AND ABS(CAST("spent" AS NUMERIC) - "spentDecimal") > 0.01
  ) THEN
    RAISE EXCEPTION 'Parity check failed: spent and spentDecimal diverge by > 0.01. Investigate before proceeding.';
  END IF;
END $$;

-- No DDL for phase 4 — app layer switches reads (handled in code)
SELECT 'Phase 4: parity check passed' AS status;
