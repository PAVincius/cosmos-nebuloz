// Confidence vote aggregation (story-042 AC-005, AC-006)
// Votes are broadcast-only — never stored with userId

const REVEAL_THRESHOLD = 0.5; // 50%

export type VoteBreakdown = Partial<Record<1 | 2 | 3 | 4 | 5, number>>;

export function computeVoteAverage(breakdown: VoteBreakdown): number {
  let total = 0;
  let count = 0;

  for (const [score, votes] of Object.entries(breakdown)) {
    const s = Number(score) as 1 | 2 | 3 | 4 | 5;
    const v = votes ?? 0;
    total += s * v;
    count += v;
  }

  return count > 0 ? total / count : 0;
}

export function isRevealThresholdMet(
  votedCount: number,
  expectedTotal: number
): boolean {
  if (expectedTotal <= 0) {
    return false;
  }
  return votedCount / expectedTotal >= REVEAL_THRESHOLD;
}

export type ConfidenceZone = "red" | "yellow" | "green";

export function getConfidenceZone(average: number): ConfidenceZone {
  if (average < 3) {
    return "red";
  }
  if (average <= 4) {
    return "yellow";
  }
  return "green";
}
