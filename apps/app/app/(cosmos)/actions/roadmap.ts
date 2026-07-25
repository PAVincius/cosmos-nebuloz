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
      },
    });
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      color: r.color,
      status: r.status,
      milestone: r.milestone,
      startDate: r.startDate.toISOString(),
      endDate: r.endDate.toISOString(),
    }));
  });
}
