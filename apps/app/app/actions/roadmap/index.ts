"use server";

import { requireTenantSession } from "@repo/auth/server";
import type { RoadmapItem } from "@repo/database";
import { database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { type Result, safeAction } from "@/app/actions/_base";
import {
  CreateRoadmapItemSchema,
  RoadmapFiltersSchema,
  type RoadmapItemData,
  type RoadmapItemWithRelations,
  type RoadmapStatus as RoadmapStatusType,
  UpdateRoadmapItemSchema,
} from "./schema";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function durationDays(startDate: Date, endDate: Date): number {
  return Math.max(
    0,
    Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000)
  );
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function listRoadmapItems(
  raw?: unknown
): Promise<Result<RoadmapItemWithRelations[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const input = RoadmapFiltersSchema.parse(raw ?? {});

    const where = {
      tenantId: ctx.tenantId,
      ...(input.artId !== undefined && { artId: input.artId }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.from !== undefined || input.to !== undefined
        ? {
            startDate: {
              ...(input.from !== undefined && { gte: input.from }),
              ...(input.to !== undefined && { lte: input.to }),
            },
          }
        : {}),
    };

    const items = await database.roadmapItem.findMany({
      where,
      orderBy: { startDate: "asc" },
    });

    if (items.length === 0) {
      return [];
    }

    // Batch-fetch related epics and ARTs to avoid N+1
    const epicIds = [
      ...new Set(
        items.map((i) => i.epicId).filter((x): x is string => x !== null)
      ),
    ];
    const artIds = [
      ...new Set(
        items.map((i) => i.artId).filter((x): x is string => x !== null)
      ),
    ];

    const [epics, arts] = await Promise.all([
      epicIds.length > 0
        ? database.epic.findMany({
            where: { id: { in: epicIds }, tenantId: ctx.tenantId },
            select: { id: true, title: true, statusId: true },
          })
        : Promise.resolve([]),
      artIds.length > 0
        ? database.aRT.findMany({
            where: { id: { in: artIds }, tenantId: ctx.tenantId },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
    ]);

    const epicMap = new Map(epics.map((e) => [e.id, e]));
    const artMap = new Map(arts.map((a) => [a.id, a]));

    return items.map((item) => ({
      ...item,
      epic: item.epicId ? (epicMap.get(item.epicId) ?? null) : null,
      art: item.artId ? (artMap.get(item.artId) ?? null) : null,
      durationDays: durationDays(item.startDate, item.endDate),
    }));
  });
}

export async function getRoadmapItemById(
  id: string
): Promise<Result<RoadmapItemWithRelations>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const item = await database.roadmapItem.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });

    if (!item) {
      throw new Error("Item de roadmap não encontrado.");
    }

    const [epic, art] = await Promise.all([
      item.epicId
        ? database.epic.findFirst({
            where: { id: item.epicId, tenantId: ctx.tenantId },
            select: { id: true, title: true, statusId: true },
          })
        : Promise.resolve(null),
      item.artId
        ? database.aRT.findFirst({
            where: { id: item.artId, tenantId: ctx.tenantId },
            select: { id: true, name: true },
          })
        : Promise.resolve(null),
    ]);

    return {
      ...item,
      epic,
      art,
      durationDays: durationDays(item.startDate, item.endDate),
    };
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export async function createRoadmapItem(
  raw: unknown
): Promise<Result<RoadmapItem>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const input = CreateRoadmapItemSchema.parse(raw);

    // Verify epicId belongs to tenant if provided
    if (input.epicId) {
      const epic = await database.epic.findFirst({
        where: { id: input.epicId, tenantId: ctx.tenantId },
      });
      if (!epic) {
        throw new Error("Épico não encontrado ou sem permissão.");
      }
    }

    const item = await database.roadmapItem.create({
      data: {
        tenantId: ctx.tenantId,
        title: input.title,
        description: input.description ?? null,
        startDate: input.startDate,
        endDate: input.endDate,
        color: input.color,
        status: input.status,
        epicId: input.epicId ?? null,
        artId: input.artId ?? null,
      },
    });

    revalidatePath("/portfolio/roadmap");
    revalidatePath("/portfolio");
    return item;
  });
}

export async function updateRoadmapItem(
  id: string,
  raw: unknown
): Promise<Result<RoadmapItem>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const input = UpdateRoadmapItemSchema.parse(raw);

    const { count } = await database.roadmapItem.updateMany({
      where: { id, tenantId: ctx.tenantId },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.description !== undefined && {
          description: input.description ?? null,
        }),
        ...(input.startDate !== undefined && { startDate: input.startDate }),
        ...(input.endDate !== undefined && { endDate: input.endDate }),
        ...(input.color !== undefined && { color: input.color }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.epicId !== undefined && { epicId: input.epicId ?? null }),
        ...(input.artId !== undefined && { artId: input.artId ?? null }),
      },
    });

    if (count === 0) {
      throw new Error("Item de roadmap não encontrado ou sem permissão.");
    }

    const updated = await database.roadmapItem.findFirstOrThrow({
      where: { id, tenantId: ctx.tenantId },
    });

    revalidatePath("/portfolio/roadmap");
    revalidatePath("/portfolio");
    return updated;
  });
}

export async function deleteRoadmapItem(
  id: string
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const { count } = await database.roadmapItem.deleteMany({
      where: { id, tenantId: ctx.tenantId },
    });

    if (count === 0) {
      throw new Error("Item de roadmap não encontrado ou sem permissão.");
    }

    revalidatePath("/portfolio/roadmap");
    revalidatePath("/portfolio");
    return { id };
  });
}

// ─── Backward-compatible helpers (for existing UI components) ─────────────────

/** @deprecated use listRoadmapItems */
export async function getRoadmapItems(): Promise<RoadmapItemData[]> {
  const result = await listRoadmapItems({});
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.data.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    startDate: item.startDate,
    endDate: item.endDate,
    color: item.color,
    status: item.status as RoadmapStatusType,
    epicId: item.epicId,
    artId: item.artId,
  }));
}
