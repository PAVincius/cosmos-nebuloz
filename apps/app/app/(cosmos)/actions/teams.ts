"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { type Result, safeAction } from "../../actions/_base";

export type TeamListView = {
  id: string;
  name: string;
  focusArea: string | null;
  color: string | null;
  wip: number;
  velocity: number | null;
  memberCount: number;
};

export type TeamDetailView = {
  id: string;
  name: string;
  focusArea: string | null;
  velocity: number | null;
  wip: number;
  members: { name: string; role: string }[];
  recentCapacity: { period: string; expectedSp: number; actualSp: number }[];
};

function parseMembers(json: unknown): { name: string; role: string }[] {
  if (!Array.isArray(json)) {
    return [];
  }
  return json
    .filter(
      (m): m is { name?: unknown; role?: unknown } =>
        typeof m === "object" && m !== null
    )
    .map((m) => ({
      name: typeof m.name === "string" ? m.name : "—",
      role: typeof m.role === "string" ? m.role : "—",
    }));
}

export async function listTeams(): Promise<Result<TeamListView[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const rows = await database.team.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        focusArea: true,
        color: true,
        wip: true,
        velocity: true,
        members: true,
      },
    });
    return rows.map((t) => ({
      id: t.id,
      name: t.name,
      focusArea: t.focusArea,
      color: t.color,
      wip: t.wip,
      velocity: t.velocity,
      memberCount: Array.isArray(t.members) ? t.members.length : 0,
    }));
  });
}

export async function getTeam(
  id: string
): Promise<Result<TeamDetailView | null>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const team = await database.team.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: {
        id: true,
        name: true,
        focusArea: true,
        velocity: true,
        wip: true,
        members: true,
      },
    });
    if (!team) {
      return null;
    }

    const snapshots = await database.teamCapacitySnapshot.findMany({
      where: { teamId: team.id, tenantId: ctx.tenantId },
      orderBy: { recordedAt: "desc" },
      take: 5,
      select: {
        recordedAt: true,
        expectedSpNextSprint: true,
        actualSpDelivered: true,
      },
    });

    return {
      id: team.id,
      name: team.name,
      focusArea: team.focusArea,
      velocity: team.velocity,
      wip: team.wip,
      members: parseMembers(team.members),
      recentCapacity: snapshots.map((s) => ({
        period: s.recordedAt.toISOString().slice(0, 10),
        expectedSp: s.expectedSpNextSprint,
        actualSp: s.actualSpDelivered,
      })),
    };
  });
}
