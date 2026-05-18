-- AlterTable
ALTER TABLE "Feature" ADD COLUMN     "startedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Story" ADD COLUMN     "startedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "StateTransitionHistory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "transitionedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "StateTransitionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlowMetricSnapshot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "periodRef" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "flowDistribution" JSONB NOT NULL DEFAULT '{}',
    "flowVelocityTotal" INTEGER NOT NULL DEFAULT 0,
    "flowVelocityByType" JSONB NOT NULL DEFAULT '{}',
    "flowTimeAvgHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "flowTimeMedianHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "flowTimeByType" JSONB NOT NULL DEFAULT '{}',
    "flowLoadAvg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "flowLoadCurrent" INTEGER NOT NULL DEFAULT 0,
    "flowEfficiency" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "flowPredictability" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "plannedItems" INTEGER NOT NULL DEFAULT 0,
    "deliveredItems" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FlowMetricSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetencyAssessment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "competency" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assessedById" TEXT,
    "respondents" JSONB,
    "notes" TEXT,
    "piPlanId" TEXT,

    CONSTRAINT "CompetencyAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImprovementAction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "scope" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "relatedMetric" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "dueDate" TIMESTAMP(3),
    "assigneeId" TEXT,
    "assessmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImprovementAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StateTransitionHistory_tenantId_idx" ON "StateTransitionHistory"("tenantId");

-- CreateIndex
CREATE INDEX "StateTransitionHistory_entityId_transitionedAt_idx" ON "StateTransitionHistory"("entityId", "transitionedAt");

-- CreateIndex
CREATE INDEX "StateTransitionHistory_tenantId_entityType_entityId_idx" ON "StateTransitionHistory"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "FlowMetricSnapshot_tenantId_idx" ON "FlowMetricSnapshot"("tenantId");

-- CreateIndex
CREATE INDEX "FlowMetricSnapshot_tenantId_scope_scopeId_idx" ON "FlowMetricSnapshot"("tenantId", "scope", "scopeId");

-- CreateIndex
CREATE INDEX "FlowMetricSnapshot_tenantId_periodRef_idx" ON "FlowMetricSnapshot"("tenantId", "periodRef");

-- CreateIndex
CREATE INDEX "CompetencyAssessment_tenantId_idx" ON "CompetencyAssessment"("tenantId");

-- CreateIndex
CREATE INDEX "CompetencyAssessment_tenantId_scope_scopeId_idx" ON "CompetencyAssessment"("tenantId", "scope", "scopeId");

-- CreateIndex
CREATE INDEX "CompetencyAssessment_tenantId_competency_idx" ON "CompetencyAssessment"("tenantId", "competency");

-- CreateIndex
CREATE INDEX "ImprovementAction_tenantId_idx" ON "ImprovementAction"("tenantId");

-- CreateIndex
CREATE INDEX "ImprovementAction_tenantId_scope_scopeId_idx" ON "ImprovementAction"("tenantId", "scope", "scopeId");

-- CreateIndex
CREATE INDEX "ImprovementAction_tenantId_status_idx" ON "ImprovementAction"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "StateTransitionHistory" ADD CONSTRAINT "StateTransitionHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlowMetricSnapshot" ADD CONSTRAINT "FlowMetricSnapshot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyAssessment" ADD CONSTRAINT "CompetencyAssessment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImprovementAction" ADD CONSTRAINT "ImprovementAction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImprovementAction" ADD CONSTRAINT "ImprovementAction_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "CompetencyAssessment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
