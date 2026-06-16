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
    const { userId, tenantId } = await requireTenantSession(await headers());

    const [leanBudgets, notifications, arts, pendingEpics] = await Promise.all([
      database.leanBudget.findMany({
        where: { tenantId },
        take: 5,
      }),
      database.notification.findMany({
        where: {
          tenantId,
          userId,
          read: false,
          type: { in: ["risk", "system"] },
        },
        take: 4,
        orderBy: { createdAt: "desc" },
      }),
      database.aRT.findMany({
        where: { tenantId },
        take: 4,
      }),
      database.epic.findMany({
        where: {
          tenantId,
          lifecycleStatus: { in: ["FUNNEL", "ANALYZING"] },
        },
        take: 5,
      }),
    ]);

    return { leanBudgets, notifications, arts, pendingEpics };
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
