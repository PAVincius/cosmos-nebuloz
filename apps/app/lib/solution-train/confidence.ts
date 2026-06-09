type ARTConfidenceTally = {
  artId: string;
  teamCount: number;
  averageScore: number;
};

export function aggregateSolutionConfidence(
  tallies: ARTConfidenceTally[]
): number {
  if (tallies.length === 0) {
    return 0;
  }

  const totalWeight = tallies.reduce((sum, t) => sum + t.teamCount, 0);
  if (totalWeight === 0) {
    return 0;
  }

  const weightedSum = tallies.reduce(
    (sum, t) => sum + t.averageScore * t.teamCount,
    0
  );

  return weightedSum / totalWeight;
}
