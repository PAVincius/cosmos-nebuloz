-- Story-037: API Keys, Webhook Endpoints, Credential Vault

-- ── ApiKey ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "ApiKey" (
  "id"         TEXT NOT NULL DEFAULT gen_random_uuid(),
  "tenantId"   TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "keyHash"    TEXT NOT NULL,
  "prefix"     TEXT NOT NULL DEFAULT 'cmbk_live_',
  "lastFour"   TEXT NOT NULL,
  "scope"      TEXT[] NOT NULL DEFAULT '{}',
  "expiresAt"  TIMESTAMP(3),
  "revokedAt"  TIMESTAMP(3),
  "createdBy"  TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ApiKey"
  ADD CONSTRAINT "ApiKey_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "ApiKey_keyHash_key" ON "ApiKey"("keyHash");
CREATE INDEX IF NOT EXISTS "ApiKey_tenantId_idx"  ON "ApiKey"("tenantId");
CREATE INDEX IF NOT EXISTS "ApiKey_keyHash_idx"   ON "ApiKey"("keyHash");

-- ── ApiKeyUsageLog ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "ApiKeyUsageLog" (
  "id"          TEXT NOT NULL DEFAULT gen_random_uuid(),
  "apiKeyId"    TEXT NOT NULL,
  "tenantId"    TEXT NOT NULL,
  "endpoint"    TEXT NOT NULL,
  "method"      TEXT NOT NULL DEFAULT 'GET',
  "statusCode"  INTEGER NOT NULL,
  "ipAddress"   TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApiKeyUsageLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ApiKeyUsageLog"
  ADD CONSTRAINT "ApiKeyUsageLog_apiKeyId_fkey"
    FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "ApiKeyUsageLog_apiKeyId_idx"           ON "ApiKeyUsageLog"("apiKeyId");
CREATE INDEX IF NOT EXISTS "ApiKeyUsageLog_tenantId_createdAt_idx" ON "ApiKeyUsageLog"("tenantId", "createdAt");

-- ── WebhookEndpoint ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "WebhookEndpoint" (
  "id"          TEXT NOT NULL DEFAULT gen_random_uuid(),
  "tenantId"    TEXT NOT NULL,
  "url"         TEXT NOT NULL,
  "secretHash"  TEXT NOT NULL,
  "secretEnc"   TEXT NOT NULL,
  "eventTypes"  TEXT[] NOT NULL DEFAULT '{}',
  "active"      BOOLEAN NOT NULL DEFAULT true,
  "createdBy"   TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "WebhookEndpoint"
  ADD CONSTRAINT "WebhookEndpoint_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "WebhookEndpoint_tenantId_idx" ON "WebhookEndpoint"("tenantId");

-- ── WebhookDeliveryStatus enum ────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "WebhookDeliveryStatus" AS ENUM (
    'PENDING', 'DELIVERED', 'FAILED', 'FAILED_PERMANENTLY'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── WebhookDeliveryLog ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "WebhookDeliveryLog" (
  "id"           TEXT NOT NULL DEFAULT gen_random_uuid(),
  "endpointId"   TEXT NOT NULL,
  "tenantId"     TEXT NOT NULL,
  "eventType"    TEXT NOT NULL,
  "requestBody"  JSONB NOT NULL,
  "responseCode" INTEGER,
  "responseBody" TEXT,
  "attemptCount" INTEGER NOT NULL DEFAULT 1,
  "status"       "WebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "synthetic"    BOOLEAN NOT NULL DEFAULT false,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WebhookDeliveryLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "WebhookDeliveryLog"
  ADD CONSTRAINT "WebhookDeliveryLog_endpointId_fkey"
    FOREIGN KEY ("endpointId") REFERENCES "WebhookEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "WebhookDeliveryLog_endpointId_idx"           ON "WebhookDeliveryLog"("endpointId");
CREATE INDEX IF NOT EXISTS "WebhookDeliveryLog_tenantId_createdAt_idx"   ON "WebhookDeliveryLog"("tenantId", "createdAt");

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE "ApiKey"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApiKey"            FORCE ROW LEVEL SECURITY;
ALTER TABLE "ApiKeyUsageLog"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApiKeyUsageLog"    FORCE ROW LEVEL SECURITY;
ALTER TABLE "WebhookEndpoint"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WebhookEndpoint"   FORCE ROW LEVEL SECURITY;
ALTER TABLE "WebhookDeliveryLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WebhookDeliveryLog" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "ApiKey"
  USING ("tenantId" = current_tenant_id());

CREATE POLICY "tenant_isolation" ON "ApiKeyUsageLog"
  USING ("tenantId" = current_tenant_id());

CREATE POLICY "tenant_isolation" ON "WebhookEndpoint"
  USING ("tenantId" = current_tenant_id());

CREATE POLICY "tenant_isolation" ON "WebhookDeliveryLog"
  USING ("tenantId" = current_tenant_id());
