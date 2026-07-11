"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { type Result, safeAction } from "@/app/actions/_base";
import {
  ActionStatus,
  type ActionStatusValue,
  CreateAssessmentSchema,
  CreateImprovementActionSchema,
  SAFE_COMPETENCIES,
  ScopeType,
  UpdateImprovementActionSchema,
} from "./schema";

import type { AssessmentWithActions } from "./types";

// ─── Queries ──────────────────────────────────────────────────────────────────

/** List all assessments for the tenant (page-level, no scope filter). */
export async function listAllAssessments(): Promise<AssessmentWithActions[]> {
  const ctx = await requireTenantSession(await headers());

  const rows = await database.competencyAssessment.findMany({
    where: { tenantId: ctx.tenantId },
    include: {
      actions: {
        select: {
          id: true,
          title: true,
          status: true,
          relatedMetric: true,
          dueDate: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { assessedAt: "desc" },
  });

  return rows.map((a) => ({
    ...a,
    score: Number(a.score),
    competencyLabel:
      SAFE_COMPETENCIES.find((c) => c.key === a.competency)?.label ??
      a.competency,
    actions: a.actions.map((action) => ({
      ...action,
      status: action.status as ActionStatusValue,
    })),
  }));
}

/** List assessments filtered by scope + scopeId (legacy / reused by other pages). */
export async function getAssessments(
  scope: string,
  scopeId: string
): Promise<AssessmentWithActions[]> {
  const ctx = await requireTenantSession(await headers());
  const validScope = ScopeType.parse(scope);

  const rows = await database.competencyAssessment.findMany({
    where: { tenantId: ctx.tenantId, scope: validScope, scopeId },
    include: {
      actions: {
        select: {
          id: true,
          title: true,
          status: true,
          relatedMetric: true,
          dueDate: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { assessedAt: "desc" },
  });

  return rows.map((a) => ({
    ...a,
    score: Number(a.score),
    competencyLabel:
      SAFE_COMPETENCIES.find((c) => c.key === a.competency)?.label ??
      a.competency,
    actions: a.actions.map((action) => ({
      ...action,
      status: action.status as ActionStatusValue,
    })),
  }));
}

/** List all improvement actions for the tenant. */
export async function listAllImprovementActions() {
  const ctx = await requireTenantSession(await headers());

  return database.improvementAction.findMany({
    where: { tenantId: ctx.tenantId },
    orderBy: { createdAt: "desc" },
  });
}

/** List improvement actions filtered by scope + scopeId. */
export async function getImprovementActions(scope: string, scopeId: string) {
  const ctx = await requireTenantSession(await headers());
  const validScope = ScopeType.parse(scope);

  return database.improvementAction.findMany({
    where: { tenantId: ctx.tenantId, scope: validScope, scopeId },
    orderBy: { createdAt: "desc" },
  });
}

// ─── Mutations (Result-wrapped for client components) ─────────────────────────

export async function createAssessmentAction(
  raw: unknown
): Promise<Result<{ id: string }>> {
  return await safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const input = CreateAssessmentSchema.parse(raw);

    const rec = await database.competencyAssessment.create({
      data: {
        tenantId: ctx.tenantId,
        scope: input.scope,
        scopeId: input.scopeId,
        competency: input.competency,
        score: input.score,
        notes: input.notes ?? null,
        assessedById: ctx.userId,
        piPlanId: input.piPlanId ?? null,
      },
      select: { id: true },
    });

    revalidatePath("/analytics/measure-grow");
    return rec;
  });
}

export async function createImprovementActionResult(
  raw: unknown
): Promise<Result<{ id: string }>> {
  return await safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const input = CreateImprovementActionSchema.parse(raw);

    const rec = await database.improvementAction.create({
      data: {
        tenantId: ctx.tenantId,
        title: input.title,
        description: input.description ?? null,
        scope: input.scope,
        scopeId: input.scopeId,
        relatedMetric: input.relatedMetric ?? null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        assigneeId: ctx.userId,
        assessmentId: input.assessmentId ?? null,
        status: input.status,
      },
      select: { id: true },
    });

    revalidatePath("/analytics/measure-grow");
    return rec;
  });
}

export async function updateImprovementActionResult(
  id: string,
  raw: unknown
): Promise<Result<void>> {
  return await safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const input = UpdateImprovementActionSchema.parse(raw);

    await database.improvementAction.updateMany({
      where: { id, tenantId: ctx.tenantId },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.description !== undefined && {
          description: input.description,
        }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.relatedMetric !== undefined && {
          relatedMetric: input.relatedMetric,
        }),
        ...(input.dueDate !== undefined && {
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
        }),
        ...(input.scope !== undefined && { scope: input.scope }),
        ...(input.scopeId !== undefined && { scopeId: input.scopeId }),
      },
    });

    revalidatePath("/analytics/measure-grow");
  });
}

// ─── Spec-required aliases ────────────────────────────────────────────────────

export async function listAssessments(): Promise<AssessmentWithActions[]> {
  return listAllAssessments();
}

export async function listImprovementActions() {
  return listAllImprovementActions();
}

export async function createAssessment(
  raw: unknown
): Promise<Result<{ id: string }>> {
  return createAssessmentAction(raw);
}

export async function createImprovementAction(
  raw: unknown
): Promise<Result<{ id: string }>> {
  return createImprovementActionResult(raw);
}

export async function updateImprovementAction(
  id: string,
  raw: unknown
): Promise<Result<void>> {
  return updateImprovementActionResult(id, raw);
}

export async function updateActionStatus(
  id: string,
  status: ActionStatusValue
) {
  const ctx = await requireTenantSession(await headers());
  const validated = ActionStatus.parse(status);

  await database.improvementAction.updateMany({
    where: { id, tenantId: ctx.tenantId },
    data: { status: validated },
  });

  revalidatePath("/analytics/flow");
}
