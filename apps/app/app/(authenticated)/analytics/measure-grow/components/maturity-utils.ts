/**
 * Shared derivation for "current cycle" vs "previous cycle" competency
 * maturity, used by both MaturityOverview (KPIs + detail list) and
 * CompetencyRadar (current vs. previous polygon).
 *
 * The schema has no explicit PI/quarter field on Assessment, so "cycle" is
 * derived from the data we do have: for each competency, the most recent
 * distinct `assessedAt` date is the current cycle and the next most recent
 * distinct date is the previous cycle. Competencies with a single dated
 * snapshot (or none) have no real previous value, so prevScore falls back
 * to score (delta 0) rather than a fabricated number.
 */

export type CompetencyAssessment = {
  competency: string;
  score: number;
  assessedAt: Date;
};

export type CompetencyMaturity = {
  key: string;
  score: number;
  prevScore: number;
  delta: number;
};

export function computeCompetencyMaturity(
  competencyKeys: string[],
  assessments: CompetencyAssessment[]
): Record<string, CompetencyMaturity> {
  const byCompetency = new Map<string, CompetencyAssessment[]>();
  for (const a of assessments) {
    const list = byCompetency.get(a.competency) ?? [];
    list.push(a);
    byCompetency.set(a.competency, list);
  }

  const result: Record<string, CompetencyMaturity> = {};
  for (const key of competencyKeys) {
    const list = byCompetency.get(key) ?? [];
    if (list.length === 0) {
      result[key] = { key, score: 0, prevScore: 0, delta: 0 };
      continue;
    }

    const dates = Array.from(
      new Set(list.map((a) => a.assessedAt.getTime()))
    ).sort((a, b) => b - a);
    const currentTime = dates[0];
    const prevTime = dates[1];

    const avgAt = (time: number) => {
      const scores = list
        .filter((a) => a.assessedAt.getTime() === time)
        .map((a) => a.score);
      return scores.reduce((s, v) => s + v, 0) / scores.length;
    };

    const score = Math.round(avgAt(currentTime) * 10) / 10;
    const prevScore =
      prevTime !== undefined ? Math.round(avgAt(prevTime) * 10) / 10 : score;

    result[key] = {
      key,
      score,
      prevScore,
      delta: Math.round((score - prevScore) * 10) / 10,
    };
  }
  return result;
}

export function formatDelta(delta: number): string {
  if (delta === 0) return "—";
  return `${delta > 0 ? "+" : ""}${delta.toFixed(1)}`;
}
