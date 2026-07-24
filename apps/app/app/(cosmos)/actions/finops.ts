"use server";

// finops.ts — cloud cost summary for the portfolio dashboard, backed by the
// real CostSnapshot/CostAnomaly FinOps models (see lib/inngest/billing-sync.ts
// for how snapshots are written: granularity "DAILY", period = day-truncated
// usage date). Tenant-scoped, read-only.
import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { type Result, safeAction } from "../../actions/_base";

export type CloudCostSummaryView = {
  currentMonthCostUsd: number | null;
  previousMonthCostUsd: number | null;
  deltaPct: number | null;
  openAnomalyCount: number;
};

function monthStart(date: Date, offsetMonths = 0): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offsetMonths, 1)
  );
}

export async function getCloudCostSummary(): Promise<
  Result<CloudCostSummaryView>
> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const now = new Date();
    const startOfThisMonth = monthStart(now);
    const startOfNextMonth = monthStart(now, 1);
    const startOfPrevMonth = monthStart(now, -1);

    const [currentAgg, previousAgg, openAnomalyCount] = await Promise.all([
      database.costSnapshot.aggregate({
        where: {
          tenantId: ctx.tenantId,
          granularity: "DAILY",
          period: { gte: startOfThisMonth, lt: startOfNextMonth },
        },
        _sum: { cloudCost: true },
      }),
      database.costSnapshot.aggregate({
        where: {
          tenantId: ctx.tenantId,
          granularity: "DAILY",
          period: { gte: startOfPrevMonth, lt: startOfThisMonth },
        },
        _sum: { cloudCost: true },
      }),
      database.costAnomaly.count({
        where: { tenantId: ctx.tenantId, status: "OPEN" },
      }),
    ]);

    const current =
      currentAgg._sum.cloudCost != null
        ? Number(currentAgg._sum.cloudCost)
        : null;
    const previous =
      previousAgg._sum.cloudCost != null
        ? Number(previousAgg._sum.cloudCost)
        : null;
    const deltaPct =
      current != null && previous != null && previous > 0
        ? Math.round(((current - previous) / previous) * 100)
        : null;

    return {
      currentMonthCostUsd: current,
      previousMonthCostUsd: previous,
      deltaPct,
      openAnomalyCount,
    };
  });
}
