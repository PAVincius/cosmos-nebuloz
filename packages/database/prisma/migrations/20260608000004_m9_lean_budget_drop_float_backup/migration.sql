-- M9: Remove legacy LeanBudget.spent Float backup column
-- The Decimal column already maps to the "spent" column name.
-- spentDecimal Decimal? @map("spent") becomes spent Decimal? (no map needed).

ALTER TABLE "LeanBudget" DROP COLUMN IF EXISTS "spent_float_backup";
