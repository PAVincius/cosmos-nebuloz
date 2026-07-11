"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";

export type ArtHealthRow = {
  id: string;
  name: string;
  ppm: number;
  teamCount: number;
  memberCount: number;
  featureCount: number;
  epicCount: number;
  budgetM: number;
  hasData: boolean;
};

export type PortfolioOverviewData = {
  artHealth: ArtHealthRow[];
  activeEpics: number;
  totalEpics: number;
  budgetAllocatedM: number;
  budgetSpentM: number;
  throughputSP: number;
  piCurrentWeek: number | null;
  piTotalWeeks: number;
};

export async function getPortfolioOverviewData(): Promise<PortfolioOverviewData> {
  const ctx = await requireTenantSession(await headers());
  const { tenantId } = ctx;

  const [arts, epicTotal, epicActive, budgetAgg, spentRows, teams, artBudgets] =
    await Promise.all([
      database.aRT.findMany({
        where: { tenantId },
        include: {
          teams: { select: { id: true, members: true, velocity: true } },
          piPlans: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: {
              piObjectives: {
                where: { isStretch: false },
                select: { id: true, status: true },
              },
              features: { select: { id: true, epicId: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      database.epic.count({ where: { tenantId } }),
      database.epic.count({
        where: {
          tenantId,
          statusId: { notIn: ["DONE", "CANCELLED", "ARCHIVED"] },
        },
      }),
      database.leanBudget.aggregate({
        where: { tenantId },
        _sum: { amount: true },
      }),
      database.leanBudget.findMany({
        where: { tenantId, spent: { not: null } },
        select: { spent: true },
      }),
      database.team.findMany({
        where: { tenantId, velocity: { not: null } },
        select: { velocity: true },
      }),
      // Fetch per-ART budget separately since leanBudgets isn't a relation on ART
      database.leanBudget.findMany({
        where: { tenantId, artId: { not: null } },
        select: { artId: true, amount: true },
      }),
    ]);

  const budgetAllocatedM = (budgetAgg._sum.amount ?? 0) / 1_000_000;
  const budgetSpentM =
    spentRows.reduce((sum, r) => sum + Number(r.spent ?? 0), 0) / 1_000_000;

  const throughputSP = teams.reduce((sum, t) => sum + (t.velocity ?? 0), 0);

  // Budget keyed by artId
  const budgetByArt = new Map<string, number>();
  for (const b of artBudgets) {
    if (b.artId) {
      budgetByArt.set(b.artId, (budgetByArt.get(b.artId) ?? 0) + b.amount);
    }
  }

  // PI Completion from the first ART with a PI plan start date
  let piCurrentWeek: number | null = null;
  let piTotalWeeks = 10;
  for (const art of arts) {
    const pi = art.piPlans[0];
    if (pi?.startDate) {
      const start = new Date(pi.startDate);
      const now = new Date();
      const weekMs = 7 * 24 * 60 * 60 * 1000;
      const elapsed =
        Math.max(0, Math.floor((now.getTime() - start.getTime()) / weekMs)) +
        1;
      piTotalWeeks = art.cadence ?? 10;
      piCurrentWeek = Math.min(elapsed, piTotalWeeks);
      break;
    }
  }

  const artHealth: ArtHealthRow[] = arts.map((art) => {
    const pi = art.piPlans[0];
    const objectives = pi?.piObjectives ?? [];
    const achieved = objectives.filter(
      (o: { status: string }) =>
        o.status === "ACHIEVED" || o.status === "COMMITTED"
    ).length;
    const ppm =
      objectives.length > 0
        ? Math.round((achieved / objectives.length) * 100)
        : 0;

    const teamCount = art.teams.length;
    const memberCount = art.teams.reduce((sum, t) => {
      const members = Array.isArray(t.members) ? (t.members as unknown[]) : [];
      return sum + members.length;
    }, 0);

    const features = pi?.features ?? [];
    const featureCount = features.length;
    const epicCount = new Set(
      features.map((f) => f.epicId).filter(Boolean)
    ).size;

    const budgetM = (budgetByArt.get(art.id) ?? 0) / 1_000_000;

    return {
      id: art.id,
      name: art.name,
      ppm,
      teamCount,
      memberCount,
      featureCount,
      epicCount,
      budgetM,
      hasData: !!pi,
    };
  });

  return {
    artHealth,
    activeEpics: epicActive,
    totalEpics: epicTotal,
    budgetAllocatedM,
    budgetSpentM,
    throughputSP,
    piCurrentWeek,
    piTotalWeeks,
  };
}
