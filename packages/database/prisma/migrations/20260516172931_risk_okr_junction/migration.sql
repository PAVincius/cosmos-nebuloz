-- CreateTable
CREATE TABLE "RiskOKR" (
    "riskId" TEXT NOT NULL,
    "okrId" TEXT NOT NULL,
    "impact" TEXT NOT NULL DEFAULT 'medium',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskOKR_pkey" PRIMARY KEY ("riskId","okrId")
);

-- CreateIndex
CREATE INDEX "RiskOKR_okrId_idx" ON "RiskOKR"("okrId");

-- AddForeignKey
ALTER TABLE "RiskOKR" ADD CONSTRAINT "RiskOKR_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskOKR" ADD CONSTRAINT "RiskOKR_okrId_fkey" FOREIGN KEY ("okrId") REFERENCES "OKR"("id") ON DELETE CASCADE ON UPDATE CASCADE;
