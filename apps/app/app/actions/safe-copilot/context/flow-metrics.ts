import { database } from "@repo/database";

export type FlowMetricsContext = {
  snapshots: Array<{
    scope: string;
    scopeId: string;
    period: string;
    periodRef: string;
    flowVelocityTotal: number;
    flowTimeAvgHours: number;
    flowLoadCurrent: number;
    flowEfficiency: number;
    flowPredictability: number;
    plannedItems: number;
    deliveredItems: number;
    flowDistribution: unknown;
  }>;
  openImprovementActions: Array<{
    id: string;
    title: string;
    scope: string;
    relatedMetric: string | null;
    status: string;
    dueDate: string | null;
  }>;
  competencyScores: Array<{
    competency: string;
    score: number;
    assessedAt: string;
  }>;
};

export async function buildFlowMetricsContext(
  tenantId: string,
  contextRef: { scopeId?: string; scope?: string }
): Promise<FlowMetricsContext> {
  const { scopeId, scope } = contextRef;

  const [snapshots, actions, assessments] = await Promise.all([
    database.flowMetricSnapshot.findMany({
      where: {
        tenantId,
        ...(scope ? { scope } : {}),
        ...(scopeId ? { scopeId } : {}),
      },
      orderBy: { periodRef: "desc" },
      take: 9,
    }),

    database.improvementAction.findMany({
      where: {
        tenantId,
        status: { in: ["OPEN", "IN_PROGRESS"] },
        ...(scopeId ? { scopeId } : {}),
      },
      select: {
        id: true,
        title: true,
        scope: true,
        relatedMetric: true,
        status: true,
        dueDate: true,
      },
      take: 10,
    }),

    database.competencyAssessment.findMany({
      where: {
        tenantId,
        ...(scopeId ? { scopeId } : {}),
      },
      orderBy: { assessedAt: "desc" },
      take: 6,
      select: { competency: true, score: true, assessedAt: true },
    }),
  ]);

  return {
    snapshots: snapshots.map((s) => ({
      scope: s.scope,
      scopeId: s.scopeId,
      period: s.period,
      periodRef: s.periodRef,
      flowVelocityTotal: s.flowVelocityTotal,
      flowTimeAvgHours: s.flowTimeAvgHours,
      flowLoadCurrent: s.flowLoadCurrent,
      flowEfficiency: s.flowEfficiency,
      flowPredictability: s.flowPredictability,
      plannedItems: s.plannedItems,
      deliveredItems: s.deliveredItems,
      flowDistribution: s.flowDistribution,
    })),
    openImprovementActions: actions.map((a) => ({
      id: a.id,
      title: a.title,
      scope: a.scope,
      relatedMetric: a.relatedMetric,
      status: a.status,
      dueDate: a.dueDate?.toISOString().slice(0, 10) ?? null,
    })),
    competencyScores: assessments.map((a) => ({
      competency: a.competency,
      score: a.score,
      assessedAt: a.assessedAt.toISOString().slice(0, 10),
    })),
  };
}
