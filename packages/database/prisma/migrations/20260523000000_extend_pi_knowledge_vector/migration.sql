-- AlterTable: extend PIKnowledgeVector with source classification, hybrid-search fields
ALTER TABLE "PIKnowledgeVector"
  ADD COLUMN "sourceType"  TEXT          NOT NULL DEFAULT 'document',
  ADD COLUMN "sourceId"    TEXT,
  ADD COLUMN "sessionId"   TEXT,
  ADD COLUMN "chunkIndex"  INTEGER       NOT NULL DEFAULT 0,
  ADD COLUMN "title"       TEXT,
  ADD COLUMN "metadata"    JSONB,
  ADD COLUMN "createdAt"   TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt"   TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Trigger to keep updatedAt fresh
CREATE OR REPLACE FUNCTION "update_PIKnowledgeVector_updatedAt"()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PIKnowledgeVector_updatedAt_trigger"
  BEFORE UPDATE ON "PIKnowledgeVector"
  FOR EACH ROW EXECUTE FUNCTION "update_PIKnowledgeVector_updatedAt"();

-- Unique constraint for idempotent upsert by (tenant, source type, source entity, chunk)
-- Only applies when sourceId IS NOT NULL (tenant-indexed entities); documents use plain id
CREATE UNIQUE INDEX "PIKnowledgeVector_source_unique"
  ON "PIKnowledgeVector"("tenantId", "sourceType", "sourceId", "chunkIndex")
  WHERE "sourceId" IS NOT NULL;

-- Fast filtering by sourceType within a tenant
CREATE INDEX "PIKnowledgeVector_tenantId_sourceType_idx"
  ON "PIKnowledgeVector"("tenantId", "sourceType");
