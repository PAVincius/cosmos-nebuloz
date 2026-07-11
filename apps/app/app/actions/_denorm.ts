import { database } from "@repo/database";

/**
 * Recomputes Feature.progressPct from child stories.
 * Call whenever a story status changes or is created/deleted under a feature.
 */
export async function syncFeatureProgress(
  featureId: string,
  tenantId: string
): Promise<void> {
  const [total, done] = await Promise.all([
    database.story.count({ where: { featureId, tenantId } }),
    database.story.count({ where: { featureId, tenantId, status: "DONE" } }),
  ]);
  await database.feature.updateMany({
    where: { id: featureId, tenantId },
    data: { progressPct: total > 0 ? done / total : 0 },
  });
}

/**
 * Recomputes Epic.featureCount and Epic.doneFeatureCount.
 * Call whenever a feature is created, status-changed, or deleted under an epic.
 */
export async function syncEpicCounts(
  epicId: string,
  tenantId: string
): Promise<void> {
  const [total, done] = await Promise.all([
    database.feature.count({ where: { epicId, tenantId } }),
    database.feature.count({ where: { epicId, tenantId, statusId: "DONE" } }),
  ]);
  await database.epic.updateMany({
    where: { id: epicId, tenantId },
    data: { featureCount: total, doneFeatureCount: done },
  });
}

/**
 * Recomputes Team.wip — IN_PROGRESS stories inside the team's active sprint.
 * Call whenever a story status changes or moves between sprints.
 */
export async function syncTeamWip(
  teamId: string,
  tenantId: string
): Promise<void> {
  const wip = await database.story.count({
    where: {
      tenantId,
      status: "IN_PROGRESS",
      sprint: { teamId, status: "ACTIVE" },
    },
  });
  await database.team.updateMany({
    where: { id: teamId, tenantId },
    data: { wip },
  });
}

/**
 * Recomputes PIPlan.completionPct from features (statusId === "DONE").
 * Call whenever a feature status changes inside a PI plan.
 */
export async function syncPIPlanCompletion(
  piPlanId: string,
  tenantId: string
): Promise<void> {
  const [total, done] = await Promise.all([
    database.feature.count({ where: { piPlanId, tenantId } }),
    database.feature.count({ where: { piPlanId, tenantId, statusId: "DONE" } }),
  ]);
  await database.pIPlan.updateMany({
    where: { id: piPlanId, tenantId },
    data: { completionPct: total > 0 ? done / total : 0 },
  });
}

/**
 * Sets ART.currentPiPlanId to the most recent COMMITTED/EXECUTING PI plan.
 * Call after any PI plan status transition.
 */
export async function syncARTCurrentPI(
  artId: string,
  tenantId: string
): Promise<void> {
  const activePi = await database.pIPlan.findFirst({
    where: { artId, tenantId, status: { in: ["COMMITTED", "EXECUTING"] } },
    orderBy: { startDate: "desc" },
    select: { id: true },
  });
  await database.aRT.updateMany({
    where: { id: artId, tenantId },
    data: { currentPiPlanId: activePi?.id ?? null },
  });
}

/**
 * Appends a daily burndown snapshot to Sprint.burndownSnapshots.
 * Idempotent per day — overwrites if called twice on the same date.
 * Call from standup submission or a scheduled job while sprint is ACTIVE.
 */
export async function appendBurndownSnapshot(
  sprintId: string,
  tenantId: string
): Promise<void> {
  const sprint = await database.sprint.findFirst({
    where: { id: sprintId, tenantId, status: "ACTIVE" },
    select: {
      id: true,
      capacity: true,
      startDate: true,
      endDate: true,
      burndownSnapshots: true,
    },
  });
  if (!sprint) return;

  const agg = await database.story.aggregate({
    where: { sprintId, tenantId, status: { notIn: ["DONE"] } },
    _sum: { storyPoints: true },
  });
  const remainingPts = agg._sum.storyPoints ?? 0;

  const now = new Date();
  const totalMs = sprint.endDate.getTime() - sprint.startDate.getTime();
  const elapsedMs = now.getTime() - sprint.startDate.getTime();
  const ratio = totalMs > 0 ? Math.min(1, Math.max(0, elapsedMs / totalMs)) : 0;
  const ideal = Math.round((sprint.capacity ?? 0) * (1 - ratio));

  const existing = Array.isArray(sprint.burndownSnapshots)
    ? (sprint.burndownSnapshots as Array<{ date: string; remaining: number; ideal: number }>)
    : [];
  const dateKey = now.toISOString().slice(0, 10);
  const snapshots = [
    ...existing.filter((s) => s.date !== dateKey),
    { date: dateKey, remaining: remainingPts, ideal },
  ];

  await database.sprint.updateMany({
    where: { id: sprintId, tenantId },
    data: { burndownSnapshots: snapshots },
  });
}
