"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { enforce } from "../permissions";
import { dispatchEvent } from "../events";
import {
  type Result,
  type Page,
  safeAction,
  paginationArgs,
  buildPage,
  cuid,
  nnStr,
  optStr,
  isoDate,
  SprintStatus,
} from "../_base";
import {
  UpdateSprintSchema,
  SprintFiltersSchema,
  type CreateSprintInput,
  type UpdateSprintInput,
  type SprintFiltersInput,
} from "./schema";

export type { CreateSprintInput, UpdateSprintInput, SprintFiltersInput };

// ─── Internal schemas (not exported from "use server") ────────────────────────

const SprintBaseSchema = z.object({
  teamId: cuid,
  name: nnStr,
  goal: optStr,
  startDate: isoDate,
  endDate: isoDate,
  capacity: z.number().int().positive().optional(),
});

const CreateSprintSchema = SprintBaseSchema.refine(
  (d) => d.endDate > d.startDate,
  { message: "endDate deve ser após startDate", path: ["endDate"] },
);

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function listSprints(raw: unknown): Promise<Result<Page<any>>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const { page, limit, teamId, status } = SprintFiltersSchema.parse(raw);

    const where = {
      tenantId: ctx.tenantId,
      ...(teamId && { teamId }),
      ...(status && { status }),
    };

    const [items, total] = await Promise.all([
      database.sprint.findMany({
        where,
        orderBy: { startDate: "desc" },
        include: {
          team: { select: { id: true, name: true } },
          _count: { select: { stories: true } },
          review: { select: { id: true, goalMet: true, velocity: true } },
        },
        ...paginationArgs(page, limit),
      }),
      database.sprint.count({ where }),
    ]);

    return buildPage(items, total, page, limit);
  });
}

export async function getSprintById(id: string): Promise<Result<any>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const sprint = await database.sprint.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: {
        team: true,
        stories: { orderBy: { order: "asc" } },
        review: true,
        retro: true,
      },
    });

    if (!sprint) throw new Error("Sprint não encontrado");
    return sprint;
  });
}

export async function getActiveSprint(teamId: string): Promise<Result<any>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    return database.sprint.findFirst({
      where: { tenantId: ctx.tenantId, teamId, status: "ACTIVE" },
      include: {
        stories: { orderBy: { order: "asc" } },
        review: true,
      },
    });
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createSprint(raw: unknown): Promise<Result<any>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    enforce(ctx.role, "Sprint", "create");
    const data = CreateSprintSchema.parse(raw);

    const team = await database.team.findFirst({
      where: { id: data.teamId, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (!team) throw new Error("Time não encontrado");

    // Business: check for existing active sprint (non-blocking warning)
    const activeSprint = await database.sprint.findFirst({
      where: { teamId: data.teamId, tenantId: ctx.tenantId, status: "ACTIVE" },
      select: { id: true, name: true },
    });

    const sprint = await database.sprint.create({
      data: { ...data, tenantId: ctx.tenantId },
    });

    revalidatePath(`/teams/${data.teamId}/sprints`);
    revalidatePath("/teams");

    return activeSprint
      ? { ...sprint, _warning: `Já existe um sprint ativo neste time: "${(activeSprint as any).name}"` }
      : sprint;
  });
}

export async function updateSprint(
  id: string,
  raw: unknown,
): Promise<Result<any>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    enforce(ctx.role, "Sprint", "update");
    const data = UpdateSprintSchema.parse(raw);

    const sprint = await database.sprint.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!sprint) throw new Error("Sprint não encontrado");

    const updated = await database.sprint.update({ where: { id }, data });

    revalidatePath(`/teams/${sprint.teamId}/sprints`);
    revalidatePath("/teams");

    return updated;
  });
}

export async function deleteSprint(
  id: string,
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    enforce(ctx.role, "Sprint", "delete");

    const sprint = await database.sprint.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!sprint) throw new Error("Sprint não encontrado");
    if (sprint.status === "ACTIVE")
      throw new Error("Não é possível excluir um sprint ativo");

    await database.sprint.delete({ where: { id } });

    revalidatePath(`/teams/${sprint.teamId}/sprints`);
    revalidatePath("/teams");

    return { id };
  });
}

export async function activateSprint(id: string): Promise<Result<any>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    enforce(ctx.role, "Sprint", "activate");

    const sprint = await database.sprint.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!sprint) throw new Error("Sprint não encontrado");

    // Business rule: only one active sprint per team
    const activeSprint = await database.sprint.findFirst({
      where: {
        teamId: sprint.teamId,
        tenantId: ctx.tenantId,
        status: "ACTIVE",
        id: { not: id },
      },
      select: { id: true, name: true },
    });
    if (activeSprint)
      throw new Error(
        `Já existe sprint ativo neste time: "${(activeSprint as any).name}"`,
      );

    const updated = await database.sprint.update({
      where: { id },
      data: { status: "ACTIVE" },
    });

    void dispatchEvent({ type: "sprint.activated", sprintId: id, sprintName: sprint.name, teamId: sprint.teamId, tenantId: ctx.tenantId, userId: ctx.userId });

    revalidatePath(`/teams/${sprint.teamId}/sprints`);
    revalidatePath("/teams");

    return updated;
  });
}

export async function completeSprint(id: string): Promise<Result<any>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    enforce(ctx.role, "Sprint", "complete");

    const sprint = await database.sprint.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!sprint) throw new Error("Sprint não encontrado");

    const updated = await database.sprint.update({
      where: { id },
      data: { status: "COMPLETED" },
    });

    const review = await database.sprintReview.findUnique({ where: { sprintId: id }, select: { velocity: true } });
    void dispatchEvent({ type: "sprint.completed", sprintId: id, sprintName: sprint.name, teamId: sprint.teamId, velocity: review?.velocity ?? 0, tenantId: ctx.tenantId, userId: ctx.userId });

    revalidatePath(`/teams/${sprint.teamId}/sprints`);
    revalidatePath("/teams");

    return updated;
  });
}
