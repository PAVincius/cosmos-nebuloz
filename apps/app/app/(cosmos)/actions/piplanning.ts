"use server";

// piplanning.ts — getActivePiPlanning(): active PI's objectives, ROAM risks,
// and latest confidence-vote average, all tenant-scoped.

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { type Result, safeAction } from "../../actions/_base";

export type PiPlanningView = {
  piPlanName: string;
  // Current in-progress sprint under this PI (Sprint.status === "ACTIVE"),
  // null when no team has an active sprint right now.
  activeSprintName: string | null;
  objectives: {
    id: string;
    title: string;
    businessValue: number;
    status: string;
    isStretch: boolean;
    plannedValue: number;
    achievedValue: number;
    teamId: string | null;
    teamName: string | null;
  }[];
  risks: { id: string; title: string; roamStatus: string }[];
  confidenceAvg: number | null;
};

export async function getActivePiPlanning(): Promise<
  Result<PiPlanningView | null>
> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const plan = await database.pIPlan.findFirst({
      where: {
        tenantId: ctx.tenantId,
        status: { in: ["PLANNING", "COMMITTED", "EXECUTING"] },
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        piObjectives: {
          select: {
            id: true,
            title: true,
            businessValue: true,
            status: true,
            isStretch: true,
            plannedValue: true,
            achievedValue: true,
            teamId: true,
          },
        },
        risks: { select: { id: true, title: true, roamStatus: true } },
        sprints: {
          where: { tenantId: ctx.tenantId, status: "ACTIVE" },
          orderBy: { startDate: "desc" },
          take: 1,
          select: { name: true },
        },
      },
    });
    if (!plan) {
      return null;
    }

    const tally = await database.confidenceVoteTally.findFirst({
      where: { tenantId: ctx.tenantId, piPlanId: plan.id },
      orderBy: { createdAt: "desc" },
      select: { aggregateScore: true },
    });

    const teamIds = [
      ...new Set(
        plan.piObjectives
          .map((o) => o.teamId)
          .filter((id): id is string => !!id)
      ),
    ];
    const teams = teamIds.length
      ? await database.team.findMany({
          where: { id: { in: teamIds }, tenantId: ctx.tenantId },
          select: { id: true, name: true },
        })
      : [];
    const teamNameById = new Map(teams.map((t) => [t.id, t.name]));

    return {
      piPlanName: plan.name,
      activeSprintName: plan.sprints[0]?.name ?? null,
      objectives: plan.piObjectives.map((o) => ({
        id: o.id,
        title: o.title,
        businessValue: o.businessValue,
        status: o.status,
        isStretch: o.isStretch,
        plannedValue: o.plannedValue,
        achievedValue: o.achievedValue,
        teamId: o.teamId,
        teamName: (o.teamId && teamNameById.get(o.teamId)) || null,
      })),
      risks: plan.risks,
      confidenceAvg: tally?.aggregateScore ?? null,
    };
  });
}

// Count of ARTs currently running (ART.status === "ACTIVE"), tenant-scoped —
// backs the "N ARTs ativos" dashboard header badge and KPI hint.
export async function getActiveArtCount(): Promise<Result<number>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    return database.aRT.count({
      where: { tenantId: ctx.tenantId, status: "ACTIVE" },
    });
  });
}

export type PiPredictabilityPoint = {
  id: string;
  label: string;
  ppmPct: number;
};

// Last closed PIs' Program Predictability Measure (PIPlan.ppm), oldest→newest —
// the real SAFe PI predictability trend, only defined once a PI is closed.
export async function listRecentPiPredictability(): Promise<
  Result<PiPredictabilityPoint[]>
> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const rows = await database.pIPlan.findMany({
      where: {
        tenantId: ctx.tenantId,
        status: "CLOSED",
        ppm: { not: null },
        // Postgres sorts NULLs first on DESC — a null endDate would hijack
        // the "most recent" slot ahead of genuinely newer PIs. A closed PI
        // without an endDate also has no well-defined position in a
        // "recent" trend, so exclude it rather than guess an ordering.
        endDate: { not: null },
      },
      orderBy: { endDate: "desc" },
      take: 6,
      select: { id: true, name: true, ppm: true },
    });
    return rows
      .map((p) => ({
        id: p.id,
        label: p.name,
        ppmPct: Math.round(p.ppm as number),
      }))
      .reverse();
  });
}
