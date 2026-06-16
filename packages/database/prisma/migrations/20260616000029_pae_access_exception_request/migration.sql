-- Migration 029: PAE — Personal Access Exception

CREATE TABLE "AccessExceptionRequest" (
  "id"             TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"       TEXT NOT NULL,
  "requesterId"    TEXT NOT NULL,
  "entityType"     TEXT NOT NULL,
  "action"         TEXT NOT NULL,
  "targetEntityId" TEXT,
  "justification"  TEXT,
  "duration"       TEXT NOT NULL,
  "status"         TEXT NOT NULL DEFAULT 'PENDING',
  "approverId"     TEXT,
  "approvedAt"     TIMESTAMP(3),
  "expiresAt"      TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AccessExceptionRequest_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AccessExceptionRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AccessExceptionRequest" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "AccessExceptionRequest"
  USING ("tenantId" = current_tenant_id());

CREATE INDEX "AccessExceptionRequest_tenantId_requesterId_status_idx"
  ON "AccessExceptionRequest"("tenantId", "requesterId", "status");
CREATE INDEX "AccessExceptionRequest_tenantId_status_expiresAt_idx"
  ON "AccessExceptionRequest"("tenantId", "status", "expiresAt");
CREATE INDEX "AccessExceptionRequest_tenantId_idx"
  ON "AccessExceptionRequest"("tenantId");

ALTER TABLE "AccessExceptionRequest" ADD CONSTRAINT "AccessExceptionRequest_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;
