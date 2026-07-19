"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { type Result, safeAction } from "../../actions/_base";

export type CapacityView = {
  teamId: string;
  teamName: string;
  velocity: number | null;
  expectedSp: number | null;
  actualSp: number | null;
  utilizationPct: number | null;
};

export async function listTeamCapacity(): Promise<Result<CapacityView[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const teams = await database.team.findMany({
      where: { tenantId: ctx.tenantId },
      select: { id: true, name: true, velocity: true },
    });
    if (teams.length === 0) {
      return [];
    }

    const teamIds = teams.map((t) => t.id);
    const snapshots = await database.teamCapacitySnapshot.findMany({
      where: { tenantId: ctx.tenantId, teamId: { in: teamIds } },
      orderBy: { recordedAt: "desc" },
      select: {
        teamId: true,
        expectedSpNextSprint: true,
        actualSpDelivered: true,
        actualCapacityUtil: true,
        recordedAt: true,
      },
    });

    const latestByTeam = new Map<string, (typeof snapshots)[number]>();
    for (const s of snapshots) {
      if (!latestByTeam.has(s.teamId)) {
        latestByTeam.set(s.teamId, s);
      }
    }

    return teams.map((t) => {
      const snap = latestByTeam.get(t.id);
      return {
        teamId: t.id,
        teamName: t.name,
        velocity: t.velocity,
        expectedSp: snap?.expectedSpNextSprint ?? null,
        actualSp: snap?.actualSpDelivered ?? null,
        utilizationPct: snap ? Math.round(snap.actualCapacityUtil * 100) : null,
      };
    });
  });
}
