"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";

// ─── Types ──────────────────────────────────────────────────────────────

export type HistoryPastPi = {
  id: string;
  name: string;
  artId: string;
  artName: string;
  tone: string;
  quarter: string;
  ppm: number | null;
  predictability: number | null;
  objAchieved: number;
  objTotal: number;
  confidence: number | null;
  velocity: number | null;
  delivered: string;
};

export type HistoryRetiredArt = {
  id: string;
  name: string;
  teamNames: string;
  retiredOn: string;
  pisRun: number;
  members: number;
  finalPredictability: number | null;
};

export type HistoryOverview = {
  filterArt: { id: string; name: string } | null;
  pastPis: HistoryPastPi[];
  retiredArts: HistoryRetiredArt[];
};

// ─── Helpers ────────────────────────────────────────────────────────────

const ART_TONES = ["blue", "green", "purple", "amber", "red"] as const;

function toneForIndex(index: number): string {
  return ART_TONES[index % ART_TONES.length];
}

function quarterLabel(date: Date | null | undefined): string {
  if (!date) {
    return "—";
  }
  const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
  return `${date.getUTCFullYear()}-Q${quarter}`;
}

async function computePredictability(
  piPlanId: string,
  tenantId: string
): Promise<number | null> {
  const objectives = await database.pIObjective.findMany({
    where: { piPlanId, tenantId },
    select: { status: true },
  });
  if (objectives.length === 0) {
    return null;
  }
  const achieved = objectives.filter((o) => o.status === "ACHIEVED").length;
  return achieved / objectives.length;
}

// ─── Query ──────────────────────────────────────────────────────────────

/**
 * Read-only archive: closed PI plans + retired ARTs. Mirrors prototype's
 * screenHistory. When `artId` is provided (chip de origem vindo do ART
 * detail), only the "Past PIs" section is filtered — Retired ARTs remains
 * a tenant-wide archive, matching the prototype's static section.
 */
export async function getHistoryOverview(
  artId?: string
): Promise<HistoryOverview> {
  const ctx = await requireTenantSession(await headers());

  const [filterArt, closedPlans, retiredArtsRaw] = await Promise.all([
    artId
      ? database.aRT.findFirst({
          where: { id: artId, tenantId: ctx.tenantId },
          select: { id: true, name: true },
        })
      : Promise.resolve(null),
    database.pIPlan.findMany({
      where: {
        tenantId: ctx.tenantId,
        status: "CLOSED",
        ...(artId ? { artId } : {}),
      },
      include: {
        art: { select: { id: true, name: true } },
        piSessions: {
          where: { type: "CONFIDENCE_VOTE" },
          select: {
            confidenceSessions: {
              orderBy: { roundNumber: "desc" },
              take: 1,
              select: { averageScore: true },
            },
          },
        },
      },
      orderBy: { closedAt: "desc" },
    }),
    database.aRT.findMany({
      where: { tenantId: ctx.tenantId, status: "RETIRED" },
      include: {
        teams: {
          select: {
            name: true,
            memberAssignments: { select: { id: true } },
          },
        },
        piPlans: {
          where: { status: "CLOSED" },
          select: { id: true, closedAt: true },
          orderBy: { closedAt: "desc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const planIds = closedPlans.map((plan) => plan.id);

  const objectives =
    planIds.length > 0
      ? await database.pIObjective.findMany({
          where: { piPlanId: { in: planIds }, tenantId: ctx.tenantId },
          select: { piPlanId: true, status: true },
        })
      : [];

  const features =
    planIds.length > 0
      ? await database.feature.findMany({
          where: { piPlanId: { in: planIds }, tenantId: ctx.tenantId },
          select: { piPlanId: true },
        })
      : [];

  const pastPis: HistoryPastPi[] = closedPlans.map((plan, index) => {
    const planObjectives = objectives.filter((o) => o.piPlanId === plan.id);
    const objAchieved = planObjectives.filter(
      (o) => o.status === "ACHIEVED"
    ).length;
    const objTotal = planObjectives.length;
    const predictability = objTotal > 0 ? objAchieved / objTotal : null;
    const confidence =
      plan.piSessions[0]?.confidenceSessions[0]?.averageScore ?? null;
    const featureCount = features.filter(
      (f) => f.piPlanId === plan.id
    ).length;

    return {
      id: plan.id,
      name: plan.name,
      artId: plan.art.id,
      artName: plan.art.name,
      tone: toneForIndex(index),
      quarter: quarterLabel(plan.closedAt ?? plan.endDate),
      ppm: plan.ppm,
      predictability,
      objAchieved,
      objTotal,
      confidence,
      velocity: plan.velocity,
      delivered:
        featureCount > 0
          ? `${featureCount} feature${featureCount === 1 ? "" : "s"} entregue${featureCount === 1 ? "" : "s"}`
          : "Sem features vinculadas",
    };
  });

  const retiredArts: HistoryRetiredArt[] = await Promise.all(
    retiredArtsRaw.map(async (art) => {
      const lastClosed = art.piPlans[0] ?? null;
      const finalPredictability = lastClosed
        ? await computePredictability(lastClosed.id, ctx.tenantId)
        : null;
      const members = art.teams.reduce(
        (sum, team) => sum + team.memberAssignments.length,
        0
      );

      return {
        id: art.id,
        name: art.name,
        teamNames: art.teams.map((t) => t.name).join(", ") || "—",
        retiredOn: quarterLabel(art.updatedAt),
        pisRun: art.piPlans.length,
        members,
        finalPredictability,
      };
    })
  );

  return { filterArt, pastPis, retiredArts };
}
