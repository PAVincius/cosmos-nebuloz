-- Reverte 20260929010000_signal_measure_models. Reverta 20260929010100_signal_plan_metric antes.
ALTER TABLE "SignalInitiative" DROP CONSTRAINT "SignalInitiative_measureModelVersionId_fkey";
DROP INDEX "SignalInitiative_measureModelVersionId_idx";
ALTER TABLE "SignalInitiative" DROP COLUMN "measureModelVersionId", DROP COLUMN "workForm", DROP COLUMN "scaffoldTrackId", DROP COLUMN "meridianGapId";
DROP TABLE "SignalMeasureModelMetric";
DROP TABLE "SignalMeasureModelVersion";
DROP TABLE "SignalMeasureModel";
DROP TYPE "SignalMetricDirection";
DROP TYPE "SignalMetricRole";
