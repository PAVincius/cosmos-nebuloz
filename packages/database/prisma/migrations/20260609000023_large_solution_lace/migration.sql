-- Story-039: Solution Train & LACE Management schema extensions

-- ── Enums ─────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "LACERole" AS ENUM (
    'SOLUTION_TRAIN_ENGINEER', 'BUSINESS_OWNER', 'ENTERPRISE_ARCHITECT',
    'SYSTEM_ARCHITECT', 'PRODUCT_MANAGER'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "DeliverableStatus" AS ENUM (
    'PENDING', 'IN_PROGRESS', 'DELIVERED', 'DELAYED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── LACEMember ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "LACEMember" (
  "id"        TEXT NOT NULL DEFAULT gen_random_uuid(),
  "tenantId"  TEXT NOT NULL,
  "laceId"    TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "laceRole"  "LACERole" NOT NULL DEFAULT 'PRODUCT_MANAGER',
  "joinedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LACEMember_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "LACEMember"
  ADD CONSTRAINT "LACEMember_laceId_fkey"
    FOREIGN KEY ("laceId") REFERENCES "LACE"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "LACEMember_laceId_userId_key" ON "LACEMember"("laceId", "userId");
CREATE INDEX IF NOT EXISTS "LACEMember_tenantId_idx" ON "LACEMember"("tenantId");
CREATE INDEX IF NOT EXISTS "LACEMember_laceId_idx"   ON "LACEMember"("laceId");

-- ── SupplierDeliverable ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "SupplierDeliverable" (
  "id"           TEXT NOT NULL DEFAULT gen_random_uuid(),
  "tenantId"     TEXT NOT NULL,
  "supplierId"   TEXT NOT NULL,
  "featureId"    TEXT NOT NULL,
  "expectedDate" TIMESTAMP(3) NOT NULL,
  "actualDate"   TIMESTAMP(3),
  "status"       "DeliverableStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupplierDeliverable_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SupplierDeliverable"
  ADD CONSTRAINT "SupplierDeliverable_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupplierDeliverable"
  ADD CONSTRAINT "SupplierDeliverable_featureId_fkey"
    FOREIGN KEY ("featureId") REFERENCES "Feature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "SupplierDeliverable_supplierId_status_idx" ON "SupplierDeliverable"("supplierId", "status");
CREATE INDEX IF NOT EXISTS "SupplierDeliverable_tenantId_idx"          ON "SupplierDeliverable"("tenantId");

-- ── Alter existing tables ─────────────────────────────────────────────────────

-- SolutionTrain: no structural change needed (back-relations handled by FK)

-- ART: add solutionTrainId
ALTER TABLE "ART"
  ADD COLUMN IF NOT EXISTS "solutionTrainId" TEXT;

ALTER TABLE "ART"
  ADD CONSTRAINT "ART_solutionTrainId_fkey"
    FOREIGN KEY ("solutionTrainId") REFERENCES "SolutionTrain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "ART_solutionTrainId_idx" ON "ART"("solutionTrainId");

-- Supplier: add solutionTrainId
ALTER TABLE "Supplier"
  ADD COLUMN IF NOT EXISTS "solutionTrainId" TEXT;

ALTER TABLE "Supplier"
  ADD CONSTRAINT "Supplier_solutionTrainId_fkey"
    FOREIGN KEY ("solutionTrainId") REFERENCES "SolutionTrain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Supplier_solutionTrainId_idx" ON "Supplier"("solutionTrainId");

-- Epic: add solutionEpicId
ALTER TABLE "Epic"
  ADD COLUMN IF NOT EXISTS "solutionEpicId" TEXT;

ALTER TABLE "Epic"
  ADD CONSTRAINT "Epic_solutionEpicId_fkey"
    FOREIGN KEY ("solutionEpicId") REFERENCES "SolutionEpic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Epic_solutionEpicId_idx" ON "Epic"("solutionEpicId");

-- Feature: add capabilityId
ALTER TABLE "Feature"
  ADD COLUMN IF NOT EXISTS "capabilityId" TEXT;

ALTER TABLE "Feature"
  ADD CONSTRAINT "Feature_capabilityId_fkey"
    FOREIGN KEY ("capabilityId") REFERENCES "Capability"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Feature_capabilityId_idx" ON "Feature"("capabilityId");

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE "LACEMember"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LACEMember"          FORCE ROW LEVEL SECURITY;
ALTER TABLE "SupplierDeliverable" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupplierDeliverable" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "LACEMember"
  USING ("tenantId" = current_tenant_id());

CREATE POLICY "tenant_isolation" ON "SupplierDeliverable"
  USING ("tenantId" = current_tenant_id());
