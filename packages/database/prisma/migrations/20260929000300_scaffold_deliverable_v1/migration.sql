-- Entregável do Scaffold, versão fechada conforme as decisões do Norte de
-- 29/09 (seções b, c.0, d). Segue 20260929000200_scaffold_deliverable_draft.
--
-- ADD COLUMN NOT NULL sem default em ScaffoldDeliverableInstance: seguro porque
-- nenhum código escreve nessa tabela ainda (o rascunho nunca teve consumidor).
-- Se houver linha, a migration falha em vez de inventar tipo e responsável.

-- CreateEnum
CREATE TYPE "ScaffoldDeliverableKind" AS ENUM ('DOCUMENT', 'SPREADSHEET', 'DATASET', 'CONFIGURATION', 'SIGNATURE', 'TRAINING', 'REPORT', 'PACKAGE');

-- CreateEnum
CREATE TYPE "ScaffoldDeliverableProducer" AS ENUM ('OWNER', 'CONSULTANT', 'TECHNICAL', 'LEGAL');

-- AlterTable
ALTER TABLE "ScaffoldDeliverableInstance" ADD COLUMN     "dispensedReason" TEXT,
ADD COLUMN     "kind" "ScaffoldDeliverableKind" NOT NULL,
ADD COLUMN     "producer" "ScaffoldDeliverableProducer" NOT NULL,
ADD COLUMN     "stepCode" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ScaffoldStepTemplate" ADD COLUMN     "code" TEXT;

-- CreateTable
CREATE TABLE "ScaffoldDeliverableTemplate" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "phase" "ScaffoldPhase" NOT NULL,
    "stepCode" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "kind" "ScaffoldDeliverableKind" NOT NULL,
    "producer" "ScaffoldDeliverableProducer" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "requiresModule" "ProductModule",

    CONSTRAINT "ScaffoldDeliverableTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScaffoldDeliverableTemplate_versionId_phase_idx" ON "ScaffoldDeliverableTemplate"("versionId", "phase");

-- CreateIndex
CREATE UNIQUE INDEX "ScaffoldDeliverableTemplate_versionId_code_key" ON "ScaffoldDeliverableTemplate"("versionId", "code");

-- CreateIndex
CREATE INDEX "ScaffoldDeliverableInstance_trackId_stepCode_idx" ON "ScaffoldDeliverableInstance"("trackId", "stepCode");

-- CreateIndex
CREATE UNIQUE INDEX "ScaffoldStepTemplate_versionId_code_key" ON "ScaffoldStepTemplate"("versionId", "code");

-- AddForeignKey
ALTER TABLE "ScaffoldDeliverableTemplate" ADD CONSTRAINT "ScaffoldDeliverableTemplate_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ScaffoldTemplateVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Histórico append-only garantido no banco, como o AuditLog. UPDATE é sempre
-- recusado; DELETE direto também. DELETE em cascata do pai (entregável, trilha,
-- tenant) passa: dentro do trigger de integridade referencial
-- pg_trigger_depth() é > 1, e recusar aí travaria a remoção de tenant.
CREATE OR REPLACE FUNCTION prevent_scaffold_deliverable_event_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'ScaffoldDeliverableEvent is append-only. Operation: %, Entry ID: %', TG_OP, OLD.id;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER scaffold_deliverable_event_immutable
  BEFORE UPDATE OR DELETE ON "ScaffoldDeliverableEvent"
  FOR EACH ROW EXECUTE FUNCTION prevent_scaffold_deliverable_event_mutation();
