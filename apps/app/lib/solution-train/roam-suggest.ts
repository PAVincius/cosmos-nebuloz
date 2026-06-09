// ROAM risk AI-suggest threshold filter (story-043 AC-004)

export const ROAM_SIMILARITY_THRESHOLD = 0.7;

export type RiskSuggestion = {
  riskId: string;
  title: string;
  originalPi: string;
  originalResolution: string;
  similarity: number;
};

export function filterByThreshold(
  suggestions: RiskSuggestion[],
  threshold = ROAM_SIMILARITY_THRESHOLD
): RiskSuggestion[] {
  return suggestions.filter((s) => s.similarity >= threshold);
}

export function topN(
  suggestions: RiskSuggestion[],
  n: number
): RiskSuggestion[] {
  return [...suggestions]
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, n);
}
