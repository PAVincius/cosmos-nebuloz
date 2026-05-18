"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  type Result,
  safeAction,
  cuid,
  nnStr,
  optCuid,
  optDate,
} from "../_base";
import type { RetroAction, UpsertRetroInput } from "./schema";

export type { RetroAction, UpsertRetroInput };

// ─── Internal schemas (not exported from "use server") ────────────────────────

const RetroActionSchema = z.object({
  title: nnStr,
  ownerUserId: optCuid,
  dueDate: optDate,
});

const UpsertRetroSchema = z.object({
  sprintId: cuid,
  wentWell: z.array(z.string().min(1)).max(50),
  toImprove: z.array(z.string().min(1)).max(50),
  actions: z.array(RetroActionSchema).max(50),
});

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getRetrospective(
  sprintId: string,
): Promise<Result<any>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    // Verify sprint belongs to this tenant
    const sprint = await database.sprint.findFirst({
      where: { id: sprintId, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (!sprint) throw new Error("Sprint não encontrado");

    return database.retrospective.findUnique({
      where: { sprintId },
    });
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function upsertRetrospective(raw: unknown): Promise<Result<any>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const data = UpsertRetroSchema.parse(raw);

    // Business: verify sprint belongs to this tenant
    const sprint = await database.sprint.findFirst({
      where: { id: data.sprintId, tenantId: ctx.tenantId },
      select: { id: true, teamId: true },
    });
    if (!sprint) throw new Error("Sprint não encontrado");

    const result = await database.retrospective.upsert({
      where: { sprintId: data.sprintId },
      create: {
        tenantId: ctx.tenantId,
        sprintId: data.sprintId,
        wentWell: data.wentWell,
        toImprove: data.toImprove,
        actions: data.actions,
      },
      update: {
        wentWell: data.wentWell,
        toImprove: data.toImprove,
        actions: data.actions,
      },
    });

    revalidatePath(`/teams/${sprint.teamId}/sprints`);
    revalidatePath("/teams");

    return result;
  });
}
