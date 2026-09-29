-- Reverte 20260929000300_scaffold_deliverable_v1.
DROP TRIGGER scaffold_deliverable_event_immutable ON "ScaffoldDeliverableEvent";
DROP FUNCTION prevent_scaffold_deliverable_event_mutation();
ALTER TABLE "ScaffoldDeliverableTemplate" DROP CONSTRAINT "ScaffoldDeliverableTemplate_versionId_fkey";
DROP TABLE "ScaffoldDeliverableTemplate";
DROP INDEX "ScaffoldStepTemplate_versionId_code_key";
ALTER TABLE "ScaffoldStepTemplate" DROP COLUMN "code";
DROP INDEX "ScaffoldDeliverableInstance_trackId_stepCode_idx";
ALTER TABLE "ScaffoldDeliverableInstance" DROP COLUMN "dispensedReason", DROP COLUMN "kind", DROP COLUMN "producer", DROP COLUMN "stepCode";
DROP TYPE "ScaffoldDeliverableProducer";
DROP TYPE "ScaffoldDeliverableKind";
