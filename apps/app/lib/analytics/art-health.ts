// ART health scoring — story-029 pure logic

export type HealthState = "CRITICAL" | "WARNING" | "HEALTHY";

export type AnomalyInput = {
  severity: string;
};

export type ArtMetrics = {
  anomalies: AnomalyInput[];
  piPPM: number | null;
};

export const PPM_CRITICAL_THRESHOLD = 0.65;
export const PPM_WARNING_THRESHOLD = 0.8;
export const CRITICAL_ANOMALY_COUNT_CRITICAL = 2;
export const CRITICAL_ANOMALY_COUNT_WARNING = 1;

export function computeArtHealth(art: ArtMetrics): HealthState {
  const criticalAnomalies = art.anomalies.filter(
    (a) => a.severity === "CRITICAL"
  ).length;
  const predictability = art.piPPM ?? 0;

  if (
    criticalAnomalies >= CRITICAL_ANOMALY_COUNT_CRITICAL ||
    predictability < PPM_CRITICAL_THRESHOLD
  ) {
    return "CRITICAL";
  }
  if (
    criticalAnomalies >= CRITICAL_ANOMALY_COUNT_WARNING ||
    predictability < PPM_WARNING_THRESHOLD
  ) {
    return "WARNING";
  }
  return "HEALTHY";
}

export function aggregateOrgHealth(artHealths: HealthState[]): HealthState {
  if (artHealths.some((h) => h === "CRITICAL")) {
    return "CRITICAL";
  }
  if (artHealths.some((h) => h === "WARNING")) {
    return "WARNING";
  }
  return "HEALTHY";
}
