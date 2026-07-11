"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { safeAction } from "../_base";

// ─── Types ────────────────────────────────────────────────────────────────────

export type HomeConfig = {
  persona: "rte" | "lpm" | "pm" | "team" | "spc" | "global";
  hiddenCells: string[];
  activeView: string;
};

// ─── Role → Persona mapping ───────────────────────────────────────────────────

const ROLE_TO_PERSONA: Record<string, HomeConfig["persona"]> = {
  RTE: "rte",
  SM: "team",
  PO: "pm",
  ADMIN: "lpm",
  STE: "lpm",
  DEV: "global",
  MEMBER: "global",
};

// ─── getHomeConfig ────────────────────────────────────────────────────────────

export async function getHomeConfig() {
  return safeAction(async () => {
    const { userId, tenantId } = await requireTenantSession(await headers());

    const layout = await database.userDashboardLayout.findFirst({
      where: { userId, tenantId },
    });

    if (layout?.config) {
      const raw = layout.config as Partial<HomeConfig>;
      return {
        persona: raw.persona ?? "global",
        hiddenCells: raw.hiddenCells ?? [],
        activeView: raw.activeView ?? "",
      } satisfies HomeConfig;
    }

    // Derive persona from role
    const member = await database.tenantMember.findFirst({
      where: { userId, tenantId },
      select: { role: true },
    });

    const persona: HomeConfig["persona"] =
      ROLE_TO_PERSONA[member?.role ?? ""] ?? "global";

    return {
      persona,
      hiddenCells: [],
      activeView: "",
    } satisfies HomeConfig;
  });
}

// ─── upsertHomeConfig ─────────────────────────────────────────────────────────

export async function upsertHomeConfig(updates: Partial<HomeConfig>) {
  return safeAction(async () => {
    const { userId, tenantId } = await requireTenantSession(await headers());

    const existing = await database.userDashboardLayout.findFirst({
      where: { userId, tenantId },
    });

    const existingConfig =
      existing?.config && typeof existing.config === "object"
        ? (existing.config as Partial<HomeConfig>)
        : {};

    const merged = { ...existingConfig, ...updates };

    if (existing) {
      return database.userDashboardLayout.update({
        where: { id: existing.id },
        data: { config: merged },
      });
    }

    return database.userDashboardLayout.create({
      data: { userId, tenantId, config: merged },
    });
  });
}

// ─── getRteHomeData ───────────────────────────────────────────────────────────

export async function getRteHomeData() {
  return safeAction(async () => {
    const { userId, tenantId } = await requireTenantSession(await headers());

    const [arts, risks, notifications, piObjectives, okrs] = await Promise.all([
      database.aRT.findMany({
        where: { tenantId },
        include: {
          piPlans: { orderBy: { createdAt: "desc" }, take: 1 },
        },
        take: 4,
      }),
      database.risk.findMany({
        where: { tenantId, status: { in: ["IDENTIFIED", "ROAM"] } },
        take: 5,
        orderBy: { createdAt: "desc" },
      }),
      database.notification.findMany({
        where: {
          tenantId,
          userId,
          read: false,
          type: { in: ["risk", "deadline", "mention"] },
        },
        take: 4,
        orderBy: { createdAt: "desc" },
      }),
      database.pIObjective.findMany({
        where: { tenantId },
        take: 20,
      }),
      database.oKR.findMany({
        where: { tenantId, type: "pi_art", archivedAt: null },
        include: {
          keyResults: { select: { id: true, current: true, target: true } },
        },
        take: 3,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return { arts, risks, notifications, piObjectives, okrs };
  });
}

// ─── getSmHomeData ────────────────────────────────────────────────────────────

export async function getSmHomeData() {
  return safeAction(async () => {
    const { userId, tenantId } = await requireTenantSession(await headers());

    const [team, impediments, notifications, activeSprint] = await Promise.all([
      database.team.findFirst({
        where: { tenantId },
      }),
      database.impediment.findMany({
        where: { tenantId, status: { not: "RESOLVED" } },
        take: 5,
      }),
      database.notification.findMany({
        where: {
          tenantId,
          userId,
          read: false,
          type: { in: ["mention", "assignment", "deadline"] },
        },
        take: 4,
        orderBy: { createdAt: "desc" },
      }),
      database.sprint.findFirst({
        where: { tenantId, status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // Team-level OKRs for SM widget
    const teamOkrs = team
      ? await database.oKR.findMany({
          where: { tenantId, type: "team_pi", archivedAt: null },
          include: {
            keyResults: { select: { id: true, current: true, target: true } },
          },
          take: 3,
          orderBy: { createdAt: "desc" },
        })
      : [];

    return { team, impediments, notifications, activeSprint, teamOkrs };
  });
}

// ─── getPmHomeData ────────────────────────────────────────────────────────────

export async function getPmHomeData() {
  return safeAction(async () => {
    const { userId, tenantId } = await requireTenantSession(await headers());

    const [okrs, notifications, piObjectives] = await Promise.all([
      database.oKR.findMany({
        where: { tenantId },
        include: { keyResults: true },
        take: 3,
      }),
      database.notification.findMany({
        where: {
          tenantId,
          userId,
          read: false,
          type: { in: ["deadline", "mention", "risk"] },
        },
        take: 4,
        orderBy: { createdAt: "desc" },
      }),
      database.pIObjective.findMany({
        where: { tenantId },
        take: 20,
      }),
    ]);

    return { okrs, notifications, piObjectives };
  });
}

// ─── getLpmHomeData ───────────────────────────────────────────────────────────

export async function getLpmHomeData() {
  return safeAction(async () => {
    const { tenantId } = await requireTenantSession(await headers());

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [
      arts,
      teamCount,
      activeEpicsCount,
      epicsInProgress,
      activePiPlans,
      closedSprints,
      costByTheme,
    ] = await Promise.all([
      database.aRT.findMany({
        where: { tenantId },
        take: 4,
      }),
      database.team.count({ where: { tenantId } }),
      database.epic.count({
        where: { tenantId, lifecycleStatus: { notIn: ["DONE", "REJECTED"] } },
      }),
      database.epic.findMany({
        where: { tenantId, lifecycleStatus: "IMPLEMENTING" },
        select: {
          id: true,
          title: true,
          dueDate: true,
          featureCount: true,
          doneFeatureCount: true,
          investScore: true,
          strategicTheme: { select: { title: true, color: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 6,
      }),
      database.pIPlan.findMany({
        where: { tenantId, status: "EXECUTING" },
        select: { id: true, name: true, ppm: true, completionPct: true },
        orderBy: { updatedAt: "desc" },
        take: 4,
      }),
      database.sprint.findMany({
        where: { tenantId, status: "CLOSED" },
        select: { id: true, velocity: true, endDate: true },
        orderBy: { endDate: "desc" },
        take: 6,
      }),
      database.costSnapshot.groupBy({
        by: ["themeId"],
        where: { tenantId, period: { gte: startOfMonth } },
        _sum: { cloudCost: true },
      }),
    ]);

    const themeIds = costByTheme
      .map((row) => row.themeId)
      .filter((id): id is string => Boolean(id));

    const themes = themeIds.length
      ? await database.strategicTheme.findMany({
          where: { tenantId, id: { in: themeIds } },
          select: { id: true, title: true, color: true },
        })
      : [];

    const themeAllocation = costByTheme
      .map((row) => {
        const theme = themes.find((t) => t.id === row.themeId);
        return {
          id: row.themeId ?? "unmapped",
          title: theme?.title ?? "Não mapeado",
          color: theme?.color ?? "#8a8f98",
          cloudCost: Number(row._sum.cloudCost ?? 0),
        };
      })
      .filter((row) => row.cloudCost > 0)
      .sort((a, b) => b.cloudCost - a.cloudCost)
      .slice(0, 5);

    const cloudCostMtd = themeAllocation.reduce(
      (sum, row) => sum + row.cloudCost,
      0
    );

    const predictabilityPct =
      activePiPlans.length > 0
        ? Math.round(
            activePiPlans.reduce(
              (sum, plan) => sum + (plan.ppm ?? plan.completionPct ?? 0),
              0
            ) / activePiPlans.length
          )
        : null;

    const sprintVelocities = [...closedSprints].reverse();
    const lastVelocity = sprintVelocities.at(-1)?.velocity ?? null;
    const prevVelocity = sprintVelocities.at(-2)?.velocity ?? null;
    const throughputDeltaPct =
      lastVelocity !== null && prevVelocity
        ? Math.round(((lastVelocity - prevVelocity) / prevVelocity) * 100)
        : null;

    return {
      arts,
      teamCount,
      activeEpicsCount,
      epicsInProgress,
      currentPiName: activePiPlans[0]?.name ?? null,
      predictabilityPct,
      sprintVelocities,
      throughputDeltaPct,
      themeAllocation,
      cloudCostMtd,
    };
  });
}

// ─── getGlobalHomeData ────────────────────────────────────────────────────────

export async function getGlobalHomeData() {
  return safeAction(async () => {
    const { userId, tenantId } = await requireTenantSession(await headers());

    const [arts, notifications] = await Promise.all([
      database.aRT.findMany({
        where: { tenantId },
        take: 4,
      }),
      database.notification.findMany({
        where: { tenantId, userId, read: false },
        take: 4,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return { arts, notifications };
  });
}
