// Platform health metric aggregation (story-044 AC-003, AC-008)

export type HealthStatus = "healthy" | "degraded" | "unavailable";

export type MetricResult<T> = {
  status: HealthStatus;
  value?: T;
  error?: string;
};

export function aggregateSettled<T>(
  result: PromiseSettledResult<T>
): MetricResult<T> {
  if (result.status === "fulfilled") {
    return { status: "healthy", value: result.value };
  }
  const reason = result.reason;
  const msg = reason instanceof Error ? reason.message : String(reason);
  return { status: "unavailable", error: msg };
}

export function aggregateAll<T>(
  results: PromiseSettledResult<T>[]
): MetricResult<T>[] {
  return results.map(aggregateSettled);
}

export function overallStatus(results: MetricResult<unknown>[]): HealthStatus {
  if (results.every((r) => r.status === "healthy")) {
    return "healthy";
  }
  if (results.some((r) => r.status === "unavailable")) {
    return "unavailable";
  }
  return "degraded";
}
