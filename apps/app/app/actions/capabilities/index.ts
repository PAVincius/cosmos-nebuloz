"use server";

import { requireTenantSession } from "@repo/auth/server";
import { type Capability, database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import {
  buildPage,
  type Page,
  paginationArgs,
  type Result,
  safeAction,
} from "../_base";
import {
  CapabilityFiltersSchema,
  type CapabilityWithSolutionTrain,
  CreateCapabilitySchema,
  ReorderCapabilitiesSchema,
  UpdateCapabilitySchema,
} from "./schema";

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function listCapabilities(
  raw?: unknown
): Promise<Result<Page<Capability>>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const filters = CapabilityFiltersSchema.parse(raw ?? {});
    const { page, limit, solutionTrainId, status } = filters;

    const where = {
      tenantId: ctx.tenantId,
      ...(solutionTrainId ? { solutionTrainId } : {}),
      ...(status ? { status } : {}),
    };

    const [items, total] = await Promise.all([
      database.capability.findMany({
        where,
        orderBy: { order: "asc" },
        ...paginationArgs(page, limit),
      }),
      database.capability.count({ where }),
    ]);

    return buildPage(items, total, page, limit);
  });
}

export async function getCapabilityById(
  id: string
): Promise<Result<CapabilityWithSolutionTrain>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const capability = await database.capability.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: { solutionTrain: true },
    });

    if (!capability) {
      throw new Error("Capability não encontrada.");
    }
    return capability;
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export async function createCapability(
  raw: unknown
): Promise<Result<Capability>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const data = CreateCapabilitySchema.parse(raw);

    if (data.solutionTrainId) {
      const train = await database.solutionTrain.findFirst({
        where: { id: data.solutionTrainId, tenantId: ctx.tenantId },
      });
      if (!train) {
        throw new Error(
          "Solution Train não encontrado ou não pertence ao tenant."
        );
      }
    }

    const capability = await database.capability.create({
      data: {
        tenantId: ctx.tenantId,
        solutionTrainId: data.solutionTrainId ?? null,
        title: data.title,
        description: data.description ?? null,
        status: data.status,
        order: data.order,
      },
    });

    revalidatePath("/solution-trains");
    revalidatePath("/solution-trains/[stId]");
    return capability;
  });
}

export async function updateCapability(
  id: string,
  raw: unknown
): Promise<Result<Capability>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const data = UpdateCapabilitySchema.parse(raw);

    const existing = await database.capability.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!existing) {
      throw new Error("Capability não encontrada.");
    }

    const updated = await database.capability.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined
          ? { description: data.description ?? null }
          : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.order !== undefined ? { order: data.order } : {}),
      },
    });

    revalidatePath("/solution-trains");
    revalidatePath("/solution-trains/[stId]");
    return updated;
  });
}

export async function deleteCapability(
  id: string
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const existing = await database.capability.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!existing) {
      throw new Error("Capability não encontrada.");
    }

    await database.capability.delete({ where: { id } });

    revalidatePath("/solution-trains");
    revalidatePath("/solution-trains/[stId]");
    return { id };
  });
}

export async function reorderCapabilities(raw: unknown): Promise<Result<void>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const { orderedIds } = ReorderCapabilitiesSchema.parse(raw);

    await database.$transaction(
      orderedIds.map((id, idx) =>
        database.capability.updateMany({
          where: { id, tenantId: ctx.tenantId },
          data: { order: idx },
        })
      )
    );

    revalidatePath("/solution-trains");
    revalidatePath("/solution-trains/[stId]");
  });
}
