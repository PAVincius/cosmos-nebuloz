-- Migration: 20260608000002_audit_log_restrict_tenant_delete
-- Change AuditLog.tenantId FK from CASCADE to RESTRICT so tenant deletion
-- is blocked while audit logs exist. Archive or soft-delete audit logs before
-- removing a tenant record. Preserves SOC2 CC7.2 audit trail integrity.

ALTER TABLE "AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_tenantId_fkey";

ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_tenantId_fkey"
  FOREIGN KEY ("tenantId")
  REFERENCES "Tenant"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;
