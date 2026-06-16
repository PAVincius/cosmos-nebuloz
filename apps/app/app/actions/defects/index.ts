"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
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
  CreateDefectSchema,
  DefectFiltersSchema,
  UpdateDefectSchema,
} from "./schema";

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function listDefects(raw: unknown): Promise<Result<Page<any>>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const { page, limit, teamId, status, severity } =
      DefectFiltersSchema.parse(raw);

    const where = {
      tenantId: ctx.tenantId,
      ...(teamId && { teamId }),
      ...(status && { status }),
      ...(severity && { severity }),
    };

    const [items, total] = await Promise.all([
      database.defect.findMany({
        where,
        orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
        ...paginationArgs(page, limit),
      }),
      database.defect.count({ where }),
    ]);

    return buildPage(items, total, page, limit);
  });
}

export async function getDefectById(id: string): Promise<Result<any>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const defect = await database.defect.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });

    if (!defect) {
      throw new Error("Defect não encontrado");
    }
    return defect;
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createDefect(raw: unknown): Promise<Result<any>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const data = CreateDefectSchema.parse(raw);

    const defect = await database.defect.create({
      data: { ...data, tenantId: ctx.tenantId },
    });

    revalidatePath("/teams");
    if (data.teamId) {
      revalidatePath(`/teams/${data.teamId}/defects`);
    }

    return defect;
  });
}

export async function updateDefect(
  id: string,
  raw: unknown
): Promise<Result<any>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const data = UpdateDefectSchema.parse(raw);

    const defect = await database.defect.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!defect) {
      throw new Error("Defect não encontrado");
    }

    const resolvedAt =
      data.status === "RESOLVED" && defect.status !== "RESOLVED"
        ? new Date()
        : data.status !== "RESOLVED" && defect.status === "RESOLVED"
          ? null
          : undefined;

    const updated = await database.defect.update({
      where: { id },
      data: { ...data, ...(resolvedAt !== undefined && { resolvedAt }) },
    });

    revalidatePath("/teams");
    if (defect.teamId) {
      revalidatePath(`/teams/${defect.teamId}/defects`);
    }

    return updated;
  });
}

export async function resolveDefect(id: string): Promise<Result<any>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const defect = await database.defect.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!defect) {
      throw new Error("Defect não encontrado");
    }

    const updated = await database.defect.update({
      where: { id },
      data: { status: "RESOLVED", resolvedAt: new Date() },
    });

    revalidatePath("/teams");
    if (defect.teamId) {
      revalidatePath(`/teams/${defect.teamId}/defects`);
    }

    return updated;
  });
}

export async function closeDefect(id: string): Promise<Result<any>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const defect = await database.defect.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!defect) {
      throw new Error("Defect não encontrado");
    }

    const updated = await database.defect.update({
      where: { id },
      data: { status: "CLOSED" },
    });

    revalidatePath("/teams");
    if (defect.teamId) {
      revalidatePath(`/teams/${defect.teamId}/defects`);
    }

    return updated;
  });
}

export async function deleteDefect(
  id: string
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const defect = await database.defect.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!defect) {
      throw new Error("Defect não encontrado");
    }

    await database.defect.delete({ where: { id } });

    revalidatePath("/teams");
    if (defect.teamId) {
      revalidatePath(`/teams/${defect.teamId}/defects`);
    }

    return { id };
  });
}
