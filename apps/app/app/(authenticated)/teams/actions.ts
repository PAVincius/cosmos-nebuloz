"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

export type TeamMember = {
  id: string;
  name: string;
  role: string;
  skills: string[];
  hoursPerWeek: number;
};

export async function getTeams() {
  const ctx = await requireTenantSession(await headers());
  return database.team.findMany({
    where: { tenantId: ctx.tenantId },
    include: { art: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getTeamById(teamId: string) {
  const ctx = await requireTenantSession(await headers());
  return database.team.findFirst({
    where: { id: teamId, tenantId: ctx.tenantId },
    include: { art: true },
  });
}

export async function getArts() {
  const ctx = await requireTenantSession(await headers());
  return database.aRT.findMany({
    where: { tenantId: ctx.tenantId },
    orderBy: { name: "asc" },
  });
}

export async function createTeam(input: {
  name: string;
  artId?: string | null;
  velocity?: number | null;
  sprintLengthDays?: number;
  members?: TeamMember[];
}) {
  const ctx = await requireTenantSession(await headers());
  if (!input.name?.trim()) {
    throw new Error("O nome do time é obrigatório.");
  }

  await database.team.create({
    data: {
      tenantId: ctx.tenantId,
      name: input.name.trim(),
      artId: input.artId || null,
      velocity: input.velocity ?? null,
      sprintLengthDays: input.sprintLengthDays ?? 14,
      members: input.members ?? [],
    },
  });

  revalidatePath("/teams");
}

export async function updateTeamConfig(input: {
  teamId: string;
  name?: string;
  artId?: string | null;
  velocity?: number | null;
  sprintLengthDays?: number;
  members?: TeamMember[];
}) {
  const ctx = await requireTenantSession(await headers());

  const team = await database.team.findFirst({
    where: { id: input.teamId, tenantId: ctx.tenantId },
  });
  if (!team) {
    throw new Error("Time não encontrado.");
  }

  await database.team.update({
    where: { id: input.teamId },
    data: {
      ...(input.name !== undefined && { name: input.name.trim() }),
      ...(input.artId !== undefined && { artId: input.artId }),
      ...(input.velocity !== undefined && { velocity: input.velocity }),
      ...(input.sprintLengthDays !== undefined && {
        sprintLengthDays: input.sprintLengthDays,
      }),
      ...(input.members !== undefined && { members: input.members }),
    },
  });

  revalidatePath("/teams");
  revalidatePath(`/teams/${input.teamId}`);
}
