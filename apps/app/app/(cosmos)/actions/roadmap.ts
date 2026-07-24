"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { type Result, safeAction } from "../../actions/_base";

export type RoadmapItemView = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  color: string;
  status: string;
  milestone: boolean;
  artId: string | null;
  // Resolved tenant-scoped ART name for the Gantt lane label. RoadmapItem.artId
  // is a plain app-layer string, not a Prisma relation (same precedent as
  // RoadmapItem.epicId — see EpicValueMetric's comment in portfolio.prisma),
  // so it is re-scoped against the tenant's own ARTs below rather than
  // trusted as-is: an artId that doesn't resolve to one of this tenant's ARTs
  // (data-integrity bug, or a stale/foreign id) yields null, never another
  // tenant's ART name.
  artName: string | null;
};

export async function listRoadmapItems(): Promise<Result<RoadmapItemView[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const rows = await database.roadmapItem.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { startDate: "asc" },
      select: {
        id: true,
        title: true,
        startDate: true,
        endDate: true,
        color: true,
        status: true,
        milestone: true,
        artId: true,
      },
    });

    const artIds = [
      ...new Set(rows.map((r) => r.artId).filter((id): id is string => !!id)),
    ];
    const arts =
      artIds.length > 0
        ? await database.aRT.findMany({
            where: { id: { in: artIds }, tenantId: ctx.tenantId },
            select: { id: true, name: true },
          })
        : [];
    const artNameById = new Map(arts.map((a) => [a.id, a.name]));

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      color: r.color,
      status: r.status,
      milestone: r.milestone,
      artId: r.artId,
      artName: r.artId ? (artNameById.get(r.artId) ?? null) : null,
      startDate: r.startDate.toISOString(),
      endDate: r.endDate.toISOString(),
    }));
  });
}
