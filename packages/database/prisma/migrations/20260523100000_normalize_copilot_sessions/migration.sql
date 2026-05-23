-- ============================================================
-- Normalize copilot session schema
--
-- Context: original migration created "CopilotSession" (PascalCase,
-- case-sensitive in Postgres). Prisma source now maps to copilot_sessions
-- (snake_case). This migration renames tables, drops unused enum types,
-- and adds the missing fields the app requires.
-- ============================================================

-- Step 1: Rename tables from PascalCase → snake_case
-- Use DO blocks so the rename is idempotent (safe to re-run).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'CopilotSession') THEN
    ALTER TABLE "CopilotSession" RENAME TO copilot_sessions;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'CopilotMessage') THEN
    ALTER TABLE "CopilotMessage" RENAME TO copilot_messages;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'CopilotToolInvocation') THEN
    ALTER TABLE "CopilotToolInvocation" RENAME TO copilot_tool_invocations;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'CopilotSuggestion') THEN
    ALTER TABLE "CopilotSuggestion" RENAME TO copilot_suggestion_archive;
  END IF;
END $$;

-- Step 2: Rename indexes (only if they still carry the old name)

DO $$
DECLARE idx TEXT;
BEGIN
  FOR idx IN VALUES
    ('CopilotSession_tenantId_idx',         'copilot_sessions_tenantId_idx'),
    ('CopilotSession_tenantId_userId_idx',   'copilot_sessions_tenantId_userId_idx'),
    ('CopilotSession_tenantId_createdAt_idx','copilot_sessions_tenantId_createdAt_idx'),
    ('CopilotMessage_sessionId_idx',         'copilot_messages_sessionId_idx'),
    ('CopilotToolInvocation_sessionId_idx',  'copilot_tool_invocations_sessionId_idx')
  LOOP
    NULL; -- iterated via the FOR row structure below
  END LOOP;
END $$;

-- Rename indexes individually (simpler than looping over pairs in plain SQL)
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'CopilotSession_tenantId_idx')          THEN ALTER INDEX "CopilotSession_tenantId_idx"          RENAME TO copilot_sessions_tenantId_idx;          END IF; END $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'CopilotSession_tenantId_userId_idx')    THEN ALTER INDEX "CopilotSession_tenantId_userId_idx"    RENAME TO copilot_sessions_tenantId_userId_idx;    END IF; END $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'CopilotSession_tenantId_createdAt_idx') THEN ALTER INDEX "CopilotSession_tenantId_createdAt_idx" RENAME TO copilot_sessions_tenantId_createdAt_idx; END IF; END $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'CopilotMessage_sessionId_idx')          THEN ALTER INDEX "CopilotMessage_sessionId_idx"          RENAME TO copilot_messages_sessionId_idx;          END IF; END $$;

-- Step 3: Convert enum columns → TEXT on copilot_sessions
-- The original migration used CopilotMode/CopilotSurface enums.
-- We drop them in favour of plain TEXT with app-layer validation.

DO $$
BEGIN
  -- mode: was CopilotMode enum, convert to TEXT
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'copilot_sessions' AND column_name = 'mode'
               AND data_type = 'USER-DEFINED') THEN
    ALTER TABLE copilot_sessions ALTER COLUMN "mode" TYPE TEXT USING "mode"::TEXT;
    ALTER TABLE copilot_sessions ALTER COLUMN "mode" SET DEFAULT 'global';
  END IF;

  -- surface: was CopilotSurface enum, convert to TEXT
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'copilot_sessions' AND column_name = 'surface'
               AND data_type = 'USER-DEFINED') THEN
    ALTER TABLE copilot_sessions ALTER COLUMN "surface" TYPE TEXT USING "surface"::TEXT;
  END IF;
END $$;

-- Step 4: Add new columns to copilot_sessions
ALTER TABLE copilot_sessions
  ADD COLUMN IF NOT EXISTS "mode"          TEXT NOT NULL DEFAULT 'global',
  ADD COLUMN IF NOT EXISTS "title"         TEXT,
  ADD COLUMN IF NOT EXISTS "messages"      JSONB,
  ADD COLUMN IF NOT EXISTS "messageCount"  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastMessageAt" TIMESTAMP(3);

-- Make userId nullable (was NOT NULL in original migration)
ALTER TABLE copilot_sessions ALTER COLUMN "userId" DROP NOT NULL;

-- Drop columns that no longer exist in source schema
ALTER TABLE copilot_sessions
  DROP COLUMN IF EXISTS "contextRef",
  DROP COLUMN IF EXISTS "metadata",
  DROP COLUMN IF EXISTS "artId";

-- Step 5: Add tenantId + tokens to copilot_messages
ALTER TABLE copilot_messages
  ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "tokens"   INTEGER;

-- Drop unused columns from original schema
ALTER TABLE copilot_messages
  DROP COLUMN IF EXISTS "sender";

-- Backfill tenantId from the parent session
UPDATE copilot_messages cm
SET    "tenantId" = cs."tenantId"
FROM   copilot_sessions cs
WHERE  cm."sessionId" = cs."id"
  AND  cm."tenantId"  = '';

-- Step 6: Add composite index for efficient session listing (most recent first)
CREATE INDEX IF NOT EXISTS "copilot_sessions_tenantId_updatedAt_idx"
  ON copilot_sessions ("tenantId", "updatedAt" DESC);

-- Add cross-tenant message query index
CREATE INDEX IF NOT EXISTS "copilot_messages_tenantId_sessionId_idx"
  ON copilot_messages ("tenantId", "sessionId");

-- Step 7: Drop unused enum types (only after columns converted)
DROP TYPE IF EXISTS "CopilotMode";
DROP TYPE IF EXISTS "CopilotSurface";
DROP TYPE IF EXISTS "SuggestionStatus";
DROP TYPE IF EXISTS "SuggestionType";
