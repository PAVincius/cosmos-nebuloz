"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { type Result, safeAction } from "../../actions/_base";

export type FlowMetricsView = {
  flowDistribution: Record<string, number>;
  flowVelocityTotal: number;
  flowTimeAvgHours: number;
  flowLoadCurrent: number;
  flowEfficiency: number;
  flowPredictability: number;
  recordedAt: string;
};

export async function getLatestFlowMetrics(): Promise<
  Result<FlowMetricsView | null>
> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const snap = await database.flowMetricSnapshot.findFirst({
      where: { tenantId: ctx.tenantId },
      orderBy: { recordedAt: "desc" },
      select: {
        flowDistribution: true,
        flowVelocityTotal: true,
        flowTimeAvgHours: true,
        flowLoadCurrent: true,
        flowEfficiency: true,
        flowPredictability: true,
        recordedAt: true,
      },
    });
    if (!snap) {
      return null;
    }
    return {
      flowDistribution: (snap.flowDistribution as Record<string, number>) ?? {},
      flowVelocityTotal: snap.flowVelocityTotal,
      flowTimeAvgHours: snap.flowTimeAvgHours,
      flowLoadCurrent: snap.flowLoadCurrent,
      flowEfficiency: snap.flowEfficiency,
      flowPredictability: snap.flowPredictability,
      recordedAt: snap.recordedAt.toISOString(),
    };
  });
}
