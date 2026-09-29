"use server";

import { withTenantDb } from "@repo/database";
import { z } from "zod";
import { emitProductEvent } from "@/lib/inngest/emit-product-event";
import { SignalRuleError, SignalStateConflictError } from "@/lib/signal/errors";
import {
  requireInitiativeOwnership,
  type SignalContext,
} from "@/lib/signal/guards";
import { nextStateFor } from "@/lib/signal/plan";
import {
  type Db,
  FIELD_LABELS,
  logSignalAudit,
  type SignalResult,
  signalAction,
} from "./_shared";
import {
  Comment,
  decisionContext,
  Id,
  LOAD_INITIATIVE,
  type Loaded,
  loadMetric,
  recordEvent,
  revalidate,
  writeGuarded,
} from "./plan-shared";

// Pedido de revisão de meta e troca de primária (SG-PO-02).
// Regras e ordem dos portões: ver plan-shared.ts.

// ── Pedir revisão de meta (métrica congelada) ─────────────────────────────────

type ReviewSent = { metric: Loaded; eventId: string };

async function recordReviewRequest(
  db: Db,
  ctx: SignalContext,
  metric: Loaded,
  comment: string
): Promise<ReviewSent> {
  // A meta não muda aqui: baseline e caso de negócio são do Scaffold. O que o
  // Signal registra é o pedido.
  const event = await recordEvent(db, ctx, metric, {
    action: "REQUEST_TARGET_REVIEW",
    fromState: metric.state,
    toState: metric.state,
    version: metric.version,
    comment,
  });
  await logSignalAudit(db, ctx, {
    action: "Revisão de meta pedida ao Scaffold",
    entityType: "signal.planmetric",
    entityId: metric.id,
    target: `${metric.initiative.code} · ${metric.name}`,
    note: comment,
  });
  return { metric, eventId: event.id };
}

/** Depois da transação: o pedido é fato consumado e o Inngest fora do ar não
 *  pode fazer a tela dizer que falhou (mesmo critério de signBaseline). */
async function emitReviewRequested(ctx: SignalContext, sent: ReviewSent) {
  await emitProductEvent("signalTargetReviewRequested", {
    tenantId: ctx.tenantId,
    initiativeId: sent.metric.initiative.id,
    initiativeCode: sent.metric.initiative.code,
    scaffoldTrackId: sent.metric.initiative.scaffoldTrackId ?? null,
    planMetricId: sent.metric.id,
    metricName: sent.metric.name,
    eventId: sent.eventId,
    at: new Date().toISOString(),
  });
  revalidate(sent.metric.initiative.code);
}

export async function requestTargetReview(raw: {
  id: string;
  comment: string;
}): Promise<SignalResult<{ requested: true }>> {
  return await signalAction(async () => {
    const ctx = await decisionContext("requestTargetReview");
    const input = Id.extend({ comment: Comment }).parse(raw);

    const sent = await withTenantDb(ctx.tenantId, async (db) => {
      const metric = await loadMetric(db, ctx.tenantId, input.id);
      requireInitiativeOwnership(ctx, metric.initiative);

      if (!nextStateFor(metric.state, "requestTargetReview")) {
        throw new SignalStateConflictError(
          "plan.review.not-frozen",
          "Só métrica congelada pede revisão de meta. Nas outras, a meta se edita direto."
        );
      }
      return recordReviewRequest(db, ctx, metric, input.comment);
    });

    await emitReviewRequested(ctx, sent);
    return { requested: true as const };
  });
}

// ── Trocar a primária (SG-PO-02) ──────────────────────────────────────────────

const PrimarySchema = Id.extend({
  justification: z.string().trim().min(10).max(2000),
});

/**
 * Exatamente uma primária vigente. A troca exige justificativa e cria versão
 * nova das duas métricas. Com a primária atual congelada (baseline fixado no
 * gate), a troca não é local: vira pedido de revisão ao Scaffold, dono do
 * baseline e do caso de negócio.
 */
async function swapPrimary(args: {
  db: Db;
  ctx: SignalContext;
  current: Loaded;
  next: Loaded;
  justification: string;
}) {
  const { db, ctx, current, next, justification } = args;
  // Limpa a antiga ANTES de marcar a nova: o unique (initiativeId,
  // isCurrentPrimary) não admite duas `true` nem por um instante. A antiga
  // vira guarda: continua medindo, sem decidir o veredito.
  await writeGuarded(db, ctx, current, {
    isCurrentPrimary: null,
    role: "GUARD",
    version: current.version + 1,
  });
  await writeGuarded(db, ctx, next, {
    isCurrentPrimary: true,
    role: "PRIMARY",
    version: next.version + 1,
  });
  for (const [m, from, to] of [
    [current, "Primária", "Guarda"],
    [next, next.role, "Primária"],
  ] as const) {
    await recordEvent(db, ctx, m, {
      action: "CHANGE_PRIMARY",
      fromState: m.state,
      toState: m.state,
      version: m.version + 1,
      changes: [[FIELD_LABELS.role, from, to]],
      comment: justification,
    });
  }
  await logSignalAudit(db, ctx, {
    action: "Primária trocada",
    entityType: "signal.planmetric",
    entityId: next.id,
    target: `${next.initiative.code} · ${current.name} → ${next.name}`,
    note: justification,
  });
}

export async function changePrimary(
  raw: z.input<typeof PrimarySchema>
): Promise<SignalResult<{ outcome: "changed" | "review-requested" }>> {
  return await signalAction(async () => {
    const ctx = await decisionContext("edit");
    const input = PrimarySchema.parse(raw);

    const done = await withTenantDb(ctx.tenantId, async (db) => {
      const next = await loadMetric(db, ctx.tenantId, input.id);
      requireInitiativeOwnership(ctx, next.initiative);

      if (next.state === "PROPOSED") {
        throw new SignalRuleError(
          "plan.primary.proposal",
          "Proposta não pode ser a primária. Aprove a métrica antes."
        );
      }
      const current = await db.signalPlanMetric.findFirst({
        where: {
          tenantId: ctx.tenantId,
          initiativeId: next.initiativeId,
          isCurrentPrimary: true,
        },
        include: { initiative: { select: LOAD_INITIATIVE } },
      });
      if (!current || current.id === next.id) {
        throw new SignalRuleError(
          "plan.primary.same",
          "Escolha uma métrica que não seja a primária de hoje."
        );
      }

      if (current.state === "FROZEN") {
        const sent = await recordReviewRequest(
          db,
          ctx,
          current,
          `Troca de primária para "${next.name}": ${input.justification}`
        );
        return { outcome: "review-requested" as const, sent };
      }
      await swapPrimary({
        db,
        ctx,
        current,
        next,
        justification: input.justification,
      });
      return { outcome: "changed" as const, code: next.initiative.code };
    });

    if (done.outcome === "review-requested") {
      await emitReviewRequested(ctx, done.sent);
    } else {
      revalidate(done.code);
    }
    return { outcome: done.outcome };
  });
}
