"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";

export type ThemeCostRow = {
  themeId: string;
  themeName: string;
  cost: number;
  pct: number;
};

export type CostSummaryResult = {
  mapped: ThemeCostRow[];
  unmappedCost: number;
  unmappedPct: number;
  totalCost: number;
  currency: string;
};

export type MonthlyTrendRow = { month: string; cost: number };

export async function costSummaryByTheme(
  opts: { startDate?: Date; endDate?: Date } = {},
): Promise<CostSummaryResult> {
  const ctx = await requireTenantSession(await headers());
  const { tenantId } = ctx;

  const dateFilter = opts.startDate
    ? {
        usageStartDate: {
          gte: opts.startDate,
          ...(opts.endDate ? { lte: opts.endDate } : {}),
        },
      }
    : {};

  const [grouped, themes] = await Promise.all([
    database.billingEntry.groupBy({
      by: ["themeId"],
      where: { tenantId, ...dateFilter },
      _sum: { effectiveCost: true },
    }),
    database.strategicTheme.findMany({
      where: { tenantId },
      select: { id: true, title: true },
    }),
  ]);

  const themeMap = new Map(themes.map((t) => [t.id, t.title]));
  const totalCost = grouped.reduce(
    (acc, g) => acc + Number(g._sum.effectiveCost ?? 0),
    0,
  );

  let unmappedCost = 0;
  const mapped: ThemeCostRow[] = [];

  for (const g of grouped) {
    const cost = Number(g._sum.effectiveCost ?? 0);
    if (!g.themeId) {
      unmappedCost += cost;
      continue;
    }
    mapped.push({
      themeId: g.themeId,
      themeName: themeMap.get(g.themeId) ?? g.themeId,
      cost,
      pct: totalCost > 0 ? Math.round((cost / totalCost) * 100) : 0,
    });
  }

  mapped.sort((a, b) => b.cost - a.cost);

  return {
    mapped,
    unmappedCost,
    unmappedPct:
      totalCost > 0 ? Math.round((unmappedCost / totalCost) * 100) : 0,
    totalCost,
    currency: "USD",
  };
}

export async function costTrendByMonth(months = 6): Promise<MonthlyTrendRow[]> {
  const ctx = await requireTenantSession(await headers());
  const { tenantId } = ctx;

  const since = new Date();
  since.setMonth(since.getMonth() - months);

  const entries = await database.billingEntry.findMany({
    where: { tenantId, usageStartDate: { gte: since } },
    select: { usageStartDate: true, effectiveCost: true },
    orderBy: { usageStartDate: "asc" },
  });

  const byMonth = new Map<string, number>();
  for (const e of entries) {
    const key = e.usageStartDate.toISOString().slice(0, 7);
    byMonth.set(key, (byMonth.get(key) ?? 0) + Number(e.effectiveCost));
  }

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, cost]) => ({ month, cost: Math.round(cost * 100) / 100 }));
}
