"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import type {
  SprintWindow,
  MemberVelocityStats,
  TeamVelocityStats,
  BurndownEntry,
  BurndownPoint,
} from "./schema";

export type { SprintWindow, MemberVelocityStats, TeamVelocityStats, BurndownEntry, BurndownPoint };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SPRINT_LENGTH_DAYS = 14;
const TOTAL_SPRINT_WINDOWS = 6;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build an array of rolling sprint windows counting backward from `now`.
 * Window index 1 = most recent (Sprint -1), index N = oldest (Sprint -N).
 */
function buildSprintWindows(
  now: Date,
  count: number,
  lengthDays: number
): SprintWindow[] {
  const windows: SprintWindow[] = [];
  const nowMs = now.getTime();

  for (let i = 1; i <= count; i++) {
    const endMs = nowMs - (i - 1) * lengthDays * 24 * 60 * 60 * 1000;
    const startMs = endMs - lengthDays * 24 * 60 * 60 * 1000;
    windows.push({
      sprintLabel: `Sprint -${i}`,
      startDate: new Date(startMs),
      endDate: new Date(endMs),
      spCompleted: 0,
      featuresCompleted: 0,
    });
  }

  return windows;
}

/**
 * Return midnight (start of day) for a given date.
 */
function startOfDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

/**
 * Add N days to a date, returning a new Date.
 */
function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// Function 1: getMemberVelocityStats
// ---------------------------------------------------------------------------

export async function getMemberVelocityStats(
  userId: string
): Promise<MemberVelocityStats> {
  const ctx = await requireTenantSession(await headers());

  // Guard: user must belong to the caller's tenant
  const membership = await database.tenantMember.findFirst({
    where: { tenantId: ctx.tenantId, userId },
  });

  if (!membership) {
    throw new Error("User not found in this tenant");
  }

  // Fetch all completed features assigned to this user within this tenant
  const completedFeatures = await database.feature.findMany({
    where: {
      tenantId: ctx.tenantId,
      assigneeUserId: userId,
      completedAt: { not: null },
    },
    select: {
      id: true,
      storyPoints: true,
      completedAt: true,
    },
  });

  const totalFeaturesCompleted = completedFeatures.length;
  const totalSPCompleted = completedFeatures.reduce(
    (sum, f) => sum + f.storyPoints,
    0
  );

  // Build sprint windows and assign features to each window
  const now = new Date();
  const windows = buildSprintWindows(now, TOTAL_SPRINT_WINDOWS, SPRINT_LENGTH_DAYS);

  for (const feature of completedFeatures) {
    const completedAt = feature.completedAt as Date;
    for (const window of windows) {
      if (completedAt >= window.startDate && completedAt < window.endDate) {
        window.spCompleted += feature.storyPoints;
        window.featuresCompleted += 1;
        break;
      }
    }
  }

  // Calculate avgSPPerSprint over windows that have data
  const windowsWithData = windows.filter((w) => w.spCompleted > 0);
  let avgSPPerSprint = 0;

  if (windowsWithData.length >= 2) {
    const totalSPInWindows = windowsWithData.reduce(
      (sum, w) => sum + w.spCompleted,
      0
    );
    avgSPPerSprint = totalSPInWindows / windowsWithData.length;
  } else if (totalSPCompleted > 0) {
    // Fewer than 2 windows with data: estimate from total history
    const estimatedSprints = Math.max(
      1,
      Math.ceil(
        (now.getTime() -
          Math.min(
            ...completedFeatures.map((f) => (f.completedAt as Date).getTime())
          )) /
          (SPRINT_LENGTH_DAYS * 24 * 60 * 60 * 1000)
      )
    );
    avgSPPerSprint = totalSPCompleted / estimatedSprints;
  }

  return {
    userId,
    totalFeaturesCompleted,
    totalSPCompleted,
    avgSPPerSprint,
    recentSprints: windows,
  };
}

// ---------------------------------------------------------------------------
// Function 2: getTeamVelocityStats
// ---------------------------------------------------------------------------

type TeamMemberEntry = {
  id: string;
  [key: string]: unknown;
};

export async function getTeamVelocityStats(
  teamId: string
): Promise<TeamVelocityStats> {
  const ctx = await requireTenantSession(await headers());

  // Fetch team — guards tenancy
  const team = await database.team.findFirst({
    where: { id: teamId, tenantId: ctx.tenantId },
  });

  if (!team) {
    throw new Error("Team not found or access denied");
  }

  // Extract member userIds from the JSON `members` field
  const rawMembers = (team.members ?? []) as TeamMemberEntry[];
  const memberUserIds: string[] = Array.isArray(rawMembers)
    ? rawMembers.map((m) => m.id).filter(Boolean)
    : [];

  // Fetch velocity stats for all members in parallel
  const memberStats =
    memberUserIds.length > 0
      ? await Promise.all(
          memberUserIds.map((uid) =>
            getMemberVelocityStats(uid).catch(() => ({
              userId: uid,
              totalFeaturesCompleted: 0,
              totalSPCompleted: 0,
              avgSPPerSprint: 0,
              recentSprints: buildSprintWindows(
                new Date(),
                TOTAL_SPRINT_WINDOWS,
                SPRINT_LENGTH_DAYS
              ),
            }))
          )
        )
      : [];

  const totalTeamSPPerSprint = memberStats.reduce(
    (sum, m) => sum + m.avgSPPerSprint,
    0
  );

  // Build burndown data (tenant-level v1 — Features not yet linked to Teams)
  const now = new Date();
  const sprintStart = addDays(now, -SPRINT_LENGTH_DAYS);

  const sprintFeatures = await database.feature.findMany({
    where: {
      tenantId: ctx.tenantId,
      createdAt: { gte: sprintStart },
    },
    select: {
      id: true,
      storyPoints: true,
      statusId: true,
      completedAt: true,
      updatedAt: true,
    },
  });

  const totalSP = sprintFeatures.reduce((sum, f) => sum + f.storyPoints, 0);

  // Build one entry per day of the sprint (SPRINT_LENGTH_DAYS entries)
  const burndownData: BurndownEntry[] = [];

  for (let dayIndex = 0; dayIndex < SPRINT_LENGTH_DAYS; dayIndex++) {
    const dayStart = startOfDay(addDays(sprintStart, dayIndex));
    const dayEnd = addDays(dayStart, 1);

    let completedSP = 0;
    let inProgressSP = 0;

    for (const feature of sprintFeatures) {
      // Use completedAt if set, otherwise fall back to updatedAt for DONE features
      const resolvedCompletedAt =
        feature.completedAt ??
        (feature.statusId === "DONE" ? feature.updatedAt : null);

      if (resolvedCompletedAt !== null && resolvedCompletedAt < dayEnd) {
        completedSP += feature.storyPoints;
      } else if (feature.statusId === "IMPLEMENTING") {
        inProgressSP += feature.storyPoints;
      }
    }

    burndownData.push({
      date: dayStart.toISOString(),
      totalSP,
      completedSP,
      inProgressSP,
      remainingSP: Math.max(0, totalSP - completedSP),
    });
  }

  return {
    teamId,
    memberStats,
    totalTeamSPPerSprint,
    burndownData,
  };
}

// ---------------------------------------------------------------------------
// Function 3: getSprintBurndownData
// ---------------------------------------------------------------------------

export async function getSprintBurndownData(
  sprintLengthDays: number,
  teamId?: string
): Promise<BurndownPoint[]> {
  const ctx = await requireTenantSession(await headers());

  const now = new Date();
  const sprintStart = addDays(now, -sprintLengthDays);

  // If teamId provided, resolve team member ids for filtering
  let memberUserIds: string[] | null = null;

  if (teamId) {
    const team = await database.team.findFirst({
      where: { id: teamId, tenantId: ctx.tenantId },
    });

    if (team && Array.isArray(team.members)) {
      const rawMembers = team.members as TeamMemberEntry[];
      memberUserIds = rawMembers.map((m) => m.id).filter(Boolean);
    }
  }

  // Build feature query — filter by team members if provided
  const features = await database.feature.findMany({
    where: {
      tenantId: ctx.tenantId,
      ...(memberUserIds !== null
        ? { assigneeUserId: { in: memberUserIds } }
        : {}),
    },
    select: {
      id: true,
      storyPoints: true,
      statusId: true,
      completedAt: true,
      updatedAt: true,
    },
  });

  const totalSP = features.reduce((sum, f) => sum + f.storyPoints, 0);

  // Build one burndown point per sprint day
  const points: BurndownPoint[] = [];

  for (let day = 1; day <= sprintLengthDays; day++) {
    const dayStart = startOfDay(addDays(sprintStart, day - 1));
    const dayEnd = addDays(dayStart, 1);
    const isFuture = dayEnd > now;

    let completed = 0;
    let inProgress = 0;

    for (const feature of features) {
      const resolvedCompletedAt =
        feature.completedAt ??
        (feature.statusId === "DONE" ? feature.updatedAt : null);

      if (resolvedCompletedAt !== null && resolvedCompletedAt < dayEnd) {
        completed += feature.storyPoints;
      } else if (feature.statusId === "IMPLEMENTING") {
        inProgress += feature.storyPoints;
      }
    }

    // ideal: linear decrease from totalSP (day 0) to 0 (day N)
    const ideal = Math.round(totalSP * (1 - day / sprintLengthDays));

    points.push({
      day,
      label: `Dia ${day}`,
      ideal,
      actual: isFuture ? null : Math.max(0, totalSP - completed),
      completed,
      inProgress,
    });
  }

  return points;
}

// ---------------------------------------------------------------------------
// Function 4: getVelocityOverview — ART/tenant-level summary
// ---------------------------------------------------------------------------

export type TeamVelocitySummary = {
  teamId: string;
  teamName: string;
  artId: string | null;
  artName: string | null;
  avgSPPerSprint: number;
  lastSprintSP: number;
  trend: "up" | "down" | "neutral";
  sprints: { label: string; sp: number }[];
};

export async function getVelocityOverview(artId?: string): Promise<TeamVelocitySummary[]> {
  const ctx = await requireTenantSession(await headers());

  const teams = await database.team.findMany({
    where: {
      tenantId: ctx.tenantId,
      ...(artId ? { artId } : {}),
    },
    include: { art: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
  });

  const now = new Date();
  const numSprints = 6;

  const result: TeamVelocitySummary[] = await Promise.all(
    teams.map(async (team) => {
      const rawMembers = (team.members ?? []) as { id: string }[];
      const memberIds = Array.isArray(rawMembers) ? rawMembers.map((m) => m.id).filter(Boolean) : [];

      const sprints: { label: string; sp: number }[] = [];
      for (let i = numSprints; i >= 1; i--) {
        const end   = new Date(now.getTime() - (i - 1) * SPRINT_LENGTH_DAYS * 86_400_000);
        const start = new Date(end.getTime() - SPRINT_LENGTH_DAYS * 86_400_000);

        const completed = memberIds.length > 0
          ? await database.feature.count({
              where: {
                tenantId: ctx.tenantId,
                assigneeUserId: { in: memberIds },
                statusId: { in: ["DONE", "COMPLETED", "done", "completed"] },
                updatedAt: { gte: start, lt: end },
              },
            })
          : 0;

        sprints.push({ label: `S-${i}`, sp: completed });
      }

      const nonZero = sprints.filter((s) => s.sp > 0);
      const avgSPPerSprint = nonZero.length > 0
        ? Math.round(nonZero.reduce((s, x) => s + x.sp, 0) / nonZero.length)
        : 0;
      const lastSprintSP = sprints[sprints.length - 1]?.sp ?? 0;
      const prevSprintSP = sprints[sprints.length - 2]?.sp ?? 0;
      const trend: "up" | "down" | "neutral" =
        lastSprintSP > prevSprintSP ? "up" : lastSprintSP < prevSprintSP ? "down" : "neutral";

      return {
        teamId:       team.id,
        teamName:     team.name,
        artId:        team.artId,
        artName:      team.art?.name ?? null,
        avgSPPerSprint,
        lastSprintSP,
        trend,
        sprints,
      };
    })
  );

  return result.sort((a, b) => b.avgSPPerSprint - a.avgSPPerSprint);
}
