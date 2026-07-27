-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "externalSource" TEXT,
ADD COLUMN     "externalUrl" TEXT,
ADD COLUMN     "noteBlocks" JSONB;

-- CreateIndex
CREATE INDEX "Task_externalSource_externalId_idx" ON "Task"("externalSource", "externalId");
