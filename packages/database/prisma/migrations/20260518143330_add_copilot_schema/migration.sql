-- CreateEnum
CREATE TYPE "CopilotMode" AS ENUM ('rte', 'lpm', 'pm', 'team', 'spc', 'global');

-- CreateEnum
CREATE TYPE "CopilotSurface" AS ENUM ('pi_workspace', 'portfolio_dashboard', 'flow_dashboard', 'lean_budget', 'risk_board', 'global');

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('pending', 'applied', 'discarded');

-- CreateEnum
CREATE TYPE "SuggestionType" AS ENUM ('create_pi_objectives', 'create_risks', 'flag_dependencies', 'create_improvement_action');

-- CreateTable
CREATE TABLE "CopilotSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mode" "CopilotMode" NOT NULL,
    "surface" "CopilotSurface" NOT NULL,
    "contextRef" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CopilotSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CopilotMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CopilotMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CopilotToolInvocation" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "outputSummary" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CopilotToolInvocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CopilotSuggestion" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" "SuggestionType" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CopilotSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovernedEpic" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "epicId" TEXT NOT NULL,
    "valueStreamId" TEXT,
    "themeId" TEXT,
    "investmentEstimate" DOUBLE PRECISION,
    "governanceStatus" TEXT NOT NULL DEFAULT 'draft',
    "guardrailFlags" JSONB NOT NULL DEFAULT '[]',
    "currentApprovalRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovernedEpic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalWorkflow" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "etapas" JSONB NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalWorkflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'open',
    "initiatorId" TEXT NOT NULL,
    "governedEpicId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalStepInstance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "approvalRequestId" TEXT NOT NULL,
    "etapaOrdem" INTEGER NOT NULL,
    "roleRequired" TEXT NOT NULL,
    "approverId" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'pending',
    "comentario" TEXT,
    "timestamp" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalStepInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionLogEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "valueStreamId" TEXT,
    "decisao" TEXT NOT NULL,
    "justificativa" TEXT NOT NULL,
    "dadosSuporte" JSONB NOT NULL DEFAULT '{}',
    "decisorId" TEXT NOT NULL,
    "dataDecisao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CopilotSession_tenantId_idx" ON "CopilotSession"("tenantId");

-- CreateIndex
CREATE INDEX "CopilotSession_tenantId_userId_idx" ON "CopilotSession"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "CopilotSession_tenantId_createdAt_idx" ON "CopilotSession"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "CopilotMessage_sessionId_idx" ON "CopilotMessage"("sessionId");

-- CreateIndex
CREATE INDEX "CopilotToolInvocation_sessionId_idx" ON "CopilotToolInvocation"("sessionId");

-- CreateIndex
CREATE INDEX "CopilotSuggestion_sessionId_idx" ON "CopilotSuggestion"("sessionId");

-- CreateIndex
CREATE INDEX "CopilotSuggestion_sessionId_status_idx" ON "CopilotSuggestion"("sessionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "GovernedEpic_epicId_key" ON "GovernedEpic"("epicId");

-- CreateIndex
CREATE INDEX "GovernedEpic_tenantId_idx" ON "GovernedEpic"("tenantId");

-- CreateIndex
CREATE INDEX "GovernedEpic_tenantId_governanceStatus_idx" ON "GovernedEpic"("tenantId", "governanceStatus");

-- CreateIndex
CREATE INDEX "ApprovalWorkflow_tenantId_idx" ON "ApprovalWorkflow"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalWorkflow_tenantId_tipo_key" ON "ApprovalWorkflow"("tenantId", "tipo");

-- CreateIndex
CREATE INDEX "ApprovalRequest_tenantId_idx" ON "ApprovalRequest"("tenantId");

-- CreateIndex
CREATE INDEX "ApprovalRequest_tenantId_estado_idx" ON "ApprovalRequest"("tenantId", "estado");

-- CreateIndex
CREATE INDEX "ApprovalRequest_governedEpicId_idx" ON "ApprovalRequest"("governedEpicId");

-- CreateIndex
CREATE INDEX "ApprovalStepInstance_tenantId_idx" ON "ApprovalStepInstance"("tenantId");

-- CreateIndex
CREATE INDEX "ApprovalStepInstance_approvalRequestId_idx" ON "ApprovalStepInstance"("approvalRequestId");

-- CreateIndex
CREATE INDEX "DecisionLogEntry_tenantId_idx" ON "DecisionLogEntry"("tenantId");

-- CreateIndex
CREATE INDEX "DecisionLogEntry_tenantId_tipo_idx" ON "DecisionLogEntry"("tenantId", "tipo");

-- CreateIndex
CREATE INDEX "DecisionLogEntry_tenantId_dataDecisao_idx" ON "DecisionLogEntry"("tenantId", "dataDecisao");

-- AddForeignKey
ALTER TABLE "CopilotSession" ADD CONSTRAINT "CopilotSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopilotMessage" ADD CONSTRAINT "CopilotMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CopilotSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopilotToolInvocation" ADD CONSTRAINT "CopilotToolInvocation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CopilotSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopilotSuggestion" ADD CONSTRAINT "CopilotSuggestion_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CopilotSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernedEpic" ADD CONSTRAINT "GovernedEpic_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernedEpic" ADD CONSTRAINT "GovernedEpic_epicId_fkey" FOREIGN KEY ("epicId") REFERENCES "Epic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalWorkflow" ADD CONSTRAINT "ApprovalWorkflow_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "ApprovalWorkflow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_governedEpicId_fkey" FOREIGN KEY ("governedEpicId") REFERENCES "GovernedEpic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalStepInstance" ADD CONSTRAINT "ApprovalStepInstance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalStepInstance" ADD CONSTRAINT "ApprovalStepInstance_approvalRequestId_fkey" FOREIGN KEY ("approvalRequestId") REFERENCES "ApprovalRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionLogEntry" ADD CONSTRAINT "DecisionLogEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
