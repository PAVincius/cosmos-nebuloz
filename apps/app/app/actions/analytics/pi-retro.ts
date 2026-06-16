"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { err, ok, type Result } from "../_base";

export type PIRetroObjective = {
  id: string;
  title: string;
  status: string;
  businessValue: number | null;
  isStretch: boolean;
};

export type PIRetroSprint = {
  id: string;
  name: string;
  capacity: number | null;
  velocity: number | null;
  teamName: string;
};

export type PIRetroRisk = {
  id: string;
  title: string;
  status: string;
  category: string | null;
};

export type PIRetroImpediment = {
  id: string;
  title: string;
  status: string;
};

export type PIRetroReport = {
  piPlan: {
    id: string;
    name: string;
    startDate: Date | null;
    endDate: Date | null;
    artName: string;
  };
  objectives: PIRetroObjective[];
  sprints: PIRetroSprint[];
  risks: PIRetroRisk[];
  impediments: PIRetroImpediment[];
  summary: {
    objectivesAchieved: number;
    objectivesTotal: number;
    risksTotal: number;
    risksMitigated: number;
    plannedPoints: number;
    actualPoints: number;
    impedimentsResolved: number;
    impedimentsTotal: number;
  };
};

export async function generatePIRetroReport(
  piPlanId: string
): Promise<Result<PIRetroReport>> {
  try {
    const ctx = await requireTenantSession(await headers());

    const piPlan = await database.pIPlan.findFirst({
      where: { id: piPlanId, tenantId: ctx.tenantId },
      include: { art: { select: { id: true, name: true } } },
    });
    if (!piPlan) {
      return err("PI Plan não encontrado");
    }

    const artId = piPlan.artId;

    const [objectives, risks, impediments, teams] = await Promise.all([
      database.pIObjective.findMany({
        where: { piPlanId, tenantId: ctx.tenantId },
        select: {
          id: true,
          title: true,
          status: true,
          businessValue: true,
          isStretch: true,
        },
      }),
      database.risk.findMany({
        where: { piPlanId, tenantId: ctx.tenantId },
        select: { id: true, title: true, status: true, category: true },
      }),
      database.impediment.findMany({
        where: { artId, tenantId: ctx.tenantId },
        select: { id: true, title: true, status: true },
        take: 20,
        orderBy: { createdAt: "desc" },
      }),
      database.team.findMany({
        where: { artId, tenantId: ctx.tenantId },
        select: { id: true, name: true },
      }),
    ]);

    // Fetch sprints for each team linked to this PI plan
    const teamIds = teams.map((t) => t.id);
    const teamById = new Map(teams.map((t) => [t.id, t]));
    const sprintRows = teamIds.length
      ? await database.sprint.findMany({
          where: {
            tenantId: ctx.tenantId,
            teamId: { in: teamIds },
            piPlanId,
          },
          select: {
            id: true,
            name: true,
            teamId: true,
            capacity: true,
            velocity: true,
          },
        })
      : [];

    const sprints: PIRetroSprint[] = sprintRows.map((s) => ({
      id: s.id,
      name: s.name,
      capacity: s.capacity,
      velocity: s.velocity,
      teamName: teamById.get(s.teamId)?.name ?? s.teamId,
    }));

    const objectivesAchieved = objectives.filter(
      (o) => o.status === "ACHIEVED"
    ).length;
    const risksMitigated = risks.filter((r) => r.status === "MITIGATED").length;
    const plannedPoints = sprints.reduce((s, sp) => s + (sp.capacity ?? 0), 0);
    const actualPoints = sprints.reduce((s, sp) => s + (sp.velocity ?? 0), 0);
    const impedimentsResolved = impediments.filter(
      (i) => i.status === "RESOLVED"
    ).length;

    return ok({
      piPlan: {
        id: piPlan.id,
        name: piPlan.name,
        startDate: piPlan.startDate,
        endDate: piPlan.endDate,
        artName: piPlan.art?.name ?? "—",
      },
      objectives: objectives.map((o) => ({
        ...o,
        status: o.status ?? "PLANNED",
      })),
      sprints,
      risks,
      impediments,
      summary: {
        objectivesAchieved,
        objectivesTotal: objectives.length,
        risksTotal: risks.length,
        risksMitigated,
        plannedPoints,
        actualPoints,
        impedimentsResolved,
        impedimentsTotal: impediments.length,
      },
    });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Erro ao gerar retrospectiva");
  }
}
