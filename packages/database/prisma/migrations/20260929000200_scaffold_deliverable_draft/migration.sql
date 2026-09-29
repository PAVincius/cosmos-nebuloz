-- RASCUNHO (SC-DEV-03): ScaffoldDeliverableInstance e tabelas filhas. Códigos
-- A1..E3 e papéis dependem do Norte; não aplicar em produção antes dessa decisão.
-- Append-only do histórico ainda é só convenção (sem trigger).

-- CreateEnum
CREATE TYPE "ScaffoldDeliverableStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'IN_REVIEW', 'ADJUSTMENT_REQUESTED', 'APPROVED', 'REOPENED');

-- CreateEnum
CREATE TYPE "ScaffoldDeliverableAction" AS ENUM ('START', 'ATTACH_VERSION', 'SUBMIT', 'REQUEST_ADJUSTMENT', 'APPROVE', 'REOPEN', 'EDIT');

-- CreateTable
CREATE TABLE "ScaffoldDeliverableInstance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "phaseInstanceId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "templateKey" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isExtra" BOOLEAN NOT NULL DEFAULT false,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "status" "ScaffoldDeliverableStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "ownerId" TEXT,
    "approverId" TEXT,
    "summary" TEXT,
    "dueAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "fileKey" TEXT,
    "fileName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScaffoldDeliverableInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScaffoldDeliverableEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "deliverableId" TEXT NOT NULL,
    "action" "ScaffoldDeliverableAction" NOT NULL,
    "actorId" TEXT NOT NULL,
    "fromStatus" "ScaffoldDeliverableStatus",
    "toStatus" "ScaffoldDeliverableStatus",
    "version" INTEGER,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScaffoldDeliverableEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScaffoldDeliverableComment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "deliverableId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScaffoldDeliverableComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScaffoldDeliverableInstance_tenantId_idx" ON "ScaffoldDeliverableInstance"("tenantId");

-- CreateIndex
CREATE INDEX "ScaffoldDeliverableInstance_tenantId_status_idx" ON "ScaffoldDeliverableInstance"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ScaffoldDeliverableInstance_phaseInstanceId_idx" ON "ScaffoldDeliverableInstance"("phaseInstanceId");

-- CreateIndex
CREATE UNIQUE INDEX "ScaffoldDeliverableInstance_trackId_code_key" ON "ScaffoldDeliverableInstance"("trackId", "code");

-- CreateIndex
CREATE INDEX "ScaffoldDeliverableEvent_tenantId_idx" ON "ScaffoldDeliverableEvent"("tenantId");

-- CreateIndex
CREATE INDEX "ScaffoldDeliverableEvent_deliverableId_createdAt_idx" ON "ScaffoldDeliverableEvent"("deliverableId", "createdAt");

-- CreateIndex
CREATE INDEX "ScaffoldDeliverableComment_tenantId_idx" ON "ScaffoldDeliverableComment"("tenantId");

-- CreateIndex
CREATE INDEX "ScaffoldDeliverableComment_deliverableId_createdAt_idx" ON "ScaffoldDeliverableComment"("deliverableId", "createdAt");

-- AddForeignKey
ALTER TABLE "ScaffoldDeliverableInstance" ADD CONSTRAINT "ScaffoldDeliverableInstance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaffoldDeliverableInstance" ADD CONSTRAINT "ScaffoldDeliverableInstance_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "ScaffoldTrack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaffoldDeliverableInstance" ADD CONSTRAINT "ScaffoldDeliverableInstance_phaseInstanceId_fkey" FOREIGN KEY ("phaseInstanceId") REFERENCES "ScaffoldPhaseInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaffoldDeliverableEvent" ADD CONSTRAINT "ScaffoldDeliverableEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaffoldDeliverableEvent" ADD CONSTRAINT "ScaffoldDeliverableEvent_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "ScaffoldDeliverableInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaffoldDeliverableComment" ADD CONSTRAINT "ScaffoldDeliverableComment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaffoldDeliverableComment" ADD CONSTRAINT "ScaffoldDeliverableComment_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "ScaffoldDeliverableInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

