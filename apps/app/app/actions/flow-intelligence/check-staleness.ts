"use server";

import crypto from "node:crypto";
import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { computeStaleness, type StalenessState } from "./staleness-rules";

// ─── Types ────────────────────────────────────────────────────────────────────

type CheckStalenessResult = {
  snapshotId: string;
  oldState: StalenessState;
  newState: StalenessState;
  rules: string[];
  changed: boolean;
};

export type CheckStalenessResponse =
  | { ok: true; data: CheckStalenessResult }
  | { ok: false; error: string };

// ─── Action ───────────────────────────────────────────────────────────────────

export async function checkSnapshotStaleness(
  snapshotId: string
): Promise<CheckStalenessResponse> {
  const ctx = await requireTenantSession(await headers());
  const { tenantId } = ctx;

  const snapshot = await database.flowMetricSnapshot.findFirst({
    where: { id: snapshotId, tenantId },
  });
  if (!snapshot) {
    return { ok: false, error: "Snapshot not found" };
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
      take: 500, // support large ARTs; composition hash needs all members
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
          triggeredBy: "system",
        },
      }),
    ]);
  } else {
    await database.flowMetricSnapshot.update({
      where: { id: snapshotId },
      data: { lastStalenessCheck: new Date() },
    });
  }

  return {
    ok: true,
    data: { snapshotId, oldState, newState, rules: result.rules, changed },
  };
}
