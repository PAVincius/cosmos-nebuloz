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

export type PillarThemeSummary = {
  id: string;
  title: string;
};

export type PillarNode = {
  id: string;
  code: string;
  name: string;
  tone: string;
  progress: number;
  totalEpics: number;
  themes: PillarThemeSummary[];
};

export type StrategyMapData = {
  vision: string | null;
  pillars: PillarNode[];
  themes: ThemeNode[];
  unlinkedOKRs: OKRNode[];
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

function calcProgress(krs: { current: number; target: number }[]): number {
  if (krs.length === 0) {
    return 0;
  }
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

  // Run all queries in parallel for performance
  const [themes, epicOKRs, unlinkedRaw, pillars, tenant] = await Promise.all([
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

    // 4. Strategy Pillars (cosmos.html screen-strategy top-level grouping)
    database.strategyPillar.findMany({
      where: { tenantId },
      orderBy: { order: "asc" },
      select: { id: true, name: true, tone: true },
    }),

    // 5. Tenant vision statement (cosmos.html vision banner)
    database.tenant.findUnique({
      where: { id: tenantId },
      select: { visionStatement: true },
    }),
  ]);

  // Build epicId → OKRNode[] lookup
  const epicOKRMap = new Map<string, OKRNode[]>();
  for (const okr of epicOKRs) {
    if (!okr.epicId) {
      continue;
    }
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

  // Group themes by pillar (grid overview in the Strategy Map header)
  const pillarThemeMap = new Map<string, ThemeNode[]>();
  themes.forEach((t, i) => {
    if (!t.pillarId) {
      return;
    }
    const list = pillarThemeMap.get(t.pillarId) ?? [];
    list.push(themeNodes[i]);
    pillarThemeMap.set(t.pillarId, list);
  });

  const pillarNodes: PillarNode[] = pillars.map((p, i) => {
    const pillarThemes = pillarThemeMap.get(p.id) ?? [];
    const totalEpics = pillarThemes.reduce((s, t) => s + t.epics.length, 0);
    const progress =
      pillarThemes.length > 0
        ? Math.round(
            pillarThemes.reduce((s, t) => s + t.progress, 0) /
              pillarThemes.length
          )
        : 0;

    return {
      id: p.id,
      code: `P${i + 1}`,
      name: p.name,
      tone: p.tone,
      progress,
      totalEpics,
      themes: pillarThemes.map((t) => ({ id: t.id, title: t.title })),
    };
  });

  return {
    vision: tenant?.visionStatement ?? null,
    pillars: pillarNodes,
    themes: themeNodes,
    unlinkedOKRs,
  };
}
