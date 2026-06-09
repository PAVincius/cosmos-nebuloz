-- Story-038: RBAC — ARTMembership, CustomRole, CustomRoleAssignment

-- ── ARTMembership ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "ARTMembership" (
  "id"       TEXT NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" TEXT NOT NULL,
  "artId"    TEXT NOT NULL,
  "userId"   TEXT NOT NULL,
  "role"     TEXT NOT NULL DEFAULT 'MEMBER',
  CONSTRAINT "ARTMembership_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ARTMembership"
  ADD CONSTRAINT "ARTMembership_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ARTMembership"
  ADD CONSTRAINT "ARTMembership_artId_fkey"
    FOREIGN KEY ("artId") REFERENCES "ART"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "ARTMembership_artId_userId_key" ON "ARTMembership"("artId", "userId");
CREATE INDEX IF NOT EXISTS "ARTMembership_tenantId_idx" ON "ARTMembership"("tenantId");
CREATE INDEX IF NOT EXISTS "ARTMembership_artId_idx"    ON "ARTMembership"("artId");
CREATE INDEX IF NOT EXISTS "ARTMembership_userId_idx"   ON "ARTMembership"("userId");

-- ── CustomRole ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "CustomRole" (
  "id"          TEXT NOT NULL DEFAULT gen_random_uuid(),
  "tenantId"    TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "permissions" TEXT[] NOT NULL DEFAULT '{}',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomRole_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CustomRole"
  ADD CONSTRAINT "CustomRole_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "CustomRole_tenantId_name_key" ON "CustomRole"("tenantId", "name");
CREATE INDEX IF NOT EXISTS "CustomRole_tenantId_idx" ON "CustomRole"("tenantId");

-- ── CustomRoleAssignment ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "CustomRoleAssignment" (
  "id"           TEXT NOT NULL DEFAULT gen_random_uuid(),
  "tenantId"     TEXT NOT NULL,
  "userId"       TEXT NOT NULL,
  "customRoleId" TEXT NOT NULL,
  CONSTRAINT "CustomRoleAssignment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CustomRoleAssignment"
  ADD CONSTRAINT "CustomRoleAssignment_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomRoleAssignment"
  ADD CONSTRAINT "CustomRoleAssignment_customRoleId_fkey"
    FOREIGN KEY ("customRoleId") REFERENCES "CustomRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "CustomRoleAssignment_tenantId_userId_customRoleId_key"
  ON "CustomRoleAssignment"("tenantId", "userId", "customRoleId");

CREATE INDEX IF NOT EXISTS "CustomRoleAssignment_tenantId_userId_idx"
  ON "CustomRoleAssignment"("tenantId", "userId");

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE "ARTMembership"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ARTMembership"        FORCE ROW LEVEL SECURITY;
ALTER TABLE "CustomRole"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CustomRole"           FORCE ROW LEVEL SECURITY;
ALTER TABLE "CustomRoleAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CustomRoleAssignment" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "ARTMembership"
  USING ("tenantId" = current_tenant_id());

CREATE POLICY "tenant_isolation" ON "CustomRole"
  USING ("tenantId" = current_tenant_id());

CREATE POLICY "tenant_isolation" ON "CustomRoleAssignment"
  USING ("tenantId" = current_tenant_id());
