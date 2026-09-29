-- X-01 — ProcessRegistry: registro único de processo ligando os ids dos quatro
-- produtos (gap Meridian, trilha Scaffold, iniciativa Signal, caso Charter).
-- Ids são texto sem FK cruzada, de propósito; a única FK é o Tenant.
-- Depende de 20260929000000_work_form_enum.

-- CreateTable
CREATE TABLE "ProcessRegistry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "workForm" "WorkForm",
    "meridianGapId" TEXT,
    "scaffoldTrackId" TEXT,
    "signalInitiativeId" TEXT,
    "charterUseCaseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessRegistry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProcessRegistry_tenantId_idx" ON "ProcessRegistry"("tenantId");

-- CreateIndex
CREATE INDEX "ProcessRegistry_tenantId_workForm_idx" ON "ProcessRegistry"("tenantId", "workForm");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessRegistry_tenantId_meridianGapId_key" ON "ProcessRegistry"("tenantId", "meridianGapId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessRegistry_tenantId_scaffoldTrackId_key" ON "ProcessRegistry"("tenantId", "scaffoldTrackId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessRegistry_tenantId_signalInitiativeId_key" ON "ProcessRegistry"("tenantId", "signalInitiativeId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessRegistry_tenantId_charterUseCaseId_key" ON "ProcessRegistry"("tenantId", "charterUseCaseId");

-- AddForeignKey
ALTER TABLE "ProcessRegistry" ADD CONSTRAINT "ProcessRegistry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

