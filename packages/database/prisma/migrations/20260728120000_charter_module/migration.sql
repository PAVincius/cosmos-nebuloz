-- CreateEnum
CREATE TYPE "CharterRole" AS ENUM ('COMPLIANCE', 'LEGAL', 'SECURITY', 'HR', 'REQUESTER', 'EXEC', 'AUDITOR');

-- CreateEnum
CREATE TYPE "CharterDataClass" AS ENUM ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "CharterExposure" AS ENUM ('INTERNAL', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "CharterCriticality" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "CharterHitl" AS ENUM ('FULL_REVIEW', 'SAMPLING', 'PASSIVE');

-- CreateEnum
CREATE TYPE "CharterUseCaseStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'REVIEW', 'APPROVED', 'RESTRICTED', 'CHANGES', 'BLOCKED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CharterSectionStatus" AS ENUM ('PUBLISHED', 'REVIEW', 'DRAFT');

-- CreateEnum
CREATE TYPE "CharterVersionStatus" AS ENUM ('PUBLISHED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "CharterVendorTier" AS ENUM ('APPROVED', 'RESTRICTED', 'REVIEW', 'BLOCKED');

-- CreateEnum
CREATE TYPE "CharterMitigationStatus" AS ENUM ('OPEN', 'PROGRESS', 'DONE');

-- CreateEnum
CREATE TYPE "CharterRiskCategory" AS ENUM ('PRIVACY', 'REGULATORY', 'SECURITY', 'BIAS', 'IP', 'OPERATIONAL', 'REPUTATIONAL');

-- CreateEnum
CREATE TYPE "CharterDecisionOutcome" AS ENUM ('APPROVED', 'RESTRICTED', 'CHANGES', 'BLOCKED');

-- CreateEnum
CREATE TYPE "CharterRecertCadence" AS ENUM ('ANNUAL', 'SEMIANNUAL');

-- CreateEnum
CREATE TYPE "CharterPosture" AS ENUM ('CONSERVATIVE', 'MODERATE', 'AGGRESSIVE');

-- CreateEnum
CREATE TYPE "CharterAckStatus" AS ENUM ('PENDING', 'ACKNOWLEDGED');

-- CreateEnum
CREATE TYPE "ProductModule" AS ENUM ('COSMOS', 'CHARTER', 'SIGNAL');

-- CreateEnum
CREATE TYPE "ModuleStatus" AS ENUM ('ACTIVE', 'TRIAL', 'SUSPENDED', 'CANCELED');

-- CreateTable
CREATE TABLE "CharterSettings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "industry" TEXT,
    "geo" TEXT,
    "posture" "CharterPosture" NOT NULL DEFAULT 'MODERATE',
    "employees" INTEGER,
    "logRetentionDays" INTEGER NOT NULL DEFAULT 365,
    "notificationTriggers" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharterSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharterMembership" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "CharterRole" NOT NULL DEFAULT 'REQUESTER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "CharterMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharterSequence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "next" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "CharterSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharterPolicy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT,
    "publishedAt" TIMESTAMP(3),
    "approverId" TEXT,
    "nextReview" TIMESTAMP(3),
    "scope" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharterPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharterPolicySection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CharterSectionStatus" NOT NULL DEFAULT 'DRAFT',
    "ownerId" TEXT,
    "body" TEXT NOT NULL,
    "generated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharterPolicySection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharterPolicyVersion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" "CharterVersionStatus" NOT NULL DEFAULT 'PUBLISHED',
    "summary" TEXT NOT NULL,
    "publishedById" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshot" JSONB NOT NULL,
    "changeCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CharterPolicyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharterVendor" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "tier" "CharterVendorTier" NOT NULL DEFAULT 'REVIEW',
    "region" TEXT,
    "dpa" BOOLEAN NOT NULL DEFAULT false,
    "retention" TEXT,
    "subprocessors" INTEGER NOT NULL DEFAULT 0,
    "renewalAt" TIMESTAMP(3),
    "score" INTEGER NOT NULL DEFAULT 50,
    "maxClass" "CharterDataClass",
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharterVendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharterClause" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "critical" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CharterClause_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharterVendorClause" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "clauseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CharterVendorClause_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharterUseCase" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "department" TEXT,
    "ownerId" TEXT,
    "ownerName" TEXT,
    "objective" TEXT NOT NULL,
    "vendorId" TEXT,
    "dataClass" "CharterDataClass" NOT NULL,
    "exposure" "CharterExposure" NOT NULL,
    "criticality" "CharterCriticality" NOT NULL,
    "status" "CharterUseCaseStatus" NOT NULL DEFAULT 'DRAFT',
    "approvalPath" TEXT,
    "slaTotal" INTEGER,
    "hitl" "CharterHitl",
    "submittedAt" TIMESTAMP(3),
    "reviewerId" TEXT,
    "launchTarget" TIMESTAMP(3),
    "riskPrivacy" INTEGER NOT NULL DEFAULT 1,
    "riskRegulatory" INTEGER NOT NULL DEFAULT 1,
    "riskSecurity" INTEGER NOT NULL DEFAULT 1,
    "riskBias" INTEGER NOT NULL DEFAULT 1,
    "riskIp" INTEGER NOT NULL DEFAULT 1,
    "riskOperational" INTEGER NOT NULL DEFAULT 1,
    "riskReputational" INTEGER NOT NULL DEFAULT 1,
    "restrictions" TEXT[],
    "blockReason" TEXT,
    "changeRequest" TEXT,
    "vendorIneligible" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharterUseCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharterDecision" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "useCaseId" TEXT NOT NULL,
    "outcome" "CharterDecisionOutcome" NOT NULL,
    "rationale" TEXT NOT NULL,
    "conditions" TEXT[],
    "deciderId" TEXT,
    "deciderRole" "CharterRole" NOT NULL,
    "previousStatus" "CharterUseCaseStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CharterDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharterMitigation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "useCaseId" TEXT NOT NULL,
    "category" "CharterRiskCategory" NOT NULL,
    "action" TEXT NOT NULL,
    "ownerId" TEXT,
    "ownerName" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" "CharterMitigationStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharterMitigation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharterTrack" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "modules" INTEGER NOT NULL DEFAULT 1,
    "minutes" INTEGER NOT NULL DEFAULT 15,
    "recert" "CharterRecertCadence" NOT NULL DEFAULT 'ANNUAL',
    "policyId" TEXT,
    "policyVersionId" TEXT,
    "needsReassignment" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharterTrack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharterAcknowledgment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "userId" TEXT,
    "personName" TEXT NOT NULL,
    "department" TEXT,
    "status" "CharterAckStatus" NOT NULL DEFAULT 'PENDING',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "policyVersionId" TEXT,

    CONSTRAINT "CharterAcknowledgment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantModule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "module" "ProductModule" NOT NULL,
    "status" "ModuleStatus" NOT NULL DEFAULT 'ACTIVE',
    "contractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "seats" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "TenantModule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CharterSettings_tenantId_key" ON "CharterSettings"("tenantId");

-- CreateIndex
CREATE INDEX "CharterMembership_tenantId_idx" ON "CharterMembership"("tenantId");

-- CreateIndex
CREATE INDEX "CharterMembership_userId_idx" ON "CharterMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CharterMembership_tenantId_userId_key" ON "CharterMembership"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "CharterSequence_tenantId_kind_key" ON "CharterSequence"("tenantId", "kind");

-- CreateIndex
CREATE INDEX "CharterPolicy_tenantId_idx" ON "CharterPolicy"("tenantId");

-- CreateIndex
CREATE INDEX "CharterPolicySection_tenantId_idx" ON "CharterPolicySection"("tenantId");

-- CreateIndex
CREATE INDEX "CharterPolicySection_policyId_status_idx" ON "CharterPolicySection"("policyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CharterPolicySection_policyId_ordinal_key" ON "CharterPolicySection"("policyId", "ordinal");

-- CreateIndex
CREATE INDEX "CharterPolicyVersion_tenantId_idx" ON "CharterPolicyVersion"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "CharterPolicyVersion_policyId_version_key" ON "CharterPolicyVersion"("policyId", "version");

-- CreateIndex
CREATE INDEX "CharterVendor_tenantId_idx" ON "CharterVendor"("tenantId");

-- CreateIndex
CREATE INDEX "CharterVendor_tenantId_tier_idx" ON "CharterVendor"("tenantId", "tier");

-- CreateIndex
CREATE UNIQUE INDEX "CharterVendor_tenantId_code_key" ON "CharterVendor"("tenantId", "code");

-- CreateIndex
CREATE INDEX "CharterClause_tenantId_idx" ON "CharterClause"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "CharterClause_tenantId_code_key" ON "CharterClause"("tenantId", "code");

-- CreateIndex
CREATE INDEX "CharterVendorClause_tenantId_idx" ON "CharterVendorClause"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "CharterVendorClause_vendorId_clauseId_key" ON "CharterVendorClause"("vendorId", "clauseId");

-- CreateIndex
CREATE INDEX "CharterUseCase_tenantId_idx" ON "CharterUseCase"("tenantId");

-- CreateIndex
CREATE INDEX "CharterUseCase_tenantId_status_idx" ON "CharterUseCase"("tenantId", "status");

-- CreateIndex
CREATE INDEX "CharterUseCase_tenantId_dataClass_idx" ON "CharterUseCase"("tenantId", "dataClass");

-- CreateIndex
CREATE INDEX "CharterUseCase_vendorId_idx" ON "CharterUseCase"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "CharterUseCase_tenantId_code_key" ON "CharterUseCase"("tenantId", "code");

-- CreateIndex
CREATE INDEX "CharterDecision_tenantId_idx" ON "CharterDecision"("tenantId");

-- CreateIndex
CREATE INDEX "CharterDecision_useCaseId_idx" ON "CharterDecision"("useCaseId");

-- CreateIndex
CREATE INDEX "CharterMitigation_tenantId_idx" ON "CharterMitigation"("tenantId");

-- CreateIndex
CREATE INDEX "CharterMitigation_useCaseId_idx" ON "CharterMitigation"("useCaseId");

-- CreateIndex
CREATE INDEX "CharterMitigation_tenantId_status_idx" ON "CharterMitigation"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CharterMitigation_tenantId_code_key" ON "CharterMitigation"("tenantId", "code");

-- CreateIndex
CREATE INDEX "CharterTrack_tenantId_idx" ON "CharterTrack"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "CharterTrack_tenantId_code_key" ON "CharterTrack"("tenantId", "code");

-- CreateIndex
CREATE INDEX "CharterAcknowledgment_tenantId_idx" ON "CharterAcknowledgment"("tenantId");

-- CreateIndex
CREATE INDEX "CharterAcknowledgment_trackId_status_idx" ON "CharterAcknowledgment"("trackId", "status");

-- CreateIndex
CREATE INDEX "TenantModule_tenantId_idx" ON "TenantModule"("tenantId");

-- CreateIndex
CREATE INDEX "TenantModule_tenantId_status_idx" ON "TenantModule"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TenantModule_tenantId_module_key" ON "TenantModule"("tenantId", "module");

-- AddForeignKey
ALTER TABLE "CharterSettings" ADD CONSTRAINT "CharterSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharterMembership" ADD CONSTRAINT "CharterMembership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharterMembership" ADD CONSTRAINT "CharterMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharterSequence" ADD CONSTRAINT "CharterSequence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharterPolicy" ADD CONSTRAINT "CharterPolicy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharterPolicySection" ADD CONSTRAINT "CharterPolicySection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharterPolicySection" ADD CONSTRAINT "CharterPolicySection_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "CharterPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharterPolicyVersion" ADD CONSTRAINT "CharterPolicyVersion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharterPolicyVersion" ADD CONSTRAINT "CharterPolicyVersion_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "CharterPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharterVendor" ADD CONSTRAINT "CharterVendor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharterClause" ADD CONSTRAINT "CharterClause_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharterVendorClause" ADD CONSTRAINT "CharterVendorClause_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharterVendorClause" ADD CONSTRAINT "CharterVendorClause_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "CharterVendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharterVendorClause" ADD CONSTRAINT "CharterVendorClause_clauseId_fkey" FOREIGN KEY ("clauseId") REFERENCES "CharterClause"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharterUseCase" ADD CONSTRAINT "CharterUseCase_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharterUseCase" ADD CONSTRAINT "CharterUseCase_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "CharterVendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharterDecision" ADD CONSTRAINT "CharterDecision_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharterDecision" ADD CONSTRAINT "CharterDecision_useCaseId_fkey" FOREIGN KEY ("useCaseId") REFERENCES "CharterUseCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharterMitigation" ADD CONSTRAINT "CharterMitigation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharterMitigation" ADD CONSTRAINT "CharterMitigation_useCaseId_fkey" FOREIGN KEY ("useCaseId") REFERENCES "CharterUseCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharterTrack" ADD CONSTRAINT "CharterTrack_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharterTrack" ADD CONSTRAINT "CharterTrack_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "CharterPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharterTrack" ADD CONSTRAINT "CharterTrack_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "CharterPolicyVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharterAcknowledgment" ADD CONSTRAINT "CharterAcknowledgment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharterAcknowledgment" ADD CONSTRAINT "CharterAcknowledgment_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "CharterTrack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharterAcknowledgment" ADD CONSTRAINT "CharterAcknowledgment_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "CharterPolicyVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantModule" ADD CONSTRAINT "TenantModule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ─────────────────────────────────────────────────────────────────────────────
-- RLS (NFR-1.1): toda tabela nova é tenant-scoped por policy, não só por
-- `where tenantId`. Mesmo padrão de 20260728010000_rls_remaining_tenant_tables:
-- current_tenant_id() lê app.tenant_id, setado por withTenantDb().
-- Todas as 15 tabelas têm coluna tenantId direta.
-- Idempotente: DROP POLICY IF EXISTS antes de CREATE, ENABLE/FORCE repetíveis.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'TenantModule',
    'CharterSettings',
    'CharterMembership',
    'CharterSequence',
    'CharterPolicy',
    'CharterPolicySection',
    'CharterPolicyVersion',
    'CharterVendor',
    'CharterClause',
    'CharterVendorClause',
    'CharterUseCase',
    'CharterDecision',
    'CharterMitigation',
    'CharterTrack',
    'CharterAcknowledgment'
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
-- Backfill de contratação: default deny significa que um tenant sem linha em
-- TenantModule não tem módulo nenhum. Preservar o comportamento atual exige
-- semear COSMOS para todos os tenants existentes — inclusive o tenant "system",
-- que não é cliente mas cujas rotas internas ainda passam pelo guard.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO "TenantModule" ("id", "tenantId", "module", "status", "contractedAt", "createdAt", "updatedAt")
SELECT
  'tm_cosmos_' || t."id",
  t."id",
  'COSMOS'::"ProductModule",
  'ACTIVE'::"ModuleStatus",
  t."createdAt",
  NOW(),
  NOW()
FROM "Tenant" t
ON CONFLICT ("tenantId", "module") DO NOTHING;
