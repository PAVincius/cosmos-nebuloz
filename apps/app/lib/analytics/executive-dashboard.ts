// Story-029: shared executive dashboard data fetch — used by server action + API route

import { database } from "@repo/database";
import { computeArtHealth, type HealthState } from "./art-health";

export const EXECUTIVE_CACHE_TTL = 300; // 5 min

export type KpiTiles = {
  predictabilityPct: number;
  flowEfficiency: number;
  cycleTimeDays: number;
  costPerPoint: number | null;
  actionCompletionRate: number;
  activeARTsCount: number;
};

export type ARTRow = {
  artId: string;
  artName: string;
  predictabilityPct: number;
  criticalAnomalies: number;
  health: HealthState;
  healthReasons: string[];
};

export type AnomalyFeedItem = {
  id: string;
  rule: string;
  severity: string;
  metric: string;
  entityType: string | null;
  entityId: string | null;
  detectedAt: Date;
};

export type ExecutiveDashboardPayload = {
  kpis: KpiTiles;
  artTable: ARTRow[];
  anomalyFeed: AnomalyFeedItem[];
  fromCache: boolean;
};

export function executiveCacheKey(tenantId: string, artIds?: string[]): string {
  const filter =
    artIds && artIds.length > 0 ? [...artIds].sort().join(",") : "all";
  return `analytics:executive:${tenantId}:${filter}`;
}

export async function buildExecutiveDashboardData(
  tenantId: string,
  artIds?: string[]
): Promise<ExecutiveDashboardPayload> {
  const artWhere = {
    tenantId,
    status: "ACTIVE",
    ...(artIds ? { id: { in: artIds } } : {}),
  };

  const [arts, snapshots, anomalies, retroActions] = await Promise.all([
    database.aRT.findMany({
      where: artWhere,
      select: {
        id: true,
        name: true,
        piPlans: {
          orderBy: { startDate: "desc" as const },
          take: 1,
          select: {
            piObjectives: { select: { status: true, isStretch: true } },
          },
        },
      },
    }),
    database.flowMetricSnapshot.findMany({
      where: {
        tenantId,
        scope: "art",
        period: "pi",
        ...(artIds ? { scopeId: { in: artIds } } : {}),
      },
      orderBy: { recordedAt: "desc" as const },
      take: artIds?.length ?? 20,
      select: {
        scopeId: true,
        flowEfficiency: true,
        flowTimeMedianHours: true,
        flowVelocityTotal: true,
      },
    }),
    database.anomaly.findMany({
      where: {
        tenantId,
        status: "OPEN",
        ...(artIds ? { entityId: { in: artIds } } : {}),
      },
      orderBy: [{ severity: "asc" as const }, { detectedAt: "desc" as const }],
      take: 10,
      select: {
        id: true,
        rule: true,
        severity: true,
        metric: true,
        entityType: true,
        entityId: true,
        detectedAt: true,
      },
    }),
    database.retroActionItem.findMany({
      where: { tenantId },
      select: { status: true },
      take: 500,
    }),
  ]);

  // predictability avg
  let totalPredictability = 0;
  let artWithPICount = 0;
  for (const art of arts) {
    const objs = art.piPlans[0]?.piObjectives.filter((o) => !o.isStretch) ?? [];
    if (objs.length === 0) {
      continue;
    }
    const achieved = objs.filter((o) => o.status === "ACHIEVED").length;
    totalPredictability += achieved / objs.length;
    artWithPICount++;
  }
  const predictabilityPct =
    artWithPICount > 0
      ? Math.round((totalPredictability / artWithPICount) * 100)
      : 0;

  // flow metrics
  const snapshotByArt = new Map(snapshots.map((s) => [s.scopeId, s]));
  const snapArr = [...snapshotByArt.values()];
  const avgFlowEff =
    snapArr.length > 0
      ? snapArr.reduce((s, x) => s + x.flowEfficiency, 0) / snapArr.length
      : 0;
  const avgCycleTimeDays =
    snapArr.length > 0
      ? snapArr.reduce((s, x) => s + x.flowTimeMedianHours / 24, 0) /
        snapArr.length
      : 0;

  // action completion
  const totalActions = retroActions.length;
  const completedActions = retroActions.filter(
    (a) => a.status === "COMPLETE"
  ).length;
  const actionCompletionRate =
    totalActions > 0 ? Math.round((completedActions / totalActions) * 100) : 0;

  // ART table
  const criticalByArt = new Map<string, number>();
  for (const a of anomalies) {
    if (a.severity === "CRITICAL" && a.entityId) {
      criticalByArt.set(a.entityId, (criticalByArt.get(a.entityId) ?? 0) + 1);
    }
  }

  const artTable: ARTRow[] = arts.map((art) => {
    const objs = art.piPlans[0]?.piObjectives.filter((o) => !o.isStretch) ?? [];
    const achieved = objs.filter((o) => o.status === "ACHIEVED").length;
    const ppm = objs.length > 0 ? achieved / objs.length : 0;
    const critCount = criticalByArt.get(art.id) ?? 0;
    const health = computeArtHealth({
      anomalies: Array.from({ length: critCount }, () => ({
        severity: "CRITICAL",
      })),
      piPPM: ppm,
    });
    return {
      artId: art.id,
      artName: art.name,
      predictabilityPct: Math.round(ppm * 100),
      criticalAnomalies: critCount,
      health,
      healthReasons: [] as string[],
    };
  });

  const SEVERITY_ORDER: Record<string, number> = {
    CRITICAL: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
  };
  const anomalyFeed = [...anomalies].sort(
    (a, b) =>
      (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9)
  );

  return {
    kpis: {
      predictabilityPct,
      flowEfficiency: Math.round(avgFlowEff * 100) / 100,
      cycleTimeDays: Math.round(avgCycleTimeDays * 10) / 10,
      costPerPoint: null,
      actionCompletionRate,
      activeARTsCount: arts.length,
    },
    artTable,
    anomalyFeed,
    fromCache: false,
  };
}
