-- Integration Hub migration
-- Enhances Integration model, adds SyncLog, adds external fields to Feature and Story

-- 1. Enhance Integration model (rename type→source, add mapping, lastSyncAt, drop unique constraint)
ALTER TABLE "Integration" RENAME COLUMN "type" TO "source";
ALTER TABLE "Integration" ADD COLUMN "mapping" JSONB;
ALTER TABLE "Integration" ADD COLUMN "lastSyncAt" TIMESTAMP(3);
DROP INDEX IF EXISTS "Integration_tenantId_type_key";
CREATE INDEX "Integration_tenantId_source_idx" ON "Integration"("tenantId", "source");

-- 2. SyncLog table
CREATE TABLE "SyncLog" (
    "id"            TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "type"          TEXT NOT NULL,
    "status"        TEXT NOT NULL,
    "itemsCreated"  INTEGER NOT NULL DEFAULT 0,
    "itemsUpdated"  INTEGER NOT NULL DEFAULT 0,
    "itemsSkipped"  INTEGER NOT NULL DEFAULT 0,
    "errors"        JSONB,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "SyncLog" ADD CONSTRAINT "SyncLog_integrationId_fkey"
    FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "SyncLog_integrationId_idx" ON "SyncLog"("integrationId");
CREATE INDEX "SyncLog_integrationId_createdAt_idx" ON "SyncLog"("integrationId", "createdAt");

-- 3. External fields on Feature
ALTER TABLE "Feature" ADD COLUMN "externalId"     TEXT;
ALTER TABLE "Feature" ADD COLUMN "externalSource" TEXT;
ALTER TABLE "Feature" ADD COLUMN "externalUrl"    TEXT;
CREATE INDEX "Feature_externalSource_externalId_idx" ON "Feature"("externalSource", "externalId");

-- 4. External fields on Story
ALTER TABLE "Story" ADD COLUMN "externalId"     TEXT;
ALTER TABLE "Story" ADD COLUMN "externalSource" TEXT;
ALTER TABLE "Story" ADD COLUMN "externalUrl"    TEXT;
CREATE INDEX "Story_externalSource_externalId_idx" ON "Story"("externalSource", "externalId");
