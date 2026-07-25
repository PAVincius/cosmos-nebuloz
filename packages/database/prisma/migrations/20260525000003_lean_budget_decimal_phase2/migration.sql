-- Phase 2: Backfill spentDecimal from existing spent (Float)
-- Safe to run while app is live — reads from Float, writes to Decimal
UPDATE "LeanBudget"
SET "spentDecimal" = CAST("spent" AS DECIMAL(18,6))
WHERE "spentDecimal" = 0 AND "spent" > 0;
