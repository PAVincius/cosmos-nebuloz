-- Scaffold — adoção assistida. 19 modelos, 12 enums, mais `SCAFFOLD` no
-- `ProductModule`.

-- CreateEnum
CREATE TYPE "ScaffoldPhase" AS ENUM ('ASSESS', 'PILOT', 'SCALE', 'EMBED');

-- CreateEnum
CREATE TYPE "ScaffoldPhaseState" AS ENUM ('IDLE', 'OPEN', 'GATE_READY', 'BLOCKED', 'CLOSED', 'OBSERVING', 'REOPENED');

-- CreateEnum
CREATE TYPE "ScaffoldStepState" AS ENUM ('TODO', 'ACTIVE', 'DONE');

-- CreateEnum
CREATE TYPE "ScaffoldGateOutcome" AS ENUM ('PENDING', 'PASSED', 'OVERRIDDEN');

-- CreateEnum
CREATE TYPE "ScaffoldTrackStatus" AS ENUM ('ACTIVE', 'STALLED', 'EMBEDDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ScaffoldRole" AS ENUM ('TEAM_MEMBER', 'PROCESS_OWNER', 'TRANSFORMATION_LEAD', 'CONSULTANT', 'ADMIN');

-- CreateEnum
CREATE TYPE "ScaffoldArchetype" AS ENUM ('TRIAGE', 'DOC_REVIEW', 'REPORTING');

-- CreateEnum
CREATE TYPE "ScaffoldCriterionEvaluation" AS ENUM ('MANUAL', 'DERIVED');

-- CreateEnum
CREATE TYPE "ScaffoldBusinessCaseState" AS ENUM ('DRAFT', 'AWAITING', 'CONTESTED', 'SIGNED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "ScaffoldMetricDirection" AS ENUM ('DOWN', 'UP');

-- CreateEnum
CREATE TYPE "ScaffoldMetricConfidence" AS ENUM ('MEASURED', 'ESTIMATED', 'DECLARED');

-- CreateEnum
CREATE TYPE "ScaffoldBenefitKind" AS ENUM ('COST_AVOIDED', 'REVENUE_PROTECTED', 'REVENUE_NEW');

-- AlterEnum
ALTER TYPE "ProductModule" ADD VALUE 'SCAFFOLD';

-- CreateTable
CREATE TABLE "ScaffoldMembership" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ScaffoldRole" NOT NULL DEFAULT 'TEAM_MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "ScaffoldMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScaffoldSequence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "next" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ScaffoldSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScaffoldSettings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "stallThresholdDays" INTEGER NOT NULL DEFAULT 14,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScaffoldSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScaffoldTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "archetype" "ScaffoldArchetype" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScaffoldTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScaffoldTemplateVersion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "authorLabel" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedBy" TEXT,

    CONSTRAINT "ScaffoldTemplateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScaffoldStepTemplate" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "phase" "ScaffoldPhase" NOT NULL,
    "seq" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "expectedArtefact" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "estimateMinutes" INTEGER,

    CONSTRAINT "ScaffoldStepTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScaffoldTemplateOverlay" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "baseVersionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ops" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScaffoldTemplateOverlay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScaffoldOverlayConflict" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "overlayId" TEXT NOT NULL,
    "againstVersionId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetKey" TEXT NOT NULL,
    "field" TEXT,
    "reason" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolution" TEXT,

    CONSTRAINT "ScaffoldOverlayConflict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScaffoldGateCriterion" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "phase" "ScaffoldPhase" NOT NULL,
    "seq" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "evaluationType" "ScaffoldCriterionEvaluation" NOT NULL DEFAULT 'MANUAL',

    CONSTRAINT "ScaffoldGateCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScaffoldTrack" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "processName" TEXT NOT NULL,
    "archetype" "ScaffoldArchetype",
    "ownerId" TEXT NOT NULL,
    "consultantId" TEXT,
    "templateVersionId" TEXT NOT NULL,
    "overlayId" TEXT,
    "sourceGapId" TEXT,
    "sourcePromotionId" TEXT,
    "status" "ScaffoldTrackStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentPhase" "ScaffoldPhase" NOT NULL DEFAULT 'ASSESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastGateAt" TIMESTAMP(3),
    "embeddedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScaffoldTrack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScaffoldPhaseInstance" (
    "id" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "phase" "ScaffoldPhase" NOT NULL,
    "state" "ScaffoldPhaseState" NOT NULL DEFAULT 'IDLE',
    "openedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "observationEndsAt" TIMESTAMP(3),
    "charterPolicyId" TEXT,
    "charterPolicyAckAt" TIMESTAMP(3),
    "reopenedAt" TIMESTAMP(3),
    "reopenCount" INTEGER NOT NULL DEFAULT 0,
    "reopenCountAtClose" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScaffoldPhaseInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScaffoldStepInstance" (
    "id" TEXT NOT NULL,
    "phaseInstanceId" TEXT NOT NULL,
    "stepTemplateKey" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "statement" TEXT NOT NULL,
    "expectedArtefact" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "state" "ScaffoldStepState" NOT NULL DEFAULT 'TODO',
    "completedById" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScaffoldStepInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScaffoldArtefact" (
    "id" TEXT NOT NULL,
    "stepInstanceId" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScaffoldArtefact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScaffoldGateResult" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "phaseInstanceId" TEXT NOT NULL,
    "cycle" INTEGER NOT NULL DEFAULT 0,
    "outcome" "ScaffoldGateOutcome" NOT NULL,
    "approverId" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criteriaSnapshot" JSONB NOT NULL,

    CONSTRAINT "ScaffoldGateResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScaffoldBusinessCase" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "state" "ScaffoldBusinessCaseState" NOT NULL DEFAULT 'DRAFT',
    "currentVersionId" TEXT,
    "signedVersionId" TEXT,
    "sponsorId" TEXT NOT NULL,
    "sponsorRoleLabel" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "signalInitiativeRef" TEXT,
    "windowStart" TIMESTAMP(3),
    "windowMonths" INTEGER,
    "cadence" TEXT,
    "firstReadAt" TIMESTAMP(3),
    "benefitKind" "ScaffoldBenefitKind" NOT NULL DEFAULT 'COST_AVOIDED',
    "benefitHard" BOOLEAN NOT NULL DEFAULT false,
    "benefitAnnualCents" BIGINT,
    "benefitBasis" TEXT NOT NULL,
    "financeReviewedAt" TIMESTAMP(3),
    "financeReviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScaffoldBusinessCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScaffoldBusinessCaseVersion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "businessCaseId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "state" "ScaffoldBusinessCaseState" NOT NULL DEFAULT 'DRAFT',
    "note" TEXT NOT NULL,
    "authoredById" TEXT NOT NULL,
    "authoredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signedById" TEXT,
    "signedAt" TIMESTAMP(3),
    "signedByLabel" TEXT,
    "contentHash" TEXT,

    CONSTRAINT "ScaffoldBusinessCaseVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScaffoldBusinessCaseMetric" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "baseValue" DECIMAL(18,4) NOT NULL,
    "targetValue" DECIMAL(18,4) NOT NULL,
    "direction" "ScaffoldMetricDirection" NOT NULL,
    "confidence" "ScaffoldMetricConfidence" NOT NULL DEFAULT 'DECLARED',
    "sourceLabel" TEXT NOT NULL,
    "sampleLabel" TEXT NOT NULL,

    CONSTRAINT "ScaffoldBusinessCaseMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScaffoldBusinessCaseContest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "businessCaseId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "byId" TEXT,
    "byLabel" TEXT NOT NULL,
    "roleLabel" TEXT NOT NULL,
    "objection" TEXT NOT NULL,
    "asks" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ScaffoldBusinessCaseContest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScaffoldGateOverride" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "gateResultId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "unmetCriteria" TEXT[],
    "rationale" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScaffoldGateOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScaffoldMembership_tenantId_idx" ON "ScaffoldMembership"("tenantId");

-- CreateIndex
CREATE INDEX "ScaffoldMembership_userId_idx" ON "ScaffoldMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ScaffoldMembership_tenantId_userId_key" ON "ScaffoldMembership"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ScaffoldSequence_tenantId_kind_key" ON "ScaffoldSequence"("tenantId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "ScaffoldSettings_tenantId_key" ON "ScaffoldSettings"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ScaffoldTemplate_key_key" ON "ScaffoldTemplate"("key");

-- CreateIndex
CREATE INDEX "ScaffoldTemplateVersion_templateId_idx" ON "ScaffoldTemplateVersion"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "ScaffoldTemplateVersion_templateId_label_key" ON "ScaffoldTemplateVersion"("templateId", "label");

-- CreateIndex
CREATE INDEX "ScaffoldStepTemplate_versionId_phase_idx" ON "ScaffoldStepTemplate"("versionId", "phase");

-- CreateIndex
CREATE UNIQUE INDEX "ScaffoldStepTemplate_versionId_key_key" ON "ScaffoldStepTemplate"("versionId", "key");

-- CreateIndex
CREATE INDEX "ScaffoldTemplateOverlay_tenantId_idx" ON "ScaffoldTemplateOverlay"("tenantId");

-- CreateIndex
CREATE INDEX "ScaffoldTemplateOverlay_templateId_idx" ON "ScaffoldTemplateOverlay"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "ScaffoldTemplateOverlay_tenantId_templateId_name_key" ON "ScaffoldTemplateOverlay"("tenantId", "templateId", "name");

-- CreateIndex
CREATE INDEX "ScaffoldOverlayConflict_tenantId_idx" ON "ScaffoldOverlayConflict"("tenantId");

-- CreateIndex
CREATE INDEX "ScaffoldOverlayConflict_overlayId_resolvedAt_idx" ON "ScaffoldOverlayConflict"("overlayId", "resolvedAt");

-- CreateIndex
CREATE INDEX "ScaffoldGateCriterion_versionId_phase_idx" ON "ScaffoldGateCriterion"("versionId", "phase");

-- CreateIndex
CREATE UNIQUE INDEX "ScaffoldGateCriterion_versionId_key_key" ON "ScaffoldGateCriterion"("versionId", "key");

-- CreateIndex
CREATE INDEX "ScaffoldTrack_tenantId_idx" ON "ScaffoldTrack"("tenantId");

-- CreateIndex
CREATE INDEX "ScaffoldTrack_tenantId_status_idx" ON "ScaffoldTrack"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ScaffoldTrack_tenantId_lastGateAt_idx" ON "ScaffoldTrack"("tenantId", "lastGateAt");

-- CreateIndex
CREATE INDEX "ScaffoldTrack_sourceGapId_idx" ON "ScaffoldTrack"("sourceGapId");

-- CreateIndex
CREATE UNIQUE INDEX "ScaffoldTrack_tenantId_code_key" ON "ScaffoldTrack"("tenantId", "code");

-- CreateIndex
CREATE INDEX "ScaffoldPhaseInstance_trackId_idx" ON "ScaffoldPhaseInstance"("trackId");

-- CreateIndex
CREATE INDEX "ScaffoldPhaseInstance_state_idx" ON "ScaffoldPhaseInstance"("state");

-- CreateIndex
CREATE UNIQUE INDEX "ScaffoldPhaseInstance_trackId_phase_key" ON "ScaffoldPhaseInstance"("trackId", "phase");

-- CreateIndex
CREATE INDEX "ScaffoldStepInstance_phaseInstanceId_idx" ON "ScaffoldStepInstance"("phaseInstanceId");

-- CreateIndex
CREATE UNIQUE INDEX "ScaffoldStepInstance_phaseInstanceId_stepTemplateKey_key" ON "ScaffoldStepInstance"("phaseInstanceId", "stepTemplateKey");

-- CreateIndex
CREATE UNIQUE INDEX "ScaffoldArtefact_objectKey_key" ON "ScaffoldArtefact"("objectKey");

-- CreateIndex
CREATE INDEX "ScaffoldArtefact_stepInstanceId_idx" ON "ScaffoldArtefact"("stepInstanceId");

-- CreateIndex
CREATE INDEX "ScaffoldGateResult_tenantId_idx" ON "ScaffoldGateResult"("tenantId");

-- CreateIndex
CREATE INDEX "ScaffoldGateResult_phaseInstanceId_idx" ON "ScaffoldGateResult"("phaseInstanceId");

-- CreateIndex
CREATE UNIQUE INDEX "ScaffoldGateResult_tenantId_phaseInstanceId_cycle_key" ON "ScaffoldGateResult"("tenantId", "phaseInstanceId", "cycle");

-- CreateIndex
CREATE UNIQUE INDEX "ScaffoldBusinessCase_trackId_key" ON "ScaffoldBusinessCase"("trackId");

-- CreateIndex
CREATE UNIQUE INDEX "ScaffoldBusinessCase_currentVersionId_key" ON "ScaffoldBusinessCase"("currentVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "ScaffoldBusinessCase_signedVersionId_key" ON "ScaffoldBusinessCase"("signedVersionId");

-- CreateIndex
CREATE INDEX "ScaffoldBusinessCase_tenantId_idx" ON "ScaffoldBusinessCase"("tenantId");

-- CreateIndex
CREATE INDEX "ScaffoldBusinessCase_tenantId_state_idx" ON "ScaffoldBusinessCase"("tenantId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "ScaffoldBusinessCase_tenantId_code_key" ON "ScaffoldBusinessCase"("tenantId", "code");

-- CreateIndex
CREATE INDEX "ScaffoldBusinessCaseVersion_tenantId_idx" ON "ScaffoldBusinessCaseVersion"("tenantId");

-- CreateIndex
CREATE INDEX "ScaffoldBusinessCaseVersion_businessCaseId_idx" ON "ScaffoldBusinessCaseVersion"("businessCaseId");

-- CreateIndex
CREATE UNIQUE INDEX "ScaffoldBusinessCaseVersion_tenantId_businessCaseId_label_key" ON "ScaffoldBusinessCaseVersion"("tenantId", "businessCaseId", "label");

-- CreateIndex
CREATE INDEX "ScaffoldBusinessCaseMetric_tenantId_idx" ON "ScaffoldBusinessCaseMetric"("tenantId");

-- CreateIndex
CREATE INDEX "ScaffoldBusinessCaseMetric_versionId_idx" ON "ScaffoldBusinessCaseMetric"("versionId");

-- CreateIndex
CREATE UNIQUE INDEX "ScaffoldBusinessCaseMetric_tenantId_versionId_key_key" ON "ScaffoldBusinessCaseMetric"("tenantId", "versionId", "key");

-- CreateIndex
CREATE INDEX "ScaffoldBusinessCaseContest_tenantId_idx" ON "ScaffoldBusinessCaseContest"("tenantId");

-- CreateIndex
CREATE INDEX "ScaffoldBusinessCaseContest_businessCaseId_idx" ON "ScaffoldBusinessCaseContest"("businessCaseId");

-- CreateIndex
CREATE UNIQUE INDEX "ScaffoldGateOverride_gateResultId_key" ON "ScaffoldGateOverride"("gateResultId");

-- CreateIndex
CREATE INDEX "ScaffoldGateOverride_tenantId_idx" ON "ScaffoldGateOverride"("tenantId");

-- AddForeignKey
ALTER TABLE "ScaffoldMembership" ADD CONSTRAINT "ScaffoldMembership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaffoldMembership" ADD CONSTRAINT "ScaffoldMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaffoldSequence" ADD CONSTRAINT "ScaffoldSequence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaffoldSettings" ADD CONSTRAINT "ScaffoldSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaffoldTemplateVersion" ADD CONSTRAINT "ScaffoldTemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ScaffoldTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaffoldStepTemplate" ADD CONSTRAINT "ScaffoldStepTemplate_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ScaffoldTemplateVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaffoldTemplateOverlay" ADD CONSTRAINT "ScaffoldTemplateOverlay_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaffoldTemplateOverlay" ADD CONSTRAINT "ScaffoldTemplateOverlay_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ScaffoldTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaffoldTemplateOverlay" ADD CONSTRAINT "ScaffoldTemplateOverlay_baseVersionId_fkey" FOREIGN KEY ("baseVersionId") REFERENCES "ScaffoldTemplateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaffoldOverlayConflict" ADD CONSTRAINT "ScaffoldOverlayConflict_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaffoldOverlayConflict" ADD CONSTRAINT "ScaffoldOverlayConflict_overlayId_fkey" FOREIGN KEY ("overlayId") REFERENCES "ScaffoldTemplateOverlay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaffoldOverlayConflict" ADD CONSTRAINT "ScaffoldOverlayConflict_againstVersionId_fkey" FOREIGN KEY ("againstVersionId") REFERENCES "ScaffoldTemplateVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaffoldGateCriterion" ADD CONSTRAINT "ScaffoldGateCriterion_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ScaffoldTemplateVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaffoldTrack" ADD CONSTRAINT "ScaffoldTrack_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaffoldTrack" ADD CONSTRAINT "ScaffoldTrack_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "ScaffoldTemplateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaffoldTrack" ADD CONSTRAINT "ScaffoldTrack_overlayId_fkey" FOREIGN KEY ("overlayId") REFERENCES "ScaffoldTemplateOverlay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaffoldPhaseInstance" ADD CONSTRAINT "ScaffoldPhaseInstance_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "ScaffoldTrack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaffoldStepInstance" ADD CONSTRAINT "ScaffoldStepInstance_phaseInstanceId_fkey" FOREIGN KEY ("phaseInstanceId") REFERENCES "ScaffoldPhaseInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaffoldArtefact" ADD CONSTRAINT "ScaffoldArtefact_stepInstanceId_fkey" FOREIGN KEY ("stepInstanceId") REFERENCES "ScaffoldStepInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaffoldGateResult" ADD CONSTRAINT "ScaffoldGateResult_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaffoldGateResult" ADD CONSTRAINT "ScaffoldGateResult_phaseInstanceId_fkey" FOREIGN KEY ("phaseInstanceId") REFERENCES "ScaffoldPhaseInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaffoldBusinessCase" ADD CONSTRAINT "ScaffoldBusinessCase_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaffoldBusinessCase" ADD CONSTRAINT "ScaffoldBusinessCase_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "ScaffoldTrack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaffoldBusinessCaseVersion" ADD CONSTRAINT "ScaffoldBusinessCaseVersion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaffoldBusinessCaseVersion" ADD CONSTRAINT "ScaffoldBusinessCaseVersion_businessCaseId_fkey" FOREIGN KEY ("businessCaseId") REFERENCES "ScaffoldBusinessCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaffoldBusinessCaseMetric" ADD CONSTRAINT "ScaffoldBusinessCaseMetric_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaffoldBusinessCaseMetric" ADD CONSTRAINT "ScaffoldBusinessCaseMetric_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ScaffoldBusinessCaseVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaffoldBusinessCaseContest" ADD CONSTRAINT "ScaffoldBusinessCaseContest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaffoldBusinessCaseContest" ADD CONSTRAINT "ScaffoldBusinessCaseContest_businessCaseId_fkey" FOREIGN KEY ("businessCaseId") REFERENCES "ScaffoldBusinessCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaffoldBusinessCaseContest" ADD CONSTRAINT "ScaffoldBusinessCaseContest_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ScaffoldBusinessCaseVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaffoldGateOverride" ADD CONSTRAINT "ScaffoldGateOverride_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaffoldGateOverride" ADD CONSTRAINT "ScaffoldGateOverride_gateResultId_fkey" FOREIGN KEY ("gateResultId") REFERENCES "ScaffoldGateResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- RLS nas tabelas de tenant do Scaffold.
--
-- Mesmo padrão de `20260902130000_meridian_rls`, que fechou o bloco do
-- Meridian dias atrás. Nascer sem policy reabriria o buraco que aquela
-- migration acabou de tapar — 19 tabelas novas contra as 36 que ainda faltavam.
--
-- Só as 12 que têm `tenantId`. As outras 7 ficam de fora por dois motivos
-- distintos, e nenhum é esquecimento:
--   • A biblioteca de método (`ScaffoldTemplate`, `ScaffoldTemplateVersion`,
--     `ScaffoldStepTemplate`, `ScaffoldGateCriterion`) é compartilhada por
--     desenho — é o método da Nebuloz, não dado de cliente.
--   • A cadeia de instância (`ScaffoldPhaseInstance`, `ScaffoldStepInstance`,
--     `ScaffoldArtefact`) é escopada por `ScaffoldTrack` e não tem coluna para
--     comparar. Vale registrar que `ScaffoldArtefact` é a mais sensível das
--     três: policy nela dependeria de subconsulta pela trilha, e o isolamento
--     dela hoje vem do `where` da action, não do banco.
--
-- O que isto muda em runtime hoje: nada, e ADR-0012 explica por quê — a
-- conexão é `postgres`, que tem `rolbypassrls`. A policy passa a existir para
-- o dia em que a role do app deixar de ser superuser.
--
-- Idempotente: DROP POLICY IF EXISTS antes de CREATE, ENABLE/FORCE repetíveis.

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ScaffoldMembership',
    'ScaffoldSequence',
    'ScaffoldSettings',
    'ScaffoldTemplateOverlay',
    'ScaffoldOverlayConflict',
    'ScaffoldTrack',
    'ScaffoldGateResult',
    'ScaffoldGateOverride',
    'ScaffoldBusinessCase',
    'ScaffoldBusinessCaseVersion',
    'ScaffoldBusinessCaseMetric',
    'ScaffoldBusinessCaseContest'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_isolation" ON %I', t);
    EXECUTE format(
      'CREATE POLICY "tenant_isolation" ON %I USING ("tenantId" = current_tenant_id()) WITH CHECK ("tenantId" = current_tenant_id())',
      t
    );
  END LOOP;
END $$;
