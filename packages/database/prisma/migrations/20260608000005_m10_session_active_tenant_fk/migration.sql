-- M10: Add FK constraint on Session.activeTenantId → Tenant.id with ON DELETE SET NULL

ALTER TABLE "Session"
  ADD CONSTRAINT "Session_activeTenantId_fkey"
  FOREIGN KEY ("activeTenantId") REFERENCES "Tenant"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Session_activeTenantId_idx" ON "Session"("activeTenantId");
