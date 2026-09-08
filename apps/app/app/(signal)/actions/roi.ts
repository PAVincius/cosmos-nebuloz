"use server";

import { withTenantDb } from "@repo/database";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { SignalRuleError } from "@/lib/signal/errors";
import {
  requireInitiativeOwnership,
  requireSignalPermissionContext,
} from "@/lib/signal/guards";
import { computeRoi } from "@/lib/signal/roi";
import { nnStr, optStr } from "../../actions/_base";
import {
  FIELD_LABELS,
  logSignalAudit,
  type SignalResult,
  signalAction,
} from "./_shared";

// Fórmula de ROI — US2.
//
// Versionar é a operação central deste arquivo, e ela NUNCA sobrescreve: a
// versão anterior fica como `SUPERSEDED` e continua ali. É o que permite
// responder "o número mudou por quê?" seis meses depois — a resposta é a lista
// de versões, não o último estado.
//
// Não existe delete. Uma fórmula errada é corrigida por uma versão nova, com a
// nota explicando o que estava errado; apagar apagaria junto a prova de que o
// relatório do trimestre passado usou outra conta.

const EntrySchema = z.object({
  kind: z.enum(["RETURN", "COST"]),
  label: nnStr,
  quantityLabel: nnStr.optional(),
  unitLabel: nnStr.optional(),
  total: z.coerce.number().nonnegative(),
  sourceLabel: nnStr,
});

const AssumptionSchema = z.object({
  label: nnStr,
  value: nnStr,
  // Nota obrigatória: "R$ 84" não se sustenta em comitê, "folha + encargos ÷
  // 1.760 h" se sustenta. É a diferença entre número e argumento.
  note: z.string().trim().min(3).max(2000),
});

const VersionSchema = z.object({
  initiativeCode: nnStr,
  horizonMonths: z.coerce.number().int().positive().max(120).default(12),
  entries: z.array(EntrySchema).min(1).max(40),
  assumptions: z.array(AssumptionSchema).max(20).default([]),
  note: optStr,
});

export type RoiView = {
  version: number | null;
  horizonMonths: number | null;
  invested: number;
  returned: number;
  multiple: number | null;
  net: number;
  steps: ReturnType<typeof computeRoi>["steps"];
  assumptions: { label: string; value: string; note: string }[];
  versions: { version: number; state: string; changedAt: Date }[];
};

export async function getRoi(raw: {
  initiativeCode: string;
}): Promise<SignalResult<RoiView>> {
  return await signalAction(async () => {
    const ctx = await requireSignalPermissionContext("signal.read");
    const { initiativeCode } = z.object({ initiativeCode: nnStr }).parse(raw);

    return withTenantDb(ctx.tenantId, async (db) => {
      const initiative = await db.signalInitiative.findUnique({
        where: {
          tenantId_code: { tenantId: ctx.tenantId, code: initiativeCode },
        },
        select: { id: true },
      });
      if (!initiative) {
        throw new SignalRuleError(
          "initiative.not-found",
          `Iniciativa ${initiativeCode} não encontrada nesta organização.`
        );
      }

      const formulas = await db.signalRoiFormula.findMany({
        where: { tenantId: ctx.tenantId, initiativeId: initiative.id },
        include: {
          entries: { orderBy: { order: "asc" } },
          assumptions: { orderBy: { order: "asc" } },
        },
        orderBy: { version: "desc" },
      });

      const active = formulas.find((f) => f.state === "ACTIVE");
      const roi = computeRoi(
        (active?.entries ?? []).map((e) => ({
          kind: e.kind,
          label: e.label,
          total: Number(e.total),
          quantityLabel: e.quantityLabel,
          unitLabel: e.unitLabel,
          sourceLabel: e.sourceLabel,
        }))
      );

      return {
        version: active?.version ?? null,
        horizonMonths: active?.horizonMonths ?? null,
        ...roi,
        assumptions: (active?.assumptions ?? []).map((a) => ({
          label: a.label,
          value: a.value,
          note: a.note,
        })),
        // A lista de versões é a resposta a "por que o número mudou?".
        versions: formulas.map((f) => ({
          version: f.version,
          state: f.state,
          changedAt: f.changedAt,
        })),
      };
    });
  });
}

/**
 * As duas pré-condições de uma fórmula versionável.
 *
 * Ambas existem para impedir um múltiplo que a própria tela já marcaria como
 * "sem lastro" — recusar na escrita é melhor do que gravar um número que
 * ninguém pode usar.
 */
function assertVersionable(
  hasSignedBaseline: boolean,
  entries: z.infer<typeof EntrySchema>[]
): void {
  // Sem baseline assinado não há contra o que medir: o "retorno" seria a
  // diferença contra um número que ninguém congelou.
  if (!hasSignedBaseline) {
    throw new SignalRuleError(
      "roi.baseline.required",
      "Versione a fórmula só depois de assinar o baseline — sem linha de base, o retorno calculado não tem contra o que ser comparado."
    );
  }
  if (!entries.some((e) => e.kind === "COST")) {
    throw new SignalRuleError(
      "roi.cost.required",
      "A fórmula precisa de pelo menos um componente de custo. Retorno sem custo não é múltiplo, é ausência de dado."
    );
  }
}

export async function versionRoiFormula(
  raw: z.input<typeof VersionSchema>
): Promise<SignalResult<{ version: number; multiple: number | null }>> {
  return await signalAction(async () => {
    const ctx = await requireSignalPermissionContext("signal.formula.write");
    const input = VersionSchema.parse(raw);

    const created = await withTenantDb(ctx.tenantId, async (db) => {
      const initiative = await db.signalInitiative.findUnique({
        where: {
          tenantId_code: { tenantId: ctx.tenantId, code: input.initiativeCode },
        },
        include: { baselines: { where: { signedAt: { not: null } }, take: 1 } },
      });
      if (!initiative) {
        throw new SignalRuleError(
          "initiative.not-found",
          `Iniciativa ${input.initiativeCode} não encontrada nesta organização.`
        );
      }
      requireInitiativeOwnership(ctx, initiative);
      assertVersionable(initiative.baselines.length > 0, input.entries);

      const previous = await db.signalRoiFormula.findFirst({
        where: {
          tenantId: ctx.tenantId,
          initiativeId: initiative.id,
          state: "ACTIVE",
        },
      });
      const latest = await db.signalRoiFormula.findFirst({
        where: { tenantId: ctx.tenantId, initiativeId: initiative.id },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      const version = (latest?.version ?? 0) + 1;

      // Supersede e cria na MESMA transação: um instante com duas fórmulas
      // ativas faria `getRoi` escolher uma delas por ordem de índice.
      if (previous) {
        await db.signalRoiFormula.update({
          where: { id: previous.id },
          data: { state: "SUPERSEDED" },
        });
      }

      const formula = await db.signalRoiFormula.create({
        data: {
          tenantId: ctx.tenantId,
          initiativeId: initiative.id,
          version,
          horizonMonths: input.horizonMonths,
          state: "ACTIVE",
          changedById: ctx.userId,
          note: input.note,
          entries: {
            create: input.entries.map((e, order) => ({
              tenantId: ctx.tenantId,
              kind: e.kind,
              label: e.label,
              quantityLabel: e.quantityLabel,
              unitLabel: e.unitLabel,
              total: e.total,
              sourceLabel: e.sourceLabel,
              order,
            })),
          },
          assumptions: {
            create: input.assumptions.map((a, order) => ({
              tenantId: ctx.tenantId,
              label: a.label,
              value: a.value,
              note: a.note,
              order,
            })),
          },
        },
      });

      const roi = computeRoi(
        input.entries.map((e) => ({
          kind: e.kind,
          label: e.label,
          total: e.total,
          sourceLabel: e.sourceLabel,
        }))
      );

      await logSignalAudit(db, ctx, {
        action: "Fórmula de ROI versionada",
        entityType: "signal.roiformula",
        entityId: formula.id,
        target: `${initiative.code} · ${initiative.name}`,
        note: input.note,
        diff: [
          [
            FIELD_LABELS.version,
            previous ? `v${previous.version}` : "—",
            `v${version}`,
          ],
        ],
      });

      return { version, multiple: roi.multiple };
    });

    revalidatePath(`/signal/initiative/${input.initiativeCode}`);
    revalidatePath("/signal/initiatives");
    return created;
  });
}
