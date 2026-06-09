-- Story-034: Audit immutability, LGPD compliance, RLS for stories 031-033 tables

-- ─── 1. Extend AuditLog with actor/metadata fields ───────────────────────────

ALTER TABLE "AuditLog"
  ADD COLUMN IF NOT EXISTS "actorId"    TEXT,
  ADD COLUMN IF NOT EXISTS "actorType"  TEXT,
  ADD COLUMN IF NOT EXISTS "metadata"   JSONB,
  ALTER COLUMN "entityType" DROP NOT NULL,
  ALTER COLUMN "entityId"   DROP NOT NULL;

-- ─── 2. AuditLog immutability trigger (AC-001) ───────────────────────────────

CREATE OR REPLACE FUNCTION prevent_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog entries are immutable. Operation: %, Entry ID: %', TG_OP, OLD.id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_immutable
BEFORE UPDATE OR DELETE ON "AuditLog"
FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();

-- ─── 3. DataSubjectRequest table (AC-003 / AC-004) ───────────────────────────

CREATE TYPE "DsrType"   AS ENUM ('ERASURE', 'PORTABILITY');
CREATE TYPE "DsrStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

CREATE TABLE "DataSubjectRequest" (
  "id"          TEXT        NOT NULL,
  "tenantId"    TEXT        NOT NULL,
  "subjectId"   TEXT        NOT NULL,
  "type"        "DsrType"   NOT NULL,
  "status"      "DsrStatus" NOT NULL DEFAULT 'PENDING',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "metadata"    JSONB,
  CONSTRAINT "DataSubjectRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DataSubjectRequest_tenantId_idx"
  ON "DataSubjectRequest"("tenantId");

CREATE INDEX "DataSubjectRequest_tenantId_subjectId_idx"
  ON "DataSubjectRequest"("tenantId", "subjectId");

CREATE INDEX "DataSubjectRequest_tenantId_status_idx"
  ON "DataSubjectRequest"("tenantId", "status");

ALTER TABLE "DataSubjectRequest"
  ADD CONSTRAINT "DataSubjectRequest_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── 4. RLS for tables created in stories 031-033 ────────────────────────────

ALTER TABLE "pi_plan_feature_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pi_plan_feature_assignments" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "pi_plan_feature_assignments"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "board_reconciliation_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "board_reconciliation_logs" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "board_reconciliation_logs"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "tenant_security_policies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_security_policies" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "tenant_security_policies"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

-- ─── 5. RLS for DataSubjectRequest ───────────────────────────────────────────

ALTER TABLE "DataSubjectRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DataSubjectRequest" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "DataSubjectRequest"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

-- ─── 6. Performance: cursor pagination index (AC-008) ────────────────────────
-- AuditLog already has (tenantId, createdAt) from migration 20260603000001.
-- Add covering index for cursor queries that also filter by action.

CREATE INDEX CONCURRENTLY IF NOT EXISTS "AuditLog_tenantId_action_createdAt_idx"
  ON "AuditLog"("tenantId", "action", "createdAt" DESC);
