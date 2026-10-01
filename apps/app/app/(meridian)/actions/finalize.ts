"use server";

import { withTenantDb } from "@repo/database";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AXES, AXIS_IDS } from "@/lib/meridian/axes";
import {
  MeridianRuleError,
  requireMeridianPermissionContext,
  StateConflictError,
} from "@/lib/meridian/guards";
import { cuid, type Result, safeAction } from "../../actions/_base";
import { logMeridianAudit } from "./_shared";

// Finalizar assessment (decisão do Norte, 30/09).
//
// A transição REVIEW → FINALISED não existia: nenhum código gravava
// FINALISED, e o endpoint de gaps ranqueados (X-03, `lib/meridian/ranked-gaps`)
// só lê assessment FINALISED — devolvia vazio para qualquer diagnóstico real.
//
// Só o consultor (`assessment.manage`). Pré-condições: o assessment está em
// revisão (a coleta foi fechada e o scoring rodou), os cinco eixos têm score e
// nenhum eixo segue contestado — a fila de revisão vazia é o que fecha o SC-004
// ("todo eixo acima do limiar passa pela fila antes de o relatório valer").
// Efeito: o diagnóstico vale como final e os gaps ranqueados são liberados.

const FinalizeSchema = z.object({ assessmentId: cuid });

export async function finalizeAssessment(
  raw: z.input<typeof FinalizeSchema>
): Promise<Result<{ status: "FINALISED" }>> {
  return safeAction(async () => {
    const ctx = await requireMeridianPermissionContext("assessment.manage");
    const input = FinalizeSchema.parse(raw);

    await withTenantDb(ctx.tenantId, async (db) => {
      const a = await db.meridianAssessment.findFirst({
        where: { id: input.assessmentId, tenantId: ctx.tenantId },
        select: {
          id: true,
          code: true,
          orgName: true,
          status: true,
          scores: { select: { axis: true, status: true } },
        },
      });
      if (!a) {
        throw new MeridianRuleError(
          "assessment.not-found",
          "Assessment não encontrado nesta organização."
        );
      }
      if (a.status === "FINALISED") {
        throw new StateConflictError(
          "finalize.already-finalised",
          "Assessment já finalizado."
        );
      }
      if (a.status !== "REVIEW") {
        throw new StateConflictError(
          "finalize.not-in-review",
          "Só se finaliza um assessment em revisão — feche a coleta e rode o scoring antes."
        );
      }
      const scored = new Set(a.scores.map((s) => s.axis));
      if (!AXIS_IDS.every((axis) => scored.has(axis))) {
        throw new StateConflictError(
          "finalize.scoring-missing",
          "Há eixo sem score — rode o scoring antes de finalizar."
        );
      }
      const contested = AXIS_IDS.filter((axis) =>
        a.scores.some((s) => s.axis === axis && s.status === "CONTESTED")
      ).map((axis) => AXES[axis].label);
      if (contested.length > 0) {
        throw new StateConflictError(
          "finalize.contested-pending",
          `Há eixo contestado sem decisão (${contested.join(", ")}) — decida na fila de revisão antes de finalizar.`,
          contested
        );
      }

      // O `where` com status repete a pré-condição na escrita: se outra ação
      // mudou o assessment entre a leitura e aqui, ninguém finaliza por cima.
      const { count } = await db.meridianAssessment.updateMany({
        where: { id: a.id, tenantId: ctx.tenantId, status: "REVIEW" },
        data: { status: "FINALISED" },
      });
      if (count !== 1) {
        throw new StateConflictError(
          "finalize.state-changed",
          "O assessment mudou de estado enquanto finalizava — recarregue e tente de novo."
        );
      }

      await logMeridianAudit(db, ctx, {
        action: "meridian.assessment.finalise",
        entityType: "meridian.assessment",
        entityId: a.id,
        target: `${a.code} · ${a.orgName}`,
        note: "Assessment finalizado: diagnóstico final e gaps ranqueados liberados para o Scaffold.",
        diff: [["Status", "REVIEW", "FINALISED"]],
      });
    });

    revalidatePath("/meridian");
    return { status: "FINALISED" as const };
  });
}
