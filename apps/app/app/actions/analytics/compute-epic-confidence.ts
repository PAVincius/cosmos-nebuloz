import { database } from "@repo/database";
import {
  type EpicConfidence,
  epicConfidence,
} from "@/lib/analytics/release-forecast";

const HISTORY_SPRINTS = 6;
const DEFAULT_CADENCE_DAYS = 14;
const MS_PER_DAY = 86_400_000;

async function computeCadenceDays(
  tenantId: string,
  teamIds: string[]
): Promise<number> {
  if (teamIds.length === 0) {
    return DEFAULT_CADENCE_DAYS;
  }
  const sprints = await database.sprint.findMany({
    where: { tenantId, teamId: { in: teamIds } },
    select: { startDate: true, endDate: true },
    orderBy: { startDate: "desc" },
    take: 6,
  });
  if (sprints.length === 0) {
    return DEFAULT_CADENCE_DAYS;
  }
  const lengths = sprints.map(
    (s) => (s.endDate.getTime() - s.startDate.getTime()) / MS_PER_DAY
  );
  const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  return Math.max(1, Math.round(avg));
}

/**
 * Not a server action — no "use server" directive, so it is not RPC-reachable.
 * Callers must pass a tenantId they already trust, never a caller-supplied
 * value.
 */
export async function computeEpicConfidence(
  tenantId: string,
  epicId: string
): Promise<EpicConfidence> {
  const epic = await database.epic.findFirst({
    where: { id: epicId, tenantId },
    select: { id: true, dueDate: true },
  });
  if (!epic) {
    throw new Error("EPIC_NOT_FOUND");
  }

  const features = await database.feature.findMany({
    where: { tenantId, epicId, statusId: { not: "DONE" } },
    select: { assignedTeamId: true },
  });
  const remainingItems = features.length;
  const teamIds = [
    ...new Set(
      features
        .map((f) => f.assignedTeamId)
        .filter((t): t is string => Boolean(t))
    ),
  ];

  const snapshots = teamIds.length
    ? await database.flowMetricSnapshot.findMany({
        where: {
          tenantId,
          scope: "team",
          scopeId: { in: teamIds },
          period: "sprint",
        },
        select: { periodRef: true, flowVelocityTotal: true, recordedAt: true },
        orderBy: { recordedAt: "desc" },
        take: HISTORY_SPRINTS * Math.max(teamIds.length, 1),
      })
    : [];

  // Sum velocity per sprint (periodRef); snapshots are newest-first, so the
  // Map preserves newest-first insertion order.
  const bySprint = new Map<string, number>();
  for (const s of snapshots) {
    bySprint.set(
      s.periodRef,
      (bySprint.get(s.periodRef) ?? 0) + s.flowVelocityTotal
    );
  }
  const historicalThroughput = [...bySprint.values()].slice(0, HISTORY_SPRINTS);

  const cadenceDays = await computeCadenceDays(tenantId, teamIds);

  return epicConfidence({
    historicalThroughput,
    remainingItems,
    dueDate: epic.dueDate,
    cadenceDays,
    anchor: new Date(),
  });
}
