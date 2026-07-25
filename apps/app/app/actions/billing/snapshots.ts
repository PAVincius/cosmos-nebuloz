"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { type Result, safeAction } from "@/app/actions/_base";

export type BudgetOverviewItem = {
  themeId: string | null;
  themeName: string | null;
  plannedCost: number;
  actualCost: number;
  cloudCost: number;
  unmappedAmount: number;
  period: string;
};

export async function getBudgetOverview(params: {
  granularity: "DAILY" | "MONTHLY";
  periodStart: Date;
  periodEnd: Date;
}): Promise<Result<BudgetOverviewItem[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const snapshots = await database.costSnapshot.findMany({
      where: {
        tenantId: ctx.tenantId,
        granularity: params.granularity,
        period: { gte: params.periodStart, lte: params.periodEnd },
      },
      orderBy: [{ period: "desc" }, { themeId: "asc" }],
    });

    // Group by themeId and sum
    const byTheme = new Map<string | null, BudgetOverviewItem>();

    for (const snap of snapshots) {
      const key = snap.themeId;
      const existing = byTheme.get(key);
      if (existing) {
        existing.actualCost += Number(snap.actualCost);
        existing.cloudCost += Number(snap.cloudCost);
        existing.unmappedAmount += Number(snap.unmappedAmount);
        if (snap.plannedCost) {
          existing.plannedCost += Number(snap.plannedCost);
        }
      } else {
        byTheme.set(key, {
          themeId: snap.themeId,
          themeName: null,
          plannedCost: snap.plannedCost ? Number(snap.plannedCost) : 0,
          actualCost: Number(snap.actualCost),
          cloudCost: Number(snap.cloudCost),
          unmappedAmount: Number(snap.unmappedAmount),
          period: snap.period.toISOString(),
        });
      }
    }

    // Enrich with theme names
    const themeIds = [...byTheme.keys()].filter(Boolean) as string[];
    if (themeIds.length > 0) {
      const themes = await database.strategicTheme.findMany({
        where: { id: { in: themeIds }, tenantId: ctx.tenantId },
        select: { id: true, title: true },
      });
      for (const t of themes) {
        const item = byTheme.get(t.id);
        if (item) {
          item.themeName = t.title;
        }
      }
    }

    return [...byTheme.values()];
  });
}
