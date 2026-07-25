"use server";

import { requireRole, requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import type { EpicWithFeatures, FeatureWSJF, WSJFConfig } from "./schema";

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: WSJFConfig = {
  scale: [1, 2, 3, 5, 8, 13, 20],
  labels: {
    bv: "Business Value",
    tc: "Time Criticality",
    rr: "Risk Reduction / OE",
    js: "Job Size",
  },
};

function isWSJFConfig(value: unknown): value is WSJFConfig {
  if (!value || typeof value !== "object") {
    return false;
  }
  const obj = value as Record<string, unknown>;
  if (!Array.isArray(obj.scale)) {
    return false;
  }
  if (typeof obj.labels !== "object" || !obj.labels) {
    return false;
  }
  const labels = obj.labels as Record<string, unknown>;
  return (
    typeof labels.bv === "string" &&
    typeof labels.tc === "string" &&
    typeof labels.rr === "string" &&
    typeof labels.js === "string"
  );
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function getEpicsWithFeatureWSJF(): Promise<EpicWithFeatures[]> {
  const ctx = await requireTenantSession(await headers());

  const [epics, deps] = await Promise.all([
    database.epic.findMany({
      where: { tenantId: ctx.tenantId },
      include: {
        features: true,
        strategicTheme: { select: { title: true, color: true } },
      },
      orderBy: [{ statusId: "asc" }, { order: "asc" }],
    }),
    database.dependencyLink.findMany({
      where: { tenantId: ctx.tenantId },
      select: { blockingFeature: { select: { epicId: true } } },
    }),
  ]);

  const depCountByEpic = new Map<string, number>();
  for (const dep of deps) {
    const epicId = dep.blockingFeature.epicId;
    if (epicId) {
      depCountByEpic.set(epicId, (depCountByEpic.get(epicId) ?? 0) + 1);
    }
  }

  const result: EpicWithFeatures[] = epics.map((epic) => {
    const features: FeatureWSJF[] = epic.features.map((f) => ({
      id: f.id,
      title: f.title,
      bv: f.bv,
      tc: f.tc,
      rr: f.rr,
      js: f.js,
      wsjfScore: f.wsjfScore,
      statusId: f.statusId,
      externalSource: f.externalSource ?? null,
      externalUrl: f.externalUrl ?? null,
    }));

    const totalWSJF =
      features.length > 0
        ? Math.round(
            (features.reduce((sum, f) => sum + f.wsjfScore, 0) /
              features.length) *
              100
          ) / 100
        : 0;

    return {
      id: epic.id,
      title: epic.title,
      statusId: epic.statusId,
      features,
      totalWSJF,
      dependencyCount: depCountByEpic.get(epic.id) ?? 0,
      themeTitle: epic.strategicTheme?.title ?? null,
      themeColor: epic.strategicTheme?.color ?? null,
    };
  });

  return result.sort((a, b) => b.totalWSJF - a.totalWSJF);
}

export async function getWSJFConfig(): Promise<WSJFConfig> {
  const ctx = await requireTenantSession(await headers());

  const tenant = await database.tenant.findFirst({
    where: { id: ctx.tenantId },
    select: { metadata: true },
  });

  if (!tenant) {
    return DEFAULT_CONFIG;
  }

  const meta = tenant.metadata;
  if (!meta || typeof meta !== "object") {
    return DEFAULT_CONFIG;
  }

  const raw = (meta as Record<string, unknown>).wsjfConfig;
  if (isWSJFConfig(raw)) {
    return raw;
  }

  return DEFAULT_CONFIG;
}

export async function saveWSJFConfig(config: WSJFConfig): Promise<void> {
  const ctx = await requireTenantSession(await headers());
  requireRole(["ADMIN", "STE", "RTE"], ctx);

  const tenant = await database.tenant.findFirst({
    where: { id: ctx.tenantId },
    select: { metadata: true },
  });

  const existingMeta =
    tenant?.metadata && typeof tenant.metadata === "object"
      ? (tenant.metadata as Record<string, unknown>)
      : {};

  await database.tenant.update({
    where: { id: ctx.tenantId },
    data: {
      metadata: {
        ...existingMeta,
        wsjfConfig: config,
      },
    },
  });

  revalidatePath("/portfolio/wsjf");
}
