"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { FlowType } from "./schema";
import { SaveStepSchema } from "./schema";

export async function getOrCreateProgress(flowType: FlowType) {
  const ctx = await requireTenantSession(await headers());

  const existing = await database.onboardingProgress.findFirst({
    where: { tenantId: ctx.tenantId, flowType },
  });
  if (existing) {
    return existing;
  }

  return database.onboardingProgress.create({
    data: {
      tenantId: ctx.tenantId,
      flowType,
      currentStep: 0,
      completedSteps: [],
      data: {},
      status: "in_progress",
    },
  });
}

export async function getProgress(flowType: FlowType) {
  const ctx = await requireTenantSession(await headers());
  return database.onboardingProgress.findFirst({
    where: { tenantId: ctx.tenantId, flowType },
  });
}

export async function saveStep(raw: unknown) {
  const ctx = await requireTenantSession(await headers());
  const { flowType, stepKey, stepIndex, data } = SaveStepSchema.parse(raw);

  const progress = await database.onboardingProgress.findFirst({
    where: { tenantId: ctx.tenantId, flowType },
  });
  if (!progress) {
    throw new Error("OnboardingProgress not found.");
  }

  const existingData = (progress.data as Record<string, unknown>) ?? {};
  const completedSteps = progress.completedSteps.includes(stepKey)
    ? progress.completedSteps
    : [...progress.completedSteps, stepKey];

  const updated = await database.onboardingProgress.update({
    where: { id: progress.id },
    data: {
      currentStep: Math.max(progress.currentStep, stepIndex + 1),
      completedSteps,
      // Prisma Json field requires InputJsonValue; cast through unknown is safe here
      // because the shape is validated upstream via Zod (SaveStepSchema).
      data: { ...existingData, [stepKey]: data } as unknown as object,
    },
  });

  revalidatePath("/onboarding");
  return updated;
}

export async function completeFlow(flowType: FlowType) {
  const ctx = await requireTenantSession(await headers());

  const progress = await database.onboardingProgress.findFirst({
    where: { tenantId: ctx.tenantId, flowType },
  });
  if (!progress) {
    throw new Error("OnboardingProgress not found.");
  }

  const updated = await database.onboardingProgress.update({
    where: { id: progress.id },
    data: { status: "completed" },
  });

  revalidatePath("/onboarding");
  revalidatePath("/");
  return updated;
}
