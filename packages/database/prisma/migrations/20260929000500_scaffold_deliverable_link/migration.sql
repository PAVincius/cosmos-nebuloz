-- Costura Scaffold ↔ Linear (Norte, 29/09, seção e.2): link manual, de 0 a N por
-- entregável. Aditivo; só referência, sem estado externo.

-- CreateEnum
CREATE TYPE "ScaffoldDeliverableLinkProvider" AS ENUM ('COSMOS', 'LINEAR', 'GITHUB', 'JIRA');

-- CreateTable
CREATE TABLE "ScaffoldDeliverableLink" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "deliverableId" TEXT NOT NULL,
    "provider" "ScaffoldDeliverableLinkProvider" NOT NULL,
    "externalId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScaffoldDeliverableLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScaffoldDeliverableLink_tenantId_idx" ON "ScaffoldDeliverableLink"("tenantId");

-- CreateIndex
CREATE INDEX "ScaffoldDeliverableLink_deliverableId_idx" ON "ScaffoldDeliverableLink"("deliverableId");

-- CreateIndex
CREATE UNIQUE INDEX "ScaffoldDeliverableLink_deliverableId_provider_externalId_key" ON "ScaffoldDeliverableLink"("deliverableId", "provider", "externalId");

-- AddForeignKey
ALTER TABLE "ScaffoldDeliverableLink" ADD CONSTRAINT "ScaffoldDeliverableLink_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaffoldDeliverableLink" ADD CONSTRAINT "ScaffoldDeliverableLink_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "ScaffoldDeliverableInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
