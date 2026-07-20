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
