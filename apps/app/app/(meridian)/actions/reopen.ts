"use server";

import { withTenantDb } from "@repo/database";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  MeridianRuleError,
  requireMeridianPermissionContext,
  StateConflictError,
} from "@/lib/meridian/guards";
import { cuid, type Result, safeAction } from "../../actions/_base";
import { logMeridianAudit } from "./_shared";

// Reabrir assessment finalizado (D-29, FR-029e).
//
// FINALISED → REVIEW, nunca COLLECTING: as respostas continuam travadas —
// corrigir uma resposta exige reavaliação, não reabertura. Só o consultor
// (`assessment.manage`), com motivo de 20+ caracteres, e a reabertura é
// auditada. Nada além do status muda: o baseline assinado de uma trilha
// noutro produto (Scaffold) é versão imutável e não anda por trás do Meridian.
// Para finalizar de novo, a fila de contestados precisa estar vazia outra vez
// (`finalizeAssessment`).

const REASON_MIN = 20;

const ReopenSchema = z.object({
  assessmentId: cuid,
  reason: z.string().max(4000),
});

export async function reopenAssessment(
  raw: z.input<typeof ReopenSchema>
): Promise<Result<{ status: "REVIEW" }>> {
  return safeAction(async () => {
    const ctx = await requireMeridianPermissionContext("assessment.manage");
    const input = ReopenSchema.parse(raw);

    const reason = input.reason.trim();
    if (reason.length < REASON_MIN) {
      throw new MeridianRuleError(
        "reopen.reason",
        `Reabrir exige um motivo de pelo menos ${REASON_MIN} caracteres — fica na trilha de auditoria.`
      );
    }

    await withTenantDb(ctx.tenantId, async (db) => {
      const a = await db.meridianAssessment.findFirst({
        where: { id: input.assessmentId, tenantId: ctx.tenantId },
        select: { id: true, code: true, orgName: true, status: true },
      });
      if (!a) {
        throw new MeridianRuleError(
          "assessment.not-found",
          "Assessment não encontrado nesta organização."
        );
      }
      if (a.status !== "FINALISED") {
        throw new StateConflictError(
          "reopen.not-finalised",
          "Só se reabre um assessment finalizado."
        );
      }

      // O `where` com status repete a pré-condição na escrita (corrida).
      const { count } = await db.meridianAssessment.updateMany({
        where: { id: a.id, tenantId: ctx.tenantId, status: "FINALISED" },
        data: { status: "REVIEW" },
      });
      if (count !== 1) {
        throw new StateConflictError(
          "reopen.state-changed",
          "O assessment mudou de estado enquanto reabria — recarregue e tente de novo."
        );
      }

      await logMeridianAudit(db, ctx, {
        action: "meridian.assessment.reopen",
        entityType: "meridian.assessment",
        entityId: a.id,
        target: `${a.code} · ${a.orgName}`,
        note: reason,
        diff: [["Status", "FINALISED", "REVIEW"]],
      });
    });

    revalidatePath("/meridian");
    return { status: "REVIEW" as const };
  });
}
