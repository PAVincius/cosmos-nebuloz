-- AddColumn
ALTER TABLE "LeanBudget" ADD COLUMN "themeId" TEXT;

-- CreateIndex
CREATE INDEX "LeanBudget_tenantId_themeId_idx" ON "LeanBudget"("tenantId", "themeId");

-- AddForeignKey
ALTER TABLE "LeanBudget" ADD CONSTRAINT "LeanBudget_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "StrategicTheme"("id") ON DELETE SET NULL ON UPDATE CASCADE;
