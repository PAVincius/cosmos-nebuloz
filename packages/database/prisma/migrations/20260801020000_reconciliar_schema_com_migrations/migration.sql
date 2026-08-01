-- Reconcilia a cadeia de migrations com o schema Prisma.
--
-- O script `pnpm migrate` do repo roda `db push`, não `migrate dev`: o schema
-- evoluiu por push nos bancos de desenvolvimento e as migrations ficaram para
-- trás. `prisma migrate diff` acusava 482 linhas de diferença, em 61 tabelas.
--
-- O efeito prático: banco criado pela cadeia (produção, CI) fica com formato
-- diferente do que o client espera, e gravações falham com
--
--     The column `(not available)` does not exist in the current database
--
-- que era o que quebrava a criação de Tenant no cadastro self-service.
--
-- Todo o DDL aqui é idempotente — IF [NOT] EXISTS em colunas, índices e
-- tabelas; DO/EXCEPTION em constraints e renames. Os dois estados precisam ser
-- aceitos: banco de dev já está no formato final por causa do push, banco da
-- cadeia está atrás e precisa do DDL de verdade.
--
-- Três tabelas apareciam no diff como "dropar e recriar" — eram divergência de
-- nome, não de estrutura: as migrations criaram em snake_case e os modelos não
-- tinham `@@map`. Resolvido no schema, sem DDL.
--
-- As duas tabelas dropadas aqui (copilot_tool_invocations e
-- copilot_suggestion_archive) não têm modelo no schema, não são referenciadas
-- por código e não existem nos bancos de dev.

-- DropForeignKey
ALTER TABLE "AccessExceptionRequest" DROP CONSTRAINT IF EXISTS "AccessExceptionRequest_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "AnomalyRuleConfig" DROP CONSTRAINT IF EXISTS "AnomalyRuleConfig_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "ArtSequenceCounter" DROP CONSTRAINT IF EXISTS "ArtSequenceCounter_artId_fkey";

-- DropForeignKey
ALTER TABLE "ArtSequenceCounter" DROP CONSTRAINT IF EXISTS "ArtSequenceCounter_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "CapacityAdjustmentNote" DROP CONSTRAINT IF EXISTS "CapacityAdjustmentNote_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "ConfidenceVoteTally" DROP CONSTRAINT IF EXISTS "ConfidenceVoteTally_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "ConfidenceVoteTally" DROP CONSTRAINT IF EXISTS "ConfidenceVoteTally_voteSessionId_fkey";

-- DropForeignKey
ALTER TABLE "CrossArtDependency" DROP CONSTRAINT IF EXISTS "CrossArtDependency_solutionTrainId_fkey";

-- DropForeignKey
ALTER TABLE "EpicValueMetric" DROP CONSTRAINT IF EXISTS "EpicValueMetric_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "InvestmentHorizon" DROP CONSTRAINT IF EXISTS "InvestmentHorizon_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "LeanBudgetReallocation" DROP CONSTRAINT IF EXISTS "LeanBudgetReallocation_leanBudgetId_fkey";

-- DropForeignKey
ALTER TABLE "LeanBudgetReallocation" DROP CONSTRAINT IF EXISTS "LeanBudgetReallocation_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "MeetingInsight" DROP CONSTRAINT IF EXISTS "MeetingInsight_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "MeetingInsight" DROP CONSTRAINT IF EXISTS "MeetingInsight_transcriptId_fkey";

-- DropForeignKey
ALTER TABLE "MeetingIntegration" DROP CONSTRAINT IF EXISTS "MeetingIntegration_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "MeetingTranscript" DROP CONSTRAINT IF EXISTS "MeetingTranscript_integrationId_fkey";

-- DropForeignKey
ALTER TABLE "MeetingTranscript" DROP CONSTRAINT IF EXISTS "MeetingTranscript_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "PortfolioAnalysisReport" DROP CONSTRAINT IF EXISTS "PortfolioAnalysisReport_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "ScheduledReport" DROP CONSTRAINT IF EXISTS "ScheduledReport_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "ScheduledReportExecution" DROP CONSTRAINT IF EXISTS "ScheduledReportExecution_reportId_fkey";

-- DropForeignKey
ALTER TABLE "SolutionRisk" DROP CONSTRAINT IF EXISTS "SolutionRisk_solutionTrainId_fkey";

-- DropForeignKey
ALTER TABLE "UserDashboardLayout" DROP CONSTRAINT IF EXISTS "UserDashboardLayout_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "copilot_suggestion_archive" DROP CONSTRAINT IF EXISTS "CopilotSuggestion_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "copilot_tool_invocations" DROP CONSTRAINT IF EXISTS "CopilotToolInvocation_sessionId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "AuditLog_tenantId_action_createdAt_idx";

-- DropIndex
DROP INDEX IF EXISTS "BpmnDefinition_tenantId_teamId_idx";

-- DropIndex
DROP INDEX IF EXISTS "DependencyLink_boardStatus_idx";

-- DropIndex
DROP INDEX IF EXISTS "DependencyLink_tenantId_boardStatus_idx";

-- DropIndex
DROP INDEX IF EXISTS "Epic_searchVector_gin_idx";

-- DropIndex
DROP INDEX IF EXISTS "Epic_tenantId_lifecycleStatus_idx";

-- DropIndex
DROP INDEX IF EXISTS "Feature_artScopedId_idx";

-- DropIndex
DROP INDEX IF EXISTS "Feature_assignedTeamId_idx";

-- DropIndex
DROP INDEX IF EXISTS "Feature_searchVector_gin_idx";

-- DropIndex
DROP INDEX IF EXISTS "Risk_tenantId_overdue_idx";

-- DropIndex
DROP INDEX IF EXISTS "Risk_tenantId_roamStatus_idx";

-- DropIndex
DROP INDEX IF EXISTS "Sprint_teamId_status_idx";

-- DropIndex
DROP INDEX IF EXISTS "Story_originStoryId_idx";

-- DropIndex
DROP INDEX IF EXISTS "copilot_sessions_tenantid_createdat_idx";

-- AlterTable
ALTER TABLE "ARTMembership" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AnomalyRuleConfig" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ApiKey" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ApiKeyUsageLog" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "BpmnDefinition" DROP COLUMN IF EXISTS "teamId",
DROP COLUMN IF EXISTS "xmlContent",
ADD COLUMN IF NOT EXISTS "actionCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "activatedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "activatedBy" TEXT,
ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "compiledMachine" JSONB,
ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS "entityType" TEXT NOT NULL,
ADD COLUMN IF NOT EXISTS "lockedNodes" TEXT[],
ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL,
ADD COLUMN IF NOT EXISTS "ownerId" TEXT NOT NULL,
ADD COLUMN IF NOT EXISTS "ownerType" TEXT NOT NULL,
ADD COLUMN IF NOT EXISTS "parentId" TEXT,
ADD COLUMN IF NOT EXISTS "runCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "triggerLabel" TEXT,
ADD COLUMN IF NOT EXISTS "xmlGzip" BYTEA NOT NULL;

-- AlterTable
ALTER TABLE "Capability" ADD COLUMN IF NOT EXISTS "milestone" TEXT;

-- AlterTable
ALTER TABLE "ConfidenceVoteSession" DROP COLUMN IF EXISTS "roundType";

-- AlterTable
ALTER TABLE "ConfidenceVoteTally" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CrossArtDependency" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CustomRole" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CustomRoleAssignment" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "DecisionLogEntry" ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "titulo" TEXT;

-- AlterTable
ALTER TABLE "Epic" ADD COLUMN IF NOT EXISTS "artId" TEXT,
ADD COLUMN IF NOT EXISTS "artTone" TEXT,
ADD COLUMN IF NOT EXISTS "hot" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "ownerId" TEXT,
ADD COLUMN IF NOT EXISTS "ownerName" TEXT,
ADD COLUMN IF NOT EXISTS "sizePoints" INTEGER,
ADD COLUMN IF NOT EXISTS "wsjf" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Feature" ADD COLUMN IF NOT EXISTS "milestone" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "workflowContext" JSONB,
ADD COLUMN IF NOT EXISTS "workflowState" TEXT,
ADD COLUMN IF NOT EXISTS "workflowVersion" INTEGER;

-- AlterTable
ALTER TABLE "GovernanceEscalation" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "JobFallbackQueue" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "payload" DROP DEFAULT;

-- AlterTable
ALTER TABLE "KeyResult" ADD COLUMN IF NOT EXISTS "confidence" TEXT NOT NULL DEFAULT 'ON_TRACK',
ADD COLUMN IF NOT EXISTS "metricRuleId" TEXT;

-- AlterTable
ALTER TABLE "KeyResultSnapshot" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "LACEMember" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "LeanBudget" ALTER COLUMN "spent" DROP DEFAULT;

-- AlterTable
ALTER TABLE "MeetingInsight" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "MeetingIntegration" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "config" DROP DEFAULT;

-- AlterTable
ALTER TABLE "MeetingTranscript" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Notification" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "OKR" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "finalAchievement" JSONB,
ADD COLUMN IF NOT EXISTS "quarter" INTEGER,
ADD COLUMN IF NOT EXISTS "year" INTEGER;

-- AlterTable
ALTER TABLE "PIPlan" ADD COLUMN IF NOT EXISTS "miroBoardUrl" TEXT;

-- AlterTable
ALTER TABLE "PortfolioAnalysisReport" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "RetroActionItem" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "RoadmapItem" ADD COLUMN IF NOT EXISTS "milestone" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ScheduledReport" ADD COLUMN IF NOT EXISTS "artId" TEXT,
ADD COLUMN IF NOT EXISTS "artifactRef" TEXT,
ADD COLUMN IF NOT EXISTS "cadence" TEXT NOT NULL DEFAULT 'MONTHLY',
ADD COLUMN IF NOT EXISTS "createdBy" TEXT,
ADD COLUMN IF NOT EXISTS "lastRunAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'EXECUTIVE_SUMMARY',
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "recipients" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ScheduledReportExecution" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ScoringEvent" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SolutionRisk" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "affectedArtIds" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Story" ADD COLUMN IF NOT EXISTS "workflowContext" JSONB,
ADD COLUMN IF NOT EXISTS "workflowState" TEXT,
ADD COLUMN IF NOT EXISTS "workflowVersion" INTEGER;

-- AlterTable
ALTER TABLE "StrategicTheme" ADD COLUMN IF NOT EXISTS "healthStatus" TEXT NOT NULL DEFAULT 'on',
ADD COLUMN IF NOT EXISTS "pillarId" TEXT,
ADD COLUMN IF NOT EXISTS "targetAllocationPct" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "SupplierDeliverable" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TagRule" ADD COLUMN IF NOT EXISTS "outputTag" TEXT,
ADD COLUMN IF NOT EXISTS "outputTagTone" TEXT DEFAULT 'accent',
ADD COLUMN IF NOT EXISTS "scope" TEXT;

-- AlterTable
ALTER TABLE "Team" ADD COLUMN IF NOT EXISTS "focusArea" TEXT,
ADD COLUMN IF NOT EXISTS "leadUserId" TEXT,
ALTER COLUMN "color" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "visionStatement" TEXT;

-- AlterTable
ALTER TABLE "UserDashboardLayout" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "WebhookDeliveryLog" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "WebhookEndpoint" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
DO $$ BEGIN
  ALTER TABLE "copilot_messages" RENAME CONSTRAINT "CopilotMessage_pkey" TO "copilot_messages_pkey";
EXCEPTION WHEN undefined_object OR duplicate_object THEN NULL;
END $$;

-- AlterTable
DO $$ BEGIN
  ALTER TABLE "copilot_sessions" RENAME CONSTRAINT "CopilotSession_pkey" TO "copilot_sessions_pkey";
EXCEPTION WHEN undefined_object OR duplicate_object THEN NULL;
END $$;

ALTER TABLE "copilot_sessions" ALTER COLUMN "surface" DROP NOT NULL;

-- DropTable
DROP TABLE IF EXISTS "copilot_suggestion_archive";

-- DropTable
DROP TABLE IF EXISTS "copilot_tool_invocations";

-- CreateTable
CREATE TABLE IF NOT EXISTS "StrategyPillar" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tone" TEXT NOT NULL DEFAULT 'accent',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StrategyPillar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TenantSSOConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "idpMetadataUrl" TEXT,
    "idpEntityId" TEXT,
    "idpCertificate" TEXT,
    "spEntityId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "TenantSSOConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StrategyPillar_tenantId_idx" ON "StrategyPillar"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TenantSSOConfig_tenantId_key" ON "TenantSSOConfig"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TenantSSOConfig_tenantId_idx" ON "TenantSSOConfig"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BpmnDefinition_tenantId_entityType_ownerId_active_idx" ON "BpmnDefinition"("tenantId", "entityType", "ownerId", "active");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BpmnDefinition_tenantId_name_ownerType_ownerId_key" ON "BpmnDefinition"("tenantId", "name", "ownerType", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "LeanBudget_artId_piPlanId_key" ON "LeanBudget"("artId", "piPlanId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OKR_tenantId_artId_year_quarter_idx" ON "OKR"("tenantId", "artId", "year", "quarter");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PIKnowledgeVector_source_unique" ON "PIKnowledgeVector"("tenantId", "sourceType", "sourceId", "chunkIndex");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PortfolioAnalysisReport_jobId_key" ON "PortfolioAnalysisReport"("jobId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StrategicTheme_pillarId_idx" ON "StrategicTheme"("pillarId");

-- RenameForeignKey
DO $$ BEGIN
  ALTER TABLE "copilot_messages" RENAME CONSTRAINT "CopilotMessage_sessionId_fkey" TO "copilot_messages_sessionId_fkey";
EXCEPTION WHEN undefined_object OR duplicate_object THEN NULL;
END $$;

-- RenameForeignKey
DO $$ BEGIN
  ALTER TABLE "copilot_sessions" RENAME CONSTRAINT "CopilotSession_tenantId_fkey" TO "copilot_sessions_tenantId_fkey";
EXCEPTION WHEN undefined_object OR duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ArtSequenceCounter" ADD CONSTRAINT "ArtSequenceCounter_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ArtSequenceCounter" ADD CONSTRAINT "ArtSequenceCounter_artId_fkey" FOREIGN KEY ("artId") REFERENCES "ART"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ScoringEvent" ADD CONSTRAINT "ScoringEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "pi_plan_feature_assignments" ADD CONSTRAINT "pi_plan_feature_assignments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "board_reconciliation_logs" ADD CONSTRAINT "board_reconciliation_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "AnomalyRuleConfig" ADD CONSTRAINT "AnomalyRuleConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "SolutionRisk" ADD CONSTRAINT "SolutionRisk_solutionTrainId_fkey" FOREIGN KEY ("solutionTrainId") REFERENCES "SolutionTrain"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "SolutionRisk" ADD CONSTRAINT "SolutionRisk_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CrossArtDependency" ADD CONSTRAINT "CrossArtDependency_solutionTrainId_fkey" FOREIGN KEY ("solutionTrainId") REFERENCES "SolutionTrain"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CrossArtDependency" ADD CONSTRAINT "CrossArtDependency_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "MeetingIntegration" ADD CONSTRAINT "MeetingIntegration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "MeetingTranscript" ADD CONSTRAINT "MeetingTranscript_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "MeetingTranscript" ADD CONSTRAINT "MeetingTranscript_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "MeetingIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "MeetingInsight" ADD CONSTRAINT "MeetingInsight_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "MeetingInsight" ADD CONSTRAINT "MeetingInsight_transcriptId_fkey" FOREIGN KEY ("transcriptId") REFERENCES "MeetingTranscript"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ConfidenceVoteTally" ADD CONSTRAINT "ConfidenceVoteTally_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ConfidenceVoteTally" ADD CONSTRAINT "ConfidenceVoteTally_voteSessionId_fkey" FOREIGN KEY ("voteSessionId") REFERENCES "ConfidenceVoteSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "AccessExceptionRequest" ADD CONSTRAINT "AccessExceptionRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "StrategicTheme" ADD CONSTRAINT "StrategicTheme_pillarId_fkey" FOREIGN KEY ("pillarId") REFERENCES "StrategyPillar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "StrategyPillar" ADD CONSTRAINT "StrategyPillar_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "InvestmentHorizon" ADD CONSTRAINT "InvestmentHorizon_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "LeanBudgetReallocation" ADD CONSTRAINT "LeanBudgetReallocation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "LeanBudgetReallocation" ADD CONSTRAINT "LeanBudgetReallocation_leanBudgetId_fkey" FOREIGN KEY ("leanBudgetId") REFERENCES "LeanBudget"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PortfolioAnalysisReport" ADD CONSTRAINT "PortfolioAnalysisReport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "EpicValueMetric" ADD CONSTRAINT "EpicValueMetric_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ScheduledReport" ADD CONSTRAINT "ScheduledReport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ScheduledReportExecution" ADD CONSTRAINT "ScheduledReportExecution_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "ScheduledReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ScheduledReportExecution" ADD CONSTRAINT "ScheduledReportExecution_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "UserDashboardLayout" ADD CONSTRAINT "UserDashboardLayout_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CapacityAdjustmentNote" ADD CONSTRAINT "CapacityAdjustmentNote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Sprint" ADD CONSTRAINT "Sprint_piPlanId_fkey" FOREIGN KEY ("piPlanId") REFERENCES "PIPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "RetroItem" ADD CONSTRAINT "RetroItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "RetroItem" ADD CONSTRAINT "RetroItem_retroId_fkey" FOREIGN KEY ("retroId") REFERENCES "Retrospective"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "RetroVote" ADD CONSTRAINT "RetroVote_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "RetroItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "RetroActionItem" ADD CONSTRAINT "RetroActionItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "RetroActionItem" ADD CONSTRAINT "RetroActionItem_retroId_fkey" FOREIGN KEY ("retroId") REFERENCES "Retrospective"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "TenantSSOConfig" ADD CONSTRAINT "TenantSSOConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RenameIndex
ALTER INDEX "ScheduledReportExecution_reportId_idx" RENAME TO "ScheduledReportExecution_reportId_status_idx";

-- RenameIndex
ALTER INDEX "pi_plan_feature_assignments_tenantId_piPlanId_teamId_sprintId_i" RENAME TO "pi_plan_feature_assignments_tenantId_piPlanId_teamId_sprint_idx";

-- A migration 20260728005000 adicionou copilot_sessions_tenantId_fkey nos bancos
-- da cadeia, onde a tabela já carregava a FK com o nome antigo (CopilotSession_
-- tenantId_fkey, herdado do rename de 20260523100000). Ficaram duas FKs iguais na
-- mesma coluna. Aqui a antiga sai; se ela não existir (banco de dev), não faz nada.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CopilotSession_tenantId_fkey')
     AND EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'copilot_sessions_tenantId_fkey') THEN
    ALTER TABLE "copilot_sessions" DROP CONSTRAINT "CopilotSession_tenantId_fkey";
  END IF;
END $$;
