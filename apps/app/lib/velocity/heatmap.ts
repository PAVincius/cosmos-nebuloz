// Capacity heatmap bands + member metric anonymization — story-032 pure logic

export type HeatmapBand = "green" | "yellow" | "red";

export const HEATMAP_YELLOW_THRESHOLD = 1.0; // allocated/capacity > 100%
export const HEATMAP_RED_THRESHOLD = 1.2; // allocated/capacity > 120%

export type MemberMetrics = {
  throughput: number;
  cycleTime: number;
  defectRate: number;
  standupCadence: number;
  memberId: string;
};

export function heatmapBand(allocated: number, capacity: number): HeatmapBand {
  if (capacity <= 0) {
    return "red";
  }
  const ratio = allocated / capacity;
  if (ratio > HEATMAP_RED_THRESHOLD) {
    return "red";
  }
  if (ratio > HEATMAP_YELLOW_THRESHOLD) {
    return "yellow";
  }
  return "green";
}

export function anonymizeMetrics(
  metrics: MemberMetrics,
  role: string
): Omit<MemberMetrics, "memberId"> & { memberId: string } {
  if (role === "DEVELOPER") {
    return {
      throughput: 0,
      cycleTime: 0,
      defectRate: 0,
      standupCadence: 0,
      memberId: "anonymous",
    };
  }
  return metrics;
}
