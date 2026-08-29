-- Meridian V1 · Diagnose — módulo de diagnóstico de prontidão para IA.
--
-- Puramente aditiva: 16 tabelas novas, 11 enums novos e um valor novo em
-- ProductModule. Nenhum DROP, nenhum ALTER COLUMN, nenhuma coluna existente
-- tocada — nada do Cosmos, do Charter ou do Signal muda de forma.
--
-- O `ALTER TYPE "ProductModule" ADD VALUE 'MERIDIAN'` roda antes das tabelas e
-- o valor não é usado em nenhuma delas nesta mesma migration: usar um valor de
-- enum na mesma transação em que ele é adicionado é o caso que o Postgres
-- recusa.
--
-- Gerada por `prisma migrate diff` entre o schema de 4d3a42f8 e o atual.

-- CreateEnum
CREATE TYPE "MeridianAxis" AS ENUM ('DATA', 'PROCESS', 'PEOPLE', 'GOVERNANCE', 'INFRASTRUCTURE');

-- CreateEnum
CREATE TYPE "MeridianAssessmentStatus" AS ENUM ('DRAFT', 'COLLECTING', 'REVIEW', 'FINALISED');

-- CreateEnum
CREATE TYPE "MeridianRespondentStatus" AS ENUM ('INVITED', 'PENDING', 'DONE', 'OVERDUE', 'REVOKED');

-- CreateEnum
CREATE TYPE "MeridianQuestionType" AS ENUM ('LIKERT', 'YES_NO', 'SCALE');

-- CreateEnum
CREATE TYPE "MeridianScoreStatus" AS ENUM ('COMPUTED', 'CONTESTED', 'OVERRIDDEN');

-- CreateEnum
CREATE TYPE "MeridianSeverity" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "MeridianEffort" AS ENUM ('S', 'M', 'L');

-- CreateEnum
CREATE TYPE "MeridianGapState" AS ENUM ('OPEN', 'PLANNED', 'PROMOTED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "MeridianConfidence" AS ENUM ('MEASURED', 'ESTIMATED', 'DECLARED');

-- CreateEnum
CREATE TYPE "MeridianRole" AS ENUM ('CONSULTANT', 'REVIEWER', 'VIEWER');

-- CreateEnum
CREATE TYPE "MeridianPromotionTarget" AS ENUM ('COSMOS', 'CHARTER', 'SIGNAL', 'SCAFFOLD');

-- AlterEnum
ALTER TYPE "ProductModule" ADD VALUE 'MERIDIAN';

-- CreateTable
CREATE TABLE "MeridianMembership" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "MeridianRole" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "MeridianMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeridianSequence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "next" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "MeridianSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeridianTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "contestedSpread" INTEGER NOT NULL DEFAULT 25,
    "gapThreshold" INTEGER NOT NULL DEFAULT 60,
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeridianTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeridianQuestion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "axis" "MeridianAxis" NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "type" "MeridianQuestionType" NOT NULL,
    "text" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "inverted" BOOLEAN NOT NULL DEFAULT false,
    "scaleLabels" TEXT[],

    CONSTRAINT "MeridianQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeridianAssessment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "orgName" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "sizeBand" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "status" "MeridianAssessmentStatus" NOT NULL DEFAULT 'DRAFT',
    "consultantId" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadline" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "benchmarkOptIn" BOOLEAN NOT NULL DEFAULT false,
    "reassessmentOfId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeridianAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeridianRespondent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "axis" "MeridianAxis" NOT NULL,
    "status" "MeridianRespondentStatus" NOT NULL DEFAULT 'INVITED',
    "tokenHash" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "invitedAt" TIMESTAMP(3),
    "lastRemindedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeridianRespondent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeridianResponse" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "respondentId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "rawValue" INTEGER NOT NULL,
    "normalized" DECIMAL(4,3) NOT NULL,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeridianResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeridianEvidence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "responseId" TEXT,
    "storagePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "uploadedByRespondentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeridianEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeridianAxisScore" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "axis" "MeridianAxis" NOT NULL,
    "computed" INTEGER NOT NULL,
    "final" INTEGER,
    "confidence" DECIMAL(3,2) NOT NULL,
    "respondentCount" INTEGER NOT NULL,
    "spread" INTEGER NOT NULL,
    "status" "MeridianScoreStatus" NOT NULL DEFAULT 'COMPUTED',
    "note" TEXT,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeridianAxisScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeridianOverride" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "axis" "MeridianAxis" NOT NULL,
    "code" TEXT NOT NULL,
    "fromScore" INTEGER NOT NULL,
    "toScore" INTEGER NOT NULL,
    "rationale" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeridianOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeridianGap" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "axis" "MeridianAxis" NOT NULL,
    "statement" TEXT NOT NULL,
    "severity" "MeridianSeverity" NOT NULL,
    "effort" "MeridianEffort" NOT NULL,
    "costOfDelay" INTEGER NOT NULL,
    "confidence" "MeridianConfidence" NOT NULL DEFAULT 'DECLARED',
    "ownerLabel" TEXT NOT NULL,
    "state" "MeridianGapState" NOT NULL DEFAULT 'OPEN',
    "derived" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeridianGap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeridianGapDependency" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "gapId" TEXT NOT NULL,
    "dependsOnGapId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeridianGapDependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeridianPlanItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "gapId" TEXT NOT NULL,
    "quarter" INTEGER NOT NULL,
    "seq" INTEGER NOT NULL,
    "capacityNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeridianPlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeridianGapPromotion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "gapId" TEXT NOT NULL,
    "targetProduct" "MeridianPromotionTarget" NOT NULL,
    "targetEntityId" TEXT,
    "targetLabel" TEXT NOT NULL,
    "promotedById" TEXT NOT NULL,
    "promotedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "MeridianGapPromotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeridianBenchmarkCohort" (
    "id" TEXT NOT NULL,
    "cohortKey" TEXT NOT NULL,
    "n" INTEGER NOT NULL DEFAULT 0,
    "percentiles" JSONB NOT NULL,
    "recalculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeridianBenchmarkCohort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeridianBenchmarkContribution" (
    "id" TEXT NOT NULL,
    "cohortKey" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "axis" "MeridianAxis" NOT NULL,
    "score" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeridianBenchmarkContribution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MeridianMembership_tenantId_idx" ON "MeridianMembership"("tenantId");

-- CreateIndex
CREATE INDEX "MeridianMembership_userId_idx" ON "MeridianMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MeridianMembership_tenantId_userId_key" ON "MeridianMembership"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "MeridianSequence_tenantId_kind_key" ON "MeridianSequence"("tenantId", "kind");

-- CreateIndex
CREATE INDEX "MeridianTemplate_tenantId_idx" ON "MeridianTemplate"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "MeridianTemplate_tenantId_version_key" ON "MeridianTemplate"("tenantId", "version");

-- CreateIndex
CREATE INDEX "MeridianQuestion_tenantId_idx" ON "MeridianQuestion"("tenantId");

-- CreateIndex
CREATE INDEX "MeridianQuestion_templateId_axis_ordinal_idx" ON "MeridianQuestion"("templateId", "axis", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "MeridianQuestion_templateId_code_key" ON "MeridianQuestion"("templateId", "code");

-- CreateIndex
CREATE INDEX "MeridianAssessment_tenantId_idx" ON "MeridianAssessment"("tenantId");

-- CreateIndex
CREATE INDEX "MeridianAssessment_tenantId_status_idx" ON "MeridianAssessment"("tenantId", "status");

-- CreateIndex
CREATE INDEX "MeridianAssessment_templateId_idx" ON "MeridianAssessment"("templateId");

-- CreateIndex
CREATE INDEX "MeridianAssessment_reassessmentOfId_idx" ON "MeridianAssessment"("reassessmentOfId");

-- CreateIndex
CREATE UNIQUE INDEX "MeridianAssessment_tenantId_code_key" ON "MeridianAssessment"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "MeridianRespondent_tokenHash_key" ON "MeridianRespondent"("tokenHash");

-- CreateIndex
CREATE INDEX "MeridianRespondent_tenantId_idx" ON "MeridianRespondent"("tenantId");

-- CreateIndex
CREATE INDEX "MeridianRespondent_assessmentId_axis_idx" ON "MeridianRespondent"("assessmentId", "axis");

-- CreateIndex
CREATE INDEX "MeridianResponse_tenantId_idx" ON "MeridianResponse"("tenantId");

-- CreateIndex
CREATE INDEX "MeridianResponse_questionId_idx" ON "MeridianResponse"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "MeridianResponse_respondentId_questionId_key" ON "MeridianResponse"("respondentId", "questionId");

-- CreateIndex
CREATE INDEX "MeridianEvidence_tenantId_idx" ON "MeridianEvidence"("tenantId");

-- CreateIndex
CREATE INDEX "MeridianEvidence_assessmentId_idx" ON "MeridianEvidence"("assessmentId");

-- CreateIndex
CREATE INDEX "MeridianEvidence_responseId_idx" ON "MeridianEvidence"("responseId");

-- CreateIndex
CREATE INDEX "MeridianAxisScore_tenantId_idx" ON "MeridianAxisScore"("tenantId");

-- CreateIndex
CREATE INDEX "MeridianAxisScore_tenantId_status_idx" ON "MeridianAxisScore"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MeridianAxisScore_assessmentId_axis_key" ON "MeridianAxisScore"("assessmentId", "axis");

-- CreateIndex
CREATE INDEX "MeridianOverride_tenantId_idx" ON "MeridianOverride"("tenantId");

-- CreateIndex
CREATE INDEX "MeridianOverride_assessmentId_axis_createdAt_idx" ON "MeridianOverride"("assessmentId", "axis", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MeridianOverride_tenantId_code_key" ON "MeridianOverride"("tenantId", "code");

-- CreateIndex
CREATE INDEX "MeridianGap_tenantId_idx" ON "MeridianGap"("tenantId");

-- CreateIndex
CREATE INDEX "MeridianGap_tenantId_state_idx" ON "MeridianGap"("tenantId", "state");

-- CreateIndex
CREATE INDEX "MeridianGap_assessmentId_idx" ON "MeridianGap"("assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "MeridianGap_tenantId_code_key" ON "MeridianGap"("tenantId", "code");

-- CreateIndex
CREATE INDEX "MeridianGapDependency_tenantId_idx" ON "MeridianGapDependency"("tenantId");

-- CreateIndex
CREATE INDEX "MeridianGapDependency_dependsOnGapId_idx" ON "MeridianGapDependency"("dependsOnGapId");

-- CreateIndex
CREATE UNIQUE INDEX "MeridianGapDependency_gapId_dependsOnGapId_key" ON "MeridianGapDependency"("gapId", "dependsOnGapId");

-- CreateIndex
CREATE INDEX "MeridianPlanItem_tenantId_idx" ON "MeridianPlanItem"("tenantId");

-- CreateIndex
CREATE INDEX "MeridianPlanItem_assessmentId_quarter_seq_idx" ON "MeridianPlanItem"("assessmentId", "quarter", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "MeridianPlanItem_assessmentId_gapId_key" ON "MeridianPlanItem"("assessmentId", "gapId");

-- CreateIndex
CREATE INDEX "MeridianGapPromotion_tenantId_idx" ON "MeridianGapPromotion"("tenantId");

-- CreateIndex
CREATE INDEX "MeridianGapPromotion_gapId_revokedAt_idx" ON "MeridianGapPromotion"("gapId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MeridianBenchmarkCohort_cohortKey_key" ON "MeridianBenchmarkCohort"("cohortKey");

-- CreateIndex
CREATE INDEX "MeridianBenchmarkContribution_cohortKey_axis_idx" ON "MeridianBenchmarkContribution"("cohortKey", "axis");

-- CreateIndex
CREATE UNIQUE INDEX "MeridianBenchmarkContribution_assessmentId_axis_key" ON "MeridianBenchmarkContribution"("assessmentId", "axis");

-- AddForeignKey
ALTER TABLE "MeridianMembership" ADD CONSTRAINT "MeridianMembership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeridianMembership" ADD CONSTRAINT "MeridianMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeridianSequence" ADD CONSTRAINT "MeridianSequence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeridianTemplate" ADD CONSTRAINT "MeridianTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeridianQuestion" ADD CONSTRAINT "MeridianQuestion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeridianQuestion" ADD CONSTRAINT "MeridianQuestion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MeridianTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeridianAssessment" ADD CONSTRAINT "MeridianAssessment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeridianAssessment" ADD CONSTRAINT "MeridianAssessment_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MeridianTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeridianAssessment" ADD CONSTRAINT "MeridianAssessment_reassessmentOfId_fkey" FOREIGN KEY ("reassessmentOfId") REFERENCES "MeridianAssessment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeridianRespondent" ADD CONSTRAINT "MeridianRespondent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeridianRespondent" ADD CONSTRAINT "MeridianRespondent_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "MeridianAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeridianResponse" ADD CONSTRAINT "MeridianResponse_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeridianResponse" ADD CONSTRAINT "MeridianResponse_respondentId_fkey" FOREIGN KEY ("respondentId") REFERENCES "MeridianRespondent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeridianResponse" ADD CONSTRAINT "MeridianResponse_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "MeridianQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeridianEvidence" ADD CONSTRAINT "MeridianEvidence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeridianEvidence" ADD CONSTRAINT "MeridianEvidence_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "MeridianAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeridianEvidence" ADD CONSTRAINT "MeridianEvidence_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "MeridianResponse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeridianEvidence" ADD CONSTRAINT "MeridianEvidence_uploadedByRespondentId_fkey" FOREIGN KEY ("uploadedByRespondentId") REFERENCES "MeridianRespondent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeridianAxisScore" ADD CONSTRAINT "MeridianAxisScore_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeridianAxisScore" ADD CONSTRAINT "MeridianAxisScore_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "MeridianAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeridianOverride" ADD CONSTRAINT "MeridianOverride_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeridianOverride" ADD CONSTRAINT "MeridianOverride_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "MeridianAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeridianGap" ADD CONSTRAINT "MeridianGap_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeridianGap" ADD CONSTRAINT "MeridianGap_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "MeridianAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeridianGapDependency" ADD CONSTRAINT "MeridianGapDependency_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeridianGapDependency" ADD CONSTRAINT "MeridianGapDependency_gapId_fkey" FOREIGN KEY ("gapId") REFERENCES "MeridianGap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeridianGapDependency" ADD CONSTRAINT "MeridianGapDependency_dependsOnGapId_fkey" FOREIGN KEY ("dependsOnGapId") REFERENCES "MeridianGap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeridianPlanItem" ADD CONSTRAINT "MeridianPlanItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeridianPlanItem" ADD CONSTRAINT "MeridianPlanItem_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "MeridianAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeridianPlanItem" ADD CONSTRAINT "MeridianPlanItem_gapId_fkey" FOREIGN KEY ("gapId") REFERENCES "MeridianGap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeridianGapPromotion" ADD CONSTRAINT "MeridianGapPromotion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeridianGapPromotion" ADD CONSTRAINT "MeridianGapPromotion_gapId_fkey" FOREIGN KEY ("gapId") REFERENCES "MeridianGap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeridianBenchmarkContribution" ADD CONSTRAINT "MeridianBenchmarkContribution_cohortKey_fkey" FOREIGN KEY ("cohortKey") REFERENCES "MeridianBenchmarkCohort"("cohortKey") ON DELETE CASCADE ON UPDATE CASCADE;

