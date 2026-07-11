-- Story-024: Linear SAFe-Aware Two-Way Sync
-- Adds LinearSyncEvent (per-field conflict log) and WebhookDlq (PAUSED integration DLQ)

-- LinearSyncEvent: per-field/entity sync event for conflict resolution UI
CREATE TABLE "linear_sync_events" (
    "id"            TEXT NOT NULL,
    "tenantId"      TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "direction"     TEXT NOT NULL,
    "source"        TEXT NOT NULL,
    "action"        TEXT NOT NULL,
    "entityType"    TEXT NOT NULL,
    "entityId"      TEXT NOT NULL,
    "externalId"    TEXT,
    "field"         TEXT,
    "linearValue"   JSONB,
    "cosmosValue"   JSONB,
    "cursor"        TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "linear_sync_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "linear_sync_events_tenantId_integrationId_createdAt_idx"
    ON "linear_sync_events"("tenantId", "integrationId", "createdAt");

CREATE INDEX "linear_sync_events_tenantId_entityType_entityId_idx"
    ON "linear_sync_events"("tenantId", "entityType", "entityId");

ALTER TABLE "linear_sync_events"
    ADD CONSTRAINT "linear_sync_events_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- WebhookDlq: dead-letter queue for webhooks received while integration is PAUSED
CREATE TABLE "webhook_dlq" (
    "id"            TEXT NOT NULL,
    "tenantId"      TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "source"        TEXT NOT NULL,
    "webhookId"     TEXT,
    "payload"       JSONB NOT NULL,
    "receivedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retryCount"    INTEGER NOT NULL DEFAULT 0,
    "lastRetryAt"   TIMESTAMP(3),
    "processedAt"   TIMESTAMP(3),

    CONSTRAINT "webhook_dlq_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "webhook_dlq_tenantId_source_processedAt_idx"
    ON "webhook_dlq"("tenantId", "source", "processedAt");

CREATE INDEX "webhook_dlq_tenantId_integrationId_idx"
    ON "webhook_dlq"("tenantId", "integrationId");

ALTER TABLE "webhook_dlq"
    ADD CONSTRAINT "webhook_dlq_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Integration.status: add PAUSED to allowed comment (no DDL change needed — stored as text)
COMMENT ON COLUMN "Integration"."status" IS 'ACTIVE | PAUSED | INACTIVE | ERROR';
