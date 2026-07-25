export function ppmFormula(
  objectives: Array<{
    plannedValue: number;
    achievedValue: number;
    businessValue: number;
    isStretch: boolean;
  }>
): number {
  const committed = objectives.filter(
    (o) => !o.isStretch && o.plannedValue > 0
  );
  if (committed.length === 0) {
    return 0;
  }
  const numerator = committed.reduce(
    (sum, o) => sum + (o.achievedValue / o.plannedValue) * o.businessValue,
    0
  );
  const denominator = committed.reduce((sum, o) => sum + o.businessValue, 0);
  return denominator === 0 ? 0 : numerator / denominator;
}
