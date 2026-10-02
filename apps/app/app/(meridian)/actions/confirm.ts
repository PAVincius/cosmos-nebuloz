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
import { logMeridianAudit, nextCode, requireDecisionsOpen } from "./_shared";

// Confirmar o computado (D-29, FR-029a, SC-012).
//
// Decisão do revisor sobre um eixo CONTESTADO que mantém o score. É ato
// distinto do override: o override muda o score e continua recusando "sem
// mudança" (`registerOverride`); confirmar não muda e é a única saída da fila
// sem mexer na nota. Mesmas exigências (override.write, justificativa de 20+
// caracteres), append-only — uma linha `kind = CONFIRMATION` em
// `MeridianOverride`, com antes e depois iguais, no mesmo código OV-nnn — e
// auditada. O eixo passa de CONTESTED a COMPUTED sem tocar `final` nem
// `computed`; o re-scoring respeita a confirmação (ver `runScoringInTx`).

const RATIONALE_MIN = 20;

const ConfirmSchema = z.object({
  assessmentId: cuid,
  axis: z.enum(AXIS_IDS as [string, ...string[]]),
  rationale: z.string().max(4000),
});

export async function confirmComputed(
  raw: z.input<typeof ConfirmSchema>
): Promise<Result<{ id: string; code: string }>> {
  return safeAction(async () => {
    const ctx = await requireMeridianPermissionContext("override.write");
    const input = ConfirmSchema.parse(raw);
    const axis = input.axis as (typeof AXIS_IDS)[number];

    const rationale = input.rationale.trim();
    if (rationale.length < RATIONALE_MIN) {
      throw new MeridianRuleError(
        "confirm.rationale",
        `A justificativa precisa de pelo menos ${RATIONALE_MIN} caracteres — é o que o patrocinador lê quando pergunta por que o eixo ficou como está.`
      );
    }

    const created = await withTenantDb(ctx.tenantId, async (db) => {
      await requireDecisionsOpen(db, ctx.tenantId, input.assessmentId);

      const score = await db.meridianAxisScore.findFirst({
        where: {
          tenantId: ctx.tenantId,
          assessmentId: input.assessmentId,
          axis,
        },
        include: { assessment: { select: { code: true, orgName: true } } },
      });
      if (!score) {
        throw new MeridianRuleError(
          "confirm.no-score",
          "Este eixo ainda não tem score computado — feche a coleta antes de decidir."
        );
      }
      if (score.status !== "CONTESTED") {
        throw new StateConflictError(
          "confirm.not-contested",
          "Só se confirma o computado de um eixo contestado."
        );
      }

      // A leitura acima não segura nada: duas confirmações, ou uma confirmação
      // e um override, leem CONTESTED ao mesmo tempo. O estado vai no where da
      // escrita — o banco deixa uma só mudar a linha, e quem perde a corrida
      // sai antes de gravar código, confirmação ou trilha. A trava de
      // FINALISED entra pelo mesmo where. Só o status muda: `final` e
      // `computed` não são tocados.
      const claimed = await db.meridianAxisScore.updateMany({
        where: {
          id: score.id,
          tenantId: ctx.tenantId,
          status: "CONTESTED",
          assessment: { status: { not: "FINALISED" } },
        },
        data: { status: "COMPUTED" },
      });
      if (claimed.count !== 1) {
        throw new StateConflictError(
          "confirm.state-changed",
          "O eixo mudou de estado enquanto você decidia — recarregue a tela antes de confirmar."
        );
      }

      const value = score.final ?? score.computed;
      const code = await nextCode({
        db,
        tenantId: ctx.tenantId,
        kind: "override",
        prefix: "OV",
      });
      const row = await db.meridianOverride.create({
        data: {
          tenantId: ctx.tenantId,
          assessmentId: input.assessmentId,
          axis,
          code,
          kind: "CONFIRMATION",
          fromScore: value,
          toScore: value,
          rationale,
          reviewerId: ctx.userId,
        },
        select: { id: true, code: true },
      });

      await logMeridianAudit(db, ctx, {
        action: "meridian.override.confirm",
        entityType: "meridian.override",
        entityId: row.id,
        target: `${score.assessment.code} · ${AXES[axis].label}`,
        note: rationale,
        diff: [["Eixo", "Contestado", "Confirmado pelo revisor"]],
      });

      return row;
    });

    revalidatePath("/meridian");
    return created;
  });
}
