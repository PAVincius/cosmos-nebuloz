// Epic ROI hypothesis + cost trend — story-032 pure logic

export const COST_INCREASE_THRESHOLD_PCT = 0.1; // 10% per PI

export function calcConfidenceScore(
  confirmed: number,
  total: number
): number | null {
  if (total <= 0) {
    return null;
  }
  return confirmed / total;
}

export function isCostIncreasing(costPerPoints: number[]): boolean {
  if (costPerPoints.length < 2) {
    return false;
  }
  for (let i = 1; i < costPerPoints.length; i += 1) {
    const prev = costPerPoints[i - 1] ?? 0;
    const curr = costPerPoints[i] ?? 0;
    if (prev <= 0) {
      continue;
    }
    const growthRate = (curr - prev) / prev;
    if (growthRate > COST_INCREASE_THRESHOLD_PCT) {
      return true;
    }
  }
  return false;
}

export function calcCostPerPoint(
  totalSpend: number,
  acceptedPoints: number
): number | null {
  if (acceptedPoints <= 0) {
    return null;
  }
  return totalSpend / acceptedPoints;
}
