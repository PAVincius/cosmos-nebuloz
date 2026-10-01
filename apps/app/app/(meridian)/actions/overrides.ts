"use server";

import { withTenantDb } from "@repo/database";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AXES } from "@/lib/meridian/axes";
import {
  MeridianRuleError,
  requireMeridianPermissionContext,
} from "@/lib/meridian/guards";
import { cuid, type Result, safeAction } from "../../actions/_base";
import { logMeridianAudit, nextCode, requireDecisionsOpen } from "./_shared";

// Override de score — US3.
//
// Append-only por construção: `registerOverride` só faz `create`. Não existe
// caminho de update nem de delete neste arquivo, e é deliberado — a pergunta
// que o patrocinador faz é "por que o número mudou?", e a resposta é a lista
// inteira, não o último estado.

const RATIONALE_MIN = 20;

const RegisterSchema = z.object({
  assessmentId: cuid,
  axis: z.enum(["DATA", "PROCESS", "PEOPLE", "GOVERNANCE", "INFRASTRUCTURE"]),
  toScore: z.number().int().min(0).max(100),
  rationale: z.string().trim().max(4000),
});

export async function registerOverride(
  raw: z.input<typeof RegisterSchema>
): Promise<Result<{ id: string; code: string }>> {
  return safeAction(async () => {
    const ctx = await requireMeridianPermissionContext("override.write");
    const input = RegisterSchema.parse(raw);

    if (input.rationale.length < RATIONALE_MIN) {
      throw new MeridianRuleError(
        "override.rationale",
        `A justificativa precisa de pelo menos ${RATIONALE_MIN} caracteres — é o que o patrocinador lê quando pergunta por que o número mudou.`
      );
    }

    const created = await withTenantDb(ctx.tenantId, async (db) => {
      await requireDecisionsOpen(db, ctx.tenantId, input.assessmentId);
      const score = await db.meridianAxisScore.findFirst({
        where: {
          tenantId: ctx.tenantId,
          assessmentId: input.assessmentId,
          axis: input.axis,
        },
        include: {
          assessment: { select: { code: true, orgName: true } },
        },
      });
      if (!score) {
        throw new MeridianRuleError(
          "override.no-score",
          "Este eixo ainda não tem score computado — feche a coleta antes de decidir."
        );
      }

      const from = score.final ?? score.computed;
      if (input.toScore === from) {
        throw new MeridianRuleError(
          "override.no-change",
          "Override sem mudança de score não é decisão — informe um valor diferente do atual."
        );
      }

      const code = await nextCode({
        db,
        tenantId: ctx.tenantId,
        kind: "override",
        prefix: "OV",
      });

      const override = await db.meridianOverride.create({
        data: {
          tenantId: ctx.tenantId,
          assessmentId: input.assessmentId,
          axis: input.axis,
          code,
          fromScore: from,
          toScore: input.toScore,
          rationale: input.rationale,
          reviewerId: ctx.userId,
        },
        select: { id: true, code: true },
      });

      // `computed` não é tocado. `final` reflete sempre o override mais
      // recente, e o histórico continua sendo a lista de linhas.
      await db.meridianAxisScore.update({
        where: { id: score.id },
        data: { final: input.toScore, status: "OVERRIDDEN" },
      });

      await logMeridianAudit(db, ctx, {
        action: "meridian.override.register",
        entityType: "meridian.override",
        entityId: override.id,
        target: `${score.assessment.code} · ${AXES[input.axis].label}`,
        note: input.rationale,
        diff: [
          ["Score final", String(from), String(input.toScore)],
          ["Score computado", String(score.computed), String(score.computed)],
        ].filter((row) => row[1] !== row[2]) as [string, string, string][],
      });

      return override;
    });

    revalidatePath("/meridian");
    return created;
  });
}

export type OverrideRow = {
  id: string;
  code: string;
  axis: string;
  fromScore: number;
  toScore: number;
  rationale: string;
  reviewerId: string;
  createdAt: string;
};

const ListSchema = z.object({ assessmentId: cuid });

export async function listOverrides(
  raw: z.input<typeof ListSchema>
): Promise<Result<OverrideRow[]>> {
  return safeAction(async () => {
    const ctx = await requireMeridianPermissionContext("report.read");
    const input = ListSchema.parse(raw);

    return withTenantDb(ctx.tenantId, async (db) => {
      const rows = await db.meridianOverride.findMany({
        where: { tenantId: ctx.tenantId, assessmentId: input.assessmentId },
        // Ordem cronológica crescente: a trilha se lê de cima para baixo.
        orderBy: { createdAt: "asc" },
      });
      return rows.map(
        (o): OverrideRow => ({
          id: o.id,
          code: o.code,
          axis: o.axis,
          fromScore: o.fromScore,
          toScore: o.toScore,
          rationale: o.rationale,
          reviewerId: o.reviewerId,
          createdAt: o.createdAt.toISOString(),
        })
      );
    });
  });
}
