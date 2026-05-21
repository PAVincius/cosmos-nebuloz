-- AlterTable
ALTER TABLE "FlowMetricSnapshot" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastStalenessCheck" TIMESTAMP(3),
ADD COLUMN     "reevaluatedAt" TIMESTAMP(3),
ADD COLUMN     "reevaluatedBy" TEXT,
ADD COLUMN     "staleness" TEXT NOT NULL DEFAULT 'FRESH',
ADD COLUMN     "stalenessReasons" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "teamCompositionHash" TEXT,
ADD COLUMN     "versionOf" TEXT;

-- AlterTable
ALTER TABLE "ImprovementAction" ADD COLUMN     "source" TEXT,
ADD COLUMN     "sourceRunId" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "actualSp" INTEGER,
ADD COLUMN     "complexity" TEXT,
ADD COLUMN     "estimatedSp" INTEGER,
ADD COLUMN     "taskType" TEXT;

-- CreateTable
CREATE TABLE "AnomalyDetectionRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "summary" JSONB,
    "ranAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AnomalyDetectionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Anomaly" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "rule" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "delta" DOUBLE PRECISION NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Anomaly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StalenessAuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "oldState" TEXT NOT NULL,
    "newState" TEXT NOT NULL,
    "triggeredRules" JSONB NOT NULL,
    "triggeredBy" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StalenessAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonSkillProfile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "competency" TEXT NOT NULL,
    "skillLevel" INTEGER NOT NULL,
    "proficiency" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assessedBy" TEXT,
    "notes" TEXT,
    "confidence" INTEGER,
    "isDraft" BOOLEAN NOT NULL DEFAULT true,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PersonSkillProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMemberAssignment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sprintId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "capacityFactor" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "hoursPerWeek" DOUBLE PRECISION,
    "role" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamMemberAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberSprintMetrics" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sprintId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storyPointsDelivered" INTEGER NOT NULL DEFAULT 0,
    "storiesCompleted" INTEGER NOT NULL DEFAULT 0,
    "defectsResolved" INTEGER NOT NULL DEFAULT 0,
    "avgFlowTimeHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberSprintMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberThroughputBaseline" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "avgSpPerSprint" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "p10Estimate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "p50Estimate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "p90Estimate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "trend" TEXT NOT NULL DEFAULT 'NEUTRAL',
    "volatility" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sprintCount" INTEGER NOT NULL DEFAULT 0,
    "lastComputedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberThroughputBaseline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamCapacitySnapshot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sprintId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "totalMembersCommitted" INTEGER NOT NULL DEFAULT 0,
    "totalCapacityFactor" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expectedSpNextSprint" INTEGER NOT NULL DEFAULT 0,
    "minCapacityEstimate" INTEGER NOT NULL DEFAULT 0,
    "maxCapacityEstimate" INTEGER NOT NULL DEFAULT 0,
    "actualSpDelivered" INTEGER NOT NULL DEFAULT 0,
    "actualCapacityUtil" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "teamTrend" TEXT NOT NULL DEFAULT 'NEUTRAL',
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamCapacitySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PairSynergy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId1" TEXT NOT NULL,
    "userId2" TEXT NOT NULL,
    "taskType" TEXT NOT NULL DEFAULT 'any',
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "samples" INTEGER NOT NULL DEFAULT 0,
    "totalSp" INTEGER NOT NULL DEFAULT 0,
    "variance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "firstTaskAt" TIMESTAMP(3),
    "lastTaskAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PairSynergy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupSynergy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "memberIds" JSONB NOT NULL,
    "memberHash" TEXT NOT NULL,
    "taskType" TEXT NOT NULL DEFAULT 'any',
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "samples" INTEGER NOT NULL DEFAULT 0,
    "totalSp" INTEGER NOT NULL DEFAULT 0,
    "variance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupSynergy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskAssignee" (
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskAssignee_pkey" PRIMARY KEY ("taskId","userId")
);

-- CreateIndex
CREATE INDEX "AnomalyDetectionRun_tenantId_idx" ON "AnomalyDetectionRun"("tenantId");

-- CreateIndex
CREATE INDEX "AnomalyDetectionRun_tenantId_scope_scopeId_idx" ON "AnomalyDetectionRun"("tenantId", "scope", "scopeId");

-- CreateIndex
CREATE INDEX "AnomalyDetectionRun_snapshotId_idx" ON "AnomalyDetectionRun"("snapshotId");

-- CreateIndex
CREATE INDEX "AnomalyDetectionRun_tenantId_status_idx" ON "AnomalyDetectionRun"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Anomaly_tenantId_idx" ON "Anomaly"("tenantId");

-- CreateIndex
CREATE INDEX "Anomaly_runId_idx" ON "Anomaly"("runId");

-- CreateIndex
CREATE INDEX "Anomaly_tenantId_severity_idx" ON "Anomaly"("tenantId", "severity");

-- CreateIndex
CREATE INDEX "Anomaly_tenantId_rule_idx" ON "Anomaly"("tenantId", "rule");

-- CreateIndex
CREATE INDEX "StalenessAuditLog_tenantId_idx" ON "StalenessAuditLog"("tenantId");

-- CreateIndex
CREATE INDEX "StalenessAuditLog_snapshotId_idx" ON "StalenessAuditLog"("snapshotId");

-- CreateIndex
CREATE INDEX "StalenessAuditLog_tenantId_checkedAt_idx" ON "StalenessAuditLog"("tenantId", "checkedAt");

-- CreateIndex
CREATE INDEX "PersonSkillProfile_tenantId_idx" ON "PersonSkillProfile"("tenantId");

-- CreateIndex
CREATE INDEX "PersonSkillProfile_tenantId_userId_idx" ON "PersonSkillProfile"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "PersonSkillProfile_tenantId_competency_idx" ON "PersonSkillProfile"("tenantId", "competency");

-- CreateIndex
CREATE UNIQUE INDEX "PersonSkillProfile_tenantId_userId_competency_key" ON "PersonSkillProfile"("tenantId", "userId", "competency");

-- CreateIndex
CREATE INDEX "TeamMemberAssignment_tenantId_idx" ON "TeamMemberAssignment"("tenantId");

-- CreateIndex
CREATE INDEX "TeamMemberAssignment_teamId_idx" ON "TeamMemberAssignment"("teamId");

-- CreateIndex
CREATE INDEX "TeamMemberAssignment_userId_idx" ON "TeamMemberAssignment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMemberAssignment_sprintId_userId_key" ON "TeamMemberAssignment"("sprintId", "userId");

-- CreateIndex
CREATE INDEX "MemberSprintMetrics_tenantId_idx" ON "MemberSprintMetrics"("tenantId");

-- CreateIndex
CREATE INDEX "MemberSprintMetrics_teamId_userId_idx" ON "MemberSprintMetrics"("teamId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberSprintMetrics_sprintId_userId_key" ON "MemberSprintMetrics"("sprintId", "userId");

-- CreateIndex
CREATE INDEX "MemberThroughputBaseline_tenantId_idx" ON "MemberThroughputBaseline"("tenantId");

-- CreateIndex
CREATE INDEX "MemberThroughputBaseline_teamId_idx" ON "MemberThroughputBaseline"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberThroughputBaseline_tenantId_teamId_userId_key" ON "MemberThroughputBaseline"("tenantId", "teamId", "userId");

-- CreateIndex
CREATE INDEX "TeamCapacitySnapshot_tenantId_idx" ON "TeamCapacitySnapshot"("tenantId");

-- CreateIndex
CREATE INDEX "TeamCapacitySnapshot_teamId_idx" ON "TeamCapacitySnapshot"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamCapacitySnapshot_sprintId_teamId_key" ON "TeamCapacitySnapshot"("sprintId", "teamId");

-- CreateIndex
CREATE INDEX "PairSynergy_tenantId_idx" ON "PairSynergy"("tenantId");

-- CreateIndex
CREATE INDEX "PairSynergy_tenantId_userId1_idx" ON "PairSynergy"("tenantId", "userId1");

-- CreateIndex
CREATE INDEX "PairSynergy_tenantId_userId2_idx" ON "PairSynergy"("tenantId", "userId2");

-- CreateIndex
CREATE UNIQUE INDEX "PairSynergy_tenantId_userId1_userId2_taskType_key" ON "PairSynergy"("tenantId", "userId1", "userId2", "taskType");

-- CreateIndex
CREATE INDEX "GroupSynergy_tenantId_idx" ON "GroupSynergy"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupSynergy_tenantId_memberHash_taskType_key" ON "GroupSynergy"("tenantId", "memberHash", "taskType");

-- CreateIndex
CREATE INDEX "TaskAssignee_userId_idx" ON "TaskAssignee"("userId");

-- CreateIndex
CREATE INDEX "TaskAssignee_taskId_idx" ON "TaskAssignee"("taskId");

-- CreateIndex
CREATE INDEX "FlowMetricSnapshot_tenantId_staleness_lastStalenessCheck_idx" ON "FlowMetricSnapshot"("tenantId", "staleness", "lastStalenessCheck");

-- CreateIndex
CREATE INDEX "ImprovementAction_tenantId_source_idx" ON "ImprovementAction"("tenantId", "source");

-- AddForeignKey
ALTER TABLE "AnomalyDetectionRun" ADD CONSTRAINT "AnomalyDetectionRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anomaly" ADD CONSTRAINT "Anomaly_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anomaly" ADD CONSTRAINT "Anomaly_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AnomalyDetectionRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StalenessAuditLog" ADD CONSTRAINT "StalenessAuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonSkillProfile" ADD CONSTRAINT "PersonSkillProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMemberAssignment" ADD CONSTRAINT "TeamMemberAssignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMemberAssignment" ADD CONSTRAINT "TeamMemberAssignment_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMemberAssignment" ADD CONSTRAINT "TeamMemberAssignment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberSprintMetrics" ADD CONSTRAINT "MemberSprintMetrics_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberSprintMetrics" ADD CONSTRAINT "MemberSprintMetrics_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberThroughputBaseline" ADD CONSTRAINT "MemberThroughputBaseline_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamCapacitySnapshot" ADD CONSTRAINT "TeamCapacitySnapshot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamCapacitySnapshot" ADD CONSTRAINT "TeamCapacitySnapshot_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PairSynergy" ADD CONSTRAINT "PairSynergy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupSynergy" ADD CONSTRAINT "GroupSynergy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignee" ADD CONSTRAINT "TaskAssignee_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
