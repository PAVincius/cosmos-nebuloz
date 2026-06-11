const KR_THRESHOLDS = [25, 50, 75, 100] as const;

/** Returns threshold percentages crossed when value moves from prevValue to newValue. */
export function crossedThresholds(
  prevValue: number,
  newValue: number,
  target: number
): number[] {
  if (target <= 0) {
    return [];
  }
  const prevPct = (prevValue / target) * 100;
  const newPct = (newValue / target) * 100;
  return KR_THRESHOLDS.filter((t) => prevPct < t && newPct >= t);
}
