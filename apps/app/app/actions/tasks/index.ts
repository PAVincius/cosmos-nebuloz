"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { enforce } from "../permissions";
import {
  type Result,
  safeAction,
  TaskStatus,
} from "../_base";
import {
  CreateTaskSchema,
  UpdateTaskSchema,
  type CreateTaskInput,
  type UpdateTaskInput,
} from "./schema";

export type { CreateTaskInput, UpdateTaskInput };

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function resolveTaskTeamId(
  ctx: { tenantId: string },
  task: { story: { sprint?: { teamId: string } | null } },
): Promise<string | null> {
  return task.story.sprint?.teamId ?? null;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function listTasksByStory(storyId: string): Promise<Result<any[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    // Verify story belongs to this tenant
    const story = await database.story.findFirst({
      where: { id: storyId, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (!story) throw new Error("Story não encontrada");

    return database.task.findMany({
      where: { storyId, tenantId: ctx.tenantId },
      orderBy: { createdAt: "asc" },
    });
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createTask(raw: unknown): Promise<Result<any>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    enforce(ctx.role, "Task", "create");
    const data = CreateTaskSchema.parse(raw);

    // Business: verify storyId belongs to this tenant
    const story = await database.story.findFirst({
      where: { id: data.storyId, tenantId: ctx.tenantId },
      include: { sprint: { select: { teamId: true } } },
    });
    if (!story) throw new Error("Story não encontrada");

    const task = await database.task.create({
      data: { ...data, tenantId: ctx.tenantId },
    });

    const teamId = story.sprint?.teamId;
    if (teamId) {
      revalidatePath(`/teams/${teamId}/kanban`);
      if (story.sprintId) {
        revalidatePath(`/teams/${teamId}/sprints/${story.sprintId}`);
      }
    }
    revalidatePath("/teams");

    return task;
  });
}

export async function updateTask(
  id: string,
  raw: unknown,
): Promise<Result<any>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    enforce(ctx.role, "Task", "update");
    const data = UpdateTaskSchema.parse(raw);

    const task = await database.task.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: {
        story: { include: { sprint: { select: { teamId: true } } } },
      },
    });
    if (!task) throw new Error("Task não encontrada");

    const completedAt =
      data.status === "DONE" && task.status !== "DONE"
        ? new Date()
        : data.status !== "DONE" && task.status === "DONE"
          ? null
          : undefined;

    const updated = await database.task.update({
      where: { id },
      data: { ...data, ...(completedAt !== undefined && { completedAt }) },
    });

    const teamId = await resolveTaskTeamId(ctx, task);
    if (teamId) {
      revalidatePath(`/teams/${teamId}/kanban`);
    }
    revalidatePath("/teams");

    return updated;
  });
}

export async function updateTaskStatus(
  id: string,
  status: string,
): Promise<Result<any>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    enforce(ctx.role, "Task", "update");
    const validStatus = TaskStatus.parse(status);

    const task = await database.task.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: {
        story: { include: { sprint: { select: { teamId: true } } } },
      },
    });
    if (!task) throw new Error("Task não encontrada");

    const completedAt = validStatus === "DONE" ? new Date() : null;

    const updated = await database.task.update({
      where: { id },
      data: { status: validStatus, completedAt },
    });

    const teamId = await resolveTaskTeamId(ctx, task);
    if (teamId) {
      revalidatePath(`/teams/${teamId}/kanban`);
    }
    revalidatePath("/teams");

    return updated;
  });
}

export async function deleteTask(
  id: string,
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    enforce(ctx.role, "Task", "delete");

    const task = await database.task.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: {
        story: { include: { sprint: { select: { teamId: true } } } },
      },
    });
    if (!task) throw new Error("Task não encontrada");

    await database.task.delete({ where: { id } });

    const teamId = await resolveTaskTeamId(ctx, task);
    if (teamId) {
      revalidatePath(`/teams/${teamId}/kanban`);
    }
    revalidatePath("/teams");

    return { id };
  });
}
