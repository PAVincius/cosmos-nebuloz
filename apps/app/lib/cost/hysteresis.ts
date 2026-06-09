// Budget threshold hysteresis — story-030 pure logic

export const BUDGET_THRESHOLDS = [70, 90, 100] as const;
export type BudgetThreshold = (typeof BUDGET_THRESHOLDS)[number];

export type ThresholdCrossed = Partial<Record<number, string>>;

export function calcUtilization(
  currentSpend: number,
  totalAmount: number
): number {
  if (totalAmount <= 0) {
    return 0;
  }
  return (currentSpend / totalAmount) * 100;
}

export function findNewCrossings(
  utilization: number,
  crossed: ThresholdCrossed
): BudgetThreshold[] {
  return BUDGET_THRESHOLDS.filter(
    (t) => utilization >= t && crossed[t] === undefined
  );
}

export function recordCrossings(
  crossed: ThresholdCrossed,
  newThresholds: BudgetThreshold[],
  timestamp: string
): ThresholdCrossed {
  const updated = { ...crossed };
  for (const t of newThresholds) {
    updated[t] = timestamp;
  }
  return updated;
}

export function hasThresholdBeenCrossed(
  crossed: ThresholdCrossed,
  threshold: number
): boolean {
  return crossed[threshold] !== undefined;
}
