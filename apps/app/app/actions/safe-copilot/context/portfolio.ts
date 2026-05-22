import { database } from "@repo/database";

export type PortfolioContext = {
  themes: Array<{
    id: string;
    code: string | null;
    title: string;
    status: string;
    horizon: string | null;
    budgetTotal: number | null;
  }>;
  epics: Array<{
    id: string;
    title: string;
    statusId: string | null;
    featuresCount: number;
  }>;
  activeOkrs: Array<{
    id: string;
    title: string;
    type: string;
    status: string;
    keyResultsCount: number;
  }>;
  recentFlowSummary: {
    avgVelocity: number | null;
    avgEfficiency: number | null;
    avgPredictability: number | null;
  } | null;
};

export async function buildPortfolioContext(
  tenantId: string
): Promise<PortfolioContext> {
  const [themes, epics, okrs, flowSnapshots] = await Promise.all([
    database.strategicTheme.findMany({
      where: { tenantId },
      select: {
        id: true,
        code: true,
        title: true,
        status: true,
        horizon: true,
        budgetTotal: true,
      },
      take: 20,
    }),

    database.epic.findMany({
      where: { tenantId },
      select: {
        id: true,
        title: true,
        statusId: true,
        _count: { select: { features: true } },
      },
      take: 20,
    }),

    database.oKR.findMany({
      where: { tenantId, status: { in: ["ON_TRACK", "AT_RISK", "BEHIND"] } },
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        _count: { select: { keyResults: true } },
      },
      take: 15,
    }),

    database.flowMetricSnapshot.findMany({
      where: { tenantId },
      orderBy: { periodRef: "desc" },
      take: 5,
      select: {
        flowVelocityTotal: true,
        flowEfficiency: true,
        flowPredictability: true,
      },
    }),
  ]);

  const avgVelocity =
    flowSnapshots.length > 0
      ? flowSnapshots.reduce((s, f) => s + f.flowVelocityTotal, 0) /
        flowSnapshots.length
      : null;
  const avgEfficiency =
    flowSnapshots.length > 0
      ? flowSnapshots.reduce((s, f) => s + (f.flowEfficiency ?? 0), 0) /
        flowSnapshots.length
      : null;
  const avgPredictability =
    flowSnapshots.length > 0
      ? flowSnapshots.reduce((s, f) => s + (f.flowPredictability ?? 0), 0) /
        flowSnapshots.length
      : null;

  return {
    themes: themes.map((t) => ({
      id: t.id,
      code: t.code,
      title: t.title,
      status: t.status,
      horizon: t.horizon,
      budgetTotal: t.budgetTotal,
    })),
    epics: epics.map((e) => ({
      id: e.id,
      title: e.title,
      statusId: e.statusId,
      featuresCount: e._count.features,
    })),
    activeOkrs: okrs.map((o) => ({
      id: o.id,
      title: o.title,
      type: o.type,
      status: o.status,
      keyResultsCount: o._count.keyResults,
    })),
    recentFlowSummary:
      flowSnapshots.length > 0
        ? {
            avgVelocity:
              avgVelocity !== null ? Math.round(avgVelocity * 10) / 10 : null,
            avgEfficiency:
              avgEfficiency !== null
                ? Math.round(avgEfficiency * 100) / 100
                : null,
            avgPredictability:
              avgPredictability !== null
                ? Math.round(avgPredictability * 100) / 100
                : null,
          }
        : null,
  };
}
