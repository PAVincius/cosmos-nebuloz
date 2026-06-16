"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { calculateWSJF } from "@repo/safe-engine";
import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { logAudit } from "../audit/index";
import { portfolioEpicsCacheTag } from "../epics/portfolio-cache";
import { dispatchEvent } from "../events";
import { enforce } from "../permissions";
import { indexEntity } from "../safe-copilot/indexer";

import type { FeatureDetail, FeatureRow } from "./schema";

const CreateFeatureSchema = z.object({
  epicId: z.string().min(1),
  title: z.string().min(1),
  statusId: z
    .enum(["BACKLOG", "ANALYSIS", "REVIEW", "IMPLEMENTING", "DONE"])
    .default("BACKLOG"),
  storyPoints: z.number().int().min(1).max(999).default(1),
  bv: z.number().int().min(1).max(10).default(5),
  tc: z.number().int().min(1).max(10).default(3),
  rr: z.number().int().min(1).max(10).default(2),
  js: z.number().int().min(1).max(10).default(3),
  assigneeUserId: z.string().optional(),
});

export async function getEpicFeatures(epicId: string): Promise<FeatureRow[]> {
  const ctx = await requireTenantSession(await headers());
  return database.feature.findMany({
    where: { epicId, tenantId: ctx.tenantId },
    orderBy: { wsjfScore: "desc" },
    select: {
      id: true,
      title: true,
      statusId: true,
      storyPoints: true,
      bv: true,
      tc: true,
      rr: true,
      js: true,
      wsjfScore: true,
      epicId: true,
      assigneeUserId: true,
      completedAt: true,
      createdAt: true,
      externalSource: true,
      externalUrl: true,
    },
  });
}

export async function createFeature(raw: unknown) {
  const ctx = await requireTenantSession(await headers());
  enforce(ctx.role, "Feature", "create");
  const data = CreateFeatureSchema.parse(raw);

  const epic = await database.epic.findFirst({
    where: { id: data.epicId, tenantId: ctx.tenantId },
  });
  if (!epic) {
    throw new Error("Epic não encontrado.");
  }

  const wsjfScore = calculateWSJF({
    bv: data.bv,
    tc: data.tc,
    rr: data.rr,
    js: data.js,
  });

  const created = await database.feature.create({
    data: {
      tenantId: ctx.tenantId,
      epicId: data.epicId,
      title: data.title,
      statusId: data.statusId,
      storyPoints: data.storyPoints,
      bv: data.bv,
      tc: data.tc,
      rr: data.rr,
      js: data.js,
      wsjfScore,
      assigneeUserId: data.assigneeUserId,
    },
  });

  dispatchEvent({
    type: "feature.created",
    featureId: created.id,
    featureTitle: created.title,
    epicId: created.epicId ?? "",
    tenantId: ctx.tenantId,
    userId: ctx.userId,
  });
  logAudit(ctx.tenantId, {
    userId: ctx.userId,
    action: "created",
    entityType: "Feature",
    entityId: created.id,
  });

  queueMicrotask(() => {
    indexEntity("feature", created.id, ctx.tenantId).catch(() => {});
  });

  revalidatePath(`/epics/${data.epicId}/features`);
  revalidatePath(`/epics/${data.epicId}`);
  revalidateTag(portfolioEpicsCacheTag(ctx.tenantId), "max");
}

export async function updateFeatureStatus(
  id: string,
  statusId: string,
  epicId: string
) {
  const ctx = await requireTenantSession(await headers());
  await database.feature.updateMany({
    where: { id, tenantId: ctx.tenantId },
    data: {
      statusId,
      completedAt: statusId === "DONE" ? new Date() : null,
    },
  });
  revalidatePath(`/epics/${epicId}/features`);
  revalidateTag(portfolioEpicsCacheTag(ctx.tenantId), "max");
}

export async function updateFeatureStoryPoints(
  id: string,
  storyPoints: number,
  epicId: string
) {
  const ctx = await requireTenantSession(await headers());
  await database.feature.updateMany({
    where: { id, tenantId: ctx.tenantId },
    data: { storyPoints },
  });
  revalidatePath(`/epics/${epicId}/features`);
  revalidateTag(portfolioEpicsCacheTag(ctx.tenantId), "max");
}

export async function deleteFeature(id: string, epicId: string) {
  const ctx = await requireTenantSession(await headers());
  enforce(ctx.role, "Feature", "delete");
  await database.feature.deleteMany({ where: { id, tenantId: ctx.tenantId } });
  logAudit(ctx.tenantId, {
    userId: ctx.userId,
    action: "deleted",
    entityType: "Feature",
    entityId: id,
  });
  revalidatePath(`/epics/${epicId}/features`);
  revalidatePath(`/epics/${epicId}`);
  revalidateTag(portfolioEpicsCacheTag(ctx.tenantId), "max");
}

// ─── Wave 2 additions ─────────────────────────────────────────────────────────

const UpdateFeatureSchema = z.object({
  title: z.string().min(1).optional(),
  statusId: z
    .enum(["BACKLOG", "ANALYSIS", "REVIEW", "IMPLEMENTING", "DONE"])
    .optional(),
  storyPoints: z.number().int().min(1).max(999).optional(),
  bv: z.number().min(1).max(10).optional(),
  tc: z.number().min(1).max(10).optional(),
  rr: z.number().min(1).max(10).optional(),
  js: z.number().min(1).max(10).optional(),
  piPlanId: z.string().nullable().optional(),
  assigneeUserId: z.string().nullable().optional(),
});

export async function getFeatureById(
  id: string
): Promise<FeatureDetail | null> {
  const ctx = await requireTenantSession(await headers());
  return database.feature.findFirst({
    where: { id, tenantId: ctx.tenantId },
    include: {
      epic: { select: { id: true, title: true } },
      piPlan: { select: { id: true, name: true } },
    },
  }) as Promise<FeatureDetail | null>;
}

export async function getFeaturesByPIPlan(
  piPlanId: string
): Promise<FeatureRow[]> {
  const ctx = await requireTenantSession(await headers());
  return database.feature.findMany({
    where: { piPlanId, tenantId: ctx.tenantId },
    orderBy: { wsjfScore: "desc" },
    select: {
      id: true,
      title: true,
      statusId: true,
      storyPoints: true,
      bv: true,
      tc: true,
      rr: true,
      js: true,
      wsjfScore: true,
      epicId: true,
      assigneeUserId: true,
      completedAt: true,
      createdAt: true,
      externalSource: true,
      externalUrl: true,
    },
  });
}

type FeatureCurrent = { bv: number; tc: number; rr: number; js: number };
type FeatureInput = z.infer<typeof UpdateFeatureSchema>;

function recalculateWSJF(
  data: FeatureInput,
  current: FeatureCurrent
): number | undefined {
  const changed =
    data.bv !== undefined ||
    data.tc !== undefined ||
    data.rr !== undefined ||
    data.js !== undefined;
  if (!changed) {
    return;
  }
  return calculateWSJF({
    bv: data.bv ?? current.bv,
    tc: data.tc ?? current.tc,
    rr: data.rr ?? current.rr,
    js: data.js ?? current.js,
  });
}

function buildStatusFields(statusId: string) {
  return { statusId, completedAt: statusId === "DONE" ? new Date() : null };
}

function buildFeatureUpdateData(data: FeatureInput, feature: FeatureCurrent) {
  const wsjfScore = recalculateWSJF(data, feature);
  return {
    ...(data.title !== undefined && { title: data.title }),
    ...(data.statusId !== undefined && buildStatusFields(data.statusId)),
    ...(data.storyPoints !== undefined && { storyPoints: data.storyPoints }),
    ...(data.bv !== undefined && { bv: data.bv }),
    ...(data.tc !== undefined && { tc: data.tc }),
    ...(data.rr !== undefined && { rr: data.rr }),
    ...(data.js !== undefined && { js: data.js }),
    ...(wsjfScore !== undefined && { wsjfScore }),
    ...("piPlanId" in data && { piPlanId: data.piPlanId }),
    ...("assigneeUserId" in data && { assigneeUserId: data.assigneeUserId }),
  };
}

export async function updateFeature(id: string, raw: unknown) {
  const ctx = await requireTenantSession(await headers());
  enforce(ctx.role, "Feature", "update");
  const data = UpdateFeatureSchema.parse(raw);

  const feature = await database.feature.findFirst({
    where: { id, tenantId: ctx.tenantId },
  });
  if (!feature) {
    throw new Error("Feature não encontrada.");
  }

  await database.feature.updateMany({
    where: { id, tenantId: ctx.tenantId },
    data: buildFeatureUpdateData(data, feature),
  });

  dispatchEvent({
    type: "feature.updated",
    featureId: id,
    featureTitle: feature.title,
    tenantId: ctx.tenantId,
    userId: ctx.userId,
  });

  queueMicrotask(() => {
    indexEntity("feature", id, ctx.tenantId).catch(() => {});
  });

  revalidatePath(`/features/${id}`);
  if (feature.epicId) {
    revalidatePath(`/epics/${feature.epicId}/features`);
    revalidatePath(`/epics/${feature.epicId}`);
  }
  revalidateTag(portfolioEpicsCacheTag(ctx.tenantId), "max");
}
