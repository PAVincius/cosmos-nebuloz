-- CreateTable
CREATE TABLE "linear_syncs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "linearId" TEXT NOT NULL,
    "linearType" TEXT NOT NULL,
    "cosmosId" TEXT NOT NULL,
    "cosmosType" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "linear_syncs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "linear_syncs_tenantId_idx" ON "linear_syncs"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "linear_syncs_tenantId_linearId_linearType_key" ON "linear_syncs"("tenantId", "linearId", "linearType");
