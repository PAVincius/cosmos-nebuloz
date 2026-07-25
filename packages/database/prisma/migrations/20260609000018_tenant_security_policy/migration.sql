-- Story-033: TenantSecurityPolicy — IP allowlist, 2FA enforcement, terminology

CREATE TABLE "tenant_security_policies" (
  "id"              TEXT NOT NULL,
  "tenantId"        TEXT NOT NULL,
  "require2FA"      BOOLEAN NOT NULL DEFAULT false,
  "gracePeriodDays" INTEGER NOT NULL DEFAULT 7,
  "allowedIpRanges" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "terminologyMap"  JSONB,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  "updatedBy"       TEXT,
  CONSTRAINT "tenant_security_policies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenant_security_policies_tenantId_key"
  ON "tenant_security_policies"("tenantId");

CREATE INDEX "tenant_security_policies_tenantId_idx"
  ON "tenant_security_policies"("tenantId");

ALTER TABLE "tenant_security_policies"
  ADD CONSTRAINT "tenant_security_policies_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
