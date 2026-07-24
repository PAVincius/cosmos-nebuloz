-- CapacityAdjustmentNote — free-text annotations explaining a sprint's
-- capacity variance (training, holiday, onboarding, hiring), surfaced next
-- to the per-team capacity grid on the Capacity Planning screen.
-- teamId/sprintId are plain app-layer tenant-guarded references (no FK
-- constraint), matching the existing TeamCapacitySnapshot.teamId precedent.

CREATE TABLE "CapacityAdjustmentNote" (
  "id"          TEXT NOT NULL,
  "tenantId"    TEXT NOT NULL,
  "teamId"      TEXT NOT NULL,
  "sprintId"    TEXT,
  "text"        TEXT NOT NULL,
  "tone"        TEXT NOT NULL DEFAULT 'neutral',
  "createdById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CapacityAdjustmentNote_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CapacityAdjustmentNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CapacityAdjustmentNote" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "CapacityAdjustmentNote"
  USING ("tenantId" = current_tenant_id());

CREATE INDEX "CapacityAdjustmentNote_tenantId_idx"
  ON "CapacityAdjustmentNote"("tenantId");
CREATE INDEX "CapacityAdjustmentNote_tenantId_teamId_idx"
  ON "CapacityAdjustmentNote"("tenantId", "teamId");
CREATE INDEX "CapacityAdjustmentNote_tenantId_sprintId_idx"
  ON "CapacityAdjustmentNote"("tenantId", "sprintId");

ALTER TABLE "CapacityAdjustmentNote" ADD CONSTRAINT "CapacityAdjustmentNote_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;
