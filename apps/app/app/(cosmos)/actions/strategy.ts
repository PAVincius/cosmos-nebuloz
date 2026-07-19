"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { type Result, safeAction } from "../../actions/_base";

export type PillarView = {
  id: string;
  name: string;
  tone: string;
  themes: {
    id: string;
    title: string;
    healthStatus: string;
    targetAllocationPct: number | null;
  }[];
};

export async function listStrategyPillars(): Promise<Result<PillarView[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const rows = await database.strategyPillar.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { order: "asc" },
      select: {
        id: true,
        name: true,
        tone: true,
        themes: {
          select: {
            id: true,
            title: true,
            healthStatus: true,
            targetAllocationPct: true,
          },
        },
      },
    });
    return rows;
  });
}
