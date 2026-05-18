"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { type SolutionEpic } from "@repo/database";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import {
  type Result,
  type Page,
  safeAction,
  paginationArgs,
  buildPage,
} from "../_base";
import {
  CreateSolutionEpicSchema,
  UpdateSolutionEpicSchema,
  SolutionEpicFiltersSchema,
  type CreateSolutionEpicInput,
  type UpdateSolutionEpicInput,
  type SolutionEpicFilters,
  type SolutionEpicWithSolutionTrain,
} from "./schema";

export type { CreateSolutionEpicInput, UpdateSolutionEpicInput, SolutionEpicFilters, SolutionEpicWithSolutionTrain };

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function listSolutionEpics(raw?: unknown): Promise<Result<Page<SolutionEpic>>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const filters = SolutionEpicFiltersSchema.parse(raw ?? {});
    const { page, limit, solutionTrainId, status } = filters;

    const where = {
      tenantId: ctx.tenantId,
      ...(solutionTrainId ? { solutionTrainId } : {}),
      ...(status ? { status } : {}),
    };

    const [items, total] = await Promise.all([
      database.solutionEpic.findMany({
        where,
        orderBy: { wsjfScore: "desc" },
        ...paginationArgs(page, limit),
      }),
      database.solutionEpic.count({ where }),
    ]);

    return buildPage(items, total, page, limit);
  });
}

export async function getSolutionEpicById(
  id: string
): Promise<Result<SolutionEpicWithSolutionTrain>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const epic = await database.solutionEpic.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: { solutionTrain: true },
    });

    if (!epic) throw new Error("Solution Epic não encontrado.");
    return epic;
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export async function createSolutionEpic(raw: unknown): Promise<Result<SolutionEpic>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const data = CreateSolutionEpicSchema.parse(raw);

    const epic = await database.solutionEpic.create({
      data: {
        tenantId: ctx.tenantId,
        solutionTrainId: data.solutionTrainId ?? null,
        title: data.title,
        description: data.description ?? null,
        status: data.status,
        wsjfScore: data.wsjfScore,
      },
    });

    revalidatePath("/solution-trains");
    revalidatePath("/solution-trains/[stId]");
    return epic;
  });
}

export async function updateSolutionEpic(
  id: string,
  raw: unknown
): Promise<Result<SolutionEpic>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const data = UpdateSolutionEpicSchema.parse(raw);

    const existing = await database.solutionEpic.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!existing) throw new Error("Solution Epic não encontrado.");

    const updated = await database.solutionEpic.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description ?? null } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.wsjfScore !== undefined ? { wsjfScore: data.wsjfScore } : {}),
      },
    });

    revalidatePath("/solution-trains");
    revalidatePath("/solution-trains/[stId]");
    return updated;
  });
}

export async function deleteSolutionEpic(id: string): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const existing = await database.solutionEpic.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!existing) throw new Error("Solution Epic não encontrado.");

    await database.solutionEpic.delete({ where: { id } });

    revalidatePath("/solution-trains");
    revalidatePath("/solution-trains/[stId]");
    return { id };
  });
}
