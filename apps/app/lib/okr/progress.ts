// OKR progress calculation — story-027 pure logic

export const MAX_KEY_RESULTS_PER_OKR = 5;
export const MAX_OKRS_PER_QUARTER = 10;
export const AT_RISK_THRESHOLD = 0.85;
export const THRESHOLD_MILESTONES = [25, 50, 75, 100] as const;

export type KrInput = {
  current: number;
  target: number;
};

export function calcKrProgress(current: number, target: number): number {
  if (target <= 0) {
    return 0;
  }
  return Math.min(100, Math.round((current / target) * 100));
}

export function calcProgress(keyResults: KrInput[]): number {
  if (keyResults.length === 0) {
    return 0;
  }
  const avg =
    keyResults.reduce(
      (sum, kr) => sum + Math.min(kr.current / (kr.target || 1), 1),
      0
    ) / keyResults.length;
  return Math.round(avg * 100);
}

export function isAtRisk(projectedPct: number, targetPct: number): boolean {
  return projectedPct < targetPct * AT_RISK_THRESHOLD;
}

export function detectThresholdCrossings(
  previousPct: number,
  currentPct: number
): number[] {
  return THRESHOLD_MILESTONES.filter((t) => previousPct < t && currentPct >= t);
}

export function exceedsKrLimit(count: number): boolean {
  return count > MAX_KEY_RESULTS_PER_OKR;
}

export function exceedsOkrLimit(count: number): boolean {
  return count > MAX_OKRS_PER_QUARTER;
}
