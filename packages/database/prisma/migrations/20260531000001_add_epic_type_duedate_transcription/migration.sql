-- AlterTable: Add epicType, dueDate, transcription to Epic
ALTER TABLE "Epic"
  ADD COLUMN IF NOT EXISTS "epicType"      TEXT NOT NULL DEFAULT 'EPIC',
  ADD COLUMN IF NOT EXISTS "dueDate"       TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "transcription" TEXT;
