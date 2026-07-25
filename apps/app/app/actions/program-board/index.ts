"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { z } from "zod";
import { err, ok, type Result } from "../_base";

import type {
  ProgramBoardCell,
  ProgramBoardData,
  ProgramBoardDependency,
} from "./schema";

const SaveBoardLayoutSchema = z.object({
  piPlanId: z.string().min(1),
  placements: z.array(
    z.object({
      featureId: z.string(),
      teamId: z.string(),
      sprintIndex: z.number().int().min(0),
    })
  ),
});

export async function saveProgramBoardLayout(
  raw: unknown
): Promise<Result<{ saved: number }>> {
  try {
    const ctx = await requireTenantSession(await headers());
    const { piPlanId, placements } = SaveBoardLayoutSchema.parse(raw);

    await Promise.all(
      placements.map((p) =>
        database.pIPlanFeatureAssignment.upsert({
          where: { piPlanId_featureId: { piPlanId, featureId: p.featureId } },
          create: {
            tenantId: ctx.tenantId,
            piPlanId,
            featureId: p.featureId,
            teamId: p.teamId,
            sprintId: String(p.sprintIndex),
            rank: 0,
            updatedAt: new Date(),
            updatedBy: ctx.userId,
          },
          update: {
            teamId: p.teamId,
            sprintId: String(p.sprintIndex),
            updatedAt: new Date(),
            updatedBy: ctx.userId,
          },
        })
      )
    );

    return ok({ saved: placements.length });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Erro ao salvar layout");
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildSprints(cadence: number | null): string[] {
  const count = Math.min(Math.max(Math.floor((cadence ?? 10) / 2), 4), 5);
  const list = Array.from({ length: count }, (_, i) => `Sprint ${i + 1}`);
  list.push("IP Sprint");
  return list;
}

function buildUserToTeamIndex(
  features: { assigneeUserId: string | null }[],
  teamList: { id: string }[]
): Map<string, number> {
  const map = new Map<string, number>();
  let counter = 0;
  for (const f of features) {
    if (f.assigneeUserId && !map.has(f.assigneeUserId)) {
      map.set(f.assigneeUserId, counter % teamList.length);
      counter += 1;
    }
  }
  return map;
}

function initMatrix(
  teamList: { id: string }[],
  sprints: string[]
): ProgramBoardCell[] {
  const matrix: ProgramBoardCell[] = [];
  for (const team of teamList) {
    for (let si = 0; si < sprints.length; si++) {
      matrix.push({ teamId: team.id, sprintIndex: si, features: [] });
    }
  }
  return matrix;
}

type FeatureRecord = {
  id: string;
  title: string;
  statusId: string;
  storyPoints: number;
  wsjfScore: number;
  assigneeUserId: string | null;
  epicId: string | null;
  externalSource: string | null;
  externalUrl: string | null;
  epic: { title: string } | null;
};

type PlacementContext = {
  matrix: ProgramBoardCell[];
  userToTeamIndex: Map<string, number>;
  teamList: { id: string }[];
  sprints: string[];
};

function placeFeatures(features: FeatureRecord[], ctx: PlacementContext): void {
  const { matrix, userToTeamIndex, teamList, sprints } = ctx;
  const teamSprintCounter = new Map<string, number>();
  for (const team of teamList) {
    teamSprintCounter.set(team.id, 0);
  }

  for (const feature of features) {
    let teamId = teamList[0].id;
    if (feature.assigneeUserId) {
      const idx = userToTeamIndex.get(feature.assigneeUserId) ?? 0;
      teamId = teamList[idx]?.id ?? teamList[0].id;
    }
    const currentSprint =
      (teamSprintCounter.get(teamId) ?? 0) % (sprints.length - 1);
    teamSprintCounter.set(teamId, currentSprint + 1);

    const cell = matrix.find(
      (c) => c.teamId === teamId && c.sprintIndex === currentSprint
    );
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
        externalSource: feature.externalSource ?? null,
        externalUrl: feature.externalUrl ?? null,
      });
    }
  }
}

function buildDependencies(
  rawDeps: {
    id: string;
    blockingFeatureId: string;
    blockedFeatureId: string;
    status: string;
    severity: string;
    blockingFeature: { title: string };
    blockedFeature: { title: string };
  }[],
  featurePlacement: Map<string, { teamId: string; sprintIndex: number }>
): ProgramBoardDependency[] {
  return rawDeps.map((dep) => {
    const bp = featurePlacement.get(dep.blockingFeatureId);
    const blp = featurePlacement.get(dep.blockedFeatureId);
    return {
      id: dep.id,
      blockingFeatureId: dep.blockingFeatureId,
      blockedFeatureId: dep.blockedFeatureId,
      blockingFeatureTitle: dep.blockingFeature.title,
      blockedFeatureTitle: dep.blockedFeature.title,
      status: dep.status,
      severity: dep.severity,
      isConflict: !!bp && !!blp && bp.sprintIndex >= blp.sprintIndex,
    };
  });
}

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

  const [art, piPlan, teams, features, rawDeps] = await Promise.all([
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
    database.dependencyLink.findMany({
      where: {
        tenantId: ctx.tenantId,
        blockingFeature: { piPlanId },
      },
      select: {
        id: true,
        blockingFeatureId: true,
        blockedFeatureId: true,
        status: true,
        severity: true,
        blockingFeature: { select: { title: true } },
        blockedFeature: { select: { title: true } },
      },
    }),
  ]);

  if (!(art && piPlan)) {
    return {
      teams: [],
      sprints: [],
      matrix: [],
      piPlan: null,
      dependencies: [],
    };
  }

  const sprints = buildSprints(art.cadence ?? null);
  const teamList =
    teams.length > 0
      ? teams
      : [{ id: "unassigned", name: "Sem time", velocity: null }];
  const userToTeamIndex = buildUserToTeamIndex(features, teamList);
  const matrix = initMatrix(teamList, sprints);
  placeFeatures(features, { matrix, userToTeamIndex, teamList, sprints });

  // Overwrite round-robin positions with any saved board layout
  const savedAssignments = await database.pIPlanFeatureAssignment.findMany({
    where: { piPlanId, tenantId: ctx.tenantId },
    select: { featureId: true, teamId: true, sprintId: true },
  });
  if (savedAssignments.length > 0) {
    const savedMap = new Map(
      savedAssignments.map((a) => [
        a.featureId,
        { teamId: a.teamId, sprintIndex: Number.parseInt(a.sprintId, 10) },
      ])
    );
    // Remove features with saved positions from their round-robin cells
    for (const cell of matrix) {
      cell.features = cell.features.filter((f) => !savedMap.has(f.id));
    }
    // Place features in their saved positions
    for (const feature of features) {
      const saved = savedMap.get(feature.id);
      if (!saved) {
        continue;
      }
      const cell = matrix.find(
        (c) => c.teamId === saved.teamId && c.sprintIndex === saved.sprintIndex
      );
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
          externalSource: feature.externalSource ?? null,
          externalUrl: feature.externalUrl ?? null,
        });
      }
    }
  }

  const featurePlacement = new Map<
    string,
    { teamId: string; sprintIndex: number }
  >();
  for (const cell of matrix) {
    for (const f of cell.features) {
      featurePlacement.set(f.id, {
        teamId: cell.teamId,
        sprintIndex: cell.sprintIndex,
      });
    }
  }

  return {
    teams: teamList,
    sprints,
    matrix,
    piPlan,
    dependencies: buildDependencies(rawDeps, featurePlacement),
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
