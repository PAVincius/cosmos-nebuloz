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
  optStr,
} from "../_base";
import type { UpsertSprintReviewInput } from "./schema";

export type { UpsertSprintReviewInput };

// ─── Internal schemas (not exported from "use server") ────────────────────────

const UpsertSprintReviewSchema = z.object({
  sprintId: cuid,
  velocity: z.number().int().nonnegative().optional(),
  demoNotes: optStr,
  goalMet: z.boolean().default(false),
});

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getSprintReview(
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

    return database.sprintReview.findUnique({
      where: { sprintId },
    });
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function upsertSprintReview(raw: unknown): Promise<Result<any>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const data = UpsertSprintReviewSchema.parse(raw);

    // Business: verify sprint belongs to this tenant
    const sprint = await database.sprint.findFirst({
      where: { id: data.sprintId, tenantId: ctx.tenantId },
      select: { id: true, teamId: true },
    });
    if (!sprint) throw new Error("Sprint não encontrado");

    const result = await database.sprintReview.upsert({
      where: { sprintId: data.sprintId },
      create: {
        tenantId: ctx.tenantId,
        sprintId: data.sprintId,
        velocity: data.velocity,
        demoNotes: data.demoNotes,
        goalMet: data.goalMet,
      },
      update: {
        velocity: data.velocity,
        demoNotes: data.demoNotes,
        goalMet: data.goalMet,
      },
    });

    revalidatePath(`/teams/${sprint.teamId}/sprints`);
    revalidatePath("/teams");

    return result;
  });
}
