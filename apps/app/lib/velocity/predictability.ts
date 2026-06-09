// Velocity predictability calculation — story-032 pure logic

export const LOW_PREDICTABILITY_THRESHOLD = 0.7;
export const LOW_PREDICTABILITY_CONSECUTIVE_PIS = 3;

export type SprintReview = {
  committedPoints: number;
  acceptedPoints: number;
};

export function computePredictability(sprints: SprintReview[]): number | null {
  const withCommitments = sprints.filter((s) => s.committedPoints > 0);
  if (withCommitments.length === 0) {
    return null;
  }
  return (
    withCommitments.reduce(
      (sum, s) => sum + s.acceptedPoints / s.committedPoints,
      0
    ) / withCommitments.length
  );
}

export function isLowPredictability(
  piPredictabilities: (number | null)[]
): boolean {
  if (piPredictabilities.length < LOW_PREDICTABILITY_CONSECUTIVE_PIS) {
    return false;
  }
  const last3 = piPredictabilities.slice(-LOW_PREDICTABILITY_CONSECUTIVE_PIS);
  return last3.every((p) => p !== null && p < LOW_PREDICTABILITY_THRESHOLD);
}
