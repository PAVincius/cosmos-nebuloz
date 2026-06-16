"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { err, ok, type Result } from "../_base";

export type CycleTimePoint = {
  storyId: string;
  title: string;
  completedAt: string; // ISO date
  cycleTimeDays: number;
  storyPoints: number;
};

export type CycleTimeData = {
  points: CycleTimePoint[];
  p50: number;
  p85: number;
};

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

export async function getCycleTimeData(
  teamId?: string
): Promise<Result<CycleTimeData>> {
  try {
    const ctx = await requireTenantSession(await headers());

    const stories = await database.story.findMany({
      where: {
        tenantId: ctx.tenantId,
        ...(teamId ? { sprint: { teamId } } : {}),
        startedAt: { not: null },
        completedAt: { not: null },
        status: "DONE",
      },
      select: {
        id: true,
        title: true,
        startedAt: true,
        completedAt: true,
        storyPoints: true,
      },
      orderBy: { completedAt: "desc" },
      take: 200,
    });

    const points: CycleTimePoint[] = stories
      .filter((s) => s.startedAt && s.completedAt)
      .map((s) => {
        const ms =
          (s.completedAt as Date).getTime() - (s.startedAt as Date).getTime();
        const days = Math.max(0, ms / (1000 * 60 * 60 * 24));
        return {
          storyId: s.id,
          title: s.title,
          completedAt: (s.completedAt as Date).toISOString().slice(0, 10),
          cycleTimeDays: Math.round(days * 10) / 10,
          storyPoints: s.storyPoints,
        };
      });

    const sorted = [...points]
      .map((p) => p.cycleTimeDays)
      .sort((a, b) => a - b);

    return ok({
      points,
      p50: percentile(sorted, 50),
      p85: percentile(sorted, 85),
    });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Erro ao carregar cycle time");
  }
}
