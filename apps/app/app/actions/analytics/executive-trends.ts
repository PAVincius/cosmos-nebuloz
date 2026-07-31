"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { type Result, safeAction } from "../_base";

type TrendPoint = {
  pi: string;
  predictabilityPct: number;
  cycleTimeDays: number;
  costPerPoint: number | null;
};

export async function getExecutiveTrends(
  artIds?: string[]
): Promise<Result<TrendPoint[]>> {
  return safeAction(async () => {
    const { tenantId } = await requireTenantSession(await headers());

    const snapshots = await database.flowMetricSnapshot.findMany({
      where: {
        tenantId,
        scope: "art",
        period: "pi",
        ...(artIds ? { scopeId: { in: artIds } } : {}),
      },
      orderBy: { recordedAt: "desc" as const },
      take: artIds ? artIds.length * 6 : 60,
      select: {
        scopeId: true,
        recordedAt: true,
        flowTimeMedianHours: true,
        flowVelocityTotal: true,
        periodRef: true,
      },
    });

    // Group by periodRef (piPlanId or "2026-Q2") — aggregate across ARTs
    const byPi = new Map<string, { cycleTimeSum: number; count: number }>();

    for (const s of snapshots) {
      const label = s.periodRef ?? s.recordedAt.toISOString().slice(0, 7);
      const existing = byPi.get(label) ?? { cycleTimeSum: 0, count: 0 };
      byPi.set(label, {
        cycleTimeSum: existing.cycleTimeSum + s.flowTimeMedianHours / 24,
        count: existing.count + 1,
      });
    }

    // Last 6 PIs sorted oldest→newest
    const sorted = [...byPi.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6);

    return sorted.map(([pi, v]) => ({
      pi,
      predictabilityPct: 0, // requires PI objectives join — placeholder
      cycleTimeDays: Math.round((v.cycleTimeSum / v.count) * 10) / 10,
      costPerPoint: null,
    }));
  });
}
