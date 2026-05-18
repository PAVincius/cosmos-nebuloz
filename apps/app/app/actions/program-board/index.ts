"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import type { ProgramBoardFeature, ProgramBoardCell, ProgramBoardData } from "./schema";

export type { ProgramBoardFeature, ProgramBoardCell, ProgramBoardData };

/**
 * Build the Program Board matrix.
 *
 * Since features don't have a sprintIndex or teamId in the schema, this action
 * derives a best-effort layout:
 * - Sprints are generated from the PI cadence (ART.cadence weeks / 2 = number
 *   of 2-week iterations, minimum 5 sprints). Last sprint is always "IP Sprint".
 * - Features are distributed across teams in a round-robin by assigneeUserId.
 *   Features with no assignee are grouped under the first team (or "Sem time").
 * - Sprint allocation is round-robin across the sprint set per team.
 *
 * This structure lets the UI display a meaningful board without requiring extra
 * schema fields. Future iterations can add a sprintIndex / teamId column.
 */
export async function getProgramBoardData(
  artId: string,
  piPlanId: string
): Promise<ProgramBoardData> {
  const ctx = await requireTenantSession(await headers());

  const [art, piPlan, teams, features] = await Promise.all([
    database.aRT.findFirst({
      where: { id: artId, tenantId: ctx.tenantId },
      select: { id: true, name: true, cadence: true },
    }),
    database.pIPlan.findFirst({
      where: { id: piPlanId, tenantId: ctx.tenantId, artId },
      select: { id: true, name: true, startDate: true, endDate: true },
    }),
    database.team.findMany({
      where: { artId, tenantId: ctx.tenantId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, velocity: true },
    }),
    database.feature.findMany({
      where: { piPlanId, tenantId: ctx.tenantId },
      orderBy: { wsjfScore: "desc" },
      include: { epic: { select: { id: true, title: true } } },
    }),
  ]);

  if (!art || !piPlan) {
    return { teams: [], sprints: [], matrix: [], piPlan: null };
  }

  // Derive sprint count: cadence in weeks / 2 rounds gives iteration count,
  // capped at 5 planning sprints + 1 IP sprint = 6 total.
  const iterationCount = Math.min(Math.max(Math.floor((art.cadence ?? 10) / 2), 4), 5);
  const sprints: string[] = Array.from({ length: iterationCount }, (_, i) => `Sprint ${i + 1}`);
  sprints.push("IP Sprint");

  // Map each team to a row. If no teams exist, create a virtual "Sem time" row.
  const teamList =
    teams.length > 0 ? teams : [{ id: "unassigned", name: "Sem time", velocity: null }];

  // Build assigneeUserId → teamIndex mapping (round-robin by user).
  const userToTeamIndex = new Map<string, number>();
  let userCounter = 0;

  for (const feature of features) {
    if (feature.assigneeUserId && !userToTeamIndex.has(feature.assigneeUserId)) {
      userToTeamIndex.set(feature.assigneeUserId, userCounter % teamList.length);
      userCounter++;
    }
  }

  // Build sprint counter per team to distribute features across sprints.
  const teamSprintCounter = new Map<string, number>();

  const matrix: ProgramBoardCell[] = [];

  // Pre-populate all cells.
  for (const team of teamList) {
    for (let si = 0; si < sprints.length; si++) {
      matrix.push({ teamId: team.id, sprintIndex: si, features: [] });
    }
    teamSprintCounter.set(team.id, 0);
  }

  function getCell(teamId: string, sprintIndex: number): ProgramBoardCell | undefined {
    return matrix.find((c) => c.teamId === teamId && c.sprintIndex === sprintIndex);
  }

  for (const feature of features) {
    // Determine which team this feature belongs to.
    let teamId = teamList[0].id;
    if (feature.assigneeUserId) {
      const idx = userToTeamIndex.get(feature.assigneeUserId) ?? 0;
      teamId = teamList[idx]?.id ?? teamList[0].id;
    }

    // Allocate to next available sprint for this team (excluding IP Sprint for
    // now; IP Sprint only gets features explicitly designated via statusId in future).
    const currentSprint = (teamSprintCounter.get(teamId) ?? 0) % (sprints.length - 1);
    teamSprintCounter.set(teamId, currentSprint + 1);

    const cell = getCell(teamId, currentSprint);
    if (cell) {
      cell.features.push({
        id: feature.id,
        title: feature.title,
        statusId: feature.statusId,
        storyPoints: feature.storyPoints,
        wsjfScore: feature.wsjfScore,
        assigneeUserId: feature.assigneeUserId,
        epicId: feature.epicId,
        epicTitle: feature.epic?.title ?? null,
      });
    }
  }

  return {
    teams: teamList,
    sprints,
    matrix,
    piPlan,
  };
}

export async function getPIPlansByART(artId: string) {
  const ctx = await requireTenantSession(await headers());
  return database.pIPlan.findMany({
    where: { artId, tenantId: ctx.tenantId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, startDate: true, endDate: true },
  });
}
