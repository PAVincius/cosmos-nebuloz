-- Reverte 20260929010400_signal_plan_metric_baseline_key.
ALTER TABLE "SignalPlanMetric" DROP COLUMN "baselineDimensionKey";
