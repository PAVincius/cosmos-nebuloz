export type CapacityResult = {
  status: "OK" | "WARNING" | "OVER";
  utilization: number;
  assignedPoints: number;
  totalCapacity: number;
};

export function computeCapacityStatus(
  assignedPoints: number,
  totalCapacity: number
): CapacityResult {
  const utilization = totalCapacity > 0 ? assignedPoints / totalCapacity : 0;
  const status: "OK" | "WARNING" | "OVER" =
    utilization > 1.0 ? "OVER" : utilization > 0.8 ? "WARNING" : "OK";
  return { status, utilization, assignedPoints, totalCapacity };
}
