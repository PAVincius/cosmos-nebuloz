"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";

type Ok<T> = { ok: true; data: T };
type Err = { ok: false; error: string };

const ok = <T>(data: T): Ok<T> => ({ ok: true, data });
const err = (error: string): Err => ({ ok: false, error });

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

export async function computeSprintMetrics(
  sprintId: string,
  teamId: string
): Promise<Ok<{ written: number }> | Err> {
  const { tenantId } = await requireTenantSession(await headers());

  const stories = await database.story.findMany({
    where: {
      tenantId,
      sprintId,
      status: "DONE",
      completedAt: { not: null },
    },
    select: {
      assigneeUserId: true,
      storyPoints: true,
      startedAt: true,
      completedAt: true,
    },
  });

  const byMember = new Map<
    string,
    Array<{
      assigneeUserId: string | null;
      storyPoints: number;
      startedAt: Date | null;
      completedAt: Date | null;
    }>
  >();

  for (const s of stories) {
    if (!s.assigneeUserId) {
      continue;
    }
    const arr = byMember.get(s.assigneeUserId) ?? [];
    arr.push(s);
    byMember.set(s.assigneeUserId, arr);
  }

  await Promise.all(
    Array.from(byMember.entries()).map(([userId, memberStories]) => {
      const sp = memberStories.reduce(
        (sum, s) => sum + (s.storyPoints ?? 0),
        0
      );
      const flowTimes = memberStories
        .filter((s) => s.startedAt && s.completedAt)
        .map(
          (s) =>
            ((s.completedAt?.getTime() ?? 0) - (s.startedAt?.getTime() ?? 0)) /
            3_600_000
        );

      const avgFlowTime =
        flowTimes.length > 0
          ? flowTimes.reduce((a, b) => a + b, 0) / flowTimes.length
          : 0;

      return database.memberSprintMetrics.upsert({
        where: { sprintId_userId: { sprintId, userId } },
        create: {
          tenantId,
          sprintId,
          teamId,
          userId,
          storyPointsDelivered: sp,
          storiesCompleted: memberStories.length,
          defectsResolved: 0,
          avgFlowTimeHours: avgFlowTime,
        },
        update: {
          storyPointsDelivered: sp,
          storiesCompleted: memberStories.length,
          avgFlowTimeHours: avgFlowTime,
        },
      });
    })
  );

  return ok({ written: byMember.size });
}

export async function computeMemberBaseline(
  teamId: string,
  userId: string
): Promise<Ok<{ sprintCount: number }> | Err> {
  const { tenantId } = await requireTenantSession(await headers());

  const metrics = await database.memberSprintMetrics.findMany({
    where: { tenantId, teamId, userId },
    orderBy: { createdAt: "desc" },
    take: 6,
    select: { storyPointsDelivered: true },
  });

  const sprintCount = metrics.length;
  const values = metrics
    .map((m) => m.storyPointsDelivered)
    .sort((a, b) => a - b);
  const avg =
    sprintCount > 0 ? values.reduce((a, b) => a + b, 0) / sprintCount : 0;

  let trend = "NEUTRAL";
  if (sprintCount >= 6) {
    const recent =
      (metrics[0].storyPointsDelivered +
        metrics[1].storyPointsDelivered +
        metrics[2].storyPointsDelivered) /
      3;
    const older =
      (metrics[3].storyPointsDelivered +
        metrics[4].storyPointsDelivered +
        metrics[5].storyPointsDelivered) /
      3;
    if (recent > older * 1.1) {
      trend = "UP";
    } else if (recent < older * 0.9) {
      trend = "DOWN";
    }
  }

  const variance =
    sprintCount > 1
      ? values.reduce((s, v) => s + (v - avg) ** 2, 0) / (sprintCount - 1)
      : 0;

  await database.memberThroughputBaseline.upsert({
    where: { tenantId_teamId_userId: { tenantId, teamId, userId } },
    create: {
      tenantId,
      teamId,
      userId,
      avgSpPerSprint: avg,
      p10Estimate: percentile(values, 10),
      p50Estimate: percentile(values, 50),
      p90Estimate: percentile(values, 90),
      trend,
      volatility: Math.sqrt(variance),
      sprintCount,
    },
    update: {
      avgSpPerSprint: avg,
      p10Estimate: percentile(values, 10),
      p50Estimate: percentile(values, 50),
      p90Estimate: percentile(values, 90),
      trend,
      volatility: Math.sqrt(variance),
      sprintCount,
      lastComputedAt: new Date(),
    },
  });

  return ok({ sprintCount });
}

export async function upsertMemberAssignment(
  sprintId: string,
  teamId: string,
  userId: string,
  options: { capacityFactor: number; role?: string }
): Promise<Ok<{ id: string }> | Err> {
  const { capacityFactor, role } = options;

  if (capacityFactor < 0 || capacityFactor > 1) {
    return err("capacityFactor must be in [0, 1]");
  }

  const { tenantId } = await requireTenantSession(await headers());

  const result = await database.teamMemberAssignment.upsert({
    where: { sprintId_userId: { sprintId, userId } },
    create: {
      tenantId,
      sprintId,
      teamId,
      userId,
      capacityFactor,
      role,
    },
    update: {
      capacityFactor,
      role,
    },
  });

  return ok({ id: result.id });
}
