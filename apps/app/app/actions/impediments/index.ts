"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
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
  CreateImpedimentSchema,
  UpdateImpedimentSchema,
  ImpedimentFiltersSchema,
  type CreateImpedimentInput,
  type UpdateImpedimentInput,
  type ImpedimentFiltersInput,
} from "./schema";

export type { CreateImpedimentInput, UpdateImpedimentInput, ImpedimentFiltersInput };

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function listImpediments(
  raw: unknown,
): Promise<Result<Page<any>>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const { page, limit, teamId, status } = ImpedimentFiltersSchema.parse(raw);

    const where = {
      tenantId: ctx.tenantId,
      ...(teamId && { teamId }),
      ...(status && { status }),
    };

    const [items, total] = await Promise.all([
      database.impediment.findMany({
        where,
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        ...paginationArgs(page, limit),
      }),
      database.impediment.count({ where }),
    ]);

    return buildPage(items, total, page, limit);
  });
}

export async function getImpedimentById(id: string): Promise<Result<any>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const impediment = await database.impediment.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });

    if (!impediment) throw new Error("Impedimento não encontrado");
    return impediment;
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createImpediment(raw: unknown): Promise<Result<any>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const data = CreateImpedimentSchema.parse(raw);

    const impediment = await database.impediment.create({
      data: { ...data, tenantId: ctx.tenantId },
    });

    revalidatePath("/teams");
    if (data.teamId) {
      revalidatePath(`/teams/${data.teamId}/impediments`);
    }

    return impediment;
  });
}

export async function updateImpediment(
  id: string,
  raw: unknown,
): Promise<Result<any>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const data = UpdateImpedimentSchema.parse(raw);

    const impediment = await database.impediment.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!impediment) throw new Error("Impedimento não encontrado");

    const updated = await database.impediment.update({
      where: { id },
      data,
    });

    revalidatePath("/teams");
    if (impediment.teamId) {
      revalidatePath(`/teams/${impediment.teamId}/impediments`);
    }

    return updated;
  });
}

export async function resolveImpediment(id: string): Promise<Result<any>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const impediment = await database.impediment.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!impediment) throw new Error("Impedimento não encontrado");

    const updated = await database.impediment.update({
      where: { id },
      data: { status: "RESOLVED", resolvedAt: new Date() },
    });

    revalidatePath("/teams");
    if (impediment.teamId) {
      revalidatePath(`/teams/${impediment.teamId}/impediments`);
    }

    return updated;
  });
}

export async function deleteImpediment(
  id: string,
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const impediment = await database.impediment.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!impediment) throw new Error("Impedimento não encontrado");

    await database.impediment.delete({ where: { id } });

    revalidatePath("/teams");
    if (impediment.teamId) {
      revalidatePath(`/teams/${impediment.teamId}/impediments`);
    }

    return { id };
  });
}
