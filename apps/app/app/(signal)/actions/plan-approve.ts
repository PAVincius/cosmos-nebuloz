"use server";

import { withTenantDb } from "@repo/database";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { SignalRuleError } from "@/lib/signal/errors";
import {
  requireInitiativeOwnership,
  type SignalContext,
} from "@/lib/signal/guards";
import { resolveBaselineValue } from "@/lib/signal/plan-freeze";
import { nnStr } from "../../actions/_base";
import {
  type Db,
  logSignalAudit,
  type SignalResult,
  signalAction,
} from "./_shared";
import { decisionContext } from "./plan-shared";

// ── Aprovar métrica proposta (SG-PO-03 e SG-PO-05) ─────────────────────────────

const ApproveSchema = z.object({
  initiativeCode: nnStr,
  metricId: nnStr,
});

async function loadProposedMetric(
  db: Db,
  ctx: SignalContext,
  initiative: { id: string },
  metricId: string
) {
  const metric = await db.signalPlanMetric.findFirst({
    where: {
      id: metricId,
      tenantId: ctx.tenantId,
      initiativeId: initiative.id,
    },
    select: {
      id: true,
      state: true,
      version: true,
      baselineDimensionKey: true,
      baselineValue: true,
    },
  });
  if (!metric) {
    throw new SignalRuleError(
      "plan.metric.not-found",
      "Métrica não encontrada no plano desta iniciativa."
    );
  }
  if (metric.state !== "PROPOSED") {
    throw new SignalRuleError(
      "plan.metric.not-proposed",
      `Só métrica proposta se aprova; esta está em ${metric.state}.`
    );
  }
  return metric;
}

/** Baseline assinado mais recente da iniciativa, com o valor numérico das
 *  dimensões. Nulo se a iniciativa ainda não assinou nenhum. */
function latestSignedBaseline(
  db: Db,
  ctx: SignalContext,
  initiative: { id: string }
) {
  return db.signalBaseline.findFirst({
    where: {
      tenantId: ctx.tenantId,
      initiativeId: initiative.id,
      signedAt: { not: null },
    },
    orderBy: { version: "desc" },
    select: {
      id: true,
      dimensions: { select: { key: true, numericValue: true } },
    },
  });
}

type MetricRow = Awaited<ReturnType<typeof loadProposedMetric>>;

/** APPROVE (do ator) e, se congelou na hora, FREEZE (do sistema). */
function approvalEvents(args: {
  ctx: SignalContext;
  metric: MetricRow;
  freezeNow: boolean;
  baselineValue: string | null;
}) {
  const { ctx, metric, freezeNow, baselineValue } = args;
  const version = metric.version + 1;
  const previous =
    metric.baselineValue === null ? null : String(metric.baselineValue);
  const approve = {
    tenantId: ctx.tenantId,
    planMetricId: metric.id,
    action: "APPROVE" as const,
    actorId: ctx.userId as string | null,
    fromState: "PROPOSED" as const,
    toState: "NO_SOURCE" as const,
    version,
    changes: [["state", "PROPOSED", "NO_SOURCE"]] as (string | null)[][],
    comment: null as string | null,
  };
  if (!freezeNow) {
    return [approve];
  }
  const semValor =
    "Congelada na aprovação, sem valor de baseline: a métrica não tem dimensão correspondente no baseline assinado.";
  const freeze = {
    ...approve,
    action: "FREEZE" as const,
    actorId: null,
    fromState: "NO_SOURCE" as const,
    toState: "FROZEN" as const,
    changes: [
      ["state", "NO_SOURCE", "FROZEN"],
      ["baselineValue", previous, baselineValue],
    ] as (string | null)[][],
    comment:
      baselineValue === null
        ? semValor
        : "Congelada na aprovação: a iniciativa já tinha baseline assinado.",
  };
  return [approve, freeze];
}

async function approveInDb(
  db: Db,
  ctx: SignalContext,
  input: z.infer<typeof ApproveSchema>
) {
  const initiative = await db.signalInitiative.findUnique({
    where: {
      tenantId_code: { tenantId: ctx.tenantId, code: input.initiativeCode },
    },
  });
  if (!initiative) {
    throw new SignalRuleError(
      "initiative.not-found",
      `Iniciativa ${input.initiativeCode} não encontrada nesta organização.`
    );
  }
  requireInitiativeOwnership(ctx, initiative);

  const metric = await loadProposedMetric(db, ctx, initiative, input.metricId);
  const baseline = await latestSignedBaseline(db, ctx, initiative);
  const freezeNow = baseline !== null;
  const finalState = freezeNow ? ("FROZEN" as const) : ("NO_SOURCE" as const);
  const baselineValue = baseline
    ? resolveBaselineValue(
        baseline.dimensions,
        metric.baselineDimensionKey,
        metric.baselineValue
      )
    : null;

  const updated = await db.signalPlanMetric.updateMany({
    where: { id: metric.id, tenantId: ctx.tenantId, state: "PROPOSED" },
    data: {
      state: finalState,
      ...(freezeNow ? { baselineValue } : {}),
      version: { increment: 1 },
    },
  });
  if (updated.count === 0) {
    throw new SignalRuleError(
      "plan.metric.changed",
      "A métrica mudou de estado enquanto você aprovava. Recarregue e tente de novo."
    );
  }

  await db.signalPlanMetricEvent.createMany({
    data: approvalEvents({ ctx, metric, freezeNow, baselineValue }),
  });
  await logSignalAudit(db, ctx, {
    action: freezeNow
      ? "Métrica aprovada e congelada"
      : "Métrica aprovada no plano",
    entityType: "signal.planmetric",
    entityId: metric.id,
    target: `${initiative.code} · métrica ${metric.id}`,
    diff: [["Estado", "PROPOSED", finalState]],
  });
  return finalState;
}

/**
 * Aprova, no plano, uma métrica proposta fora do modelo (SG-PO-05): Proposta →
 * Sem fonte.
 *
 * Se a iniciativa JÁ TEM baseline assinado, a métrica congela na hora. O
 * consumidor de `signal/baseline.frozen` só pega métrica que existia quando o
 * baseline foi assinado; uma proposta aprovada depois nunca o veria, e ficaria
 * medindo contra uma régua que ela mesma poderia editar. Dois eventos: APPROVE,
 * do ator, e FREEZE, do sistema.
 *
 * O valor de baseline é `assinado ?? anterior`: não apaga o que já havia.
 */
export async function approvePlanMetric(
  raw: z.input<typeof ApproveSchema>
): Promise<SignalResult<{ state: "NO_SOURCE" | "FROZEN" }>> {
  return await signalAction(async () => {
    // Mesma negação do resto do plano: ADMIN não decide (SG-PO-03).
    const ctx = await decisionContext("approve");
    const input = ApproveSchema.parse(raw);
    const state = await withTenantDb(ctx.tenantId, (db) =>
      approveInDb(db, ctx, input)
    );
    revalidatePath(`/signal/initiative/${input.initiativeCode}`);
    return { state };
  });
}
