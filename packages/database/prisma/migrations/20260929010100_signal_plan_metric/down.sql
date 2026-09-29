-- Reverte 20260929010100_signal_plan_metric.
DROP TABLE "SignalPlanMetricEvent";
DROP TABLE "SignalPlanMetric";
DROP FUNCTION prevent_signal_frozen_target_change();
DROP FUNCTION prevent_append_only_mutation();
DROP TYPE "SignalPlanMetricAction";
DROP TYPE "SignalPlanMetricState";
