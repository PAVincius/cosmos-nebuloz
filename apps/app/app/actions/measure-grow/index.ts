"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

export const COMPETENCIES = [
  { id: "TEAM_TECHNICAL_AGILITY", label: "Team & Technical Agility" },
  { id: "AGILE_PRODUCT_DELIVERY", label: "Agile Product Delivery" },
  { id: "LEAN_PORTFOLIO_MANAGEMENT", label: "Lean Portfolio Management" },
  { id: "ORGANIZATIONAL_AGILITY", label: "Organizational Agility" },
  { id: "ENTERPRISE_SOLUTION_DELIVERY", label: "Enterprise Solution Delivery" },
  { id: "LEAN_AGILE_LEADERSHIP", label: "Lean-Agile Leadership" },
  { id: "CONTINUOUS_LEARNING_CULTURE", label: "Continuous Learning Culture" },
] as const;

export type CompetencyId = (typeof COMPETENCIES)[number]["id"];

export type AssessmentWithActions = {
  id: string;
  scope: string;
  scopeId: string;
  competency: string;
  competencyLabel: string;
  score: number;
  assessedAt: Date;
  notes: string | null;
  actions: {
    id: string;
    title: string;
    status: string;
    relatedMetric: string | null;
    dueDate: Date | null;
  }[];
};

export async function getAssessments(
  scope: string,
  scopeId: string
): Promise<AssessmentWithActions[]> {
  const ctx = await requireTenantSession(await headers());

  const assessments = await database.competencyAssessment.findMany({
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

  return assessments.map((a) => ({
    ...a,
    competencyLabel:
      COMPETENCIES.find((c) => c.id === a.competency)?.label ?? a.competency,
  }));
}

export async function createAssessment(input: {
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
      tenantId: ctx.tenantId,
      scope: input.scope,
      scopeId: input.scopeId,
      competency: input.competency,
      score: input.score,
      notes: input.notes ?? null,
      assessedById: ctx.userId,
      piPlanId: input.piPlanId ?? null,
    },
  });

  revalidatePath("/analytics/flow");
}

export async function createImprovementAction(input: {
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
      tenantId: ctx.tenantId,
      title: input.title.trim(),
      description: input.description ?? null,
      scope: input.scope,
      scopeId: input.scopeId,
      relatedMetric: input.relatedMetric ?? null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      assigneeId: ctx.userId,
      assessmentId: input.assessmentId ?? null,
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

export async function getImprovementActions(scope: string, scopeId: string) {
  const ctx = await requireTenantSession(await headers());

  return database.improvementAction.findMany({
    where: { tenantId: ctx.tenantId, scope, scopeId },
    orderBy: { createdAt: "desc" },
  });
}
