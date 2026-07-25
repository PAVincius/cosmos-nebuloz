-- Story-036: Global Search (tsvector GIN), Feature Flags, Notification Preferences

-- ─── 1. Full-text search columns + GIN indexes ───────────────────────────────

ALTER TABLE "Epic" ADD COLUMN IF NOT EXISTS "searchVector" tsvector;
ALTER TABLE "Feature" ADD COLUMN IF NOT EXISTS "searchVector" tsvector;

-- Backfill existing rows
UPDATE "Epic" SET "searchVector" = to_tsvector('english',
  coalesce(title, '') || ' ' || coalesce("descriptionMd", '') || ' ' || coalesce(hypothesis, '')
);

UPDATE "Feature" SET "searchVector" = to_tsvector('english', coalesce(title, ''));

CREATE INDEX IF NOT EXISTS "Epic_searchVector_gin_idx"
  ON "Epic" USING gin("searchVector");

CREATE INDEX IF NOT EXISTS "Feature_searchVector_gin_idx"
  ON "Feature" USING gin("searchVector");

-- Auto-update triggers
CREATE OR REPLACE FUNCTION update_epic_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW."searchVector" = to_tsvector('english',
    coalesce(NEW.title, '') || ' ' ||
    coalesce(NEW."descriptionMd", '') || ' ' ||
    coalesce(NEW.hypothesis, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER epic_search_vector_update
BEFORE INSERT OR UPDATE ON "Epic"
FOR EACH ROW EXECUTE FUNCTION update_epic_search_vector();

CREATE OR REPLACE FUNCTION update_feature_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW."searchVector" = to_tsvector('english', coalesce(NEW.title, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER feature_search_vector_update
BEFORE INSERT OR UPDATE ON "Feature"
FOR EACH ROW EXECUTE FUNCTION update_feature_search_vector();

-- ─── 2. NotificationPreference table ─────────────────────────────────────────

ALTER TABLE "Notification"
  ADD COLUMN IF NOT EXISTS "pinned"    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "NotificationPreference" (
  "id"          TEXT    NOT NULL,
  "tenantId"    TEXT    NOT NULL,
  "userId"      TEXT    NOT NULL,
  "type"        TEXT    NOT NULL,
  "digestMode"  BOOLEAN NOT NULL DEFAULT false,
  "digestCron"  TEXT,
  "channelIn"   BOOLEAN NOT NULL DEFAULT true,
  "channelMail" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationPreference_tenantId_userId_type_key"
  ON "NotificationPreference"("tenantId", "userId", "type");

CREATE INDEX "NotificationPreference_tenantId_userId_idx"
  ON "NotificationPreference"("tenantId", "userId");

ALTER TABLE "NotificationPreference"
  ADD CONSTRAINT "NotificationPreference_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── 3. FeatureFlag + FeatureFlagOverride tables ──────────────────────────────

CREATE TABLE "FeatureFlag" (
  "id"           TEXT    NOT NULL,
  "key"          TEXT    NOT NULL,
  "description"  TEXT,
  "defaultValue" BOOLEAN NOT NULL DEFAULT false,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FeatureFlag_key_key" ON "FeatureFlag"("key");

CREATE TABLE "FeatureFlagOverride" (
  "id"        TEXT    NOT NULL,
  "tenantId"  TEXT    NOT NULL,
  "userId"    TEXT,
  "flagKey"   TEXT    NOT NULL,
  "value"     BOOLEAN NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FeatureFlagOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FeatureFlagOverride_tenantId_userId_flagKey_key"
  ON "FeatureFlagOverride"("tenantId", "userId", "flagKey");

CREATE INDEX "FeatureFlagOverride_tenantId_idx"
  ON "FeatureFlagOverride"("tenantId");

CREATE INDEX "FeatureFlagOverride_flagKey_idx"
  ON "FeatureFlagOverride"("flagKey");

CREATE INDEX "FeatureFlagOverride_expiresAt_idx"
  ON "FeatureFlagOverride"("expiresAt");

ALTER TABLE "FeatureFlagOverride"
  ADD CONSTRAINT "FeatureFlagOverride_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FeatureFlagOverride"
  ADD CONSTRAINT "FeatureFlagOverride_flagKey_fkey"
  FOREIGN KEY ("flagKey") REFERENCES "FeatureFlag"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── 4. RLS for new tables ────────────────────────────────────────────────────

ALTER TABLE "NotificationPreference" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NotificationPreference" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "NotificationPreference"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "FeatureFlagOverride" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FeatureFlagOverride" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "FeatureFlagOverride"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());
