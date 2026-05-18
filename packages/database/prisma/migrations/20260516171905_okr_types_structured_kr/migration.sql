-- AlterTable
ALTER TABLE "KeyResult" ADD COLUMN     "baseline" DOUBLE PRECISION,
ADD COLUMN     "dataSource" TEXT,
ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "measurementType" TEXT,
ADD COLUMN     "metric" TEXT,
ADD COLUMN     "ownerId" TEXT;

-- AlterTable
ALTER TABLE "OKR" ADD COLUMN     "artId" TEXT,
ADD COLUMN     "epicId" TEXT,
ADD COLUMN     "horizon" TEXT,
ADD COLUMN     "scope" TEXT,
ADD COLUMN     "teamId" TEXT,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'portfolio_theme';

-- CreateIndex
CREATE INDEX "OKR_tenantId_type_idx" ON "OKR"("tenantId", "type");
