-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('ORBIT', 'GALAXY', 'NEBULA', 'UNIVERSE');

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('ADMIN', 'STE', 'RTE', 'SM', 'PO', 'DEV', 'MEMBER');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELED');

-- CreateTable
CREATE TABLE "ART" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cadence" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ART_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "artId" TEXT,
    "name" TEXT NOT NULL,
    "velocity" INTEGER,
    "sprintLengthDays" INTEGER NOT NULL DEFAULT 14,
    "members" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PIPlan" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "artId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PIPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PIObjective" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "piPlanId" TEXT NOT NULL,
    "teamId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "businessValue" INTEGER NOT NULL DEFAULT 5,
    "isStretch" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PIObjective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Risk" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "piPlanId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'IDENTIFIED',
    "category" TEXT,
    "impact" TEXT NOT NULL DEFAULT 'medium',
    "probability" TEXT NOT NULL DEFAULT 'medium',
    "ownerUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Risk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Epic" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "statusId" TEXT NOT NULL DEFAULT 'BACKLOG',
    "order" INTEGER NOT NULL DEFAULT 0,
    "yjsDocumentState" TEXT,
    "strategicThemeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Epic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feature" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "epicId" TEXT,
    "piPlanId" TEXT,
    "title" TEXT NOT NULL,
    "statusId" TEXT NOT NULL DEFAULT 'BACKLOG',
    "bv" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "js" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "wsjfScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "storyPoints" INTEGER NOT NULL DEFAULT 1,
    "assigneeUserId" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolutionTrain" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SolutionTrain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Capability" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "solutionTrainId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'BACKLOG',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Capability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolutionEpic" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "solutionTrainId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'BACKLOG',
    "wsjfScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SolutionEpic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LACE" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "principles" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LACE_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "artId" TEXT,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PISession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "piPlanId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'PLANNING',
    "scheduledAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PISession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfidenceVoteSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "piSessionId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL DEFAULT 1,
    "xStateStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "votes" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "ConfidenceVoteSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PIKnowledgeVector" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "textContent" TEXT NOT NULL,
    "embedding" vector(1536),

    CONSTRAINT "PIKnowledgeVector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DependencyLink" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "blockingFeatureId" TEXT NOT NULL,
    "blockedFeatureId" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'not-started',
    "type" TEXT NOT NULL DEFAULT 'technical',
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "ownerUserId" TEXT,
    "notes" TEXT,
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DependencyLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamWorkflowNode" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "position" JSONB NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "TeamWorkflowNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamWorkflowEdge" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "sourceNodeId" TEXT NOT NULL,
    "targetNodeId" TEXT NOT NULL,
    "animated" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TeamWorkflowEdge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BpmnDefinition" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "xmlContent" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "BpmnDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategicTheme" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "order" INTEGER NOT NULL DEFAULT 0,
    "horizon" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "themeType" TEXT,
    "ownerUserId" TEXT,
    "budgetTotal" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StrategicTheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThemeART" (
    "themeId" TEXT NOT NULL,
    "artId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThemeART_pkey" PRIMARY KEY ("themeId","artId")
);

-- CreateTable
CREATE TABLE "OKR" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "piPlanId" TEXT,
    "strategicThemeId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "ownerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ON_TRACK',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OKR_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeyResult" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "okrId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "current" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "target" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT '%',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KeyResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeanBudget" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "artId" TEXT,
    "name" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "spent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "period" TEXT NOT NULL,
    "guardrails" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeanBudget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoadmapItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "epicId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "artId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoadmapItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "diff" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sprint" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "goal" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNING',
    "capacity" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sprint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Story" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sprintId" TEXT,
    "featureId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "acceptanceCriteria" TEXT,
    "storyPoints" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'BACKLOG',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "assigneeUserId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Story_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "assigneeUserId" TEXT,
    "estimateHours" DOUBLE PRECISION,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Defect" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "teamId" TEXT,
    "storyId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "reporterUserId" TEXT,
    "assigneeUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Defect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Impediment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "teamId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "ownerUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Impediment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StandupEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "yesterday" TEXT,
    "today" TEXT,
    "blockers" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StandupEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SprintReview" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sprintId" TEXT NOT NULL,
    "velocity" INTEGER,
    "demoNotes" TEXT,
    "goalMet" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SprintReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Retrospective" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sprintId" TEXT NOT NULL,
    "wentWell" JSONB NOT NULL DEFAULT '[]',
    "toImprove" JSONB NOT NULL DEFAULT '[]',
    "actions" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Retrospective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "plan" "SubscriptionPlan" NOT NULL DEFAULT 'ORBIT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "activeTenantId" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantMember" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantInvitation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL DEFAULT 'MEMBER',
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "inviterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ART_tenantId_idx" ON "ART"("tenantId");

-- CreateIndex
CREATE INDEX "Team_tenantId_idx" ON "Team"("tenantId");

-- CreateIndex
CREATE INDEX "Team_artId_idx" ON "Team"("artId");

-- CreateIndex
CREATE INDEX "PIPlan_tenantId_idx" ON "PIPlan"("tenantId");

-- CreateIndex
CREATE INDEX "PIPlan_artId_idx" ON "PIPlan"("artId");

-- CreateIndex
CREATE INDEX "PIObjective_tenantId_idx" ON "PIObjective"("tenantId");

-- CreateIndex
CREATE INDEX "PIObjective_tenantId_piPlanId_idx" ON "PIObjective"("tenantId", "piPlanId");

-- CreateIndex
CREATE INDEX "Risk_tenantId_idx" ON "Risk"("tenantId");

-- CreateIndex
CREATE INDEX "Risk_tenantId_piPlanId_idx" ON "Risk"("tenantId", "piPlanId");

-- CreateIndex
CREATE INDEX "Epic_tenantId_idx" ON "Epic"("tenantId");

-- CreateIndex
CREATE INDEX "Epic_strategicThemeId_idx" ON "Epic"("strategicThemeId");

-- CreateIndex
CREATE INDEX "Feature_tenantId_idx" ON "Feature"("tenantId");

-- CreateIndex
CREATE INDEX "Feature_epicId_idx" ON "Feature"("epicId");

-- CreateIndex
CREATE INDEX "Feature_piPlanId_idx" ON "Feature"("piPlanId");

-- CreateIndex
CREATE INDEX "Feature_assigneeUserId_idx" ON "Feature"("assigneeUserId");

-- CreateIndex
CREATE INDEX "Feature_tenantId_assigneeUserId_idx" ON "Feature"("tenantId", "assigneeUserId");

-- CreateIndex
CREATE INDEX "SolutionTrain_tenantId_idx" ON "SolutionTrain"("tenantId");

-- CreateIndex
CREATE INDEX "Capability_tenantId_idx" ON "Capability"("tenantId");

-- CreateIndex
CREATE INDEX "Capability_solutionTrainId_idx" ON "Capability"("solutionTrainId");

-- CreateIndex
CREATE INDEX "SolutionEpic_tenantId_idx" ON "SolutionEpic"("tenantId");

-- CreateIndex
CREATE INDEX "SolutionEpic_solutionTrainId_idx" ON "SolutionEpic"("solutionTrainId");

-- CreateIndex
CREATE UNIQUE INDEX "LACE_tenantId_key" ON "LACE"("tenantId");

-- CreateIndex
CREATE INDEX "Supplier_tenantId_idx" ON "Supplier"("tenantId");

-- CreateIndex
CREATE INDEX "Supplier_artId_idx" ON "Supplier"("artId");

-- CreateIndex
CREATE INDEX "PISession_tenantId_idx" ON "PISession"("tenantId");

-- CreateIndex
CREATE INDEX "PISession_piPlanId_idx" ON "PISession"("piPlanId");

-- CreateIndex
CREATE INDEX "ConfidenceVoteSession_tenantId_idx" ON "ConfidenceVoteSession"("tenantId");

-- CreateIndex
CREATE INDEX "ConfidenceVoteSession_piSessionId_idx" ON "ConfidenceVoteSession"("piSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "ConfidenceVoteSession_piSessionId_roundNumber_key" ON "ConfidenceVoteSession"("piSessionId", "roundNumber");

-- CreateIndex
CREATE INDEX "PIKnowledgeVector_tenantId_idx" ON "PIKnowledgeVector"("tenantId");

-- CreateIndex
CREATE INDEX "DependencyLink_tenantId_idx" ON "DependencyLink"("tenantId");

-- CreateIndex
CREATE INDEX "DependencyLink_blockingFeatureId_idx" ON "DependencyLink"("blockingFeatureId");

-- CreateIndex
CREATE INDEX "DependencyLink_blockedFeatureId_idx" ON "DependencyLink"("blockedFeatureId");

-- CreateIndex
CREATE UNIQUE INDEX "DependencyLink_blockingFeatureId_blockedFeatureId_key" ON "DependencyLink"("blockingFeatureId", "blockedFeatureId");

-- CreateIndex
CREATE INDEX "TeamWorkflowNode_tenantId_teamId_idx" ON "TeamWorkflowNode"("tenantId", "teamId");

-- CreateIndex
CREATE INDEX "TeamWorkflowEdge_tenantId_teamId_idx" ON "TeamWorkflowEdge"("tenantId", "teamId");

-- CreateIndex
CREATE INDEX "BpmnDefinition_tenantId_teamId_idx" ON "BpmnDefinition"("tenantId", "teamId");

-- CreateIndex
CREATE INDEX "StrategicTheme_tenantId_idx" ON "StrategicTheme"("tenantId");

-- CreateIndex
CREATE INDEX "StrategicTheme_tenantId_status_idx" ON "StrategicTheme"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StrategicTheme_tenantId_code_key" ON "StrategicTheme"("tenantId", "code");

-- CreateIndex
CREATE INDEX "ThemeART_artId_idx" ON "ThemeART"("artId");

-- CreateIndex
CREATE INDEX "OKR_tenantId_idx" ON "OKR"("tenantId");

-- CreateIndex
CREATE INDEX "OKR_tenantId_piPlanId_idx" ON "OKR"("tenantId", "piPlanId");

-- CreateIndex
CREATE INDEX "OKR_strategicThemeId_idx" ON "OKR"("strategicThemeId");

-- CreateIndex
CREATE INDEX "KeyResult_tenantId_idx" ON "KeyResult"("tenantId");

-- CreateIndex
CREATE INDEX "KeyResult_okrId_idx" ON "KeyResult"("okrId");

-- CreateIndex
CREATE INDEX "LeanBudget_tenantId_idx" ON "LeanBudget"("tenantId");

-- CreateIndex
CREATE INDEX "LeanBudget_tenantId_artId_idx" ON "LeanBudget"("tenantId", "artId");

-- CreateIndex
CREATE INDEX "RoadmapItem_tenantId_idx" ON "RoadmapItem"("tenantId");

-- CreateIndex
CREATE INDEX "RoadmapItem_tenantId_startDate_endDate_idx" ON "RoadmapItem"("tenantId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "Notification_tenantId_userId_idx" ON "Notification"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "Notification_tenantId_idx" ON "Notification"("tenantId");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_idx" ON "AuditLog"("tenantId");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_entityType_entityId_idx" ON "AuditLog"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON "AuditLog"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "Integration_tenantId_idx" ON "Integration"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Integration_tenantId_type_key" ON "Integration"("tenantId", "type");

-- CreateIndex
CREATE INDEX "Sprint_tenantId_idx" ON "Sprint"("tenantId");

-- CreateIndex
CREATE INDEX "Sprint_teamId_idx" ON "Sprint"("teamId");

-- CreateIndex
CREATE INDEX "Sprint_tenantId_status_idx" ON "Sprint"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Story_tenantId_idx" ON "Story"("tenantId");

-- CreateIndex
CREATE INDEX "Story_sprintId_idx" ON "Story"("sprintId");

-- CreateIndex
CREATE INDEX "Story_featureId_idx" ON "Story"("featureId");

-- CreateIndex
CREATE INDEX "Story_tenantId_status_idx" ON "Story"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Task_tenantId_idx" ON "Task"("tenantId");

-- CreateIndex
CREATE INDEX "Task_storyId_idx" ON "Task"("storyId");

-- CreateIndex
CREATE INDEX "Defect_tenantId_idx" ON "Defect"("tenantId");

-- CreateIndex
CREATE INDEX "Defect_teamId_idx" ON "Defect"("teamId");

-- CreateIndex
CREATE INDEX "Defect_tenantId_status_idx" ON "Defect"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Impediment_tenantId_idx" ON "Impediment"("tenantId");

-- CreateIndex
CREATE INDEX "Impediment_teamId_idx" ON "Impediment"("teamId");

-- CreateIndex
CREATE INDEX "StandupEntry_tenantId_idx" ON "StandupEntry"("tenantId");

-- CreateIndex
CREATE INDEX "StandupEntry_teamId_date_idx" ON "StandupEntry"("teamId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "StandupEntry_teamId_userId_date_key" ON "StandupEntry"("teamId", "userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "SprintReview_sprintId_key" ON "SprintReview"("sprintId");

-- CreateIndex
CREATE INDEX "SprintReview_tenantId_idx" ON "SprintReview"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Retrospective_sprintId_key" ON "Retrospective"("sprintId");

-- CreateIndex
CREATE INDEX "Retrospective_tenantId_idx" ON "Retrospective"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE INDEX "TenantMember_tenantId_idx" ON "TenantMember"("tenantId");

-- CreateIndex
CREATE INDEX "TenantMember_userId_idx" ON "TenantMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantMember_tenantId_userId_key" ON "TenantMember"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "TenantInvitation_tenantId_idx" ON "TenantInvitation"("tenantId");

-- AddForeignKey
ALTER TABLE "ART" ADD CONSTRAINT "ART_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_artId_fkey" FOREIGN KEY ("artId") REFERENCES "ART"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PIPlan" ADD CONSTRAINT "PIPlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PIPlan" ADD CONSTRAINT "PIPlan_artId_fkey" FOREIGN KEY ("artId") REFERENCES "ART"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PIObjective" ADD CONSTRAINT "PIObjective_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PIObjective" ADD CONSTRAINT "PIObjective_piPlanId_fkey" FOREIGN KEY ("piPlanId") REFERENCES "PIPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_piPlanId_fkey" FOREIGN KEY ("piPlanId") REFERENCES "PIPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Epic" ADD CONSTRAINT "Epic_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Epic" ADD CONSTRAINT "Epic_strategicThemeId_fkey" FOREIGN KEY ("strategicThemeId") REFERENCES "StrategicTheme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feature" ADD CONSTRAINT "Feature_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feature" ADD CONSTRAINT "Feature_epicId_fkey" FOREIGN KEY ("epicId") REFERENCES "Epic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feature" ADD CONSTRAINT "Feature_piPlanId_fkey" FOREIGN KEY ("piPlanId") REFERENCES "PIPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolutionTrain" ADD CONSTRAINT "SolutionTrain_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Capability" ADD CONSTRAINT "Capability_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Capability" ADD CONSTRAINT "Capability_solutionTrainId_fkey" FOREIGN KEY ("solutionTrainId") REFERENCES "SolutionTrain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolutionEpic" ADD CONSTRAINT "SolutionEpic_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolutionEpic" ADD CONSTRAINT "SolutionEpic_solutionTrainId_fkey" FOREIGN KEY ("solutionTrainId") REFERENCES "SolutionTrain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LACE" ADD CONSTRAINT "LACE_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PISession" ADD CONSTRAINT "PISession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PISession" ADD CONSTRAINT "PISession_piPlanId_fkey" FOREIGN KEY ("piPlanId") REFERENCES "PIPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfidenceVoteSession" ADD CONSTRAINT "ConfidenceVoteSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfidenceVoteSession" ADD CONSTRAINT "ConfidenceVoteSession_piSessionId_fkey" FOREIGN KEY ("piSessionId") REFERENCES "PISession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PIKnowledgeVector" ADD CONSTRAINT "PIKnowledgeVector_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DependencyLink" ADD CONSTRAINT "DependencyLink_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DependencyLink" ADD CONSTRAINT "DependencyLink_blockingFeatureId_fkey" FOREIGN KEY ("blockingFeatureId") REFERENCES "Feature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DependencyLink" ADD CONSTRAINT "DependencyLink_blockedFeatureId_fkey" FOREIGN KEY ("blockedFeatureId") REFERENCES "Feature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamWorkflowNode" ADD CONSTRAINT "TeamWorkflowNode_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamWorkflowEdge" ADD CONSTRAINT "TeamWorkflowEdge_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BpmnDefinition" ADD CONSTRAINT "BpmnDefinition_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategicTheme" ADD CONSTRAINT "StrategicTheme_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThemeART" ADD CONSTRAINT "ThemeART_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "StrategicTheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThemeART" ADD CONSTRAINT "ThemeART_artId_fkey" FOREIGN KEY ("artId") REFERENCES "ART"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OKR" ADD CONSTRAINT "OKR_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OKR" ADD CONSTRAINT "OKR_strategicThemeId_fkey" FOREIGN KEY ("strategicThemeId") REFERENCES "StrategicTheme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyResult" ADD CONSTRAINT "KeyResult_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyResult" ADD CONSTRAINT "KeyResult_okrId_fkey" FOREIGN KEY ("okrId") REFERENCES "OKR"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeanBudget" ADD CONSTRAINT "LeanBudget_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoadmapItem" ADD CONSTRAINT "RoadmapItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sprint" ADD CONSTRAINT "Sprint_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sprint" ADD CONSTRAINT "Sprint_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Story" ADD CONSTRAINT "Story_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Story" ADD CONSTRAINT "Story_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Story" ADD CONSTRAINT "Story_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "Feature"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Defect" ADD CONSTRAINT "Defect_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Impediment" ADD CONSTRAINT "Impediment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandupEntry" ADD CONSTRAINT "StandupEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SprintReview" ADD CONSTRAINT "SprintReview_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SprintReview" ADD CONSTRAINT "SprintReview_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Retrospective" ADD CONSTRAINT "Retrospective_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Retrospective" ADD CONSTRAINT "Retrospective_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantMember" ADD CONSTRAINT "TenantMember_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantMember" ADD CONSTRAINT "TenantMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantInvitation" ADD CONSTRAINT "TenantInvitation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
