-- AlterTable: Add INVEST scoring + description fields to Epic
ALTER TABLE "Epic"
  ADD COLUMN IF NOT EXISTS "investScore"     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "investBreakdown" JSONB,
  ADD COLUMN IF NOT EXISTS "investHash"      TEXT,
  ADD COLUMN IF NOT EXISTS "descriptionMd"  TEXT;
