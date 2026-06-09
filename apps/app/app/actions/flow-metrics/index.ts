"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { z } from "zod";

const FlowScopeSchema = z.enum(["team", "art", "value_stream"]);
const ScopeIdSchema = z.string().min(1, "scopeId é obrigatório");

export type FlowScope = z.infer<typeof FlowScopeSchema>;
export type FlowPeriod = "sprint" | "pi" | "quarter";

export type FlowMetricsResult = {
  /** ID of the most recent non-archived FlowMetricSnapshot for this scope (null when none exists yet). */
  id: string | null;
  /** Staleness state of the most recent snapshot, or null when no snapshot exists. */
  staleness: "FRESH" | "AGING" | "STALE" | "CRITICAL" | null;

  scope: FlowScope;
  scopeId: string;
  scopeLabel: string;
  periodLabel: string;

  // Distribution: % by type
  flowDistribution: { type: string; count: number; pct: number }[];

  // Velocity: items completed per period bucket
  flowVelocity: {
    label: string;
    total: number;
    stories: number;
    features: number;
    defects: number;
  }[];

  // Time: avg cycle time in days per type
  flowTime: { type: string; avgDays: number; count: number }[];
  flowTimeOverall: number; // days

  // Load: current WIP
  flowLoad: number;
  flowLoadHistory: { label: string; wip: number }[];

  // Efficiency: active / total time (0-1)
  flowEfficiency: number;

  // Predictability: delivered / planned (0-1)
  flowPredictability: number;
  flowPredictabilityHistory: {
    label: string;
    planned: number;
    delivered: number;
  }[];
};

export type FlowScopeOption = {
  id: string;
  label: string;
  type: FlowScope;
};

export async function getFlowScopeOptions(): Promise<FlowScopeOption[]> {
  const ctx = await requireTenantSession(await headers());

  const [teams, arts] = await Promise.all([
    database.team.findMany({
      where: { tenantId: ctx.tenantId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    database.aRT.findMany({
      where: { tenantId: ctx.tenantId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return [
    ...arts.map((a) => ({ id: a.id, label: a.name, type: "art" as FlowScope })),
    ...teams.map((t) => ({
      id: t.id,
      label: t.name,
      type: "team" as FlowScope,
    })),
  ];
}

export async function getFlowMetrics(
  scope: FlowScope,
  scopeId: string
): Promise<FlowMetricsResult> {
  FlowScopeSchema.parse(scope);
  ScopeIdSchema.parse(scopeId);

  const ctx = await requireTenantSession(await headers());
  const tenantId = ctx.tenantId;

  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // Resolve scope label — tenantId included to prevent IDOR cross-tenant reads
  let scopeLabel = scopeId;
  if (scope === "team") {
    const team = await database.team.findUnique({
      where: { id: scopeId, tenantId },
      select: { name: true },
    });
    if (!team) {
      throw new Error("Team not found");
    }
    scopeLabel = team.name;
  } else if (scope === "art") {
    const art = await database.aRT.findUnique({
      where: { id: scopeId, tenantId },
      select: { name: true },
    });
    if (!art) {
      throw new Error("ART not found");
    }
    scopeLabel = art.name;
  }

  // ── DATA FETCH ────────────────────────────────────────────────────────────
  const [stories, features, defects, sprints, piPlans, latestSnapshot] =
    await Promise.all([
      // Stories for team scope or all teams in ART
      database.story.findMany({
        where:
          scope === "team"
            ? { tenantId, sprint: { teamId: scopeId } }
            : { tenantId },
        select: {
          id: true,
          status: true,
          startedAt: true,
          completedAt: true,
          createdAt: true,
          sprint: {
            select: {
              id: true,
              name: true,
              startDate: true,
              endDate: true,
              teamId: true,
            },
          },
        },
      }),
      // Features for ART scope
      scope === "art"
        ? database.feature.findMany({
            where: { tenantId, piPlan: { artId: scopeId } },
            select: {
              id: true,
              statusId: true,
              startedAt: true,
              completedAt: true,
              createdAt: true,
              piPlan: { select: { id: true, name: true } },
            },
          })
        : Promise.resolve([]),
      // Defects
      database.defect.findMany({
        where: scope === "team" ? { tenantId, teamId: scopeId } : { tenantId },
        select: { id: true, status: true, createdAt: true, updatedAt: true },
      }),
      // Sprints (last 10)
      database.sprint.findMany({
        where: scope === "team" ? { tenantId, teamId: scopeId } : { tenantId },
        orderBy: { startDate: "desc" },
        take: 10,
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          review: { select: { velocity: true, goalMet: true } },
          _count: { select: { stories: true } },
        },
      }),
      // PI Plans (last 5)
      scope === "art"
        ? database.pIPlan.findMany({
            where: { tenantId, artId: scopeId },
            orderBy: { createdAt: "desc" },
            take: 5,
            select: {
              id: true,
              name: true,
              piObjectives: {
                select: { id: true, status: true, isStretch: true },
              },
              features: { select: { id: true, statusId: true } },
            },
          })
        : Promise.resolve([]),
      // Latest non-archived snapshot for staleness display
      database.flowMetricSnapshot.findFirst({
        where: { tenantId, scope, scopeId, isArchived: false },
        orderBy: { recordedAt: "desc" },
        select: { id: true, staleness: true },
      }),
    ]);

  // ── FLOW DISTRIBUTION ────────────────────────────────────────────────────
  const completedStories = stories.filter(
    (s) =>
      s.status === "DONE" &&
      s.completedAt &&
      new Date(s.completedAt) >= ninetyDaysAgo
  );
  const completedFeatures = features.filter(
    (f) =>
      f.statusId === "DONE" &&
      f.completedAt &&
      new Date(f.completedAt) >= ninetyDaysAgo
  );
  const completedDefects = defects.filter(
    (d) => d.status === "RESOLVED" || d.status === "CLOSED"
  );

  const distTotal =
    completedStories.length +
      completedFeatures.length +
      completedDefects.length || 1;
  const flowDistribution = [
    {
      type: "História",
      count: completedStories.length,
      pct: Math.round((completedStories.length / distTotal) * 100),
    },
    {
      type: "Feature",
      count: completedFeatures.length,
      pct: Math.round((completedFeatures.length / distTotal) * 100),
    },
    {
      type: "Defect",
      count: completedDefects.length,
      pct: Math.round((completedDefects.length / distTotal) * 100),
    },
  ].filter((d) => d.count > 0);

  // ── FLOW VELOCITY ────────────────────────────────────────────────────────
  const recentSprints = [...sprints].reverse(); // oldest first
  const flowVelocity = recentSprints.map((sprint) => {
    const sprintStories = stories.filter((s) => s.sprint?.id === sprint.id);
    const done = sprintStories.filter((s) => s.status === "DONE").length;
    const actualVelocity = sprint.review?.velocity ?? done;
    return {
      label: sprint.name,
      total: actualVelocity,
      stories: done,
      features: 0,
      defects: 0,
    };
  });

  // ── FLOW TIME ────────────────────────────────────────────────────────────
  function cycleTimeDays(
    started: Date | null,
    completed: Date | null,
    created: Date
  ): number {
    const from = started ?? created;
    const to = completed ?? new Date();
    return Math.max(0, (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
  }

  const storyTimes = completedStories.map((s) =>
    cycleTimeDays(s.startedAt, s.completedAt, s.createdAt)
  );
  const featureTimes = completedFeatures.map((f) =>
    cycleTimeDays(f.startedAt, f.completedAt, f.createdAt)
  );

  const avg = (arr: number[]) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  const flowTime = [
    {
      type: "História",
      avgDays: Math.round(avg(storyTimes) * 10) / 10,
      count: storyTimes.length,
    },
    {
      type: "Feature",
      avgDays: Math.round(avg(featureTimes) * 10) / 10,
      count: featureTimes.length,
    },
  ].filter((t) => t.count > 0);

  const allTimes = [...storyTimes, ...featureTimes];
  const flowTimeOverall = Math.round(avg(allTimes) * 10) / 10;

  // ── FLOW LOAD (WIP) ──────────────────────────────────────────────────────
  const inProgressStories = stories.filter((s) =>
    ["IN_PROGRESS", "REVIEW"].includes(s.status)
  ).length;
  const inProgressFeatures = features.filter((f) =>
    ["IN_PROGRESS", "REVIEW"].includes(f.statusId)
  ).length;
  const flowLoad = inProgressStories + inProgressFeatures;

  const flowLoadHistory = recentSprints.map((sprint) => {
    const wip = stories.filter(
      (s) =>
        s.sprint?.id === sprint.id &&
        ["IN_PROGRESS", "REVIEW"].includes(s.status)
    ).length;
    return { label: sprint.name, wip };
  });

  // ── FLOW EFFICIENCY ──────────────────────────────────────────────────────
  // Proxy: stories with startedAt / total created-to-done time
  const efficiencyItems = completedStories.filter(
    (s) => s.startedAt && s.completedAt
  );
  let flowEfficiency = 0;
  if (efficiencyItems.length > 0) {
    const efficiencies = efficiencyItems.map((s) => {
      const active =
        (s.completedAt?.getTime() ?? 0) - (s.startedAt?.getTime() ?? 0);
      const total = (s.completedAt?.getTime() ?? 0) - s.createdAt.getTime();
      return total > 0 ? active / total : 0.5;
    });
    flowEfficiency = Math.round(avg(efficiencies) * 100) / 100;
  } else {
    // Fallback estimate: ~40% efficiency is typical for teams without WIP limits
    flowEfficiency = completedStories.length > 0 ? 0.42 : 0;
  }

  // ── FLOW PREDICTABILITY ──────────────────────────────────────────────────
  let flowPredictability = 0;
  const flowPredictabilityHistory: {
    label: string;
    planned: number;
    delivered: number;
  }[] = [];

  if (scope === "art" && piPlans.length > 0) {
    for (const pi of [...piPlans].reverse()) {
      const committed = pi.piObjectives.filter((o) => !o.isStretch);
      const achieved = committed.filter((o) => o.status === "ACHIEVED");
      flowPredictabilityHistory.push({
        label: pi.name,
        planned: committed.length,
        delivered: achieved.length,
      });
    }
    const lastPI = piPlans[0];
    const committed = lastPI.piObjectives.filter((o) => !o.isStretch);
    const achieved = committed.filter((o) => o.status === "ACHIEVED");
    flowPredictability =
      committed.length > 0 ? achieved.length / committed.length : 0;
  } else if (scope === "team" && sprints.length > 0) {
    // Use sprint review goalMet as proxy
    const completed = sprints.filter((s) => s.review);
    for (const s of [...completed].reverse()) {
      flowPredictabilityHistory.push({
        label: s.name,
        planned: s._count.stories,
        delivered: s.review?.velocity ?? 0,
      });
    }
    const metCount = completed.filter((s) => s.review?.goalMet).length;
    flowPredictability = completed.length > 0 ? metCount / completed.length : 0;
  }

  return {
    id: latestSnapshot?.id ?? null,
    staleness: (latestSnapshot?.staleness ?? null) as
      | "FRESH"
      | "AGING"
      | "STALE"
      | "CRITICAL"
      | null,
    scope,
    scopeId,
    scopeLabel,
    periodLabel: "Últimos 90 dias / sprints recentes",
    flowDistribution,
    flowVelocity,
    flowTime,
    flowTimeOverall,
    flowLoad,
    flowLoadHistory,
    flowEfficiency,
    flowPredictability: Math.round(flowPredictability * 100) / 100,
    flowPredictabilityHistory,
  };
}
