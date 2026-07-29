"use server";

import { requireRole, requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { type Result, safeAction } from "../../actions/_base";
import { logAudit } from "../../actions/audit/log-audit";

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
  // Rollup through themes[].epics — same aggregation getStrategyPillar()
  // computes for a single pillar, applied here to every pillar in the list.
  epicCount: number;
  avgProgress: number;
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
            epics: { select: { featureCount: true, doneFeatureCount: true } },
          },
        },
      },
    });

    return rows.map((p) => {
      const epics = p.themes.flatMap((t) => t.epics);
      const withFeatures = epics.filter((e) => e.featureCount > 0);
      const avgProgress = withFeatures.length
        ? Math.round(
            withFeatures.reduce(
              (s, e) => s + (e.doneFeatureCount / e.featureCount) * 100,
              0
            ) / withFeatures.length
          )
        : 0;
      return {
        id: p.id,
        name: p.name,
        tone: p.tone,
        themes: p.themes.map((t) => ({
          id: t.id,
          title: t.title,
          healthStatus: t.healthStatus,
          targetAllocationPct: t.targetAllocationPct,
        })),
        epicCount: epics.length,
        avgProgress,
      };
    });
  });
}

export type PillarDetailView = {
  id: string;
  name: string;
  tone: string;
  themes: {
    id: string;
    title: string;
    healthStatus: string;
    targetAllocationPct: number | null;
    epicCount: number;
    avgProgress: number;
  }[];
  epics: {
    id: string;
    title: string;
    themeTitle: string;
    wsjf: number | null;
    progressPct: number;
  }[];
  epicCount: number;
  doneEpicCount: number;
  avgProgress: number;
};

export async function getStrategyPillar(
  id: string
): Promise<Result<PillarDetailView>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const pillar = await database.strategyPillar.findFirst({
      where: { id, tenantId: ctx.tenantId },
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
            epics: {
              select: {
                id: true,
                title: true,
                wsjf: true,
                featureCount: true,
                doneFeatureCount: true,
              },
            },
          },
        },
      },
    });

    if (!pillar) {
      throw new Error("Pilar estratégico não encontrado.");
    }

    const avgProgressOf = (
      epics: { featureCount: number; doneFeatureCount: number }[]
    ) => {
      const withFeatures = epics.filter((e) => e.featureCount > 0);
      return withFeatures.length
        ? Math.round(
            withFeatures.reduce(
              (s, e) => s + (e.doneFeatureCount / e.featureCount) * 100,
              0
            ) / withFeatures.length
          )
        : 0;
    };

    const themes = pillar.themes.map((t) => ({
      id: t.id,
      title: t.title,
      healthStatus: t.healthStatus,
      targetAllocationPct: t.targetAllocationPct,
      epicCount: t.epics.length,
      avgProgress: avgProgressOf(t.epics),
    }));

    const rawEpics = pillar.themes.flatMap((t) =>
      t.epics.map((e) => ({ ...e, themeTitle: t.title }))
    );
    const epics = rawEpics.map((e) => ({
      id: e.id,
      title: e.title,
      themeTitle: e.themeTitle,
      wsjf: e.wsjf,
      progressPct:
        e.featureCount > 0
          ? Math.round((e.doneFeatureCount / e.featureCount) * 100)
          : 0,
    }));

    return {
      id: pillar.id,
      name: pillar.name,
      tone: pillar.tone,
      themes,
      epics,
      epicCount: epics.length,
      doneEpicCount: epics.filter((e) => e.progressPct === 100).length,
      avgProgress: avgProgressOf(rawEpics),
    };
  });
}

const CreatePillarSchema = z.object({
  name: z.string().min(1).max(200),
  tone: z.string().min(1).max(40).optional(),
});

export async function createPillar(
  input: z.input<typeof CreatePillarSchema>
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN", "STE"], ctx);
    const { name, tone } = CreatePillarSchema.parse(input);

    const created = await database.strategyPillar.create({
      data: {
        tenantId: ctx.tenantId,
        name,
        tone: tone ?? "accent",
      },
      select: { id: true },
    });

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "created",
      entityType: "pillar",
      entityId: created.id,
      diff: { name },
    });
    revalidateTag(`strategy:${ctx.tenantId}`, "max");
    return { id: created.id };
  });
}
