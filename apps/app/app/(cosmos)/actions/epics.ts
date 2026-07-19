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

export function getEpic(id: string): Promise<Result<EpicDetail | null>> {
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
};

export function getFeature(id: string): Promise<Result<FeatureDetail | null>> {
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
      },
    });
    if (!feature) {
      return null;
    }
    return {
      ...feature,
      acceptanceCriteria: Array.isArray(feature.acceptanceCriteria)
        ? (feature.acceptanceCriteria as string[])
        : [],
    };
  });
}
