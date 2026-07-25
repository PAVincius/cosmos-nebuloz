"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { z } from "zod";
import { type Result, safeAction } from "../_base";

const DEFAULT_CONCENTRATION_THRESHOLD = 0.6;

type ConcentrationAlert = {
  themeId: string;
  title: string;
  epicCount: number;
  percentage: number;
  threshold: number;
};

// ─── checkThemeConcentration ──────────────────────────────────────────────────

const checkThemeConcentrationSchema = z.object({
  threshold: z.number().min(0).max(1).optional(),
});

export async function checkThemeConcentration(raw: unknown): Promise<
  Result<{
    alerts: ConcentrationAlert[];
    totalEpics: number;
  }>
> {
  return safeAction(async () => {
    const { tenantId } = await requireTenantSession(await headers());
    const input = checkThemeConcentrationSchema.parse(raw);
    const threshold = input.threshold ?? DEFAULT_CONCENTRATION_THRESHOLD;

    const themes = await database.strategicTheme.findMany({
      where: { tenantId, status: { not: "ARCHIVED" } },
      select: {
        id: true,
        title: true,
        _count: { select: { epics: true } },
      },
    });

    const totalEpics = themes.reduce((sum, t) => sum + t._count.epics, 0);

    if (totalEpics === 0) {
      return { alerts: [], totalEpics: 0 };
    }

    const alerts: ConcentrationAlert[] = [];
    for (const theme of themes) {
      const percentage = theme._count.epics / totalEpics;
      if (percentage > threshold) {
        alerts.push({
          themeId: theme.id,
          title: theme.title,
          epicCount: theme._count.epics,
          percentage,
          threshold,
        });
      }
    }

    return { alerts, totalEpics };
  });
}
