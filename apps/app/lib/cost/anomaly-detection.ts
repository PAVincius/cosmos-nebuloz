// Cost anomaly detection — median / MAD / modified z-score.
//
// This is a DIFFERENT model from the flow-anomaly pipeline
// (app/actions/flow-intelligence/anomaly-rules.ts, the Anomaly/
// AnomalyDetectionRun models). That pipeline detects flow-metric
// regressions (velocity, WIP, predictability…). This module detects cost
// spikes in BillingEntry aggregates and backs the CostAnomaly model —
// do not conflate the two.
//
// It is also distinct from the simpler variance-percentage heuristic in
// lib/cost/anomaly.ts (story-030, `latest / baseline` threshold). That
// module is unused elsewhere and left as-is; this one implements the
// median/MAD "modified z-score" method (Iglewicz & Hoaglin, 1993), which
// is robust to outliers in the historical window in a way a mean/stddev
// approach is not.

type CostAnomalySeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

// Minimum number of historical periods required before a baseline is
// trusted. Below this, we do not fabricate a baseline — detectCostAnomaly
// returns null.
export const MIN_HISTORY_POINTS = 4;

// Iglewicz & Hoaglin's recommended cutoff for the modified z-score outlier
// test. Used as the default sensitivity when no AnomalyRuleConfig override
// exists for the tenant.
export const DEFAULT_SENSITIVITY_THRESHOLD = 3.5;

// Platform bounds for the tenant-configurable sensitivity threshold.
export const SENSITIVITY_BOUNDS = { min: 2, max: 8 } as const;

export type CostAnomalyDetectionResult = {
  median: number;
  mad: number;
  actual: number;
  modifiedZScore: number;
  deltaAbs: number;
  deltaPct: number;
  severity: CostAnomalySeverity;
};

export function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 !== 0) {
    return sorted[mid] as number;
  }
  return ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

export function medianAbsoluteDeviation(
  values: number[],
  centerMedian: number
): number {
  const deviations = values.map((v) => Math.abs(v - centerMedian));
  return median(deviations);
}

// Standard modified z-score formula (Iglewicz & Hoaglin): 0.6745 is the
// constant that makes the MAD comparable to the standard deviation for a
// normal distribution.
export function modifiedZScore(
  x: number,
  centerMedian: number,
  mad: number
): number {
  if (mad === 0) {
    return 0;
  }
  return (0.6745 * (x - centerMedian)) / mad;
}

function severityFromZScore(absZ: number): CostAnomalySeverity {
  if (absZ >= 10) {
    return "CRITICAL";
  }
  if (absZ >= 7) {
    return "HIGH";
  }
  if (absZ >= 5) {
    return "MEDIUM";
  }
  return "LOW";
}

/**
 * Detects whether `current` is a cost anomaly relative to `history`.
 *
 * Returns null (never a fabricated result) when:
 * - history has fewer than MIN_HISTORY_POINTS entries, or
 * - the historical MAD is 0 (zero variance — the modified z-score formula
 *   is undefined/infinite; rather than invent an arbitrarily large score,
 *   we decline to flag an anomaly from a zero-variance baseline).
 * - the modified z-score does not breach `threshold`.
 */
export function detectCostAnomaly(params: {
  current: number;
  history: number[];
  threshold?: number;
}): CostAnomalyDetectionResult | null {
  const threshold = params.threshold ?? DEFAULT_SENSITIVITY_THRESHOLD;

  if (params.history.length < MIN_HISTORY_POINTS) {
    return null;
  }

  const baselineMedian = median(params.history);
  const baselineMAD = medianAbsoluteDeviation(params.history, baselineMedian);

  if (baselineMAD === 0) {
    return null;
  }

  const z = modifiedZScore(params.current, baselineMedian, baselineMAD);
  const absZ = Math.abs(z);

  if (absZ < threshold) {
    return null;
  }

  const deltaAbs = params.current - baselineMedian;
  const deltaPct = baselineMedian !== 0 ? (deltaAbs / baselineMedian) * 100 : 0;

  return {
    median: baselineMedian,
    mad: baselineMAD,
    actual: params.current,
    modifiedZScore: z,
    deltaAbs,
    deltaPct,
    severity: severityFromZScore(absZ),
  };
}
