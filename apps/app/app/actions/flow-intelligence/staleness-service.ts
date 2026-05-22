import crypto from "node:crypto";
import { database } from "@repo/database";
import { computeStaleness, type StalenessState } from "./staleness-rules";

/**
 * Session-free staleness scoring for use by Vercel Crons.
 * Mirrors the logic of checkSnapshotStaleness but accepts tenantId directly.
 */
export async function scoreSnapshotStaleness(
  snapshotId: string,
  tenantId: string
): Promise<void> {
  const snapshot = await database.flowMetricSnapshot.findUnique({
    where: { id: snapshotId },
  });

  if (!snapshot || snapshot.tenantId !== tenantId) {
    return;
  }

  const [latestAssessment, currentAssignments] = await Promise.all([
    database.competencyAssessment.findFirst({
      where: { tenantId, scope: snapshot.scope, scopeId: snapshot.scopeId },
      orderBy: { assessedAt: "desc" },
      select: { assessedAt: true },
    }),
    database.teamMemberAssignment.findMany({
      where: { tenantId, teamId: snapshot.scopeId },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: { userId: true },
    }),
  ]);

  const sortedUserIds = currentAssignments.map((a) => a.userId).sort();
  const currentHash =
    sortedUserIds.length > 0
      ? crypto
          .createHash("sha256")
          .update(JSON.stringify(sortedUserIds))
          .digest("hex")
      : null;

  const result = computeStaleness({
    snapshotRecordedAt: snapshot.recordedAt,
    sprintDurationDays: 14,
    currentSpDelivered: null,
    snapshotSpDelivered:
      snapshot.flowVelocityTotal > 0 ? snapshot.flowVelocityTotal : null,
    currentTeamCompositionHash: currentHash,
    snapshotTeamCompositionHash: snapshot.teamCompositionHash ?? null,
    latestAssessmentAt: latestAssessment?.assessedAt ?? null,
    currentFlowEfficiency: snapshot.flowEfficiency ?? null,
    currentFlowPredictability: snapshot.flowPredictability ?? null,
    currentFlowLoadRatio:
      snapshot.flowVelocityTotal > 0
        ? (snapshot.flowLoadCurrent ?? 0) / snapshot.flowVelocityTotal
        : null,
    now: new Date(),
  });

  const oldState = snapshot.staleness as StalenessState;
  const newState = result.state;
  const changed = oldState !== newState;

  if (changed) {
    await Promise.all([
      database.flowMetricSnapshot.update({
        where: { id: snapshotId },
        data: {
          staleness: newState,
          stalenessReasons: result.rules,
          lastStalenessCheck: new Date(),
        },
      }),
      database.stalenessAuditLog.create({
        data: {
          tenantId,
          snapshotId,
          oldState,
          newState,
          triggeredRules: result.rules,
          triggeredBy: "cron",
        },
      }),
    ]);
  } else {
    await database.flowMetricSnapshot.update({
      where: { id: snapshotId },
      data: { lastStalenessCheck: new Date() },
    });
  }
}
