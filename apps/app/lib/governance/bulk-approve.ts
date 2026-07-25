import { database } from "@repo/database";
import { log } from "@repo/observability/log";

export type BulkApproveResult = {
  succeeded: number;
  failed: number;
  errors: Array<{ epicId: string; reason: string }>;
};

export async function bulkApproveStep(
  epicIds: string[],
  stepIndex: number,
  approverId: string,
  tenantId: string,
  comment?: string
): Promise<BulkApproveResult> {
  const results = await Promise.allSettled(
    epicIds.map((epicId) =>
      approveEpicStep(epicId, stepIndex, approverId, tenantId, comment)
    )
  );

  const errors: BulkApproveResult["errors"] = [];
  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "fulfilled") {
      succeeded++;
    } else {
      failed++;
      const epicId = epicIds[i] ?? "unknown";
      errors.push({
        epicId,
        reason:
          result.reason instanceof Error
            ? result.reason.message
            : "Unknown error",
      });
      log.error("[bulk-approve] step approval failed", {
        epicId,
        error: result.reason,
      });
    }
  }

  return { succeeded, failed, errors };
}

async function approveEpicStep(
  epicId: string,
  stepIndex: number,
  approverId: string,
  tenantId: string,
  comment?: string
): Promise<void> {
  const governedEpic = await database.governedEpic.findFirst({
    where: { epicId, tenantId },
    select: { id: true, currentApprovalRequestId: true },
  });

  if (!governedEpic?.currentApprovalRequestId) {
    throw new Error("No active approval request");
  }

  const step = await database.approvalStepInstance.findFirst({
    where: {
      approvalRequestId: governedEpic.currentApprovalRequestId,
      etapaOrdem: stepIndex,
      estado: "pending",
    },
    select: { id: true },
  });

  if (!step) {
    throw new Error("Step not found or already decided");
  }

  await database.$transaction([
    database.approvalStepInstance.update({
      where: { id: step.id },
      data: {
        estado: "approved",
        approverId,
        comentario: comment,
        timestamp: new Date(),
      },
    }),
    database.decisionLogEntry.create({
      data: {
        tenantId,
        tipo: "epic_decision",
        targetType: "epic",
        targetId: epicId,
        decisao: "approved",
        justificativa: comment ?? "Bulk approval",
        decisorId: approverId,
      },
    }),
  ]);
}
