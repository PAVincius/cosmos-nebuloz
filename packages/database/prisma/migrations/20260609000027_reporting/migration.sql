-- Migration 027: Reporting models (story-045)

CREATE TYPE "ReportExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'DELIVERED', 'FAILED');

CREATE TABLE "ScheduledReport" (
  "id"             TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"       TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "cronExpression" TEXT NOT NULL,
  "timezone"       TEXT NOT NULL DEFAULT 'UTC',
  "recipients"     TEXT[] NOT NULL DEFAULT '{}',
  "slackChannelId" TEXT,
  "config"         JSONB NOT NULL DEFAULT '{}',
  "enabled"        BOOLEAN NOT NULL DEFAULT true,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScheduledReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScheduledReportExecution" (
  "id"         TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"   TEXT NOT NULL,
  "reportId"   TEXT NOT NULL,
  "status"     "ReportExecutionStatus" NOT NULL DEFAULT 'PENDING',
  "attempts"   INTEGER NOT NULL DEFAULT 0,
  "pdfUrl"     TEXT,
  "error"      TEXT,
  "executedAt" TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScheduledReportExecution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserDashboardLayout" (
  "id"        TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"  TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "config"    JSONB NOT NULL DEFAULT '{"tiles":[]}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserDashboardLayout_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ScheduledReport"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ScheduledReport"          FORCE ROW LEVEL SECURITY;
ALTER TABLE "ScheduledReportExecution" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ScheduledReportExecution" FORCE ROW LEVEL SECURITY;
ALTER TABLE "UserDashboardLayout"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserDashboardLayout"      FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "ScheduledReport"
  USING ("tenantId" = current_tenant_id());
CREATE POLICY "tenant_isolation" ON "ScheduledReportExecution"
  USING ("tenantId" = current_tenant_id());
CREATE POLICY "tenant_isolation" ON "UserDashboardLayout"
  USING ("tenantId" = current_tenant_id());

CREATE INDEX "ScheduledReport_tenantId_idx"             ON "ScheduledReport"("tenantId");
CREATE INDEX "ScheduledReportExecution_reportId_idx"    ON "ScheduledReportExecution"("reportId", "status");
CREATE INDEX "ScheduledReportExecution_tenantId_idx"    ON "ScheduledReportExecution"("tenantId");
CREATE UNIQUE INDEX "UserDashboardLayout_tenantId_userId_key"
  ON "UserDashboardLayout"("tenantId", "userId");
CREATE INDEX "UserDashboardLayout_tenantId_idx"         ON "UserDashboardLayout"("tenantId");

ALTER TABLE "ScheduledReport" ADD CONSTRAINT "ScheduledReport_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;
ALTER TABLE "ScheduledReportExecution" ADD CONSTRAINT "ScheduledReportExecution_reportId_fkey"
  FOREIGN KEY ("reportId") REFERENCES "ScheduledReport"("id") ON DELETE CASCADE;
ALTER TABLE "UserDashboardLayout" ADD CONSTRAINT "UserDashboardLayout_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;
