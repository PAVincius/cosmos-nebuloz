"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database, type SolutionTrain } from "@repo/database";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { type Result, safeAction } from "../_base";
import {
  type CreateSolutionTrainInput,
  CreateSolutionTrainSchema,
  type SolutionTrainWithCounts,
  type SolutionTrainWithRelations,
  type UpdateSolutionTrainInput,
  UpdateSolutionTrainSchema,
} from "./schema";

export type {
  CreateSolutionTrainInput,
  UpdateSolutionTrainInput,
  SolutionTrainWithCounts,
  SolutionTrainWithRelations,
};

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function listSolutionTrains(): Promise<
  Result<SolutionTrainWithCounts[]>
> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    return database.solutionTrain.findMany({
      where: { tenantId: ctx.tenantId },
      include: {
        _count: {
          select: {
            capabilities: true,
            solutionEpics: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  });
}

export async function getSolutionTrainById(
  id: string
): Promise<Result<SolutionTrainWithRelations>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const train = await database.solutionTrain.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: {
        capabilities: { orderBy: { order: "asc" } },
        solutionEpics: { orderBy: { wsjfScore: "desc" } },
      },
    });

    if (!train) {
      throw new Error("Solution Train não encontrado.");
    }
    return train;
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export async function createSolutionTrain(
  raw: unknown
): Promise<Result<SolutionTrain>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const data = CreateSolutionTrainSchema.parse(raw);

    const train = await database.solutionTrain.create({
      data: {
        tenantId: ctx.tenantId,
        name: data.name,
        description: data.description ?? null,
      },
    });

    revalidatePath("/solution-trains");
    return train;
  });
}

export async function updateSolutionTrain(
  id: string,
  raw: unknown
): Promise<Result<SolutionTrain>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const data = UpdateSolutionTrainSchema.parse(raw);

    const existing = await database.solutionTrain.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!existing) {
      throw new Error("Solution Train não encontrado.");
    }

    const updated = await database.solutionTrain.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined
          ? { description: data.description ?? null }
          : {}),
      },
    });

    revalidatePath("/solution-trains");
    return updated;
  });
}

export async function deleteSolutionTrain(
  id: string
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const existing = await database.solutionTrain.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: {
        _count: { select: { capabilities: true, solutionEpics: true } },
      },
    });
    if (!existing) {
      throw new Error("Solution Train não encontrado.");
    }

    if (existing._count.capabilities > 0 || existing._count.solutionEpics > 0) {
      throw new Error(
        "Não é possível excluir: o Solution Train possui Capabilities ou Solution Epics vinculados."
      );
    }

    await database.solutionTrain.delete({ where: { id } });
    revalidatePath("/solution-trains");
    return { id };
  });
}
