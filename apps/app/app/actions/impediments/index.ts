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

export async function listImpedimentsByArt(artId: string): Promise<ImpedimentWithTeam[]> {
  const ctx = await requireTenantSession(await headers());

  const teams = await database.team.findMany({
    where: { tenantId: ctx.tenantId, artId },
    select: { id: true, name: true },
  });

  const teamIds = teams.map((t) => t.id);
  const teamNameMap = new Map(teams.map((t) => [t.id, t.name]));

  const now = new Date();

  const impediments = await database.impediment.findMany({
    where: {
      tenantId: ctx.tenantId,
      ...(teamIds.length > 0 ? { teamId: { in: teamIds } } : {}),
    },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });

  return impediments.map((imp) => {
    const ageDays = Math.floor((now.getTime() - imp.createdAt.getTime()) / 86_400_000);
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
      isEscalated: ageDays > 14 && imp.status !== "RESOLVED",
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
