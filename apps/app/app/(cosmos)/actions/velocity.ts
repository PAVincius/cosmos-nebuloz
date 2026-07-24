"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { type Result, safeAction } from "../../actions/_base";

export type SprintView = {
  id: string;
  name: string;
  capacity: number | null;
  velocity: number | null;
  sayDoRatioPct: number | null;
};

export async function listRecentSprints(): Promise<Result<SprintView[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const rows = await database.sprint.findMany({
      where: { tenantId: ctx.tenantId, status: "CLOSED" },
      orderBy: { endDate: "desc" },
      take: 8,
      select: { id: true, name: true, capacity: true, velocity: true },
    });
    return rows.map((s) => ({
      id: s.id,
      name: s.name,
      capacity: s.capacity,
      velocity: s.velocity,
      sayDoRatioPct:
        s.capacity != null && s.capacity > 0 && s.velocity != null
          ? Math.round((s.velocity / s.capacity) * 100)
          : null,
    }));
  });
}

export type TeamPredictabilityView = {
  teamId: string;
  teamName: string;
  predictabilityPct: number;
  sprintCount: number;
};

// Per-team predictability (avg say-do ratio across closed sprints with both
// capacity and velocity recorded), tenant-scoped. Sorted best-first so the
// screen can show top teams without re-sorting.
export async function listTeamPredictability(): Promise<
  Result<TeamPredictabilityView[]>
> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const rows = await database.sprint.findMany({
      where: {
        tenantId: ctx.tenantId,
        status: "CLOSED",
        capacity: { not: null },
        velocity: { not: null },
      },
      select: {
        teamId: true,
        capacity: true,
        velocity: true,
        team: { select: { name: true } },
      },
    });

    const byTeam = new Map<string, { name: string; ratios: number[] }>();
    for (const s of rows) {
      if (s.capacity == null || s.capacity <= 0 || s.velocity == null) {
        continue;
      }
      const entry = byTeam.get(s.teamId) ?? {
        name: s.team.name,
        ratios: [],
      };
      entry.ratios.push((s.velocity / s.capacity) * 100);
      byTeam.set(s.teamId, entry);
    }

    return Array.from(byTeam.entries())
      .map(([teamId, { name, ratios }]) => ({
        teamId,
        teamName: name,
        predictabilityPct: Math.round(
          ratios.reduce((a, b) => a + b, 0) / ratios.length
        ),
        sprintCount: ratios.length,
      }))
      .sort((a, b) => b.predictabilityPct - a.predictabilityPct);
  });
}
