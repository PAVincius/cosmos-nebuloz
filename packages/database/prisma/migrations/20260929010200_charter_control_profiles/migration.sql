-- Charter: perfis de controle por forma de trabalho (CH-DEV-01), versionados e
-- imutáveis após publicar, com cadência própria, e forma/perfil pinado no caso
-- de uso (CH-DEV-02). Aditivo. Conteúdo dos perfis é rascunho até a assinatura de
-- Jurídico/DPO e Segurança (CH-PO-01).

-- CreateEnum
CREATE TYPE "CharterControlCadence" AS ENUM ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL', 'PER_CYCLE');

-- AlterTable
ALTER TABLE "CharterUseCase" ADD COLUMN     "controlProfileVersionId" TEXT,
ADD COLUMN     "workForm" "WorkForm";

-- CreateTable
CREATE TABLE "CharterControlProfile" (
    "id" TEXT NOT NULL,
    "workForm" "WorkForm" NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharterControlProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharterControlProfileVersion" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "dominantRisks" "CharterRiskCategory"[],
    "decisionRole" "CharterRole" NOT NULL,
    "note" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedBy" TEXT,
    "legalSignedBy" TEXT,
    "legalSignedAt" TIMESTAMP(3),
    "securitySignedBy" TEXT,
    "securitySignedAt" TIMESTAMP(3),

    CONSTRAINT "CharterControlProfileVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharterControlProfileControl" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "CharterRiskCategory" NOT NULL,
    "evidence" TEXT NOT NULL,
    "acceptanceCriteria" TEXT NOT NULL,
    "role" "CharterRole" NOT NULL,
    "cadence" "CharterControlCadence" NOT NULL,
    "minClass" "CharterDataClass" NOT NULL,
    "dispensable" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CharterControlProfileControl_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CharterControlProfile_workForm_key" ON "CharterControlProfile"("workForm");

-- CreateIndex
CREATE INDEX "CharterControlProfileVersion_profileId_idx" ON "CharterControlProfileVersion"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "CharterControlProfileVersion_profileId_label_key" ON "CharterControlProfileVersion"("profileId", "label");

-- CreateIndex
CREATE INDEX "CharterControlProfileControl_versionId_idx" ON "CharterControlProfileControl"("versionId");

-- CreateIndex
CREATE UNIQUE INDEX "CharterControlProfileControl_versionId_code_key" ON "CharterControlProfileControl"("versionId", "code");

-- CreateIndex
CREATE INDEX "CharterUseCase_controlProfileVersionId_idx" ON "CharterUseCase"("controlProfileVersionId");

-- AddForeignKey
ALTER TABLE "CharterControlProfileVersion" ADD CONSTRAINT "CharterControlProfileVersion_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CharterControlProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharterControlProfileControl" ADD CONSTRAINT "CharterControlProfileControl_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "CharterControlProfileVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharterUseCase" ADD CONSTRAINT "CharterUseCase_controlProfileVersionId_fkey" FOREIGN KEY ("controlProfileVersionId") REFERENCES "CharterControlProfileVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Tabelas GLOBAIS (método da Nebuloz, sem tenantId): RLS ligada e forçada, SEM
-- policy, como o catálogo do Scaffold (20260929000700). Pela Data API ninguém lê
-- nem escreve; o app conecta como postgres (BYPASSRLS, ADR-0012) e segue igual.
ALTER TABLE "CharterControlProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CharterControlProfile" FORCE ROW LEVEL SECURITY;
ALTER TABLE "CharterControlProfileVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CharterControlProfileVersion" FORCE ROW LEVEL SECURITY;
ALTER TABLE "CharterControlProfileControl" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CharterControlProfileControl" FORCE ROW LEVEL SECURITY;
