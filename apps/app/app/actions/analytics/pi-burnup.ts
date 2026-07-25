"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { err, ok, type Result } from "../_base";

export type BurnupPoint = {
  sprintName: string;
  teamName: string;
  startDate: string;
  plannedCumulative: number;
  actualCumulative: number;
  planned: number;
  actual: number;
};

export type PIBurnupData = {
  points: BurnupPoint[];
  totalPlanned: number;
  totalActual: number;
  piName: string;
};

export async function getPIBurnupData(
  piPlanId: string
): Promise<Result<PIBurnupData>> {
  try {
    const ctx = await requireTenantSession(await headers());

    const piPlan = await database.pIPlan.findFirst({
      where: { id: piPlanId, tenantId: ctx.tenantId },
      select: { id: true, name: true },
    });
    if (!piPlan) {
      return err("PI Plan não encontrado");
    }

    const teams = await database.team.findMany({
      where: { tenantId: ctx.tenantId },
      select: { id: true, name: true },
    });
    const teamById = new Map(teams.map((t) => [t.id, t.name]));

    const sprints = await database.sprint.findMany({
      where: { piPlanId, tenantId: ctx.tenantId, isIPSprint: false },
      orderBy: { startDate: "asc" },
      select: {
        id: true,
        name: true,
        teamId: true,
        startDate: true,
        capacity: true,
        velocity: true,
      },
    });

    // Accumulate totals
    let plannedCumulative = 0;
    let actualCumulative = 0;

    const points: BurnupPoint[] = sprints.map((s) => {
      const planned = s.capacity ?? 0;
      const actual = s.velocity ?? 0;
      plannedCumulative += planned;
      actualCumulative += actual;
      return {
        sprintName: s.name,
        teamName: teamById.get(s.teamId) ?? s.teamId,
        startDate: s.startDate.toISOString().slice(0, 10),
        planned,
        actual,
        plannedCumulative,
        actualCumulative,
      };
    });

    return ok({
      points,
      totalPlanned: plannedCumulative,
      totalActual: actualCumulative,
      piName: piPlan.name,
    });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Erro ao carregar burnup");
  }
}
