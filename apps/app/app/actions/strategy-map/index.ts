"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";

// ─── Public types ─────────────────────────────────────────────────────────────

export type OKRNode = {
  id: string;
  title: string;
  okrType: string;
  status: string;
  progress: number;
  horizon: string | null;
};

export type EpicNode = {
  id: string;
  title: string;
  statusId: string;
  okrs: OKRNode[];
};

export type ThemeNode = {
  id: string;
  title: string;
  code: string | null;
  color: string;
  status: string;
  horizon: string | null;
  progress: number;
  okrs: OKRNode[];
  epics: EpicNode[];
};

export type StrategyMapData = {
  themes: ThemeNode[];
  unlinkedOKRs: OKRNode[];
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

function calcProgress(krs: { current: number; target: number }[]): number {
  if (krs.length === 0) return 0;
  const avg =
    krs.reduce((s, kr) => s + Math.min(kr.current / (kr.target || 1), 1), 0) /
    krs.length;
  return Math.round(avg * 100);
}

function toOKRNode(okr: {
  id: string;
  title: string;
  type: string;
  status: string;
  horizon: string | null;
  keyResults: { current: number; target: number }[];
}): OKRNode {
  return {
    id: okr.id,
    title: okr.title,
    okrType: okr.type,
    status: okr.status,
    progress: calcProgress(okr.keyResults),
    horizon: okr.horizon,
  };
}

// ─── Main query ───────────────────────────────────────────────────────────────

export async function getStrategyMapData(): Promise<StrategyMapData> {
  const ctx = await requireTenantSession(await headers());
  const { tenantId } = ctx;

  // Run all three queries in parallel for performance
  const [themes, epicOKRs, unlinkedRaw] = await Promise.all([
    // 1. All strategic themes with their linked epics and theme-level OKRs
    database.strategicTheme.findMany({
      where: { tenantId },
      orderBy: { order: "asc" },
      include: {
        epics: {
          select: { id: true, title: true, statusId: true },
          orderBy: { order: "asc" },
        },
        okrs: {
          include: { keyResults: { select: { current: true, target: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    }),

    // 2. OKRs that belong to an epic (epicId is set)
    database.oKR.findMany({
      where: { tenantId, NOT: { epicId: null } },
      include: { keyResults: { select: { current: true, target: true } } },
      orderBy: { createdAt: "asc" },
    }),

    // 3. OKRs not tied to any theme or epic (PI/ART-level, team-level, improvement)
    database.oKR.findMany({
      where: { tenantId, strategicThemeId: null, epicId: null },
      include: { keyResults: { select: { current: true, target: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // Build epicId → OKRNode[] lookup
  const epicOKRMap = new Map<string, OKRNode[]>();
  for (const okr of epicOKRs) {
    if (!okr.epicId) continue;
    const node = toOKRNode(okr);
    const list = epicOKRMap.get(okr.epicId) ?? [];
    list.push(node);
    epicOKRMap.set(okr.epicId, list);
  }

  // Shape theme nodes
  const themeNodes: ThemeNode[] = themes.map((t) => {
    const themeOKRs = t.okrs.map(toOKRNode);

    const epicNodes: EpicNode[] = t.epics.map((e) => ({
      id: e.id,
      title: e.title,
      statusId: e.statusId,
      okrs: epicOKRMap.get(e.id) ?? [],
    }));

    const progress =
      themeOKRs.length > 0
        ? Math.round(
            themeOKRs.reduce((s, o) => s + o.progress, 0) / themeOKRs.length
          )
        : 0;

    return {
      id: t.id,
      title: t.title,
      code: t.code,
      color: t.color,
      status: t.status,
      horizon: t.horizon,
      progress,
      okrs: themeOKRs,
      epics: epicNodes,
    };
  });

  const unlinkedOKRs = unlinkedRaw.map(toOKRNode);

  return { themes: themeNodes, unlinkedOKRs };
}
