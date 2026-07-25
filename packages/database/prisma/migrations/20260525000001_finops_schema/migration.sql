-- DropForeignKey (guarded: table may not exist on fresh DB)
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'lean_business_cases') THEN
    ALTER TABLE "lean_business_cases" DROP CONSTRAINT IF EXISTS "lean_business_cases_epicId_fkey";
    ALTER TABLE "lean_business_cases" DROP CONSTRAINT IF EXISTS "lean_business_cases_tenantId_fkey";
  END IF;
END $$;

-- AlterTable
ALTER TABLE "PIKnowledgeVector" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "copilot_messages" ALTER COLUMN "tenantId" DROP DEFAULT;

-- DropTable
DROP TABLE IF EXISTS "lean_business_cases";

-- CreateTable
CREATE TABLE "BillingEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "syncLogId" TEXT,
    "provider" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "subAccountId" TEXT,
    "externalId" TEXT NOT NULL,
    "usageStartDate" TIMESTAMP(3) NOT NULL,
    "usageEndDate" TIMESTAMP(3) NOT NULL,
    "billingPeriodStart" TIMESTAMP(3),
    "billingPeriodEnd" TIMESTAMP(3),
    "service" TEXT NOT NULL,
    "serviceCategory" TEXT,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "region" TEXT,
    "skuId" TEXT,
    "chargeCategory" TEXT NOT NULL DEFAULT 'Usage',
    "chargeClass" TEXT,
    "chargeFrequency" TEXT,
    "pricingCategory" TEXT,
    "billedCost" DECIMAL(18,6) NOT NULL,
    "effectiveCost" DECIMAL(18,6) NOT NULL,
    "listCost" DECIMAL(18,6),
    "contractedCost" DECIMAL(18,6),
    "unblendedAmount" DECIMAL(18,6) NOT NULL,
    "amortizedAmount" DECIMAL(18,6) NOT NULL,
    "usageQuantity" DECIMAL(18,6),
    "usageUnit" TEXT,
    "commitmentDiscountId" TEXT,
    "commitmentDiscountType" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "fxRate" DECIMAL(18,8) NOT NULL DEFAULT 1,
    "tenantCurrency" TEXT NOT NULL DEFAULT 'USD',
    "tenantAmount" DECIMAL(18,6) NOT NULL,
    "tags" JSONB NOT NULL DEFAULT '{}',
    "themeId" TEXT,
    "mappingRuleId" TEXT,
    "mappingConf" TEXT NOT NULL DEFAULT 'UNMAPPED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingEntryAllocation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "billingEntryId" TEXT NOT NULL,
    "themeId" TEXT,
    "epicId" TEXT,
    "artId" TEXT,
    "percentage" DECIMAL(5,2) NOT NULL,
    "allocationType" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),

    CONSTRAINT "BillingEntryAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostSnapshot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "themeId" TEXT,
    "artId" TEXT,
    "epicId" TEXT,
    "okrId" TEXT,
    "period" TIMESTAMP(3) NOT NULL,
    "granularity" TEXT NOT NULL,
    "cloudCost" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "peopleCost" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "saasCost" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "actualCost" DECIMAL(18,6) NOT NULL,
    "plannedCost" DECIMAL(18,6),
    "unmappedAmount" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "breakdown" JSONB NOT NULL DEFAULT '{}',
    "sourceCurrencies" JSONB NOT NULL DEFAULT '{}',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "fxStrategy" TEXT NOT NULL DEFAULT 'MONTH_AVG',
    "fxConvertedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TagRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "integrationId" TEXT,
    "name" TEXT,
    "tagKey" TEXT,
    "tagValue" TEXT,
    "matchType" TEXT NOT NULL DEFAULT 'EXACT',
    "conditions" JSONB,
    "excludeConds" JSONB,
    "themeId" TEXT,
    "artId" TEXT,
    "epicId" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "matchCount" INTEGER NOT NULL DEFAULT 0,
    "lastMatchedAt" TIMESTAMP(3),
    "appliedFromDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TagRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnmappedCostBucket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "period" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(18,6) NOT NULL,
    "currency" TEXT NOT NULL,
    "topTags" JSONB NOT NULL DEFAULT '[]',
    "entryCount" INTEGER NOT NULL,

    CONSTRAINT "UnmappedCostBucket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingSyncCursor" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "lastIngestedThrough" TIMESTAMP(3) NOT NULL,
    "lookbackDays" INTEGER NOT NULL DEFAULT 7,
    "backfillDays" INTEGER NOT NULL DEFAULT 90,
    "backfillComplete" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncLogId" TEXT,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "nextRunAt" TIMESTAMP(3),

    CONSTRAINT "BillingSyncCursor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingSyncRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "inngestRunId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "currentStep" TEXT,
    "entriesProcessed" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "BillingSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostAnomaly" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "themeId" TEXT,
    "artId" TEXT,
    "integrationId" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "period" TIMESTAMP(3) NOT NULL,
    "service" TEXT,
    "accountId" TEXT,
    "baselineMedian" DECIMAL(18,6) NOT NULL,
    "baselineMAD" DECIMAL(18,6) NOT NULL,
    "actualAmount" DECIMAL(18,6) NOT NULL,
    "modifiedZScore" DECIMAL(8,4) NOT NULL,
    "deltaAbs" DECIMAL(18,6) NOT NULL,
    "deltaPct" DECIMAL(8,2) NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "acknowledgedBy" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "rootCauseHints" JSONB,

    CONSTRAINT "CostAnomaly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetPlan" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "scopeId" TEXT,
    "period" TIMESTAMP(3) NOT NULL,
    "granularity" TEXT NOT NULL,
    "plannedAmount" DECIMAL(18,6) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "category" TEXT,
    "source" TEXT NOT NULL,

    CONSTRAINT "BudgetPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommitmentDiscount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "service" TEXT,
    "region" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "upfrontCost" DECIMAL(18,6) NOT NULL,
    "hourlyRate" DECIMAL(18,8),
    "utilization" DECIMAL(5,2),
    "coverage" DECIMAL(5,2),

    CONSTRAINT "CommitmentDiscount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonCost" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "annualCost" DECIMAL(18,6) NOT NULL,
    "currency" TEXT NOT NULL,
    "allocationPct" DECIMAL(5,2) NOT NULL DEFAULT 100,
    "teamId" TEXT,
    "artId" TEXT,

    CONSTRAINT "PersonCost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurrencyRate" (
    "id" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CurrencyRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingEntryStaging" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "syncRunId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "page" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingEntryStaging_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationDraft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BillingEntry_tenantId_usageStartDate_idx" ON "BillingEntry"("tenantId", "usageStartDate");

-- CreateIndex
CREATE INDEX "BillingEntry_tenantId_provider_usageStartDate_idx" ON "BillingEntry"("tenantId", "provider", "usageStartDate");

-- CreateIndex
CREATE INDEX "BillingEntry_tenantId_accountId_usageStartDate_idx" ON "BillingEntry"("tenantId", "accountId", "usageStartDate");

-- CreateIndex
CREATE INDEX "BillingEntry_tenantId_service_usageStartDate_idx" ON "BillingEntry"("tenantId", "service", "usageStartDate");

-- CreateIndex
CREATE INDEX "BillingEntry_tenantId_mappingConf_idx" ON "BillingEntry"("tenantId", "mappingConf");

-- CreateIndex
CREATE INDEX "BillingEntry_tenantId_themeId_usageStartDate_idx" ON "BillingEntry"("tenantId", "themeId", "usageStartDate");

-- CreateIndex
CREATE INDEX "BillingEntry_integrationId_usageStartDate_idx" ON "BillingEntry"("integrationId", "usageStartDate");

-- CreateIndex
CREATE UNIQUE INDEX "BillingEntry_tenantId_integrationId_externalId_key" ON "BillingEntry"("tenantId", "integrationId", "externalId");

-- CreateIndex
CREATE INDEX "BillingEntryAllocation_tenantId_themeId_idx" ON "BillingEntryAllocation"("tenantId", "themeId");

-- CreateIndex
CREATE INDEX "BillingEntryAllocation_tenantId_epicId_idx" ON "BillingEntryAllocation"("tenantId", "epicId");

-- CreateIndex
CREATE INDEX "BillingEntryAllocation_tenantId_artId_idx" ON "BillingEntryAllocation"("tenantId", "artId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingEntryAllocation_billingEntryId_themeId_epicId_artId__key" ON "BillingEntryAllocation"("billingEntryId", "themeId", "epicId", "artId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "CostSnapshot_tenantId_period_idx" ON "CostSnapshot"("tenantId", "period");

-- CreateIndex
CREATE INDEX "CostSnapshot_tenantId_artId_period_idx" ON "CostSnapshot"("tenantId", "artId", "period");

-- CreateIndex
CREATE INDEX "CostSnapshot_tenantId_epicId_period_idx" ON "CostSnapshot"("tenantId", "epicId", "period");

-- CreateIndex
CREATE INDEX "CostSnapshot_tenantId_okrId_period_idx" ON "CostSnapshot"("tenantId", "okrId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "CostSnapshot_tenantId_themeId_artId_epicId_okrId_period_gra_key" ON "CostSnapshot"("tenantId", "themeId", "artId", "epicId", "okrId", "period", "granularity");

-- CreateIndex
CREATE INDEX "TagRule_tenantId_integrationId_idx" ON "TagRule"("tenantId", "integrationId");

-- CreateIndex
CREATE INDEX "TagRule_tenantId_priority_idx" ON "TagRule"("tenantId", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "UnmappedCostBucket_tenantId_integrationId_period_key" ON "UnmappedCostBucket"("tenantId", "integrationId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "BillingSyncCursor_integrationId_key" ON "BillingSyncCursor"("integrationId");

-- CreateIndex
CREATE INDEX "BillingSyncRun_tenantId_integrationId_startedAt_idx" ON "BillingSyncRun"("tenantId", "integrationId", "startedAt");

-- CreateIndex
CREATE INDEX "CostAnomaly_tenantId_status_severity_idx" ON "CostAnomaly"("tenantId", "status", "severity");

-- CreateIndex
CREATE INDEX "CostAnomaly_tenantId_themeId_detectedAt_idx" ON "CostAnomaly"("tenantId", "themeId", "detectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CostAnomaly_tenantId_themeId_service_period_key" ON "CostAnomaly"("tenantId", "themeId", "service", "period");

-- CreateIndex
CREATE INDEX "BudgetPlan_tenantId_period_idx" ON "BudgetPlan"("tenantId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetPlan_tenantId_scope_scopeId_period_granularity_catego_key" ON "BudgetPlan"("tenantId", "scope", "scopeId", "period", "granularity", "category");

-- CreateIndex
CREATE INDEX "CommitmentDiscount_tenantId_endDate_idx" ON "CommitmentDiscount"("tenantId", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "CommitmentDiscount_tenantId_integrationId_externalId_key" ON "CommitmentDiscount"("tenantId", "integrationId", "externalId");

-- CreateIndex
CREATE INDEX "PersonCost_tenantId_userId_effectiveFrom_idx" ON "PersonCost"("tenantId", "userId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "CurrencyRate_from_to_date_key" ON "CurrencyRate"("from", "to", "date");

-- CreateIndex
CREATE INDEX "BillingEntryStaging_tenantId_integrationId_syncRunId_idx" ON "BillingEntryStaging"("tenantId", "integrationId", "syncRunId");

-- CreateIndex
CREATE INDEX "BillingEntryStaging_createdAt_idx" ON "BillingEntryStaging"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationDraft_userId_tenantId_provider_key" ON "IntegrationDraft"("userId", "tenantId", "provider");

-- CreateIndex (idempotent — may already exist from prior migration)
CREATE UNIQUE INDEX IF NOT EXISTS "PIKnowledgeVector_source_unique" ON "PIKnowledgeVector"("tenantId", "sourceType", "sourceId", "chunkIndex");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "copilot_messages_sessionId_idx" ON "copilot_messages"("sessionId");

-- AddForeignKey
ALTER TABLE "BillingEntry" ADD CONSTRAINT "BillingEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingEntry" ADD CONSTRAINT "BillingEntry_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingEntry" ADD CONSTRAINT "BillingEntry_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "StrategicTheme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingEntryAllocation" ADD CONSTRAINT "BillingEntryAllocation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingEntryAllocation" ADD CONSTRAINT "BillingEntryAllocation_billingEntryId_fkey" FOREIGN KEY ("billingEntryId") REFERENCES "BillingEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostSnapshot" ADD CONSTRAINT "CostSnapshot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TagRule" ADD CONSTRAINT "TagRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnmappedCostBucket" ADD CONSTRAINT "UnmappedCostBucket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingSyncCursor" ADD CONSTRAINT "BillingSyncCursor_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingSyncRun" ADD CONSTRAINT "BillingSyncRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostAnomaly" ADD CONSTRAINT "CostAnomaly_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetPlan" ADD CONSTRAINT "BudgetPlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommitmentDiscount" ADD CONSTRAINT "CommitmentDiscount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonCost" ADD CONSTRAINT "PersonCost_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingEntryStaging" ADD CONSTRAINT "BillingEntryStaging_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copilot_messages" ADD CONSTRAINT "copilot_messages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- NOTE: For production tenants with >1M BillingEntry rows, apply partition by range:
-- ALTER TABLE "BillingEntry" PARTITION BY RANGE ("usageStartDate");
-- This is handled outside Prisma migrations to avoid downtime.
