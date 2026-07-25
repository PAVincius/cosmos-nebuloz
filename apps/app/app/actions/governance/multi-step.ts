"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { type Result, safeAction } from "../_base";

type WorkflowStep = {
  order: number;
  roleRequired: string;
  requiresAll?: boolean;
  slaHours?: number;
  approverIds?: string[];
};

const DecideSchema = z.object({
  requestId: z.string().min(1),
  stepIndex: z.number().int().min(0),
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().max(2000).optional(),
});

const BypassSchema = z.object({
  governedEpicId: z.string().min(1),
  justification: z.string().min(100).max(2000),
});

async function advanceToNextStep(
  governedEpicId: string,
  currentStepIndex: number,
  workflowId: string,
  tenantId: string
): Promise<"advanced" | "completed" | "waiting"> {
  const pendingRequests = await database.approvalRequest.count({
    where: {
      governedEpicId,
      stepIndex: currentStepIndex,
      estado: "open",
      tenantId,
    },
  });

  if (pendingRequests > 0) {
    return "waiting";
  }

  const workflow = await database.approvalWorkflow.findFirstOrThrow({
    where: { id: workflowId, tenantId },
  });

  const steps = workflow.etapas as WorkflowStep[];
  const nextStepIndex = currentStepIndex + 1;

  if (nextStepIndex >= steps.length) {
    await database.$transaction(async (tx) => {
      await tx.governedEpic.update({
        where: { id: governedEpicId },
        data: { governanceStatus: "approved" },
      });

      await tx.decisionLogEntry.create({
        data: {
          tenantId,
          tipo: "APPROVED",
          targetType: "epic",
          targetId: governedEpicId,
          decisao: "approved",
          justificativa: "All approval steps completed",
          decisorId: "system",
          dadosSuporte: { stepIndex: currentStepIndex, finalStep: true },
        },
      });
    });
    return "completed";
  }

  const nextStep = steps[nextStepIndex];
  const approverIds = nextStep?.approverIds ?? [];

  await database.$transaction(async (tx) => {
    await tx.governedEpic.update({
      where: { id: governedEpicId },
      data: { currentStepIndex: nextStepIndex },
    });

    if (approverIds.length > 0) {
      await tx.approvalRequest.createMany({
        data: approverIds.map((uid) => ({
          tenantId,
          workflowId,
          targetType: "epic",
          targetId: governedEpicId,
          estado: "open",
          initiatorId: "system",
          governedEpicId,
          stepIndex: nextStepIndex,
          assignedTo: uid,
        })),
      });
    } else {
      await tx.approvalRequest.create({
        data: {
          tenantId,
          workflowId,
          targetType: "epic",
          targetId: governedEpicId,
          estado: "open",
          initiatorId: "system",
          governedEpicId,
          stepIndex: nextStepIndex,
        },
      });
    }
  });

  return "advanced";
}

export async function processApprovalDecision(
  raw: unknown
): Promise<
  Result<{ status: "advanced" | "completed" | "waiting" | "rejected" }>
> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const input = DecideSchema.parse(raw);

    const request = await database.approvalRequest.findFirstOrThrow({
      where: { id: input.requestId, tenantId: ctx.tenantId },
    });

    if (!request.governedEpicId) {
      throw new Error("REQUEST_NOT_LINKED");
    }

    const governedEpic = await database.governedEpic.findFirstOrThrow({
      where: { id: request.governedEpicId, tenantId: ctx.tenantId },
    });

    if (governedEpic.submittedBy === ctx.userId) {
      throw new Error("SELF_APPROVAL_NOT_ALLOWED");
    }

    await database.approvalRequest.update({
      where: { id: input.requestId },
      data: {
        estado: input.decision === "approved" ? "approved" : "rejected",
        decision: input.decision,
        reason: input.reason,
        decidedAt: new Date(),
      },
    });

    await database.decisionLogEntry.create({
      data: {
        tenantId: ctx.tenantId,
        tipo: input.decision.toUpperCase(),
        targetType: "epic",
        targetId: request.governedEpicId,
        decisao: input.decision,
        justificativa: input.reason ?? input.decision,
        decisorId: ctx.userId,
        dadosSuporte: {
          requestId: input.requestId,
          stepIndex: input.stepIndex,
        },
      },
    });

    if (input.decision === "rejected") {
      await database.$transaction(async (tx) => {
        await tx.governedEpic.update({
          where: { id: request.governedEpicId as string },
          data: { governanceStatus: "rejected" },
        });

        await tx.approvalRequest.updateMany({
          where: {
            governedEpicId: request.governedEpicId,
            estado: "open",
            tenantId: ctx.tenantId,
          },
          data: { estado: "cancelled" },
        });
      });

      revalidatePath("/portfolio/governance");
      return { status: "rejected" };
    }

    const advanceStatus = await advanceToNextStep(
      request.governedEpicId,
      input.stepIndex,
      request.workflowId,
      ctx.tenantId
    );

    revalidatePath("/portfolio/governance");
    return { status: advanceStatus };
  });
}

export async function bypassApproval(
  raw: unknown
): Promise<Result<{ status: "bypassed" }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    if (ctx.role !== "RTE" && ctx.role !== "ADMIN") {
      throw new Error("FORBIDDEN");
    }

    const input = BypassSchema.parse(raw);

    const governedEpic = await database.governedEpic.findFirstOrThrow({
      where: { id: input.governedEpicId, tenantId: ctx.tenantId },
    });

    if (!governedEpic.allowApprovalBypass) {
      throw new Error("BYPASS_NOT_ALLOWED");
    }

    await database.$transaction(async (tx) => {
      await tx.governedEpic.update({
        where: { id: input.governedEpicId },
        data: {
          governanceStatus: "approved",
          bypassedAt: new Date(),
          bypassedBy: ctx.userId,
        },
      });

      await tx.approvalRequest.updateMany({
        where: {
          governedEpicId: input.governedEpicId,
          estado: "open",
          tenantId: ctx.tenantId,
        },
        data: { estado: "cancelled" },
      });

      await tx.decisionLogEntry.create({
        data: {
          tenantId: ctx.tenantId,
          tipo: "BYPASS",
          targetType: "epic",
          targetId: input.governedEpicId,
          decisao: "approved",
          justificativa: input.justification,
          decisorId: ctx.userId,
          dadosSuporte: { bypassedBy: ctx.userId, role: ctx.role },
        },
      });
    });

    revalidatePath("/portfolio/governance");
    return { status: "bypassed" };
  });
}
