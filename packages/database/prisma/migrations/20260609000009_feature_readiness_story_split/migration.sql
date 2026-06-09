-- Story-021: Feature readiness checklist + ART-scoped IDs + story split wizard

CREATE TABLE IF NOT EXISTS "ArtSequenceCounter" (
  "id"       TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "artId"    TEXT NOT NULL,
  "type"     TEXT NOT NULL DEFAULT 'FEATURE',
  "next"     INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "ArtSequenceCounter_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE,
  CONSTRAINT "ArtSequenceCounter_artId_fkey"    FOREIGN KEY ("artId")    REFERENCES "ART"("id")    ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ArtSequenceCounter_artId_type_key" ON "ArtSequenceCounter"("artId", "type");
CREATE INDEX        IF NOT EXISTS "ArtSequenceCounter_tenantId_idx"   ON "ArtSequenceCounter"("tenantId");

ALTER TABLE "Feature"
  ADD COLUMN IF NOT EXISTS "artScopedId"           TEXT,
  ADD COLUMN IF NOT EXISTS "assignedTeamId"        TEXT,
  ADD COLUMN IF NOT EXISTS "acceptanceCriteria"    JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "readinessOverridden"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "readinessOverrideNote" TEXT,
  ADD COLUMN IF NOT EXISTS "readinessOverrideBy"   TEXT,
  ADD COLUMN IF NOT EXISTS "readinessOverrideAt"   TIMESTAMP(3);

ALTER TABLE "Story"
  ADD COLUMN IF NOT EXISTS "origin"            TEXT NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS "originStoryId"     TEXT,
  ADD COLUMN IF NOT EXISTS "splitIntoStoryIds" JSONB NOT NULL DEFAULT '[]';

CREATE INDEX IF NOT EXISTS "Feature_artScopedId_idx"    ON "Feature"("artScopedId");
CREATE INDEX IF NOT EXISTS "Feature_assignedTeamId_idx" ON "Feature"("assignedTeamId");
CREATE INDEX IF NOT EXISTS "Story_originStoryId_idx"    ON "Story"("originStoryId");
