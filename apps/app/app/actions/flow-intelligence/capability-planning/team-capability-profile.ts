import { database } from "@repo/database";
import { TASK_TYPES } from "./capability-schema";

export async function computeTeamCapability(args: {
  tenantId: string;
  teamId: string;
  windowSprints: number;
}) {
  const recentSprints = await database.sprint.findMany({
    where: { tenantId: args.tenantId, teamId: args.teamId, status: "COMPLETED" },
    orderBy: { endDate: "desc" },
    take: args.windowSprints,
    select: { id: true },
  });
  const sprintIds = recentSprints.map((s) => s.id);
  if (sprintIds.length === 0) {
    return { teamId: args.teamId, artId: null, capabilities: {}, windowSprints: args.windowSprints };
  }

  const tasks = await database.task.findMany({
    where: {
      tenantId: args.tenantId,
      story: { sprintId: { in: sprintIds } },
      status: "DONE",
      taskType: { not: null },
    },
    select: {
      taskType: true,
      actualSp: true,
      estimatedSp: true,
      createdAt: true,
      completedAt: true,
    },
  });

  const byType: Record<string, { count: number; sp: number; cycleHours: number[] }> = {};
  for (const t of tasks) {
    if (!t.taskType) continue;
    if (!byType[t.taskType]) {
      byType[t.taskType] = { count: 0, sp: 0, cycleHours: [] };
    }
    byType[t.taskType].count++;
    byType[t.taskType].sp += t.actualSp ?? t.estimatedSp ?? 0;
    if (t.completedAt) {
      const hours = (t.completedAt.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60);
      byType[t.taskType].cycleHours.push(hours);
    }
  }

  const capabilities: Record<
    string,
    { deliveredSp: number; avgCycleTimeHours: number; confidenceLevel: number }
  > = {};
  for (const k of TASK_TYPES) {
    const stats = byType[k];
    if (!stats || stats.count === 0) continue;
    const avgCycle =
      stats.cycleHours.length > 0
        ? stats.cycleHours.reduce((a, b) => a + b, 0) / stats.cycleHours.length
        : 0;
    capabilities[k] = {
      deliveredSp: stats.sp,
      avgCycleTimeHours: avgCycle,
      confidenceLevel: Math.min(1, stats.count / 20),
    };
  }

  const team = await database.team.findUnique({
    where: { id: args.teamId },
    select: { artId: true },
  });

  return {
    teamId: args.teamId,
    artId: (team as { artId?: string | null } | null)?.artId ?? null,
    capabilities,
    windowSprints: args.windowSprints,
  };
}
