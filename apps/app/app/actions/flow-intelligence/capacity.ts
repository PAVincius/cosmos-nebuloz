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

  const { tenantId } = await requireTenantSession(await headers());

  if (capacityFactor < 0 || capacityFactor > 1) {
    return err("capacityFactor must be in [0, 1]");
  }

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

type Member = {
  userId: string;
  role: string | null;
  capacityFactor: number;
  avgSpPerSprint: number;
  p50: number;
  trend: string;
  volatility: number;
  sprintCount: number;
  expectedSp: number;
  minSp: number;
  maxSp: number;
};

export async function getTeamCapacityDashboard(teamId: string): Promise<
  | Ok<{
      members: Member[];
      totalExpected: number;
      totalMin: number;
      totalMax: number;
      teamId: string;
    }>
  | Err
> {
  const { tenantId } = await requireTenantSession(await headers());

  // Get active sprint for this team
  const activeSprint = await database.sprint.findFirst({
    where: {
      tenantId,
      team: { id: teamId },
      status: "ACTIVE",
    },
  });

  if (!activeSprint) {
    return err("Nenhum sprint ativo encontrado");
  }

  // Get all assignments for active sprint
  const assignments = await database.teamMemberAssignment.findMany({
    where: {
      tenantId,
      sprintId: activeSprint.id,
      teamId,
    },
  });

  if (assignments.length === 0) {
    return ok({
      members: [],
      totalExpected: 0,
      totalMin: 0,
      totalMax: 0,
      teamId,
    });
  }

  // Fetch baselines for all members
  const memberIds = assignments.map((a) => a.userId);
  const baselines = await database.memberThroughputBaseline.findMany({
    where: {
      tenantId,
      teamId,
      userId: { in: memberIds },
    },
  });

  const baselinesMap = new Map(baselines.map((b) => [b.userId, b]));

  const members: Member[] = assignments.map((assignment) => {
    const baseline = baselinesMap.get(assignment.userId);

    const expectedSp = baseline
      ? Math.round(baseline.avgSpPerSprint * assignment.capacityFactor)
      : 0;
    const minSp = baseline
      ? Math.round(baseline.p10Estimate * assignment.capacityFactor)
      : 0;
    const maxSp = baseline
      ? Math.round(baseline.p90Estimate * assignment.capacityFactor)
      : 0;

    return {
      userId: assignment.userId,
      role: assignment.role,
      capacityFactor: assignment.capacityFactor,
      avgSpPerSprint: baseline?.avgSpPerSprint ?? 0,
      p50: baseline?.p50Estimate ?? 0,
      trend: baseline?.trend ?? "NEUTRAL",
      volatility: baseline?.volatility ?? 0,
      sprintCount: baseline?.sprintCount ?? 0,
      expectedSp,
      minSp,
      maxSp,
    };
  });

  // Sum across team
  const totalExpected = members.reduce((sum, m) => sum + m.expectedSp, 0);
  const totalMin = members.reduce((sum, m) => sum + m.minSp, 0);
  const totalMax = members.reduce((sum, m) => sum + m.maxSp, 0);

  return ok({
    members,
    totalExpected,
    totalMin,
    totalMax,
    teamId,
  });
}
