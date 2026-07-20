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
