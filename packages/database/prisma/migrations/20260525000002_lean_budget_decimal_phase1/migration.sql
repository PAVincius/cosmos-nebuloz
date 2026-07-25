-- Phase 1: Add spentDecimal (Decimal) column and spentSource + spentManualOverride columns
-- The existing spent (Float) column stays — dual-write in phase 3
ALTER TABLE "LeanBudget"
  ADD COLUMN IF NOT EXISTS "spentDecimal" DECIMAL(18,6) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "spentSource" TEXT NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS "spentManualOverride" DECIMAL(18,6);
