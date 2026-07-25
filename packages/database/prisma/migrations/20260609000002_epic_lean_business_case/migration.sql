-- Migration: Epic Lean Business Case fields (Story-013)
-- Adds business outcomes, leading indicators, NFRs, MVP, size estimate,
-- and description version history ring buffer to Epic model.

ALTER TABLE "Epic"
  ADD COLUMN IF NOT EXISTS "businessOutcomes"    JSONB,
  ADD COLUMN IF NOT EXISTS "leadingIndicators"   JSONB,
  ADD COLUMN IF NOT EXISTS "nfrs"                TEXT,
  ADD COLUMN IF NOT EXISTS "mvp"                 TEXT,
  ADD COLUMN IF NOT EXISTS "sizeEstimate"        TEXT,
  ADD COLUMN IF NOT EXISTS "descriptionVersions" JSONB;
