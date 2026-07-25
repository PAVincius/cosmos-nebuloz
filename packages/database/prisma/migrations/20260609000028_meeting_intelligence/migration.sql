-- Migration 028: Meeting Intelligence models (epic-009, story-046)

CREATE TABLE "MeetingIntegration" (
  "id"            TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"      TEXT NOT NULL,
  "provider"      TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "config"        JSONB NOT NULL DEFAULT '{}',
  "webhookSecret" TEXT,
  "status"        TEXT NOT NULL DEFAULT 'ACTIVE',
  "lastEventAt"   TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MeetingIntegration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MeetingTranscript" (
  "id"            TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"      TEXT NOT NULL,
  "integrationId" TEXT NOT NULL,
  "meetingId"     TEXT NOT NULL,
  "title"         TEXT,
  "rawSummary"    JSONB,
  "piPlanId"      TEXT,
  "status"        TEXT NOT NULL DEFAULT 'RECEIVED',
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MeetingTranscript_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MeetingInsight" (
  "id"              TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"        TEXT NOT NULL,
  "transcriptId"    TEXT NOT NULL,
  "type"            TEXT NOT NULL,
  "text"            TEXT NOT NULL,
  "proposedTarget"  TEXT,
  "status"          TEXT NOT NULL DEFAULT 'PENDING',
  "appliedEntityId" TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MeetingInsight_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MeetingIntegration" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MeetingIntegration" FORCE ROW LEVEL SECURITY;
ALTER TABLE "MeetingTranscript"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MeetingTranscript"  FORCE ROW LEVEL SECURITY;
ALTER TABLE "MeetingInsight"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MeetingInsight"     FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "MeetingIntegration"
  USING ("tenantId" = current_tenant_id());
CREATE POLICY "tenant_isolation" ON "MeetingTranscript"
  USING ("tenantId" = current_tenant_id());
CREATE POLICY "tenant_isolation" ON "MeetingInsight"
  USING ("tenantId" = current_tenant_id());

CREATE INDEX "MeetingIntegration_tenantId_idx"          ON "MeetingIntegration"("tenantId");
CREATE INDEX "MeetingIntegration_tenantId_provider_idx" ON "MeetingIntegration"("tenantId", "provider");

CREATE UNIQUE INDEX "MeetingTranscript_tenantId_meetingId_key"
  ON "MeetingTranscript"("tenantId", "meetingId");
CREATE INDEX "MeetingTranscript_tenantId_idx"           ON "MeetingTranscript"("tenantId");
CREATE INDEX "MeetingTranscript_integrationId_idx"      ON "MeetingTranscript"("integrationId");
CREATE INDEX "MeetingTranscript_piPlanId_idx"           ON "MeetingTranscript"("piPlanId");

CREATE INDEX "MeetingInsight_tenantId_idx"              ON "MeetingInsight"("tenantId");
CREATE INDEX "MeetingInsight_transcriptId_idx"          ON "MeetingInsight"("transcriptId");

ALTER TABLE "MeetingIntegration" ADD CONSTRAINT "MeetingIntegration_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;

ALTER TABLE "MeetingTranscript" ADD CONSTRAINT "MeetingTranscript_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;
ALTER TABLE "MeetingTranscript" ADD CONSTRAINT "MeetingTranscript_integrationId_fkey"
  FOREIGN KEY ("integrationId") REFERENCES "MeetingIntegration"("id") ON DELETE CASCADE;

ALTER TABLE "MeetingInsight" ADD CONSTRAINT "MeetingInsight_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;
ALTER TABLE "MeetingInsight" ADD CONSTRAINT "MeetingInsight_transcriptId_fkey"
  FOREIGN KEY ("transcriptId") REFERENCES "MeetingTranscript"("id") ON DELETE CASCADE;
