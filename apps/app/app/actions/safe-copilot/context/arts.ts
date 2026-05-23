import { database } from "@repo/database";

export type ARTsContext = {
  arts: Array<{
    id: string;
    name: string;
    cadence: number;
    teamsCount: number;
    latestMetrics: {
      periodRef: string;
      flowVelocityTotal: number | null;
      flowEfficiency: number | null;
      flowPredictability: number | null;
    } | null;
  }>;
};

export async function buildARTsContext(tenantId: string): Promise<ARTsContext> {
  const arts = await database.aRT.findMany({
    where: { tenantId },
    select: {
      id: true,
      name: true,
      cadence: true,
      _count: { select: { teams: true } },
    },
  });

  const snapshots = await database.flowMetricSnapshot.findMany({
    where: {
      tenantId,
      scope: "art",
      scopeId: { in: arts.map((a) => a.id) },
    },
    orderBy: { periodRef: "desc" },
    select: {
      scopeId: true,
      periodRef: true,
      flowVelocityTotal: true,
      flowEfficiency: true,
      flowPredictability: true,
    },
  });

  const latestByArt = new Map<string, (typeof snapshots)[0]>();
  for (const s of snapshots) {
    if (!latestByArt.has(s.scopeId)) {
      latestByArt.set(s.scopeId, s);
    }
  }

  return {
    arts: arts.map((a) => {
      const m = latestByArt.get(a.id) ?? null;
      return {
        id: a.id,
        name: a.name,
        cadence: a.cadence,
        teamsCount: a._count.teams,
        latestMetrics: m
          ? {
              periodRef: m.periodRef,
              flowVelocityTotal: m.flowVelocityTotal,
              flowEfficiency: m.flowEfficiency,
              flowPredictability: m.flowPredictability,
            }
          : null,
      };
    }),
  };
}
