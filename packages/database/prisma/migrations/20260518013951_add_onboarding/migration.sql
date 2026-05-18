-- CreateTable
CREATE TABLE "OnboardingProgress" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "flowType" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "completedSteps" TEXT[],
    "data" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MigrationConnection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "discoveryData" JSONB,
    "mappingData" JSONB,
    "importReport" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MigrationConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OnboardingProgress_tenantId_idx" ON "OnboardingProgress"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingProgress_tenantId_flowType_key" ON "OnboardingProgress"("tenantId", "flowType");

-- CreateIndex
CREATE INDEX "MigrationConnection_tenantId_idx" ON "MigrationConnection"("tenantId");

-- AddForeignKey
ALTER TABLE "OnboardingProgress" ADD CONSTRAINT "OnboardingProgress_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MigrationConnection" ADD CONSTRAINT "MigrationConnection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
