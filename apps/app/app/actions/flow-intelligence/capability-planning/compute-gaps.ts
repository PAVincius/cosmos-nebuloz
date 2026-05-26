import type { TeamCapability, InitiativeDemand } from "./capability-schema";

export function computeCapabilityGap(team: TeamCapability, initiative: InitiativeDemand) {
  const gapsByCategory: Record<
    string,
    { demand: number; capability: number; gap: number; weight: number }
  > = {};
  let overallScore = 0;

  for (const [category, demand] of Object.entries(initiative.demand)) {
    const cap = team.capabilities[category as keyof typeof team.capabilities];
    const capScore = cap ? Math.min(1, cap.deliveredSp / 50) * cap.confidenceLevel : 0;
    const gap = Math.max(0, demand - capScore);
    const weight = demand;
    gapsByCategory[category] = { demand, capability: capScore, gap, weight };
    overallScore += gap * weight;
  }

  const topGap = Object.entries(gapsByCategory).sort((a, b) => b[1].gap - a[1].gap)[0];
  const recommendation =
    topGap && topGap[1].gap > 0.3
      ? `Time tem gap forte em ${topGap[0]}. Considerar enabler, treinamento, ou cross-team support antes do PI.`
      : "Time tem cobertura adequada para esta iniciativa.";

  return {
    teamId: team.teamId,
    initiativeId: initiative.initiativeId,
    initiativeType: initiative.initiativeType,
    overallScore,
    gapsByCategory,
    recommendation,
  };
}
