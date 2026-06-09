-- Story-021 (Epic 007): Anomaly Detection Engine & Rule Set

-- AnomalyDetectionRun: add engine metadata fields
ALTER TABLE "AnomalyDetectionRun"
  ADD COLUMN IF NOT EXISTS "source"             TEXT NOT NULL DEFAULT 'CRON',
  ADD COLUMN IF NOT EXISTS "ruleEngineVersion"  TEXT NOT NULL DEFAULT '1.0',
  ADD COLUMN IF NOT EXISTS "itemsEvaluated"     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "anomaliesFound"     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "partialCompletion"  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "continuationCursor" TEXT;

-- Anomaly: add dedup + lifecycle fields
ALTER TABLE "Anomaly"
  ADD COLUMN IF NOT EXISTS "entityId"   TEXT,
  ADD COLUMN IF NOT EXISTS "entityType" TEXT,
  ADD COLUMN IF NOT EXISTS "status"     TEXT NOT NULL DEFAULT 'OPEN',
  ADD COLUMN IF NOT EXISTS "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Dedup composite index (type+entityId+status within 24h window)
CREATE INDEX IF NOT EXISTS "Anomaly_tenantId_rule_entityId_status_idx"
  ON "Anomaly"("tenantId", "rule", "entityId", "status");

-- AnomalyRuleConfig: per-org threshold overrides
CREATE TABLE IF NOT EXISTS "AnomalyRuleConfig" (
  "id"          TEXT NOT NULL,
  "tenantId"    TEXT NOT NULL,
  "artId"       TEXT,
  "ruleId"      TEXT NOT NULL,
  "threshold"   DOUBLE PRECISION NOT NULL,
  "isDisabled"  BOOLEAN NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AnomalyRuleConfig_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AnomalyRuleConfig"
  ADD CONSTRAINT "AnomalyRuleConfig_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "AnomalyRuleConfig_tenantId_artId_ruleId_key"
  ON "AnomalyRuleConfig"("tenantId", "artId", "ruleId");
CREATE INDEX IF NOT EXISTS "AnomalyRuleConfig_tenantId_idx"       ON "AnomalyRuleConfig"("tenantId");
CREATE INDEX IF NOT EXISTS "AnomalyRuleConfig_tenantId_artId_idx" ON "AnomalyRuleConfig"("tenantId", "artId");
