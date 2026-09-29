"use server";

import { type WorkForm, withTenantDb } from "@repo/database";
import { z } from "zod";
import { SignalRuleError } from "@/lib/signal/errors";
import { requireInitiativeOwnership } from "@/lib/signal/guards";
import { nnStr } from "../../actions/_base";
import {
  type Db,
  logSignalAudit,
  type SignalResult,
  signalAction,
} from "./_shared";
import {
  decisionContext,
  loadInitiative,
  loadInitiativeLocked,
  recordEvent,
  revalidate,
} from "./plan-shared";

// Classificar a forma de trabalho, gerar o plano do modelo e propor métrica (SG-DEV-02, SG-PO-05).
// Regras e ordem dos portões: ver plan-shared.ts.

// ── Classificar a forma de trabalho (SG-DEV-02) ───────────────────────────────

const WORK_FORMS = [
  "CONVERSATIONAL",
  "ANALYSIS",
  "DOC_REVIEW",
  "TRIAGE",
  "REPORTING",
] as const;

/**
 * Quem escreve `SignalInitiative.workForm`. Sem isso o plano não nasce: é da
 * forma que vem o modelo de medição. Muda só ANTES de haver plano; depois dele
 * a forma trava, porque trocar de modelo no meio reescreveria as métricas que
 * já estão medindo.
 */
export async function classifyInitiative(raw: {
  initiativeCode: string;
  workForm: WorkForm;
}): Promise<SignalResult<{ workForm: WorkForm }>> {
  return await signalAction(async () => {
    const ctx = await decisionContext("edit");
    const input = z
      .object({ initiativeCode: nnStr, workForm: z.enum(WORK_FORMS) })
      .parse(raw);

    await withTenantDb(ctx.tenantId, async (db) => {
      const initiative = await loadInitiativeLocked(
        db,
        ctx.tenantId,
        input.initiativeCode
      );
      requireInitiativeOwnership(ctx, initiative);
      if (initiative.workForm === input.workForm) {
        return;
      }

      const plan = await db.signalPlanMetric.count({
        where: { tenantId: ctx.tenantId, initiativeId: initiative.id },
      });
      if (plan > 0) {
        throw new SignalRuleError(
          "plan.workform.locked",
          "A forma de trabalho não muda depois que o plano existe: trocar de modelo reescreveria métricas que já estão medindo."
        );
      }

      await db.signalInitiative.update({
        where: { id: initiative.id },
        // Solta a versão pinada: o modelo certo é o da forma nova, e o plano
        // pina a versão de novo ao ser gerado.
        data: { workForm: input.workForm, measureModelVersionId: null },
      });
      await logSignalAudit(db, ctx, {
        action: "Forma de trabalho classificada",
        entityType: "signal.initiative",
        entityId: initiative.id,
        target: `${initiative.code} · ${initiative.name}`,
        diff: [
          ["Forma de trabalho", initiative.workForm ?? "—", input.workForm],
        ],
      });
    });

    revalidate(input.initiativeCode);
    return { workForm: input.workForm };
  });
}

// ── Gerar o plano do modelo (SG-DEV-02) ───────────────────────────────────────

/** Versão do modelo que o plano usa. A iniciativa pina a versão ao gerar o
 *  plano: publicar versão nova do modelo não reescreve o plano de quem já está
 *  medindo. */
async function resolveModelVersion(
  db: Db,
  initiative: {
    id: string;
    workForm: WorkForm | null;
    measureModelVersionId: string | null;
  }
) {
  let versionId = initiative.measureModelVersionId;
  if (!versionId) {
    if (!initiative.workForm) {
      throw new SignalRuleError(
        "plan.no-model",
        "Classifique a forma de trabalho da iniciativa antes de gerar o plano: é dela que vem o modelo de medição."
      );
    }
    const model = await db.signalMeasureModel.findUnique({
      where: { workForm: initiative.workForm },
    });
    const latest = model
      ? await db.signalMeasureModelVersion.findFirst({
          where: { modelId: model.id },
          orderBy: { publishedAt: "desc" },
        })
      : null;
    if (!latest) {
      throw new SignalRuleError(
        "plan.no-model",
        "Não há modelo de medição publicado para esta forma de trabalho."
      );
    }
    versionId = latest.id;
    await db.signalInitiative.update({
      where: { id: initiative.id },
      data: { measureModelVersionId: versionId },
    });
  }

  const version = await db.signalMeasureModelVersion.findUnique({
    where: { id: versionId },
    include: { metrics: { orderBy: { seq: "asc" } } },
  });
  if (!version || version.metrics.length === 0) {
    throw new SignalRuleError(
      "plan.no-model",
      "O modelo pinado nesta iniciativa não tem métricas."
    );
  }
  return version;
}

export async function generatePlan(raw: {
  initiativeCode: string;
}): Promise<SignalResult<{ metrics: number }>> {
  return await signalAction(async () => {
    const ctx = await decisionContext("edit");
    const { initiativeCode } = z.object({ initiativeCode: nnStr }).parse(raw);

    const created = await withTenantDb(ctx.tenantId, async (db) => {
      const initiative = await loadInitiativeLocked(
        db,
        ctx.tenantId,
        initiativeCode
      );
      requireInitiativeOwnership(ctx, initiative);

      const existing = await db.signalPlanMetric.count({
        where: { tenantId: ctx.tenantId, initiativeId: initiative.id },
      });
      if (existing > 0) {
        throw new SignalRuleError(
          "plan.exists",
          "Esta iniciativa já tem plano de medição. Proponha métrica nova em vez de gerar de novo."
        );
      }

      const version = await resolveModelVersion(db, initiative);

      // isCurrentPrimary é `true` na primária e NULL nas demais, nunca `false`:
      // é o par com o unique do banco que garante UMA primária por iniciativa.
      await db.signalPlanMetric.createMany({
        data: version.metrics.map((m) => ({
          tenantId: ctx.tenantId,
          initiativeId: initiative.id,
          modelMetricId: m.id,
          role: m.role,
          name: m.name,
          formula: m.formula,
          direction: m.direction,
          state: "NO_SOURCE" as const,
          isCurrentPrimary: m.role === "PRIMARY" ? true : null,
        })),
      });

      await logSignalAudit(db, ctx, {
        action: "Plano de medição gerado",
        entityType: "signal.planmetric",
        entityId: initiative.id,
        target: `${initiative.code} · ${initiative.name}`,
        note: `${version.metrics.length} métricas do modelo`,
      });
      return version.metrics.length;
    });

    revalidate(initiativeCode);
    return { metrics: created };
  });
}

// ── Propor métrica fora do modelo (SG-PO-05) ──────────────────────────────────

const ProposeSchema = z.object({
  initiativeCode: nnStr,
  role: z.enum(["PRIMARY", "GUARD", "ADOPTION", "VALUE"]),
  name: nnStr,
  formula: z.string().trim().min(3).max(2000),
  direction: z.enum(["UP", "DOWN"]),
  targetValue: z.number().finite().nullable().optional(),
});

export async function proposeMetric(
  raw: z.input<typeof ProposeSchema>
): Promise<SignalResult<{ id: string }>> {
  return await signalAction(async () => {
    const ctx = await decisionContext("propose");
    const input = ProposeSchema.parse(raw);

    // Primária tem regra própria (SG-PO-02): trocar exige justificativa e cria
    // versão do plano. Uma proposta que já nascesse primária furaria isso.
    if (input.role === "PRIMARY") {
      throw new SignalRuleError(
        "plan.proposal.primary",
        "Métrica proposta não pode ser a primária. Só uma proposta de guarda, adoção ou valor; a troca de primária tem regra própria."
      );
    }

    const saved = await withTenantDb(ctx.tenantId, async (db) => {
      const initiative = await loadInitiative(
        db,
        ctx.tenantId,
        input.initiativeCode
      );
      requireInitiativeOwnership(ctx, initiative);

      const metric = await db.signalPlanMetric.create({
        data: {
          tenantId: ctx.tenantId,
          initiativeId: initiative.id,
          modelMetricId: null,
          role: input.role,
          name: input.name,
          formula: input.formula,
          direction: input.direction,
          state: "PROPOSED",
          targetValue: input.targetValue ?? null,
        },
      });
      await recordEvent(db, ctx, metric, {
        action: "PROPOSE",
        fromState: null,
        toState: "PROPOSED",
        version: 1,
      });
      await logSignalAudit(db, ctx, {
        action: "Métrica proposta",
        entityType: "signal.planmetric",
        entityId: metric.id,
        target: `${initiative.code} · ${input.name}`,
        note: "Fora do modelo: não entra no veredito até ser aprovada.",
      });
      return { id: metric.id };
    });

    revalidate(input.initiativeCode);
    return saved;
  });
}
