"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReEvaluateResponse =
  | { ok: true; data: { newSnapshotId: string } }
  | { ok: false; error: string };

// ─── Action ───────────────────────────────────────────────────────────────────

/**
 * Re-evaluates a stale snapshot by creating an immutable new version and
 * archiving the original. Follows the versioning model: old snapshots are
 * never mutated — a new FRESH snapshot with `versionOf` pointing at the
 * original is created instead.
 */
export async function reEvaluateSnapshot(
  snapshotId: string
): Promise<ReEvaluateResponse> {
  const ctx = await requireTenantSession(await headers());
  const { tenantId } = ctx;

  const old = await database.flowMetricSnapshot.findFirst({
    where: { id: snapshotId, tenantId, isArchived: false },
  });
  if (!old) {
    return { ok: false, error: "Snapshot not found or already archived" };
  }

  // Recompute velocity from current sprint stories that have been completed
  const stories = await database.story.findMany({
    where: {
      tenantId,
      sprintId: old.periodRef,
      status: "DONE",
      completedAt: { not: null },
    },
    select: { storyPoints: true },
  });

  const totalDelivered = stories.length;

  const newSnap = await database.flowMetricSnapshot.create({
    data: {
      tenantId,
      scope: old.scope,
      scopeId: old.scopeId,
      period: old.period,
      periodRef: old.periodRef,
      versionOf: snapshotId,
      staleness: "FRESH",
      stalenessReasons: [],
      flowVelocityTotal: totalDelivered,
      flowDistribution: {},
      reevaluatedAt: new Date(),
    },
  });

  await database.flowMetricSnapshot.update({
    where: { id: snapshotId },
    data: { isArchived: true, archivedAt: new Date() },
  });

  return { ok: true, data: { newSnapshotId: newSnap.id } };
}
