-- Task 16: WsjfSettings — tenant-wide WSJF calculation parameters
-- (WsjfSettingsModal; weightBv/weightTc/weightRr consumed by
-- scoreWsjfAction, remaining fields persisted but not yet enforced).
-- Backfilled: applied to dev via `prisma db push` on 2026-07-23
-- (commit e3543c33), never got a migration file until now.

CREATE TABLE "WsjfSettings" (
  "id"                TEXT NOT NULL,
  "tenantId"          TEXT NOT NULL,
  "weightBv"          DOUBLE PRECISION NOT NULL DEFAULT 1,
  "weightTc"          DOUBLE PRECISION NOT NULL DEFAULT 1,
  "weightRr"          DOUBLE PRECISION NOT NULL DEFAULT 1,
  "scale"             TEXT NOT NULL DEFAULT 'fibonacci',
  "autoRecalc"        TEXT NOT NULL DEFAULT 'daily',
  "rebalanceApprover" TEXT NOT NULL DEFAULT 'rte',
  "staleDays"         INTEGER NOT NULL DEFAULT 14,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WsjfSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WsjfSettings_tenantId_key" ON "WsjfSettings"("tenantId");

CREATE INDEX "WsjfSettings_tenantId_idx" ON "WsjfSettings"("tenantId");

ALTER TABLE "WsjfSettings" ADD CONSTRAINT "WsjfSettings_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-level tenant isolation (defence-in-depth; matches every other tenant
-- table — ENABLE + FORCE + USING-only policy, per the meeting_intelligence
-- and pae precedents). This was MISSING from the original db-push and from
-- this backfill's first draft — WsjfSettings was the only tenant table in the
-- schema without RLS.
ALTER TABLE "WsjfSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WsjfSettings" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "WsjfSettings"
  USING ("tenantId" = current_tenant_id());
