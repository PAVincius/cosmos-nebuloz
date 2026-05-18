"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { safeAction, type Result } from "@/app/actions/_base";
import {
  CreateAssessmentSchema,
  CreateImprovementActionSchema,
  UpdateImprovementActionSchema,
  SAFE_COMPETENCIES,
  type CreateAssessmentInput,
  type CreateImprovementActionInput,
  type UpdateImprovementActionInput,
} from "./schema";

// ─── Re-exports for convenience ───────────────────────────────────────────────

export { SAFE_COMPETENCIES };
export type {
  CreateAssessmentInput,
  CreateImprovementActionInput,
  UpdateImprovementActionInput,
};

// ─── Legacy compat (used by other pages) ─────────────────────────────────────

export const COMPETENCIES = SAFE_COMPETENCIES.map((c) => ({
  id: c.key,
  label: c.label,
}));

export type CompetencyId = (typeof COMPETENCIES)[number]["id"];

// ─── Types ────────────────────────────────────────────────────────────────────

export type AssessmentAction = {
  id: string;
  title: string;
  status: string;
  relatedMetric: string | null;
  dueDate: Date | null;
};

export type AssessmentWithActions = {
  id: string;
  scope: string;
  scopeId: string;
  competency: string;
  competencyLabel: string;
  score: number;
  assessedAt: Date;
  notes: string | null;
  actions: AssessmentAction[];
};

// ─── Queries ──────────────────────────────────────────────────────────────────

/** List all assessments for the tenant (page-level, no scope filter). */
export async function listAllAssessments(): Promise<AssessmentWithActions[]> {
  const ctx = await requireTenantSession(await headers());

  const rows = await database.competencyAssessment.findMany({
    where: { tenantId: ctx.tenantId },
    include: {
      actions: {
        select: {
          id: true, title: true, status: true,
          relatedMetric: true, dueDate: true,
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
      SAFE_COMPETENCIES.find((c) => c.key === a.competency)?.label ?? a.competency,
  }));
}

/** List assessments filtered by scope + scopeId (legacy / reused by other pages). */
export async function getAssessments(
  scope: string,
  scopeId: string
): Promise<AssessmentWithActions[]> {
  const ctx = await requireTenantSession(await headers());

  const rows = await database.competencyAssessment.findMany({
    where: { tenantId: ctx.tenantId, scope, scopeId },
    include: {
      actions: {
        select: {
          id: true, title: true, status: true,
          relatedMetric: true, dueDate: true,
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
      SAFE_COMPETENCIES.find((c) => c.key === a.competency)?.label ?? a.competency,
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

  return database.improvementAction.findMany({
    where: { tenantId: ctx.tenantId, scope, scopeId },
    orderBy: { createdAt: "desc" },
  });
}

// ─── Mutations (Result-wrapped for client components) ─────────────────────────

export async function createAssessmentAction(
  raw: unknown
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx   = await requireTenantSession(await headers());
    const input = CreateAssessmentSchema.parse(raw);

    const rec = await database.competencyAssessment.create({
      data: {
        tenantId:    ctx.tenantId,
        scope:       input.scope,
        scopeId:     input.scopeId,
        competency:  input.competency,
        score:       input.score,
        notes:       input.notes ?? null,
        assessedById: ctx.userId,
        piPlanId:    input.piPlanId ?? null,
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
  return safeAction(async () => {
    const ctx   = await requireTenantSession(await headers());
    const input = CreateImprovementActionSchema.parse(raw);

    const rec = await database.improvementAction.create({
      data: {
        tenantId:      ctx.tenantId,
        title:         input.title,
        description:   input.description ?? null,
        scope:         input.scope,
        scopeId:       input.scopeId,
        relatedMetric: input.relatedMetric ?? null,
        dueDate:       input.dueDate ? new Date(input.dueDate) : null,
        assigneeId:    ctx.userId,
        assessmentId:  input.assessmentId ?? null,
        status:        input.status,
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
  return safeAction(async () => {
    const ctx   = await requireTenantSession(await headers());
    const input = UpdateImprovementActionSchema.parse(raw);

    await database.improvementAction.updateMany({
      where: { id, tenantId: ctx.tenantId },
      data: {
        ...(input.title       !== undefined && { title: input.title }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.status      !== undefined && { status: input.status }),
        ...(input.relatedMetric !== undefined && { relatedMetric: input.relatedMetric }),
        ...(input.dueDate     !== undefined && { dueDate: input.dueDate ? new Date(input.dueDate) : null }),
        ...(input.scope       !== undefined && { scope: input.scope }),
        ...(input.scopeId     !== undefined && { scopeId: input.scopeId }),
      },
    });

    revalidatePath("/analytics/measure-grow");
  });
}

// ─── Spec-required aliases ────────────────────────────────────────────────────

export const listAssessments        = listAllAssessments;
export const listImprovementActions = listAllImprovementActions;
export const createAssessment       = createAssessmentAction;
export const createImprovementAction = createImprovementActionResult;
export const updateImprovementAction = updateImprovementActionResult;

// ─── Legacy mutations (kept for backward compatibility) ───────────────────────

export async function createAssessmentLegacy(input: {
  scope: string;
  scopeId: string;
  competency: CompetencyId;
  score: number;
  notes?: string;
  piPlanId?: string;
}) {
  const ctx = await requireTenantSession(await headers());

  if (input.score < 1 || input.score > 5) throw new Error("Score deve ser entre 1 e 5.");

  await database.competencyAssessment.create({
    data: {
      tenantId:    ctx.tenantId,
      scope:       input.scope,
      scopeId:     input.scopeId,
      competency:  input.competency,
      score:       input.score,
      notes:       input.notes ?? null,
      assessedById: ctx.userId,
      piPlanId:    input.piPlanId ?? null,
    },
  });

  revalidatePath("/analytics/flow");
}

export async function createImprovementActionLegacy(input: {
  title: string;
  description?: string;
  scope: string;
  scopeId: string;
  relatedMetric?: string;
  dueDate?: string;
  assessmentId?: string;
}) {
  const ctx = await requireTenantSession(await headers());

  if (!input.title.trim()) throw new Error("Título obrigatório.");

  await database.improvementAction.create({
    data: {
      tenantId:      ctx.tenantId,
      title:         input.title.trim(),
      description:   input.description ?? null,
      scope:         input.scope,
      scopeId:       input.scopeId,
      relatedMetric: input.relatedMetric ?? null,
      dueDate:       input.dueDate ? new Date(input.dueDate) : null,
      assigneeId:    ctx.userId,
      assessmentId:  input.assessmentId ?? null,
    },
  });

  revalidatePath("/analytics/flow");
}

export async function updateActionStatus(id: string, status: string) {
  const ctx = await requireTenantSession(await headers());

  await database.improvementAction.updateMany({
    where: { id, tenantId: ctx.tenantId },
    data: { status },
  });

  revalidatePath("/analytics/flow");
}
