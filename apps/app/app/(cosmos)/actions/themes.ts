"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { type Result, safeAction } from "../../actions/_base";

export type ThemeView = {
  id: string;
  title: string;
  description: string | null;
  color: string;
  healthStatus: string;
  targetAllocationPct: number | null;
  horizon: string | null;
  epicCount: number;
  avgProgress: number;
};

export async function listThemes(): Promise<Result<ThemeView[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const rows = await database.strategicTheme.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { order: "asc" },
      select: {
        id: true,
        title: true,
        description: true,
        color: true,
        healthStatus: true,
        // Simplification (Tier 1, documented): targetAllocationPct is used
        // as-is; a real "current allocation" aggregate is not yet materialized.
        targetAllocationPct: true,
        horizon: true,
        epics: { select: { featureCount: true, doneFeatureCount: true } },
      },
    });

    return rows.map((t) => {
      const withFeatures = t.epics.filter((e) => e.featureCount > 0);
      const avgProgress = withFeatures.length
        ? Math.round(
            withFeatures.reduce(
              (s, e) => s + (e.doneFeatureCount / e.featureCount) * 100,
              0
            ) / withFeatures.length
          )
        : 0;
      return {
        id: t.id,
        title: t.title,
        description: t.description,
        color: t.color,
        healthStatus: t.healthStatus,
        targetAllocationPct: t.targetAllocationPct,
        horizon: t.horizon,
        epicCount: t.epics.length,
        avgProgress,
      };
    });
  });
}
