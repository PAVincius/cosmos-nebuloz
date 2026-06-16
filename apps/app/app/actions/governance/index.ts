"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { Page } from "@/app/actions/_base";
import {
  buildPage,
  paginationArgs,
  type Result,
  safeAction,
} from "@/app/actions/_base";
import {
  ApprovalEstadoSchema,
  type ApprovalRequestWithSteps,
  type DecisionLogEntryPublic,
  DecisionLogFiltersSchema,
  GovernedEpicFiltersSchema,
  type GovernedEpicWithDetails,
  ReviewStepSchema,
  SubmitEpicForApprovalSchema,
  type WorkflowEtapa,
} from "./schema";

// ─── Governance role map ──────────────────────────────────────────────────────

// Maps governance roleRequired strings to the MemberRole values that can approve them
const GOVERNANCE_ROLE_MAP: Record<string, string[]> = {
  lpm: ["ADMIN", "STE"],
  finance: ["ADMIN", "STE"],
  enterprise_architect: ["ADMIN", "STE"],
  cfo: ["ADMIN"],
};

// ─── Default workflows ────────────────────────────────────────────────────────

const DEFAULT_WORKFLOWS = [
  {
    tipo: "epic_investment",
    nome: "Aprovação de Épico de Portfólio",
    etapas: [
      {
        order: 1,
        roleRequired: "lpm",
        criteria: "Validar alinhamento estratégico e ROI estimado",
      },
      {
        order: 2,
        roleRequired: "finance",
        criteria: "Validar viabilidade orçamentária",
      },
    ],
  },
  {
    tipo: "budget_guardrail_change",
    nome: "Mudança de Guardrail de Budget",
    etapas: [
      {
        order: 1,
        roleRequired: "lpm",
        criteria: "Validar impacto nos value streams",
      },
      { order: 2, roleRequired: "finance", criteria: "Aprovação financeira" },
    ],
  },
] as const;

async function ensureDefaultWorkflows(tenantId: string): Promise<void> {
  for (const wf of DEFAULT_WORKFLOWS) {
    await database.approvalWorkflow.upsert({
      where: { tenantId_tipo: { tenantId, tipo: wf.tipo } },
      create: {
        tenantId,
        tipo: wf.tipo,
        nome: wf.nome,
        etapas: wf.etapas,
        ativo: true,
      },
      update: {},
    });
  }
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function listGovernedEpics(
  raw?: unknown
): Promise<Result<GovernedEpicWithDetails[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const filters = GovernedEpicFiltersSchema.parse(raw ?? {});

    const where = {
      tenantId: ctx.tenantId,
      ...(filters.status ? { governanceStatus: filters.status } : {}),
      ...(filters.valueStreamId
        ? { valueStreamId: filters.valueStreamId }
        : {}),
      ...(filters.themeId ? { themeId: filters.themeId } : {}),
    };

    const items = await database.governedEpic.findMany({
      where,
      include: { epic: { select: { title: true } } },
      orderBy: { updatedAt: "desc" },
    });

    return items.map((ge) => ({
      id: ge.id,
      tenantId: ge.tenantId,
      epicId: ge.epicId,
      epicTitle: ge.epic.title,
      governanceStatus:
        ge.governanceStatus as GovernedEpicWithDetails["governanceStatus"],
      guardrailFlags: (ge.guardrailFlags as string[]) ?? [],
      investmentEstimate: ge.investmentEstimate,
      valueStreamId: ge.valueStreamId,
      themeId: ge.themeId,
      currentApprovalRequestId: ge.currentApprovalRequestId,
      createdAt: ge.createdAt,
      updatedAt: ge.updatedAt,
    }));
  });
}

export async function getApprovalRequest(
  requestId: string
): Promise<Result<ApprovalRequestWithSteps>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const req = await database.approvalRequest.findFirst({
      where: { id: requestId, tenantId: ctx.tenantId },
      include: {
        workflow: { select: { nome: true } },
        steps: { orderBy: { etapaOrdem: "asc" } },
        governedEpic: { include: { epic: { select: { title: true } } } },
      },
    });

    if (!req) {
      throw new Error("Request de aprovação não encontrado.");
    }

    return {
      id: req.id,
      tenantId: req.tenantId,
      workflowId: req.workflowId,
      workflowNome: req.workflow.nome,
      targetType: req.targetType,
      targetId: req.targetId,
      estado: req.estado as ApprovalRequestWithSteps["estado"],
      initiatorId: req.initiatorId,
      governedEpicId: req.governedEpicId,
      epicTitle: req.governedEpic?.epic?.title ?? null,
      steps: req.steps.map((s) => ({
        id: s.id,
        etapaOrdem: s.etapaOrdem,
        roleRequired: s.roleRequired,
        approverId: s.approverId,
        estado: s.estado as ApprovalRequestWithSteps["steps"][number]["estado"],
        comentario: s.comentario,
        timestamp: s.timestamp,
      })),
      createdAt: req.createdAt,
      updatedAt: req.updatedAt,
    };
  });
}

export async function listApprovalRequests(
  raw?: unknown
): Promise<Result<ApprovalRequestWithSteps[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const estado = ApprovalEstadoSchema.optional().parse(raw);

    const reqs = await database.approvalRequest.findMany({
      where: {
        tenantId: ctx.tenantId,
        ...(estado ? { estado } : {}),
      },
      include: {
        workflow: { select: { nome: true } },
        steps: { orderBy: { etapaOrdem: "asc" } },
        governedEpic: { include: { epic: { select: { title: true } } } },
      },
      take: 200,
      orderBy: { updatedAt: "desc" },
    });

    return reqs.map((req) => ({
      id: req.id,
      tenantId: req.tenantId,
      workflowId: req.workflowId,
      workflowNome: req.workflow.nome,
      targetType: req.targetType,
      targetId: req.targetId,
      estado: req.estado as ApprovalRequestWithSteps["estado"],
      initiatorId: req.initiatorId,
      governedEpicId: req.governedEpicId,
      epicTitle: req.governedEpic?.epic?.title ?? null,
      steps: req.steps.map((s) => ({
        id: s.id,
        etapaOrdem: s.etapaOrdem,
        roleRequired: s.roleRequired,
        approverId: s.approverId,
        estado: s.estado as ApprovalRequestWithSteps["steps"][number]["estado"],
        comentario: s.comentario,
        timestamp: s.timestamp,
      })),
      createdAt: req.createdAt,
      updatedAt: req.updatedAt,
    }));
  });
}

export async function listDecisionLog(
  raw?: unknown
): Promise<Result<Page<DecisionLogEntryPublic>>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const filters = DecisionLogFiltersSchema.parse(raw ?? {});
    const { skip, take } = paginationArgs(filters.page, filters.limit);

    const where = {
      tenantId: ctx.tenantId,
      ...(filters.tipo ? { tipo: filters.tipo } : {}),
      ...(filters.valueStreamId
        ? { valueStreamId: filters.valueStreamId }
        : {}),
    };

    const [items, total] = await Promise.all([
      database.decisionLogEntry.findMany({
        where,
        skip,
        take,
        orderBy: { dataDecisao: "desc" },
      }),
      database.decisionLogEntry.count({ where }),
    ]);

    return buildPage(
      items.map((e) => ({
        id: e.id,
        tipo: e.tipo,
        targetType: e.targetType,
        targetId: e.targetId,
        valueStreamId: e.valueStreamId,
        decisao: e.decisao as DecisionLogEntryPublic["decisao"],
        justificativa: e.justificativa,
        dadosSuporte: (e.dadosSuporte ?? {}) as Record<string, unknown>,
        decisorId: e.decisorId,
        dataDecisao: e.dataDecisao,
      })),
      total,
      filters.page,
      filters.limit
    );
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function submitEpicForApproval(
  raw: unknown
): Promise<Result<{ requestId: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const input = SubmitEpicForApprovalSchema.parse(raw);

    const epic = await database.epic.findFirst({
      where: { id: input.epicId, tenantId: ctx.tenantId },
    });
    if (!epic) {
      throw new Error("Épico não encontrado.");
    }

    await ensureDefaultWorkflows(ctx.tenantId);

    // Prevent duplicate open requests for the same epic
    const existingOpen = await database.approvalRequest.findFirst({
      where: {
        tenantId: ctx.tenantId,
        targetId: input.epicId,
        estado: { in: ["open", "in_review"] },
      },
    });
    if (existingOpen) {
      throw new Error(
        "Já existe um request de aprovação em aberto para este épico."
      );
    }

    const workflow = await database.approvalWorkflow.findFirst({
      where: { tenantId: ctx.tenantId, tipo: "epic_investment", ativo: true },
    });
    if (!workflow) {
      throw new Error("Workflow de aprovação não configurado.");
    }

    const etapas = workflow.etapas as WorkflowEtapa[];

    const { request } = await database.$transaction(async (tx) => {
      const governedEpic = await tx.governedEpic.upsert({
        where: { epicId: input.epicId },
        create: {
          tenantId: ctx.tenantId,
          epicId: input.epicId,
          investmentEstimate: input.investmentEstimate ?? null,
          valueStreamId: input.valueStreamId ?? null,
          themeId: input.themeId ?? null,
          guardrailFlags: input.guardrailFlags,
          governanceStatus: "review",
        },
        update: {
          investmentEstimate: input.investmentEstimate ?? null,
          valueStreamId: input.valueStreamId ?? null,
          themeId: input.themeId ?? null,
          guardrailFlags: input.guardrailFlags,
          governanceStatus: "review",
        },
      });

      const request = await tx.approvalRequest.create({
        data: {
          tenantId: ctx.tenantId,
          workflowId: workflow.id,
          targetType: "epic",
          targetId: input.epicId,
          estado: "open",
          initiatorId: ctx.userId,
          governedEpicId: governedEpic.id,
          steps: {
            createMany: {
              data: etapas.map((e) => ({
                tenantId: ctx.tenantId,
                etapaOrdem: e.order,
                roleRequired: e.roleRequired,
                estado: "pending",
              })),
            },
          },
        },
      });

      await tx.governedEpic.update({
        where: { id: governedEpic.id },
        data: { currentApprovalRequestId: request.id },
      });

      return { request, governedEpic };
    });

    revalidatePath("/portfolio/governance");
    return { requestId: request.id };
  });
}

export async function reviewStep(
  raw: unknown
): Promise<Result<{ requestId: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const input = ReviewStepSchema.parse(raw);

    const step = await database.approvalStepInstance.findFirst({
      where: { id: input.stepId, tenantId: ctx.tenantId, estado: "pending" },
      include: {
        approvalRequest: {
          include: {
            steps: { orderBy: { etapaOrdem: "asc" } },
            governedEpic: true,
          },
        },
      },
    });
    if (!step) {
      throw new Error("Step não encontrado ou já processado.");
    }

    // Enforce role requirement
    const member = await database.tenantMember.findFirst({
      where: { tenantId: ctx.tenantId, userId: ctx.userId },
    });
    const allowedRoles = GOVERNANCE_ROLE_MAP[step.roleRequired] ?? ["ADMIN"];
    if (!(member && allowedRoles.includes(member.role))) {
      throw new Error(
        `Você não tem permissão para revisar esta etapa. Papel requerido: ${step.roleRequired}.`
      );
    }

    const requestId = step.approvalRequestId;
    const ge = step.approvalRequest.governedEpic;

    await database.$transaction(async (tx) => {
      await tx.approvalStepInstance.update({
        where: { id: step.id },
        data: {
          estado: input.decision,
          approverId: ctx.userId,
          comentario: input.comentario ?? null,
          timestamp: new Date(),
        },
      });

      // Re-fetch all steps from DB inside transaction for authoritative state
      const allSteps = await tx.approvalStepInstance.findMany({
        where: { approvalRequestId: step.approvalRequestId },
        orderBy: { etapaOrdem: "asc" },
      });

      // Override the current step with the just-applied decision
      const finalSteps = allSteps.map((s) =>
        s.id === step.id ? { ...s, estado: input.decision } : s
      );

      const anyRejected = finalSteps.some((s) => s.estado === "rejected");
      const allApproved = finalSteps.every(
        (s) => s.estado === "approved" || s.estado === "skipped"
      );

      if (anyRejected) {
        await tx.approvalRequest.update({
          where: { id: requestId },
          data: { estado: "rejected" },
        });
        if (ge) {
          await tx.governedEpic.update({
            where: { id: ge.id },
            data: { governanceStatus: "rejected" },
          });
        }
        await tx.decisionLogEntry.create({
          data: {
            tenantId: ctx.tenantId,
            tipo: "epic_decision",
            targetType: "epic",
            targetId: step.approvalRequest.targetId,
            valueStreamId: ge?.valueStreamId ?? null,
            decisao: "rejected",
            justificativa: input.comentario ?? "Rejeitado sem justificativa.",
            dadosSuporte: {},
            decisorId: ctx.userId,
          },
        });
      } else if (allApproved) {
        await tx.approvalRequest.update({
          where: { id: requestId },
          data: { estado: "approved" },
        });
        if (ge) {
          await tx.governedEpic.update({
            where: { id: ge.id },
            data: { governanceStatus: "approved" },
          });
        }
        await tx.decisionLogEntry.create({
          data: {
            tenantId: ctx.tenantId,
            tipo: "epic_decision",
            targetType: "epic",
            targetId: step.approvalRequest.targetId,
            valueStreamId: ge?.valueStreamId ?? null,
            decisao: "approved",
            justificativa:
              input.comentario ?? "Aprovado por todos os revisores.",
            dadosSuporte: {},
            decisorId: ctx.userId,
          },
        });
      } else {
        await tx.approvalRequest.update({
          where: { id: requestId },
          data: { estado: "in_review" },
        });
      }
    });

    revalidatePath("/portfolio/governance");
    revalidatePath(`/portfolio/governance/${requestId}`);
    return { requestId };
  });
}

export async function cancelApprovalRequest(
  requestId: string
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const req = await database.approvalRequest.findFirst({
      where: { id: requestId, tenantId: ctx.tenantId, initiatorId: ctx.userId },
      include: { governedEpic: true },
    });
    if (!req) {
      throw new Error("Request não encontrado ou sem permissão.");
    }

    if (!["open", "in_review"].includes(req.estado)) {
      throw new Error(
        "Apenas requests em aberto ou em revisão podem ser cancelados."
      );
    }

    await database.$transaction(async (tx) => {
      await tx.approvalRequest.update({
        where: { id: requestId },
        data: { estado: "cancelled" },
      });

      if (req.governedEpic) {
        await tx.governedEpic.update({
          where: { id: req.governedEpic.id },
          data: { governanceStatus: "draft", currentApprovalRequestId: null },
        });
      }
    });

    revalidatePath("/portfolio/governance");
    return { id: requestId };
  });
}
