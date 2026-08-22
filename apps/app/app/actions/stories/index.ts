"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import {
  buildPage,
  nnStr,
  optCuid,
  optStr,
  type Page,
  Priority,
  paginationArgs,
  type Result,
  StoryStatus,
  safeAction,
} from "../_base";
import { syncFeatureProgress, syncTeamWip } from "../_denorm";
import { logAudit } from "../audit/log-audit";
import { dispatchEvent } from "../events";
import { enforce } from "../permissions";
import { evaluateStoryInvest } from "./invest-utils";

// ─── Internal schemas (not exported from "use server") ────────────────────────

const CreateStorySchema = z.object({
  sprintId: optCuid,
  featureId: optCuid,
  title: nnStr,
  description: optStr,
  acceptanceCriteria: optStr,
  storyPoints: z.number().int().min(0).max(100).default(1),
  status: StoryStatus.default("BACKLOG"),
  priority: Priority.default("medium"),
  assigneeUserId: optCuid,
  order: z.number().int().nonnegative().default(0),
});

const UpdateStorySchema = CreateStorySchema.partial();

const StoryFiltersSchema = z.object({
  sprintId: optCuid,
  featureId: optCuid,
  status: StoryStatus.optional(),
  assigneeUserId: optCuid,
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function resolveTeamId(
  ctx: { tenantId: string },
  sprintId: string | null | undefined
): Promise<string | null> {
  if (!sprintId) {
    return null;
  }
  const sprint = await database.sprint.findFirst({
    where: { id: sprintId, tenantId: ctx.tenantId },
    select: { teamId: true },
  });
  return sprint?.teamId ?? null;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

async function listStories(raw: unknown): Promise<Result<Page<any>>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const { page, limit, sprintId, featureId, status, assigneeUserId, search } =
      StoryFiltersSchema.parse(raw);

    const where = {
      tenantId: ctx.tenantId,
      ...(sprintId && { sprintId }),
      ...(featureId && { featureId }),
      ...(status && { status }),
      ...(assigneeUserId && { assigneeUserId }),
      ...(search && {
        title: { contains: search, mode: "insensitive" as const },
      }),
    };

    const [items, total] = await Promise.all([
      database.story.findMany({
        where,
        orderBy: [{ order: "asc" }, { createdAt: "desc" }],
        include: {
          tasks: { select: { id: true, status: true } },
        },
        ...paginationArgs(page, limit),
      }),
      database.story.count({ where }),
    ]);

    return buildPage(items, total, page, limit);
  });
}

async function getStoryById(id: string): Promise<Result<any>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const story = await database.story.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: {
        tasks: { orderBy: { createdAt: "asc" } },
        sprint: true,
        feature: true,
      },
    });

    if (!story) {
      throw new Error("Story não encontrada");
    }
    return story;
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createStory(raw: unknown): Promise<Result<any>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    enforce(ctx.role, "Story", "create");
    const data = CreateStorySchema.parse(raw);

    const story = await database.story.create({
      data: { ...data, tenantId: ctx.tenantId },
    });

    if (data.assigneeUserId) {
      void dispatchEvent({
        type: "story.assigned",
        storyId: story.id,
        storyTitle: story.title,
        assigneeUserId: data.assigneeUserId,
        tenantId: ctx.tenantId,
        userId: ctx.userId,
      });
    }
    logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "created",
      entityType: "Story",
      entityId: story.id,
    });

    const teamId = await resolveTeamId(ctx, data.sprintId ?? null);
    if (teamId) {
      revalidatePath(`/teams/${teamId}/kanban`);
      if (data.sprintId) {
        revalidatePath(`/teams/${teamId}/sprints/${data.sprintId}`);
      }
    }
    revalidatePath("/teams");

    if (data.featureId) {
      void syncFeatureProgress(data.featureId, ctx.tenantId);
    }
    if (teamId) {
      void syncTeamWip(teamId, ctx.tenantId);
    }

    return story;
  });
}

async function updateStory(id: string, raw: unknown): Promise<Result<any>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    enforce(ctx.role, "Story", "update");
    const data = UpdateStorySchema.parse(raw);

    const story = await database.story.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: { sprint: { select: { teamId: true } } },
    });
    if (!story) {
      throw new Error("Story não encontrada");
    }

    if ((data.status as string) === "READY") {
      const invest = evaluateStoryInvest({ ...story, ...data });
      const errorCriteria = invest.criteria.filter(
        (c) => !c.pass && c.level === "ERROR"
      );
      if (errorCriteria.length > 0) {
        throw new Error(
          `INVEST_BLOCK: ${errorCriteria.map((c) => c.hint).join("; ")}`
        );
      }
    }

    const completedAt =
      data.status === "DONE" && story.status !== "DONE"
        ? new Date()
        : data.status !== "DONE" && story.status === "DONE"
          ? null
          : undefined;

    const updated = await database.story.update({
      where: { id },
      data: { ...data, ...(completedAt !== undefined && { completedAt }) },
    });

    logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "updated",
      entityType: "Story",
      entityId: id,
      diff: data as Record<string, string>,
    });

    if (data.status !== undefined && data.status !== story.status) {
      void dispatchEvent({
        type: "story.status_changed",
        storyId: id,
        storyTitle: story.title,
        from: story.status,
        to: data.status,
        assigneeUserId: story.assigneeUserId ?? undefined,
        tenantId: ctx.tenantId,
        userId: ctx.userId,
      });
    }
    if (
      data.assigneeUserId !== undefined &&
      data.assigneeUserId !== story.assigneeUserId
    ) {
      void dispatchEvent({
        type: "story.assigned",
        storyId: id,
        storyTitle: story.title,
        assigneeUserId: data.assigneeUserId,
        tenantId: ctx.tenantId,
        userId: ctx.userId,
      });
    }

    const teamId = story.sprint?.teamId;
    if (teamId) {
      revalidatePath(`/teams/${teamId}/kanban`);
      if (story.sprintId) {
        revalidatePath(`/teams/${teamId}/sprints/${story.sprintId}`);
      }
      if (data.sprintId && data.sprintId !== story.sprintId) {
        revalidatePath(`/teams/${teamId}/sprints/${data.sprintId}`);
      }
    }
    revalidatePath("/teams");

    if (data.status !== undefined && data.status !== story.status) {
      if (story.featureId) {
        void syncFeatureProgress(story.featureId, ctx.tenantId);
      }
      if (teamId) {
        void syncTeamWip(teamId, ctx.tenantId);
      }
    }

    return updated;
  });
}

export async function updateStoryStatus(
  id: string,
  status: string
): Promise<Result<any>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    enforce(ctx.role, "Story", "update");
    const validStatus = StoryStatus.parse(status);

    const story = await database.story.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: { sprint: { select: { teamId: true } } },
    });
    if (!story) {
      throw new Error("Story não encontrada");
    }

    const completedAt = validStatus === "DONE" ? new Date() : null;

    const updated = await database.story.update({
      where: { id },
      data: { status: validStatus, completedAt },
    });

    void dispatchEvent({
      type: "story.status_changed",
      storyId: id,
      storyTitle: story.title,
      from: story.status,
      to: validStatus,
      assigneeUserId: story.assigneeUserId ?? undefined,
      tenantId: ctx.tenantId,
      userId: ctx.userId,
    });

    logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "updated",
      entityType: "Story",
      entityId: id,
      diff: { status: validStatus },
    });

    const teamId = story.sprint?.teamId;
    if (teamId) {
      revalidatePath(`/teams/${teamId}/kanban`);
      if (story.sprintId) {
        revalidatePath(`/teams/${teamId}/sprints/${story.sprintId}`);
      }
    }
    revalidatePath("/teams");

    if (story.featureId) {
      void syncFeatureProgress(story.featureId, ctx.tenantId);
    }
    if (teamId) {
      void syncTeamWip(teamId, ctx.tenantId);
    }

    return updated;
  });
}

async function moveStoryToSprint(
  id: string,
  sprintId: string | null
): Promise<Result<any>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    enforce(ctx.role, "Story", "update");

    const story = await database.story.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: { sprint: { select: { teamId: true } } },
    });
    if (!story) {
      throw new Error("Story não encontrada");
    }

    // Verify target sprint belongs to this tenant
    if (sprintId) {
      const targetSprint = await database.sprint.findFirst({
        where: { id: sprintId, tenantId: ctx.tenantId },
        select: { id: true },
      });
      if (!targetSprint) {
        throw new Error("Sprint não encontrado");
      }
    }

    const updated = await database.story.update({
      where: { id },
      data: { sprintId },
    });

    const teamId = story.sprint?.teamId;
    if (teamId) {
      revalidatePath(`/teams/${teamId}/kanban`);
      if (story.sprintId) {
        revalidatePath(`/teams/${teamId}/sprints/${story.sprintId}`);
      }
    }
    if (sprintId) {
      const newTeamId = await resolveTeamId(ctx, sprintId);
      if (newTeamId) {
        revalidatePath(`/teams/${newTeamId}/kanban`);
        revalidatePath(`/teams/${newTeamId}/sprints/${sprintId}`);
        void syncTeamWip(newTeamId, ctx.tenantId);
      }
    }
    revalidatePath("/teams");

    const oldTeamId = story.sprint?.teamId;
    if (oldTeamId) {
      void syncTeamWip(oldTeamId, ctx.tenantId);
    }

    return updated;
  });
}

async function deleteStory(id: string): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    enforce(ctx.role, "Story", "delete");

    const story = await database.story.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: {
        sprint: { select: { teamId: true } },
        tasks: { select: { id: true, status: true } },
      },
    });
    if (!story) {
      throw new Error("Story não encontrada");
    }

    await database.story.delete({ where: { id } });

    logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "deleted",
      entityType: "Story",
      entityId: id,
    });

    const teamId = story.sprint?.teamId;
    if (teamId) {
      revalidatePath(`/teams/${teamId}/kanban`);
      if (story.sprintId) {
        revalidatePath(`/teams/${teamId}/sprints/${story.sprintId}`);
      }
    }
    revalidatePath("/teams");

    if (story.featureId) {
      void syncFeatureProgress(story.featureId, ctx.tenantId);
    }
    if (teamId) {
      void syncTeamWip(teamId, ctx.tenantId);
    }

    return { id };
  });
}

async function reorderStories(ids: string[]): Promise<Result<void>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    enforce(ctx.role, "Story", "update");

    // Verify all stories belong to this tenant
    const stories = await database.story.findMany({
      where: { id: { in: ids }, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (stories.length !== ids.length) {
      throw new Error("Uma ou mais stories não encontradas");
    }

    await database.$transaction(
      ids.map((storyId, index) =>
        database.story.update({
          where: { id: storyId },
          data: { order: index },
        })
      )
    );

    revalidatePath("/teams");
  });
}
