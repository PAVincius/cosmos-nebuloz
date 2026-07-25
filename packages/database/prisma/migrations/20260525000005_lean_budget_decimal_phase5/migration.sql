-- Phase 5: Drop old Float column, make spentDecimal the canonical spent
-- WARNING: Only run after phase 4 has been stable for 1+ week in production
-- This migration is NOT applied automatically — run manually after validation

-- Step A: Backup old float column
ALTER TABLE "LeanBudget" RENAME COLUMN "spent" TO "spent_float_backup";

-- Step B: Rename spentDecimal → spent
ALTER TABLE "LeanBudget" RENAME COLUMN "spentDecimal" TO "spent";

-- Step C: Drop backup (run separately after validation):
-- ALTER TABLE "LeanBudget" DROP COLUMN "spent_float_backup";
