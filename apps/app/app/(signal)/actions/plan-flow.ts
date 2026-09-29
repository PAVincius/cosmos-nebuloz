"use server";

import { withTenantDb } from "@repo/database";
import { SignalRuleError } from "@/lib/signal/errors";
import {
  requireInitiativeOwnership,
  requireSignalPermissionContext,
  type SignalContext,
} from "@/lib/signal/guards";
import {
  COMMENT_REQUIRED,
  nextStateFor,
  type PlanState,
  planActionDenial,
} from "@/lib/signal/plan";
import { resolveBaselineValue } from "@/lib/signal/plan-freeze";
import { nnStr } from "../../actions/_base";
import {
  type AuditDiff,
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
  invalidTransition,
  type Loaded,
  loadMetric,
  recordEvent,
  revalidate,
  stateLabel,
  writeGuarded,
} from "./plan-shared";

// Transições de estado do plano: aprovar, pausar, retomar e mapear fonte (SG-PO-03, SG-PO-05, SG-PM-03).
// Regras e ordem dos portões: ver plan-shared.ts.

// ── Transições de estado ──────────────────────────────────────────────────────

type TransitionSpec = {
  action: "approve" | "pause" | "resume";
  event: "APPROVE" | "PAUSE" | "RESUME";
  verb: string;
  audit: string;
};

/**
 * SG-PO-05. Proposta aprovada numa iniciativa que JÁ TEM baseline assinado
 * congela na hora: o consumidor de `signal/baseline.frozen` só pega métrica que
 * existia quando o baseline foi assinado, e uma proposta aprovada depois nunca o
 * veria, ficando a medir contra uma régua que ela mesma poderia editar. O valor
 * é `assinado ?? anterior` (não apaga o que a métrica já tinha).
 */
async function baselineOnApproval(
  db: Db,
  ctx: SignalContext,
  metric: Loaded
): Promise<{ value: string | null } | null> {
  const baseline = await db.signalBaseline.findFirst({
    where: {
      tenantId: ctx.tenantId,
      initiativeId: metric.initiativeId,
      signedAt: { not: null },
    },
    orderBy: { version: "desc" },
    select: { dimensions: { select: { key: true, numericValue: true } } },
  });
  if (!baseline) {
    return null;
  }
  return {
    value: resolveBaselineValue(
      baseline.dimensions,
      metric.baselineDimensionKey,
      metric.baselineValue
    ),
  };
}

const FROZEN_ON_APPROVAL =
  "Congelada na aprovação: a iniciativa já tinha baseline assinado.";
const FROZEN_WITHOUT_VALUE =
  "Congelada na aprovação, sem valor de baseline: a métrica não tem dimensão correspondente no baseline assinado.";

async function applyTransition(args: {
  db: Db;
  ctx: SignalContext;
  id: string;
  spec: TransitionSpec;
  comment: string | undefined;
}): Promise<{ state: PlanState; code: string }> {
  const { db, ctx, id, spec, comment } = args;
  const metric = await loadMetric(db, ctx.tenantId, id);
  requireInitiativeOwnership(ctx, metric.initiative);

  const next = nextStateFor(metric.state, spec.action);
  if (!next) {
    invalidTransition(metric, spec.verb);
  }

  const frozen =
    spec.action === "approve"
      ? await baselineOnApproval(db, ctx, metric)
      : null;
  const finalState: PlanState = frozen ? "FROZEN" : next;

  await writeGuarded(
    db,
    ctx,
    metric,
    frozen
      ? {
          state: "FROZEN",
          baselineValue: frozen.value,
          version: { increment: 1 },
        }
      : { state: next }
  );
  await recordEvent(db, ctx, metric, {
    action: spec.event,
    fromState: metric.state,
    toState: next,
    version: metric.version,
    comment,
  });
  if (frozen) {
    // Dois eventos: APPROVE, do ator, e FREEZE, do sistema.
    const previous =
      metric.baselineValue === null ? null : String(metric.baselineValue);
    await recordEvent(db, ctx, metric, {
      action: "FREEZE",
      actorId: null,
      fromState: next,
      toState: "FROZEN",
      version: metric.version + 1,
      changes: [
        ["Estado", stateLabel(next), stateLabel("FROZEN")],
        ...(frozen.value === previous
          ? []
          : ([
              ["Baseline", previous ?? "—", frozen.value ?? "—"],
            ] as AuditDiff)),
      ],
      comment:
        frozen.value === null ? FROZEN_WITHOUT_VALUE : FROZEN_ON_APPROVAL,
    });
  }
  await logSignalAudit(db, ctx, {
    action: frozen ? "Métrica aprovada e congelada" : spec.audit,
    entityType: "signal.planmetric",
    entityId: metric.id,
    target: `${metric.initiative.code} · ${metric.name}`,
    note: comment,
    diff: [
      [FIELD_LABELS.state, stateLabel(metric.state), stateLabel(finalState)],
    ],
  });
  return { state: finalState, code: metric.initiative.code };
}

async function moveState(
  raw: unknown,
  spec: TransitionSpec
): Promise<SignalResult<{ state: PlanState }>> {
  return await signalAction(async () => {
    const ctx = await decisionContext(spec.action);
    const input = Id.extend({
      comment: COMMENT_REQUIRED.includes(spec.action)
        ? Comment
        : Comment.optional(),
    }).parse(raw);
    const { comment } = input;

    const result = await withTenantDb(ctx.tenantId, (db) =>
      applyTransition({ db, ctx, id: input.id, spec, comment })
    );

    revalidate(result.code);
    return { state: result.state };
  });
}

/** Proposta → Sem fonte. Só o OWNER (ou o Analista, que o alcança). Se a
 *  iniciativa já tem baseline assinado, a métrica congela na hora (SG-PO-05). */
export async function approveMetric(raw: { id: string }) {
  return await moveState(raw, {
    action: "approve",
    event: "APPROVE",
    verb: "aprovar",
    audit: "Métrica aprovada no plano",
  });
}

export async function pauseMetric(raw: { id: string; comment: string }) {
  return await moveState(raw, {
    action: "pause",
    event: "PAUSE",
    verb: "pausar",
    audit: "Métrica pausada",
  });
}

export async function resumeMetric(raw: { id: string; comment: string }) {
  return await moveState(raw, {
    action: "resume",
    event: "RESUME",
    verb: "retomar",
    audit: "Métrica retomada",
  });
}

// ── Mapear fonte (SG-PM-03) ───────────────────────────────────────────────────

/** Valida o mapeamento contra a métrica e decide se ela passa a Medindo. */
async function resolveSource(
  db: Db,
  tenantId: string,
  metric: Loaded,
  mappingId: string
) {
  // Congelado não muda fonte: o baseline do gate foi medido por aquela fonte, e
  // trocá-la mudaria de onde vem o número contra o qual o contrato foi firmado.
  if (metric.state === "FROZEN") {
    throw new SignalRuleError(
      "plan.source.frozen",
      "Métrica congelada não muda de fonte: o baseline firmado no gate foi medido por ela."
    );
  }
  if (metric.state === "PROPOSED") {
    throw new SignalRuleError(
      "plan.source.not-approved",
      "Aprove a métrica no plano antes de mapear a fonte: proposta não é medida."
    );
  }

  const mapping = await db.signalMetricMapping.findFirst({
    where: { id: mappingId, tenantId },
    include: { connection: { select: { health: true } } },
  });
  if (!mapping) {
    throw new SignalRuleError(
      "plan.source.not-found",
      "Mapeamento não encontrado nesta organização."
    );
  }
  // Mapeamento global (initiativeId nulo) serve a qualquer iniciativa; o de
  // outra iniciativa não pode alimentar esta.
  if (mapping.initiativeId && mapping.initiativeId !== metric.initiativeId) {
    throw new SignalRuleError(
      "plan.source.foreign",
      "Este mapeamento é de outra iniciativa."
    );
  }

  // Sem fonte → Medindo é do sistema, e só com a conexão saudável: medir por
  // fonte parada ou caída produziria um número sem lastro.
  const starts =
    metric.state === "NO_SOURCE" && mapping.connection.health === "HEALTHY";
  const next: PlanState = starts ? "MEASURING" : metric.state;

  // O "antes" do histórico é a fonte que a métrica tinha, não um traço fixo:
  // trocar de fonte muda de onde vem o número, e a trilha precisa dizer de qual
  // para qual.
  const previous = metric.sourceMappingId
    ? await db.signalMetricMapping.findFirst({
        where: { id: metric.sourceMappingId, tenantId },
        select: { code: true },
      })
    : null;
  return { mapping, starts, next, before: previous?.code ?? "—" };
}

export async function mapMetricSource(raw: {
  id: string;
  mappingId: string;
}): Promise<SignalResult<{ state: PlanState }>> {
  return await signalAction(async () => {
    // Mesma negação das outras ações do plano: ADMIN tem `mapping.write` na
    // matriz, mas administrar acesso não é decidir (SG-PO-03), e mapear a fonte
    // é o que leva a métrica a Medindo.
    const ctx = await requireSignalPermissionContext("signal.mapping.write");
    const denial = planActionDenial(ctx.signalRole, "edit");
    if (denial) {
      throw new SignalRuleError("plan.role.denied", denial);
    }
    const input = Id.extend({ mappingId: nnStr }).parse(raw);

    const result = await withTenantDb(ctx.tenantId, async (db) => {
      const metric = await loadMetric(db, ctx.tenantId, input.id);
      requireInitiativeOwnership(ctx, metric.initiative);

      const { mapping, starts, next, before } = await resolveSource(
        db,
        ctx.tenantId,
        metric,
        input.mappingId
      );

      await writeGuarded(db, ctx, metric, {
        sourceMappingId: mapping.id,
        state: next,
      });
      await recordEvent(db, ctx, metric, {
        action: "MAP_SOURCE",
        fromState: metric.state,
        toState: metric.state,
        version: metric.version,
        changes: [[FIELD_LABELS.sourceMappingId, before, mapping.code]],
      });
      if (starts) {
        await recordEvent(db, ctx, metric, {
          action: "START_MEASURING",
          fromState: metric.state,
          toState: next,
          version: metric.version,
        });
      }
      await logSignalAudit(db, ctx, {
        action: "Fonte mapeada na métrica",
        entityType: "signal.planmetric",
        entityId: metric.id,
        target: `${metric.initiative.code} · ${metric.name}`,
        note: starts
          ? "Conexão saudável: a métrica passou a Medindo."
          : "Conexão não saudável: a métrica espera a fonte voltar.",
        diff: [[FIELD_LABELS.sourceMappingId, before, mapping.code]],
      });
      return { state: next, code: metric.initiative.code };
    });

    revalidate(result.code);
    return { state: result.state };
  });
}
