-- Signal — medição de adoção e valor de iniciativas de IA.
--
-- 18 tabelas, 13 enums. Mapeamento de `specs/003-signal-measure/data-model.md`.
--
-- O DDL abaixo foi gerado por `prisma migrate diff` e recortado para conter
-- SOMENTE objetos `Signal*`. O diff bruto trazia junto drift pré-existente da
-- base local — as quatro tabelas do catálogo comercial (`PlanoComercial`,
-- `PrecoDeModulo`, `TermoDeContrato`, `AddOnComercial`, que estão no schema mas
-- não têm migration própria) e alterações em `MeetingParticipant`, `Proposal` e
-- `Service`, incluindo dois `DROP CONSTRAINT`. Nada disso pertence a esta
-- feature e arrastar junto seria mudar o banco de outra pessoa às escondidas.
--
-- RLS no fim do arquivo: as 18 tabelas têm `tenantId` direto e entram no mesmo
-- padrão do Charter (ENABLE + FORCE + policy com WITH CHECK). Sem `FORCE`, o
-- dono da tabela ignora a política — e o papel da aplicação costuma ser o dono.
-- Sem `WITH CHECK`, a política filtra leitura mas deixa gravar linha de outro
-- tenant.

-- CreateEnum
CREATE TYPE "SignalInitiativeStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SignalCategory" AS ENUM ('PRODUCTIVITY', 'QUALITY', 'RISK', 'REVENUE');

-- CreateEnum
CREATE TYPE "SignalConnHealth" AS ENUM ('HEALTHY', 'STALE', 'DOWN');

-- CreateEnum
CREATE TYPE "SignalMappingState" AS ENUM ('ACTIVE', 'REVIEW', 'BROKEN', 'STALE');

-- CreateEnum
CREATE TYPE "SignalAlertKind" AS ENUM ('LOW', 'WEAK', 'STALE');

-- CreateEnum
CREATE TYPE "SignalAlertState" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "SignalReportState" AS ENUM ('DRAFT', 'FINAL');

-- CreateEnum
CREATE TYPE "SignalReportKind" AS ENUM ('EXECUTIVE', 'PORTFOLIO');

-- CreateEnum
CREATE TYPE "SignalObservationSource" AS ENUM ('SYNC', 'MANUAL', 'IMPORT');

-- CreateEnum
CREATE TYPE "SignalRoiEntryKind" AS ENUM ('RETURN', 'COST');

-- CreateEnum
CREATE TYPE "SignalOutcomeDirection" AS ENUM ('LOWER_IS_BETTER', 'HIGHER_IS_BETTER');

-- CreateEnum
CREATE TYPE "SignalRoiFormulaState" AS ENUM ('ACTIVE', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "SignalRole" AS ENUM ('VIEWER', 'OWNER', 'ANALYST', 'ADMIN');

-- CreateTable
CREATE TABLE "SignalInitiative" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "businessUnit" TEXT NOT NULL,
    "category" "SignalCategory" NOT NULL,
    "status" "SignalInitiativeStatus" NOT NULL DEFAULT 'DRAFT',
    "ownerId" TEXT NOT NULL,
    "hypothesis" TEXT NOT NULL,
    "expectedValue" DECIMAL(14,2),
    "startedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "closureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "SignalInitiative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignalBaseline" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "windowLabel" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "signedById" TEXT,
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignalBaseline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignalBaselineDimension" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "baselineId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "numericValue" DECIMAL(18,4),
    "unit" TEXT,
    "sourceLabel" TEXT NOT NULL,
    "connectionId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SignalBaselineDimension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignalConnection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "icon" TEXT,
    "config" JSONB,
    "health" "SignalConnHealth" NOT NULL DEFAULT 'HEALTHY',
    "lastSyncAt" TIMESTAMP(3),
    "expectedFreqMinutes" INTEGER,
    "rowsLabel" TEXT,
    "ownerId" TEXT,
    "errorMessage" TEXT,
    "impactNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "SignalConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignalMetricMapping" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "initiativeId" TEXT,
    "eventKey" TEXT NOT NULL,
    "metricLabel" TEXT NOT NULL,
    "transform" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "state" "SignalMappingState" NOT NULL DEFAULT 'ACTIVE',
    "changedById" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignalMetricMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignalMetricObservation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "mappingId" TEXT,
    "connectionLabel" TEXT,
    "metricLabel" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "numericValue" DECIMAL(18,4),
    "unit" TEXT,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "rowCount" INTEGER,
    "transform" TEXT NOT NULL,
    "source" "SignalObservationSource" NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "recordedById" TEXT,
    "flag" TEXT,
    "frozenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignalMetricObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignalRoiFormula" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "horizonMonths" INTEGER NOT NULL DEFAULT 12,
    "state" "SignalRoiFormulaState" NOT NULL DEFAULT 'ACTIVE',
    "changedById" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "SignalRoiFormula_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignalRoiEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "formulaId" TEXT NOT NULL,
    "kind" "SignalRoiEntryKind" NOT NULL,
    "label" TEXT NOT NULL,
    "quantityLabel" TEXT,
    "unitLabel" TEXT,
    "total" DECIMAL(14,2) NOT NULL,
    "sourceLabel" TEXT NOT NULL,
    "connectionId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SignalRoiEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignalRoiAssumption" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "formulaId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SignalRoiAssumption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignalAdoptionSnapshot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "activeUsers" INTEGER NOT NULL,
    "licensedUsers" INTEGER NOT NULL,
    "frequencyLabel" TEXT,
    "depthNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignalAdoptionSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignalOutcomeSnapshot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "metricLabel" TEXT NOT NULL,
    "baselineValue" TEXT NOT NULL,
    "currentValue" TEXT NOT NULL,
    "numericBaseline" DECIMAL(18,4),
    "numericCurrent" DECIMAL(18,4),
    "isSecondary" BOOLEAN NOT NULL DEFAULT false,
    "direction" "SignalOutcomeDirection" NOT NULL DEFAULT 'LOWER_IS_BETTER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignalOutcomeSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignalConfidenceRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignalConfidenceRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignalConfidenceScore" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "got" INTEGER NOT NULL,
    "note" TEXT,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignalConfidenceScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignalAlert" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "SignalAlertKind" NOT NULL,
    "state" "SignalAlertState" NOT NULL DEFAULT 'OPEN',
    "initiativeId" TEXT NOT NULL,
    "what" TEXT NOT NULL,
    "nextStep" TEXT NOT NULL,
    "ownerId" TEXT,
    "raisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "note" TEXT,

    CONSTRAINT "SignalAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignalReportSnapshot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "SignalReportKind" NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "state" "SignalReportState" NOT NULL DEFAULT 'DRAFT',
    "payload" JSONB,
    "pageCount" INTEGER,
    "note" TEXT,
    "blockedReason" TEXT,
    "generatedById" TEXT,
    "generatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignalReportSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignalMember" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "SignalRole" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "SignalMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignalSettings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "adoptionBar" INTEGER NOT NULL DEFAULT 60,
    "valueBar" DECIMAL(6,2) NOT NULL DEFAULT 1.5,
    "lowAdoptionPct" INTEGER NOT NULL DEFAULT 40,
    "lowAdoptionWeeks" INTEGER NOT NULL DEFAULT 8,
    "weakRoi" DECIMAL(6,2) NOT NULL DEFAULT 1.0,
    "staleHours" INTEGER NOT NULL DEFAULT 48,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "fiscalYearLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "SignalSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignalSequence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "next" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "SignalSequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SignalInitiative_tenantId_idx" ON "SignalInitiative"("tenantId");

-- CreateIndex
CREATE INDEX "SignalInitiative_tenantId_status_idx" ON "SignalInitiative"("tenantId", "status");

-- CreateIndex
CREATE INDEX "SignalInitiative_tenantId_category_idx" ON "SignalInitiative"("tenantId", "category");

-- CreateIndex
CREATE INDEX "SignalInitiative_tenantId_ownerId_idx" ON "SignalInitiative"("tenantId", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "SignalInitiative_tenantId_code_key" ON "SignalInitiative"("tenantId", "code");

-- CreateIndex
CREATE INDEX "SignalBaseline_tenantId_idx" ON "SignalBaseline"("tenantId");

-- CreateIndex
CREATE INDEX "SignalBaseline_initiativeId_idx" ON "SignalBaseline"("initiativeId");

-- CreateIndex
CREATE UNIQUE INDEX "SignalBaseline_tenantId_initiativeId_version_key" ON "SignalBaseline"("tenantId", "initiativeId", "version");

-- CreateIndex
CREATE INDEX "SignalBaselineDimension_tenantId_idx" ON "SignalBaselineDimension"("tenantId");

-- CreateIndex
CREATE INDEX "SignalBaselineDimension_baselineId_idx" ON "SignalBaselineDimension"("baselineId");

-- CreateIndex
CREATE INDEX "SignalConnection_tenantId_idx" ON "SignalConnection"("tenantId");

-- CreateIndex
CREATE INDEX "SignalConnection_tenantId_health_idx" ON "SignalConnection"("tenantId", "health");

-- CreateIndex
CREATE UNIQUE INDEX "SignalConnection_tenantId_code_key" ON "SignalConnection"("tenantId", "code");

-- CreateIndex
CREATE INDEX "SignalMetricMapping_tenantId_idx" ON "SignalMetricMapping"("tenantId");

-- CreateIndex
CREATE INDEX "SignalMetricMapping_tenantId_connectionId_idx" ON "SignalMetricMapping"("tenantId", "connectionId");

-- CreateIndex
CREATE INDEX "SignalMetricMapping_tenantId_initiativeId_idx" ON "SignalMetricMapping"("tenantId", "initiativeId");

-- CreateIndex
CREATE INDEX "SignalMetricMapping_tenantId_state_idx" ON "SignalMetricMapping"("tenantId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "SignalMetricMapping_tenantId_code_version_key" ON "SignalMetricMapping"("tenantId", "code", "version");

-- CreateIndex
CREATE INDEX "SignalMetricObservation_tenantId_idx" ON "SignalMetricObservation"("tenantId");

-- CreateIndex
CREATE INDEX "SignalMetricObservation_tenantId_initiativeId_idx" ON "SignalMetricObservation"("tenantId", "initiativeId");

-- CreateIndex
CREATE INDEX "SignalMetricObservation_tenantId_mappingId_idx" ON "SignalMetricObservation"("tenantId", "mappingId");

-- CreateIndex
CREATE INDEX "SignalMetricObservation_tenantId_frozenAt_idx" ON "SignalMetricObservation"("tenantId", "frozenAt");

-- CreateIndex
CREATE UNIQUE INDEX "SignalMetricObservation_tenantId_code_key" ON "SignalMetricObservation"("tenantId", "code");

-- CreateIndex
CREATE INDEX "SignalRoiFormula_tenantId_idx" ON "SignalRoiFormula"("tenantId");

-- CreateIndex
CREATE INDEX "SignalRoiFormula_tenantId_initiativeId_state_idx" ON "SignalRoiFormula"("tenantId", "initiativeId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "SignalRoiFormula_tenantId_initiativeId_version_key" ON "SignalRoiFormula"("tenantId", "initiativeId", "version");

-- CreateIndex
CREATE INDEX "SignalRoiEntry_tenantId_idx" ON "SignalRoiEntry"("tenantId");

-- CreateIndex
CREATE INDEX "SignalRoiEntry_formulaId_idx" ON "SignalRoiEntry"("formulaId");

-- CreateIndex
CREATE INDEX "SignalRoiAssumption_tenantId_idx" ON "SignalRoiAssumption"("tenantId");

-- CreateIndex
CREATE INDEX "SignalRoiAssumption_formulaId_idx" ON "SignalRoiAssumption"("formulaId");

-- CreateIndex
CREATE INDEX "SignalAdoptionSnapshot_tenantId_idx" ON "SignalAdoptionSnapshot"("tenantId");

-- CreateIndex
CREATE INDEX "SignalAdoptionSnapshot_initiativeId_idx" ON "SignalAdoptionSnapshot"("initiativeId");

-- CreateIndex
CREATE UNIQUE INDEX "SignalAdoptionSnapshot_tenantId_initiativeId_periodStart_key" ON "SignalAdoptionSnapshot"("tenantId", "initiativeId", "periodStart");

-- CreateIndex
CREATE INDEX "SignalOutcomeSnapshot_tenantId_idx" ON "SignalOutcomeSnapshot"("tenantId");

-- CreateIndex
CREATE INDEX "SignalOutcomeSnapshot_initiativeId_idx" ON "SignalOutcomeSnapshot"("initiativeId");

-- CreateIndex
CREATE UNIQUE INDEX "SignalOutcomeSnapshot_tenantId_initiativeId_periodStart_met_key" ON "SignalOutcomeSnapshot"("tenantId", "initiativeId", "periodStart", "metricLabel");

-- CreateIndex
CREATE INDEX "SignalConfidenceRule_tenantId_idx" ON "SignalConfidenceRule"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "SignalConfidenceRule_tenantId_key_key" ON "SignalConfidenceRule"("tenantId", "key");

-- CreateIndex
CREATE INDEX "SignalConfidenceScore_tenantId_idx" ON "SignalConfidenceScore"("tenantId");

-- CreateIndex
CREATE INDEX "SignalConfidenceScore_initiativeId_idx" ON "SignalConfidenceScore"("initiativeId");

-- CreateIndex
CREATE UNIQUE INDEX "SignalConfidenceScore_tenantId_initiativeId_ruleId_key" ON "SignalConfidenceScore"("tenantId", "initiativeId", "ruleId");

-- CreateIndex
CREATE INDEX "SignalAlert_tenantId_idx" ON "SignalAlert"("tenantId");

-- CreateIndex
CREATE INDEX "SignalAlert_tenantId_state_idx" ON "SignalAlert"("tenantId", "state");

-- CreateIndex
CREATE INDEX "SignalAlert_tenantId_initiativeId_idx" ON "SignalAlert"("tenantId", "initiativeId");

-- CreateIndex
CREATE UNIQUE INDEX "SignalAlert_tenantId_code_key" ON "SignalAlert"("tenantId", "code");

-- CreateIndex
CREATE INDEX "SignalReportSnapshot_tenantId_idx" ON "SignalReportSnapshot"("tenantId");

-- CreateIndex
CREATE INDEX "SignalReportSnapshot_tenantId_state_idx" ON "SignalReportSnapshot"("tenantId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "SignalReportSnapshot_tenantId_code_key" ON "SignalReportSnapshot"("tenantId", "code");

-- CreateIndex
CREATE INDEX "SignalMember_tenantId_idx" ON "SignalMember"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "SignalMember_tenantId_userId_key" ON "SignalMember"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "SignalSettings_tenantId_key" ON "SignalSettings"("tenantId");

-- CreateIndex
CREATE INDEX "SignalSequence_tenantId_idx" ON "SignalSequence"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "SignalSequence_tenantId_kind_key" ON "SignalSequence"("tenantId", "kind");

-- AddForeignKey
ALTER TABLE "SignalInitiative" ADD CONSTRAINT "SignalInitiative_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalInitiative" ADD CONSTRAINT "SignalInitiative_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalInitiative" ADD CONSTRAINT "SignalInitiative_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalBaseline" ADD CONSTRAINT "SignalBaseline_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalBaseline" ADD CONSTRAINT "SignalBaseline_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "SignalInitiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalBaseline" ADD CONSTRAINT "SignalBaseline_signedById_fkey" FOREIGN KEY ("signedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalBaselineDimension" ADD CONSTRAINT "SignalBaselineDimension_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalBaselineDimension" ADD CONSTRAINT "SignalBaselineDimension_baselineId_fkey" FOREIGN KEY ("baselineId") REFERENCES "SignalBaseline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalBaselineDimension" ADD CONSTRAINT "SignalBaselineDimension_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "SignalConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalConnection" ADD CONSTRAINT "SignalConnection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalConnection" ADD CONSTRAINT "SignalConnection_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalMetricMapping" ADD CONSTRAINT "SignalMetricMapping_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalMetricMapping" ADD CONSTRAINT "SignalMetricMapping_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "SignalConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalMetricMapping" ADD CONSTRAINT "SignalMetricMapping_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "SignalInitiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalMetricMapping" ADD CONSTRAINT "SignalMetricMapping_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalMetricObservation" ADD CONSTRAINT "SignalMetricObservation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalMetricObservation" ADD CONSTRAINT "SignalMetricObservation_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "SignalInitiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalMetricObservation" ADD CONSTRAINT "SignalMetricObservation_mappingId_fkey" FOREIGN KEY ("mappingId") REFERENCES "SignalMetricMapping"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalMetricObservation" ADD CONSTRAINT "SignalMetricObservation_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalRoiFormula" ADD CONSTRAINT "SignalRoiFormula_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalRoiFormula" ADD CONSTRAINT "SignalRoiFormula_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "SignalInitiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalRoiFormula" ADD CONSTRAINT "SignalRoiFormula_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalRoiEntry" ADD CONSTRAINT "SignalRoiEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalRoiEntry" ADD CONSTRAINT "SignalRoiEntry_formulaId_fkey" FOREIGN KEY ("formulaId") REFERENCES "SignalRoiFormula"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalRoiEntry" ADD CONSTRAINT "SignalRoiEntry_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "SignalConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalRoiAssumption" ADD CONSTRAINT "SignalRoiAssumption_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalRoiAssumption" ADD CONSTRAINT "SignalRoiAssumption_formulaId_fkey" FOREIGN KEY ("formulaId") REFERENCES "SignalRoiFormula"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalAdoptionSnapshot" ADD CONSTRAINT "SignalAdoptionSnapshot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalAdoptionSnapshot" ADD CONSTRAINT "SignalAdoptionSnapshot_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "SignalInitiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalOutcomeSnapshot" ADD CONSTRAINT "SignalOutcomeSnapshot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalOutcomeSnapshot" ADD CONSTRAINT "SignalOutcomeSnapshot_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "SignalInitiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalConfidenceRule" ADD CONSTRAINT "SignalConfidenceRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalConfidenceScore" ADD CONSTRAINT "SignalConfidenceScore_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalConfidenceScore" ADD CONSTRAINT "SignalConfidenceScore_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "SignalInitiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalConfidenceScore" ADD CONSTRAINT "SignalConfidenceScore_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "SignalConfidenceRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalAlert" ADD CONSTRAINT "SignalAlert_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalAlert" ADD CONSTRAINT "SignalAlert_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "SignalInitiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalAlert" ADD CONSTRAINT "SignalAlert_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalAlert" ADD CONSTRAINT "SignalAlert_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalReportSnapshot" ADD CONSTRAINT "SignalReportSnapshot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalReportSnapshot" ADD CONSTRAINT "SignalReportSnapshot_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalMember" ADD CONSTRAINT "SignalMember_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalMember" ADD CONSTRAINT "SignalMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalSettings" ADD CONSTRAINT "SignalSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalSequence" ADD CONSTRAINT "SignalSequence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — isolamento multi-tenant no banco (Constituição, Princípio I).
--
-- As 18 tabelas têm coluna `tenantId` direta. Mesmo padrão do
-- 20260728120000_charter_module. Idempotente: DROP POLICY IF EXISTS antes de
-- CREATE, ENABLE/FORCE repetíveis.
--
-- `current_tenant_id()` vem do 20260603000001_rls_tenant_isolation e lê
-- `app.tenant_id`, que `withTenantDb()` seta com SET LOCAL dentro da transação.
-- Sessão sem esse valor não enxerga linha nenhuma — default deny.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'SignalInitiative',
    'SignalBaseline',
    'SignalBaselineDimension',
    'SignalConnection',
    'SignalMetricMapping',
    'SignalMetricObservation',
    'SignalRoiFormula',
    'SignalRoiEntry',
    'SignalRoiAssumption',
    'SignalAdoptionSnapshot',
    'SignalOutcomeSnapshot',
    'SignalConfidenceRule',
    'SignalConfidenceScore',
    'SignalAlert',
    'SignalReportSnapshot',
    'SignalMember',
    'SignalSettings',
    'SignalSequence'
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

-- ─────────────────────────────────────────────────────────────────────────────
-- Catálogo padrão de fatores de confiança, por tenant que já tem SIGNAL.
--
-- Os pesos (30/25/20/25) vêm do handoff e somam 100 — invariante que
-- `computeConfidence` valida na leitura. Sem catálogo semeado, o primeiro
-- cálculo de confiança de um tenant devolveria 0 com faixa "Sem dado", que é
-- verdade mas parece defeito.
--
-- Só para quem contratou: default deny vale aqui também, e semear catálogo em
-- tenant sem o módulo criaria linha órfã.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO "SignalConfidenceRule" ("id", "tenantId", "key", "label", "weight", "order", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::TEXT,
  tm."tenantId",
  r.key,
  r.label,
  r.weight,
  r."order",
  NOW(),
  NOW()
FROM "TenantModule" tm
CROSS JOIN (VALUES
  ('baseline.signed',  'Baseline assinado pelo dono do processo', 30, 0),
  ('sources.fresh',    'Fontes sincronizando (≤ 24 h)',           25, 1),
  ('formula.reviewed', 'Fórmula versionada e revisada',           20, 2),
  ('sample.size',      'Amostra ≥ 4 semanas pós-adoção',          25, 3)
) AS r(key, label, weight, "order")
WHERE tm."module" = 'SIGNAL'
ON CONFLICT ("tenantId", "key") DO NOTHING;
