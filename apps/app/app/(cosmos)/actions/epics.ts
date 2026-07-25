"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { type Result, safeAction } from "../../actions/_base";

export type EpicDetail = {
  id: string;
  title: string;
  lifecycleStatus: string;
  wsjf: number | null;
  sizePoints: number | null;
  investScore: number | null;
  investBreakdown: Record<string, { score: number; rationale: string }> | null;
  hypothesis: string | null;
  descriptionMd: string | null;
  features: {
    id: string;
    title: string;
    wsjfScore: number;
    progressPct: number;
  }[];
};

export async function getEpic(id: string): Promise<Result<EpicDetail | null>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const epic = await database.epic.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: {
        id: true,
        title: true,
        lifecycleStatus: true,
        wsjf: true,
        sizePoints: true,
        investScore: true,
        investBreakdown: true,
        hypothesis: true,
        descriptionMd: true,
        features: {
          select: {
            id: true,
            title: true,
            wsjfScore: true,
            progressPct: true,
          },
          orderBy: { wsjfScore: "desc" },
        },
      },
    });
    if (!epic) {
      return null;
    }
    return {
      ...epic,
      investBreakdown:
        epic.investBreakdown &&
        typeof epic.investBreakdown === "object" &&
        !Array.isArray(epic.investBreakdown)
          ? (epic.investBreakdown as Record<
              string,
              { score: number; rationale: string }
            >)
          : null,
    };
  });
}

export type FeatureTaskView = {
  id: string;
  title: string;
  status: string;
};

export type FeatureStoryView = {
  id: string;
  title: string;
  status: string;
  storyPoints: number;
  tasks: FeatureTaskView[];
};

export type FeatureDetail = {
  id: string;
  title: string;
  statusId: string;
  bv: number;
  tc: number;
  rr: number;
  js: number;
  wsjfScore: number;
  storyPoints: number;
  progressPct: number;
  acceptanceCriteria: string[];
  epicId: string | null;
  epicTitle: string | null;
  stories: FeatureStoryView[];
  // Prev/next within the epic, ordered the same way getEpic() lists
  // features (wsjfScore desc) — null at either end, or when the feature
  // has no epic to order siblings within.
  prevFeatureId: string | null;
  nextFeatureId: string | null;
};

export async function getFeature(
  id: string
): Promise<Result<FeatureDetail | null>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const feature = await database.feature.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: {
        id: true,
        title: true,
        statusId: true,
        bv: true,
        tc: true,
        rr: true,
        js: true,
        wsjfScore: true,
        storyPoints: true,
        progressPct: true,
        acceptanceCriteria: true,
        epicId: true,
        epic: { select: { title: true } },
        stories: {
          select: {
            id: true,
            title: true,
            status: true,
            storyPoints: true,
            tasks: {
              select: { id: true, title: true, status: true },
              orderBy: { createdAt: "asc" },
            },
          },
          orderBy: { order: "asc" },
        },
      },
    });
    if (!feature) {
      return null;
    }

    let prevFeatureId: string | null = null;
    let nextFeatureId: string | null = null;
    if (feature.epicId) {
      const siblings = await database.feature.findMany({
        where: { epicId: feature.epicId, tenantId: ctx.tenantId },
        select: { id: true },
        orderBy: { wsjfScore: "desc" },
      });
      const idx = siblings.findIndex((s) => s.id === feature.id);
      if (idx > 0) {
        prevFeatureId = siblings[idx - 1].id;
      }
      if (idx >= 0 && idx < siblings.length - 1) {
        nextFeatureId = siblings[idx + 1].id;
      }
    }

    return {
      id: feature.id,
      title: feature.title,
      statusId: feature.statusId,
      bv: feature.bv,
      tc: feature.tc,
      rr: feature.rr,
      js: feature.js,
      wsjfScore: feature.wsjfScore,
      storyPoints: feature.storyPoints,
      progressPct: feature.progressPct,
      acceptanceCriteria: Array.isArray(feature.acceptanceCriteria)
        ? (feature.acceptanceCriteria as string[])
        : [],
      epicId: feature.epicId,
      epicTitle: feature.epic?.title ?? null,
      stories: feature.stories.map((s) => ({
        id: s.id,
        title: s.title,
        status: s.status,
        storyPoints: s.storyPoints,
        tasks: s.tasks,
      })),
      prevFeatureId,
      nextFeatureId,
    };
  });
}
