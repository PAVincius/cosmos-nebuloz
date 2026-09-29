-- Signal: modelos de medição por forma de trabalho (SG-DEV-01), versionados e
-- imutáveis após publicar, e as colunas de forma/modelo/trilha/gap na iniciativa
-- (SG-DEV-02). Aditivo.

-- CreateEnum
CREATE TYPE "SignalMetricRole" AS ENUM ('PRIMARY', 'GUARD', 'ADOPTION', 'VALUE');

-- CreateEnum
CREATE TYPE "SignalMetricDirection" AS ENUM ('UP', 'DOWN');

-- AlterTable
ALTER TABLE "SignalInitiative" ADD COLUMN     "measureModelVersionId" TEXT,
ADD COLUMN     "meridianGapId" TEXT,
ADD COLUMN     "scaffoldTrackId" TEXT,
ADD COLUMN     "workForm" "WorkForm";

-- CreateTable
CREATE TABLE "SignalMeasureModel" (
    "id" TEXT NOT NULL,
    "workForm" "WorkForm" NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignalMeasureModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignalMeasureModelVersion" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "counterfactual" TEXT NOT NULL,
    "sampleWindowWeeks" INTEGER NOT NULL DEFAULT 4,
    "sources" TEXT[],
    "traps" TEXT[],
    "note" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedBy" TEXT,

    CONSTRAINT "SignalMeasureModelVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignalMeasureModelMetric" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "role" "SignalMetricRole" NOT NULL,
    "name" TEXT NOT NULL,
    "formula" TEXT NOT NULL,
    "direction" "SignalMetricDirection" NOT NULL,

    CONSTRAINT "SignalMeasureModelMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SignalMeasureModel_workForm_key" ON "SignalMeasureModel"("workForm");

-- CreateIndex
CREATE INDEX "SignalMeasureModelVersion_modelId_idx" ON "SignalMeasureModelVersion"("modelId");

-- CreateIndex
CREATE UNIQUE INDEX "SignalMeasureModelVersion_modelId_label_key" ON "SignalMeasureModelVersion"("modelId", "label");

-- CreateIndex
CREATE INDEX "SignalMeasureModelMetric_versionId_idx" ON "SignalMeasureModelMetric"("versionId");

-- CreateIndex
CREATE INDEX "SignalInitiative_measureModelVersionId_idx" ON "SignalInitiative"("measureModelVersionId");

-- AddForeignKey
ALTER TABLE "SignalMeasureModelVersion" ADD CONSTRAINT "SignalMeasureModelVersion_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "SignalMeasureModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalMeasureModelMetric" ADD CONSTRAINT "SignalMeasureModelMetric_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "SignalMeasureModelVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalInitiative" ADD CONSTRAINT "SignalInitiative_measureModelVersionId_fkey" FOREIGN KEY ("measureModelVersionId") REFERENCES "SignalMeasureModelVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Tabelas GLOBAIS (método da Nebuloz, sem tenantId): RLS ligada e forçada, SEM
-- policy, como o catálogo do Scaffold (20260929000700). Pela Data API ninguém lê
-- nem escreve; o app conecta como postgres (BYPASSRLS, ADR-0012) e segue igual.
ALTER TABLE "SignalMeasureModel" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SignalMeasureModel" FORCE ROW LEVEL SECURITY;
ALTER TABLE "SignalMeasureModelVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SignalMeasureModelVersion" FORCE ROW LEVEL SECURITY;
ALTER TABLE "SignalMeasureModelMetric" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SignalMeasureModelMetric" FORCE ROW LEVEL SECURITY;
