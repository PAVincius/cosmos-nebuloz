-- CreateTable
CREATE TABLE "KeyResultSnapshot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "keyResultId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "recordedById" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KeyResultSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KeyResultSnapshot_tenantId_idx" ON "KeyResultSnapshot"("tenantId");

-- CreateIndex
CREATE INDEX "KeyResultSnapshot_keyResultId_idx" ON "KeyResultSnapshot"("keyResultId");

-- CreateIndex
CREATE INDEX "KeyResultSnapshot_keyResultId_recordedAt_idx" ON "KeyResultSnapshot"("keyResultId", "recordedAt");

-- AddForeignKey
ALTER TABLE "KeyResultSnapshot" ADD CONSTRAINT "KeyResultSnapshot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyResultSnapshot" ADD CONSTRAINT "KeyResultSnapshot_keyResultId_fkey" FOREIGN KEY ("keyResultId") REFERENCES "KeyResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;
