-- Costura Scaffold → Cosmos (Norte, 29/09, seção e.1): origem da trilha em Epic e
-- Feature, texto sem FK. Aditivo; colunas nulas não mudam nenhuma linha.
-- Único por (tenantId, originTrackId[, originPhase]) para o evento do Scaffold ser
-- reprocessável sem duplicar. NULL não colide em índice único no Postgres.

-- AlterTable
ALTER TABLE "Epic" ADD COLUMN     "originTrackId" TEXT;

-- AlterTable
ALTER TABLE "Feature" ADD COLUMN     "originPhase" TEXT,
ADD COLUMN     "originTrackId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Epic_tenantId_originTrackId_key" ON "Epic"("tenantId", "originTrackId");

-- CreateIndex
CREATE UNIQUE INDEX "Feature_tenantId_originTrackId_originPhase_key" ON "Feature"("tenantId", "originTrackId", "originPhase");

