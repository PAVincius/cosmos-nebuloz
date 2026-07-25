-- Story-031: Liveblocks CRDT Board — PIPlanFeatureAssignment + BoardReconciliationLog

CREATE TABLE "pi_plan_feature_assignments" (
  "id"         TEXT NOT NULL,
  "tenantId"   TEXT NOT NULL,
  "piPlanId"   TEXT NOT NULL,
  "featureId"  TEXT NOT NULL,
  "teamId"     TEXT NOT NULL,
  "sprintId"   TEXT NOT NULL,
  "rank"       INTEGER NOT NULL DEFAULT 0,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  "updatedBy"  TEXT,
  CONSTRAINT "pi_plan_feature_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pi_plan_feature_assignments_piPlanId_featureId_key"
  ON "pi_plan_feature_assignments"("piPlanId", "featureId");

CREATE INDEX "pi_plan_feature_assignments_tenantId_piPlanId_teamId_sprintId_idx"
  ON "pi_plan_feature_assignments"("tenantId", "piPlanId", "teamId", "sprintId");

CREATE TABLE "board_reconciliation_logs" (
  "id"              TEXT NOT NULL,
  "tenantId"        TEXT NOT NULL,
  "surface"         TEXT NOT NULL,
  "entityId"        TEXT NOT NULL,
  "lbCount"         INTEGER NOT NULL,
  "dbCount"         INTEGER NOT NULL,
  "divergenceCount" INTEGER NOT NULL,
  "resolution"      TEXT NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata"        JSONB,
  CONSTRAINT "board_reconciliation_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "board_reconciliation_logs_tenantId_surface_entityId_idx"
  ON "board_reconciliation_logs"("tenantId", "surface", "entityId");
