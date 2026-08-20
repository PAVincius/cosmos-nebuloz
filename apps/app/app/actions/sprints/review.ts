"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { type Result, safeAction } from "../_base";
import { ppmFormula } from "./ppm-formula";

// ─── saveSprintReview ────────────────────────────────────────────────────────

const saveSprintReviewSchema = z.object({
  sprintId: z.string().min(1),
  completedPoints: z.number().int().min(0),
  acceptedPoints: z.number().int().min(0),
  demoNotes: z.string().optional(),
  goalMet: z.boolean().optional(),
});

export async function saveSprintReview(
  raw: unknown
): Promise<Result<{ id: string; velocity: number }>> {
  return safeAction(async () => {
    const { tenantId } = await requireTenantSession(await headers());
    const input = saveSprintReviewSchema.parse(raw);

    // AC-001: accepted ≤ completed
    if (input.acceptedPoints > input.completedPoints) {
      throw new Error(
        `ACCEPTED_EXCEEDS_COMPLETED:accepted=${input.acceptedPoints}:completed=${input.completedPoints}`
      );
    }

    // Cross-tenant IDOR guard — the upsert key is `sprintId` alone, so without
    // this check another tenant's SprintReview row falls into the update branch
    // and gets overwritten.
    const sprint = await database.sprint.findFirst({
      where: { id: input.sprintId, tenantId },
      select: { id: true },
    });
    if (!sprint) {
      throw new Error("SPRINT_NOT_FOUND");
    }

    const review = await database.sprintReview.upsert({
      where: { sprintId: input.sprintId },
      create: {
        tenantId,
        sprintId: input.sprintId,
        completedPoints: input.completedPoints,
        acceptedPoints: input.acceptedPoints,
        velocity: input.acceptedPoints,
        demoNotes: input.demoNotes,
        goalMet: input.goalMet ?? false,
      },
      update: {
        completedPoints: input.completedPoints,
        acceptedPoints: input.acceptedPoints,
        velocity: input.acceptedPoints,
        demoNotes: input.demoNotes,
        goalMet: input.goalMet ?? false,
      },
      select: { id: true, velocity: true },
    });

    // Sync sprint velocity field to accepted points
    await database.sprint.updateMany({
      where: { id: input.sprintId, tenantId },
      data: { velocity: input.acceptedPoints },
    });

    revalidatePath("/");
    return { id: review.id, velocity: review.velocity ?? input.acceptedPoints };
  });
}

// ─── updatePIObjectiveAchieved ────────────────────────────────────────────────

const updatePIObjectiveSchema = z.object({
  objectiveId: z.string().min(1),
  sprintId: z.string().min(1),
  points: z.number().min(0),
});

export async function updatePIObjectiveAchieved(
  raw: unknown
): Promise<Result<{ achievedValue: number }>> {
  return safeAction(async () => {
    const { tenantId } = await requireTenantSession(await headers());
    const input = updatePIObjectiveSchema.parse(raw);

    return database.$transaction(async (tx) => {
      const objective = await tx.pIObjective.findFirstOrThrow({
        where: { id: input.objectiveId, tenantId },
        select: {
          id: true,
          achievedValue: true,
          sprintContributions: true,
        },
      });

      const contributions = (
        typeof objective.sprintContributions === "object" &&
        objective.sprintContributions !== null
          ? objective.sprintContributions
          : {}
      ) as Record<string, number>;

      // AC-002: idempotent — subtract prior contribution from this sprint before adding
      const prior = contributions[input.sprintId] ?? 0;
      const newAchieved = objective.achievedValue - prior + input.points;
      const newContributions = {
        ...contributions,
        [input.sprintId]: input.points,
      };

      await tx.pIObjective.updateMany({
        where: { id: input.objectiveId, tenantId },
        data: {
          achievedValue: newAchieved,
          sprintContributions: newContributions,
        },
      });

      revalidatePath("/");
      return { achievedValue: newAchieved };
    });
  });
}

// ─── computePIPPM ─────────────────────────────────────────────────────────────

const computePPMSchema = z.object({
  piPlanId: z.string().min(1),
});

export async function computePIPPM(
  raw: unknown
): Promise<Result<{ ppm: number }>> {
  return safeAction(async () => {
    const { tenantId } = await requireTenantSession(await headers());
    const input = computePPMSchema.parse(raw);

    const objectives = await database.pIObjective.findMany({
      where: { piPlanId: input.piPlanId, tenantId },
      select: {
        plannedValue: true,
        achievedValue: true,
        businessValue: true,
        isStretch: true,
      },
    });

    const ppm = ppmFormula(objectives);

    await database.pIPlan.updateMany({
      where: { id: input.piPlanId, tenantId },
      data: { ppm },
    });

    revalidatePath("/");
    return { ppm };
  });
}
