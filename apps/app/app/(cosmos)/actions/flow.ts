"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { type Result, safeAction } from "../../actions/_base";
import { AGING_WIP_SLA_DAYS } from "./flow.constants";

export type FlowMetricsView = {
  flowDistribution: Record<string, number>;
  flowVelocityTotal: number;
  flowTimeAvgHours: number;
  flowLoadCurrent: number;
  flowEfficiency: number;
  flowPredictability: number;
  recordedAt: string;
};

// Real status values written by the entities' own transition writers — see
// moveStoryOnBoard (Story.status: TODO/IN_PROGRESS/IN_REVIEW/DONE),
// updateFeatureStatus (Feature.statusId: BACKLOG/ANALYSIS/REVIEW/
// IMPLEMENTING/DONE) and epics/transition-status.ts (Epic.lifecycleStatus:
// FUNNEL/ANALYZING/PORTFOLIO_BACKLOG/IMPLEMENTING/DONE/REJECTED).
const STORY_IN_PROGRESS_STATUSES = ["IN_PROGRESS", "IN_REVIEW"];
const FEATURE_IN_PROGRESS_STATUSES = ["ANALYSIS", "REVIEW", "IMPLEMENTING"];
const EPIC_IN_PROGRESS_STATUSES = ["ANALYZING", "IMPLEMENTING"];

export type AgingWipEntityType = "Story" | "Feature" | "Epic";

export type AgingWipItem = {
  entityType: AgingWipEntityType;
  entityId: string;
  title: string;
  status: string;
  days: number;
  slaDays: number;
  overSla: boolean;
};

type AgingWipCandidate = { id: string; title: string; status: string };

// Finds, per candidate, the latest StateTransitionHistory row whose toStatus
// matches the entity's *current* status (i.e. the transition that put it
// there) and derives days-in-state from it. Candidates with no such row
// (created directly in this status, pre-dating the writer, etc.) are
// dropped rather than backfilled with a fabricated date — honest over complete.
async function agingWipForType(
  tenantId: string,
  entityType: AgingWipEntityType,
  candidates: AgingWipCandidate[]
): Promise<AgingWipItem[]> {
  if (candidates.length === 0) {
    return [];
  }

  const history = await database.stateTransitionHistory.findMany({
    where: {
      tenantId,
      entityType,
      entityId: { in: candidates.map((c) => c.id) },
    },
    orderBy: { transitionedAt: "desc" },
    select: { entityId: true, toStatus: true, transitionedAt: true },
  });

  const statusById = new Map(candidates.map((c) => [c.id, c.status]));
  const latestTransitionAt = new Map<string, Date>();
  for (const row of history) {
    if (latestTransitionAt.has(row.entityId)) {
      continue; // already found the latest matching row (rows are desc-ordered)
    }
    if (row.toStatus === statusById.get(row.entityId)) {
      latestTransitionAt.set(row.entityId, row.transitionedAt);
    }
  }

  const now = Date.now();
  const items: AgingWipItem[] = [];
  for (const c of candidates) {
    const transitionedAt = latestTransitionAt.get(c.id);
    if (!transitionedAt) {
      continue;
    }
    const days = Math.floor(
      (now - transitionedAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    items.push({
      entityType,
      entityId: c.id,
      title: c.title,
      status: c.status,
      days,
      slaDays: AGING_WIP_SLA_DAYS,
      overSla: days > AGING_WIP_SLA_DAYS,
    });
  }
  return items;
}

export async function getAgingWip(): Promise<Result<AgingWipItem[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const [stories, features, epics] = await Promise.all([
      database.story.findMany({
        where: {
          tenantId: ctx.tenantId,
          status: { in: STORY_IN_PROGRESS_STATUSES },
        },
        select: { id: true, title: true, status: true },
      }),
      database.feature.findMany({
        where: {
          tenantId: ctx.tenantId,
          statusId: { in: FEATURE_IN_PROGRESS_STATUSES },
        },
        select: { id: true, title: true, statusId: true },
      }),
      database.epic.findMany({
        where: {
          tenantId: ctx.tenantId,
          lifecycleStatus: { in: EPIC_IN_PROGRESS_STATUSES },
        },
        select: { id: true, title: true, lifecycleStatus: true },
      }),
    ]);

    const [storyItems, featureItems, epicItems] = await Promise.all([
      agingWipForType(
        ctx.tenantId,
        "Story",
        stories.map((s) => ({ id: s.id, title: s.title, status: s.status }))
      ),
      agingWipForType(
        ctx.tenantId,
        "Feature",
        features.map((f) => ({
          id: f.id,
          title: f.title,
          status: f.statusId,
        }))
      ),
      agingWipForType(
        ctx.tenantId,
        "Epic",
        epics.map((e) => ({
          id: e.id,
          title: e.title,
          status: e.lifecycleStatus,
        }))
      ),
    ]);

    return [...storyItems, ...featureItems, ...epicItems].sort(
      (a, b) => b.days - a.days
    );
  });
}

// Handoff shows an 8-period window for the CFD / throughput charts.
const FLOW_SERIES_WINDOW = 8;

export type FlowMetricsSeriesPoint = {
  periodRef: string;
  recordedAt: string;
  label: string;
  flowVelocityTotal: number;
};

// Windowed sibling of getLatestFlowMetrics — same tenant-wide, unscoped feed
// (no scope/period filter), just the last N snapshots instead of only the
// most recent one. Drives the CFD + throughput-per-period charts. Only
// flowVelocityTotal is exposed here (not flowDistribution) — its per-type
// values are proportions, not counts, and can't be recombined with
// deliveredItems (a different denominator) into an honest absolute
// breakdown per period.
export async function getFlowMetricsSeries(): Promise<
  Result<FlowMetricsSeriesPoint[]>
> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const snaps = await database.flowMetricSnapshot.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { recordedAt: "desc" },
      take: FLOW_SERIES_WINDOW,
      select: {
        periodRef: true,
        recordedAt: true,
        flowVelocityTotal: true,
      },
    });
    if (snaps.length === 0) {
      return [];
    }

    // Sprint-period snapshots get a human label (sprint name); anything
    // else falls back to the recorded date.
    const sprints = await database.sprint.findMany({
      where: {
        tenantId: ctx.tenantId,
        id: { in: snaps.map((s) => s.periodRef) },
      },
      select: { id: true, name: true },
    });
    const sprintNameById = new Map(sprints.map((s) => [s.id, s.name]));

    return snaps
      .slice()
      .reverse() // chronological order for the CFD/throughput charts
      .map((s) => ({
        periodRef: s.periodRef,
        recordedAt: s.recordedAt.toISOString(),
        label:
          sprintNameById.get(s.periodRef) ??
          new Date(s.recordedAt).toLocaleDateString("pt-BR"),
        flowVelocityTotal: s.flowVelocityTotal,
      }));
  });
}

export async function getLatestFlowMetrics(): Promise<
  Result<FlowMetricsView | null>
> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const snap = await database.flowMetricSnapshot.findFirst({
      where: { tenantId: ctx.tenantId },
      orderBy: { recordedAt: "desc" },
      select: {
        flowDistribution: true,
        flowVelocityTotal: true,
        flowTimeAvgHours: true,
        flowLoadCurrent: true,
        flowEfficiency: true,
        flowPredictability: true,
        recordedAt: true,
      },
    });
    if (!snap) {
      return null;
    }
    return {
      flowDistribution: (snap.flowDistribution as Record<string, number>) ?? {},
      flowVelocityTotal: snap.flowVelocityTotal,
      flowTimeAvgHours: snap.flowTimeAvgHours,
      flowLoadCurrent: snap.flowLoadCurrent,
      flowEfficiency: snap.flowEfficiency,
      flowPredictability: snap.flowPredictability,
      recordedAt: snap.recordedAt.toISOString(),
    };
  });
}
