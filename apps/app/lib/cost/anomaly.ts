// Cost anomaly detection — story-030 pure logic

export const ANOMALY_VARIANCE_THRESHOLD = 100; // > 100% variance = anomaly
export const HIGH_SEVERITY_THRESHOLD = 200; // > 200% = HIGH

export type AnomalySeverity = "HIGH" | "MEDIUM";

export function calcVariancePct(latest: number, baseline: number): number {
  if (baseline <= 0) {
    return 0;
  }
  return ((latest - baseline) / baseline) * 100;
}

export function isAnomaly(variancePct: number): boolean {
  return variancePct > ANOMALY_VARIANCE_THRESHOLD;
}

export function anomalySeverity(variancePct: number): AnomalySeverity | null {
  if (variancePct > HIGH_SEVERITY_THRESHOLD) {
    return "HIGH";
  }
  if (variancePct > ANOMALY_VARIANCE_THRESHOLD) {
    return "MEDIUM";
  }
  return null;
}

export function calcDailyBaseline(
  totalSpend: number,
  dayCount: number
): number {
  if (dayCount <= 0) {
    return 0;
  }
  return totalSpend / dayCount;
}
