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
  type CreateImpedimentInput,
  CreateImpedimentSchema,
  type ImpedimentFiltersInput,
  ImpedimentFiltersSchema,
  type UpdateImpedimentInput,
  UpdateImpedimentSchema,
} from "./schema";

export type {
  CreateImpedimentInput,
  UpdateImpedimentInput,
  ImpedimentFiltersInput,
};

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function listImpediments(
  raw: unknown
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

    if (!impediment) {
      throw new Error("Impedimento não encontrado");
    }
    return impediment;
  });
}

export type ImpedimentWithTeam = {
  id: string;
  tenantId: string;
  teamId: string | null;
  teamName: string | null;
  title: string;
  description: string | null;
  status: string;
  ownerUserId: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  ageDays: number;
  isEscalated: boolean;
};

export async function listImpedimentsByArt(
  artId: string
): Promise<ImpedimentWithTeam[]> {
  const ctx = await requireTenantSession(await headers());

  const teams = await database.team.findMany({
    where: { tenantId: ctx.tenantId, artId },
    select: { id: true, name: true },
  });

  const teamIds = teams.map((t) => t.id);
  if (teamIds.length === 0) {
    return [];
  }

  const teamNameMap = new Map(teams.map((t) => [t.id, t.name]));
  const now = new Date();

  const impediments = await database.impediment.findMany({
    where: { tenantId: ctx.tenantId, teamId: { in: teamIds } },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });

  return impediments.map((imp) => {
    const endTime = imp.resolvedAt ? imp.resolvedAt.getTime() : now.getTime();
    const ageDays = Math.floor(
      (endTime - imp.createdAt.getTime()) / 86_400_000
    );
    const isOpen = imp.status !== "RESOLVED";
    return {
      id: imp.id,
      tenantId: imp.tenantId,
      teamId: imp.teamId,
      teamName: imp.teamId ? (teamNameMap.get(imp.teamId) ?? null) : null,
      title: imp.title,
      description: imp.description,
      status: imp.status,
      ownerUserId: imp.ownerUserId,
      resolvedAt: imp.resolvedAt,
      createdAt: imp.createdAt,
      updatedAt: imp.updatedAt,
      ageDays,
      isEscalated: isOpen && ageDays > 14,
    };
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
  raw: unknown
): Promise<Result<any>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const data = UpdateImpedimentSchema.parse(raw);

    const impediment = await database.impediment.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!impediment) {
      throw new Error("Impedimento não encontrado");
    }

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
    if (!impediment) {
      throw new Error("Impedimento não encontrado");
    }

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
  id: string
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const impediment = await database.impediment.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!impediment) {
      throw new Error("Impedimento não encontrado");
    }

    await database.impediment.delete({ where: { id } });

    revalidatePath("/teams");
    if (impediment.teamId) {
      revalidatePath(`/teams/${impediment.teamId}/impediments`);
    }

    return { id };
  });
}
