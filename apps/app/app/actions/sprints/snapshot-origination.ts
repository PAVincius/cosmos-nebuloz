/**
 * Snapshot origination for sprint close — the recurring period-snapshot
 * writer pattern shared by FlowMetricSnapshot (flow history / CFD) and
 * TeamCapacitySnapshot (per-sprint capacity grid). Both are computed from
 * the same closing sprint's real Story/Defect/TeamMemberAssignment data.
 *
 * Idempotent: each function looks for an existing snapshot keyed on the
 * closing sprint before writing, so re-closing or a backfill re-run can
 * never double-write.
 *
 * Plain helper module (no "use server") on purpose — a "use server" file can
 * only export async server actions, not internal helpers, and these are
 * called from both closeSprint (lifecycle.ts) and the backfill admin action.
 *
 * Callers MUST treat these as best-effort: wrap calls in try/catch and
 * log-only on failure. A snapshot computation must never fail the sprint
 * close itself (mirrors update-epic.ts's guarded copilot-reindex side effect).
 */
import type { database } from "@repo/database";

type SnapshotDb = Pick<
  typeof database,
  | "story"
  | "defect"
  | "stateTransitionHistory"
  | "flowMetricSnapshot"
  | "teamMemberAssignment"
  | "teamCapacitySnapshot"
>;

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

const STORY_WIP_STATUSES = new Set(["IN_PROGRESS", "IN_REVIEW"]);

export type OriginateSnapshotResult = { created: boolean };

// ─── FlowMetricSnapshot ────────────────────────────────────────────────────

export async function originateFlowSnapshot(
  db: SnapshotDb,
  params: { tenantId: string; teamId: string; sprintId: string }
): Promise<OriginateSnapshotResult> {
  const { tenantId, teamId, sprintId } = params;

  const existing = await db.flowMetricSnapshot.findFirst({
    where: {
      tenantId,
      scope: "team",
      scopeId: teamId,
      period: "sprint",
      periodRef: sprintId,
    },
    select: { id: true },
  });
  if (existing) {
    return { created: false };
  }

  const [stories, defects] = await Promise.all([
    db.story.findMany({
      where: { tenantId, sprintId },
      select: {
        id: true,
        status: true,
        storyPoints: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
      },
    }),
    db.defect.findMany({
      where: { tenantId, sprintId, status: "CLOSED" },
      select: { id: true, createdAt: true, resolvedAt: true },
    }),
  ]);

  const doneStories = stories.filter(
    (s) => s.status === "DONE" && s.completedAt
  );
  const plannedItems = stories.length;
  const deliveredItems = doneStories.length; // vs. plannedItems, for flowPredictability
  const totalDeliveredForDistribution = doneStories.length + defects.length;

  const flowVelocityTotal = doneStories.reduce(
    (sum, s) => sum + s.storyPoints,
    0
  );
  const flowVelocityByType: Record<string, number> =
    flowVelocityTotal > 0 ? { story: flowVelocityTotal } : {};

  // Proportions (not raw counts) — matches the FlowMetricSnapshot convention
  // established by scripts/seed-e2e.ts's flowDistribution values.
  const flowDistribution: Record<string, number> =
    totalDeliveredForDistribution > 0
      ? {
          ...(doneStories.length > 0
            ? { story: doneStories.length / totalDeliveredForDistribution }
            : {}),
          ...(defects.length > 0
            ? { defect: defects.length / totalDeliveredForDistribution }
            : {}),
        }
      : {};

  const storyFlowTimesHours = doneStories
    .filter((s) => s.startedAt && s.completedAt)
    .map(
      (s) =>
        // biome-ignore lint/style/noNonNullAssertion: filtered above
        (s.completedAt!.getTime() - s.startedAt!.getTime()) / 3_600_000
    );
  const defectFlowTimesHours = defects
    .filter((d) => d.resolvedAt)
    .map(
      (d) =>
        // biome-ignore lint/style/noNonNullAssertion: filtered above
        (d.resolvedAt!.getTime() - d.createdAt.getTime()) / 3_600_000
    );
  const allFlowTimesHours = [...storyFlowTimesHours, ...defectFlowTimesHours];

  const flowTimeByType: Record<string, number> = {
    ...(storyFlowTimesHours.length > 0
      ? { story: average(storyFlowTimesHours) }
      : {}),
    ...(defectFlowTimesHours.length > 0
      ? { defect: average(defectFlowTimesHours) }
      : {}),
  };

  // Flow efficiency — active time (first entry into IN_PROGRESS -> first
  // entry into DONE) over total lead time (createdAt -> completedAt).
  // Stories with no matching transition history are excluded rather than
  // fabricated — same "honest over complete" precedent as getAgingWip.
  let flowEfficiency = 0;
  if (doneStories.length > 0) {
    const history = await db.stateTransitionHistory.findMany({
      where: {
        tenantId,
        entityType: "Story",
        entityId: { in: doneStories.map((s) => s.id) },
      },
      orderBy: { transitionedAt: "asc" },
      select: { entityId: true, toStatus: true, transitionedAt: true },
    });
    const firstInProgress = new Map<string, Date>();
    const firstDoneAt = new Map<string, Date>();
    for (const row of history) {
      if (
        row.toStatus === "IN_PROGRESS" &&
        !firstInProgress.has(row.entityId)
      ) {
        firstInProgress.set(row.entityId, row.transitionedAt);
      }
      if (row.toStatus === "DONE" && !firstDoneAt.has(row.entityId)) {
        firstDoneAt.set(row.entityId, row.transitionedAt);
      }
    }
    const efficiencies: number[] = [];
    for (const s of doneStories) {
      const inProgressAt = firstInProgress.get(s.id);
      const doneAt = firstDoneAt.get(s.id);
      if (!(inProgressAt && doneAt && s.completedAt)) {
        continue;
      }
      const totalMs = s.completedAt.getTime() - s.createdAt.getTime();
      if (totalMs <= 0) {
        continue;
      }
      const activeMs = doneAt.getTime() - inProgressAt.getTime();
      efficiencies.push(clamp01(activeMs / totalMs));
    }
    flowEfficiency = average(efficiencies);
  }

  const flowLoadCurrent = stories.filter((s) =>
    STORY_WIP_STATUSES.has(s.status)
  ).length;
  const flowPredictability =
    plannedItems > 0 ? clamp01(deliveredItems / plannedItems) : 0;

  await db.flowMetricSnapshot.create({
    data: {
      tenantId,
      scope: "team",
      scopeId: teamId,
      period: "sprint",
      periodRef: sprintId,
      flowDistribution,
      flowVelocityTotal,
      flowVelocityByType,
      flowTimeAvgHours: average(allFlowTimesHours),
      flowTimeMedianHours: median(allFlowTimesHours),
      flowTimeByType,
      flowLoadCurrent,
      flowEfficiency,
      flowPredictability,
      plannedItems,
      deliveredItems,
      staleness: "FRESH",
    },
  });

  return { created: true };
}

// ─── TeamCapacitySnapshot ───────────────────────────────────────────────────

export async function originateCapacitySnapshot(
  db: SnapshotDb,
  params: {
    tenantId: string;
    teamId: string;
    sprintId: string;
    velocity: number;
  }
): Promise<OriginateSnapshotResult> {
  const { tenantId, teamId, sprintId, velocity } = params;

  const existing = await db.teamCapacitySnapshot.findFirst({
    where: { tenantId, sprintId, teamId },
    select: { id: true },
  });
  if (existing) {
    return { created: false };
  }

  const [assignments, committed] = await Promise.all([
    db.teamMemberAssignment.findMany({
      where: { tenantId, sprintId },
      select: { capacityFactor: true },
    }),
    db.story.aggregate({
      where: { tenantId, sprintId },
      _sum: { storyPoints: true },
    }),
  ]);

  const totalMembersCommitted = assignments.length;
  const totalCapacityFactor = assignments.reduce(
    (sum, a) => sum + a.capacityFactor,
    0
  );
  // "Expected" here is the sprint's committed capacity target, not a
  // forecast for a different future sprint — matches how listTeamCapacity
  // already pairs expectedSpNextSprint with actualSpDelivered from the same
  // snapshot/sprint.
  const expectedSpNextSprint = committed._sum.storyPoints ?? 0;
  const actualSpDelivered = velocity;
  // Not clamped — utilization over 100% is real over-commitment info that
  // capacity.tsx's utilTone() already renders (>=100 => red).
  const actualCapacityUtil =
    expectedSpNextSprint > 0 ? actualSpDelivered / expectedSpNextSprint : 0;

  await db.teamCapacitySnapshot.create({
    data: {
      tenantId,
      sprintId,
      teamId,
      totalMembersCommitted,
      totalCapacityFactor,
      expectedSpNextSprint,
      actualSpDelivered,
      actualCapacityUtil,
    },
  });

  return { created: true };
}
