"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { type Result, safeAction } from "../../actions/_base";
import { SAFE_COMPETENCIES } from "../../actions/measure-grow/schema";

export type CompetencyScoreView = {
  competency: string;
  competencyLabel: string;
  score: number | null;
  prevScore: number | null;
  delta: number | null;
  assessedAt: Date | null;
};

export async function listCompetencyScores(): Promise<
  Result<CompetencyScoreView[]>
> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const assessments = await database.competencyAssessment.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { assessedAt: "desc" },
      select: { competency: true, score: true, assessedAt: true },
    });

    // Group every assessment per competency (already ordered newest-first by
    // the query) so we can read off both the latest and the prior cycle.
    const byCompetency = new Map<string, (typeof assessments)[number][]>();
    for (const a of assessments) {
      const history = byCompetency.get(a.competency) ?? [];
      history.push(a);
      byCompetency.set(a.competency, history);
    }

    return SAFE_COMPETENCIES.map(({ key, label }) => {
      const [latest, prior] = byCompetency.get(key) ?? [];
      const score = latest ? Number(latest.score) : null;
      const prevScore = prior ? Number(prior.score) : null;
      return {
        competency: key,
        competencyLabel: label,
        score,
        prevScore,
        delta:
          score !== null && prevScore !== null
            ? Number((score - prevScore).toFixed(1))
            : null,
        assessedAt: latest?.assessedAt ?? null,
      };
    });
  });
}
