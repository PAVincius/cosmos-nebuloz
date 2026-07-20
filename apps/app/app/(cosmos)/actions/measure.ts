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

    const latestByCompetency = new Map<string, (typeof assessments)[number]>();
    for (const a of assessments) {
      if (!latestByCompetency.has(a.competency)) {
        latestByCompetency.set(a.competency, a);
      }
    }

    return SAFE_COMPETENCIES.map(({ key, label }) => {
      const latest = latestByCompetency.get(key);
      return {
        competency: key,
        competencyLabel: label,
        score: latest ? Number(latest.score) : null,
        assessedAt: latest?.assessedAt ?? null,
      };
    });
  });
}
