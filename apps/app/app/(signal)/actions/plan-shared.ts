import "server-only";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { SignalRuleError, SignalStateConflictError } from "@/lib/signal/errors";
import {
  requireSignalPermissionContext,
  type SignalContext,
} from "@/lib/signal/guards";
import {
  PLAN_STATE_META,
  type PlanAction,
  type PlanState,
  planActionDenial,
} from "@/lib/signal/plan";
import { nnStr } from "../../actions/_base";
import type { AuditDiff, Db } from "./_shared";

// Plano de medição da iniciativa — SG-DEV-05.
//
// Toda mutação segue a mesma ordem: sessão + módulo + papel → papel pode mover
// o plano (ADMIN não, SG-PO-03) → a métrica é lida pelo tenant do contexto →
// posse da iniciativa → regra de estado → escrita + histórico + trilha, na
// mesma transação. O histórico da métrica (SignalPlanMetricEvent) é o "antes e
// depois" do plano; a trilha (AuditLog) é a prova para fora do produto.
//
// Peças compartilhadas pelas actions do plano de medição (plan-*.ts). Sem
// "use server": um arquivo "use server" só exporta função async, e aqui há
// constantes, tipos e auxiliares.

export const Id = z.object({ id: nnStr });
export const Comment = z.string().trim().min(3).max(2000);

export type Loaded = NonNullable<Awaited<ReturnType<typeof loadMetric>>>;

/** Permissão de escrever no plano + papel que decide. */
export async function decisionContext(
  action: PlanAction
): Promise<SignalContext> {
  const ctx = await requireSignalPermissionContext("signal.initiative.write");
  const denial = planActionDenial(ctx.signalRole, action);
  if (denial) {
    throw new SignalRuleError("plan.role.denied", denial);
  }
  return ctx;
}

export const LOAD_INITIATIVE = {
  id: true,
  code: true,
  name: true,
  ownerId: true,
  scaffoldTrackId: true,
} as const;

/** A métrica é procurada pelo tenant do contexto, nunca só por id: id de outro
 *  tenant vira "não encontrada", não "proibida" (não confirma que existe). */
export async function loadMetric(db: Db, tenantId: string, id: string) {
  const metric = await db.signalPlanMetric.findFirst({
    where: { id, tenantId },
    include: { initiative: { select: LOAD_INITIATIVE } },
  });
  if (!metric) {
    throw new SignalRuleError(
      "plan.not-found",
      "Métrica não encontrada nesta organização."
    );
  }
  return metric;
}

export async function loadInitiative(db: Db, tenantId: string, code: string) {
  const initiative = await db.signalInitiative.findUnique({
    where: { tenantId_code: { tenantId, code } },
  });
  if (!initiative) {
    throw new SignalRuleError(
      "initiative.not-found",
      `Iniciativa ${code} não encontrada nesta organização.`
    );
  }
  return initiative;
}

/**
 * Carrega a iniciativa e toma o trinco dela até o fim da transação. Classificar
 * e gerar o plano leem "há plano?" e depois escrevem: sem o trinco, duas
 * chamadas ao mesmo tempo passam as duas pela leitura e geram o plano duas
 * vezes (ou classificam depois que o outro já gerou). Relê depois do trinco,
 * porque a primeira leitura pode ter ficado velha esperando a vez.
 */
export async function loadInitiativeLocked(
  db: Db,
  tenantId: string,
  code: string
) {
  const first = await loadInitiative(db, tenantId, code);
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`signal-plan:${tenantId}:${first.id}`}, 0))`;
  return loadInitiative(db, tenantId, code);
}

export function recordEvent(
  db: Db,
  ctx: SignalContext,
  metric: { id: string },
  event: {
    action:
      | "PROPOSE"
      | "APPROVE"
      | "MAP_SOURCE"
      | "START_MEASURING"
      | "PAUSE"
      | "RESUME"
      | "REQUEST_TARGET_REVIEW"
      | "CHANGE_PRIMARY"
      | "EDIT";
    fromState: PlanState | null;
    toState: PlanState | null;
    version: number;
    changes?: AuditDiff;
    comment?: string;
  }
) {
  return db.signalPlanMetricEvent.create({
    data: {
      tenantId: ctx.tenantId,
      planMetricId: metric.id,
      actorId: ctx.userId,
      action: event.action,
      fromState: event.fromState,
      toState: event.toState,
      version: event.version,
      changes: event.changes ?? undefined,
      comment: event.comment ?? null,
    },
    select: { id: true },
  });
}

/**
 * Grava só se a métrica ainda está como foi lida (estado e versão). Duas
 * pessoas agindo ao mesmo tempo: a segunda recebe conflito e recarrega, em vez
 * de sobrescrever a decisão da primeira sem saber (mesmo critério do Scaffold).
 */
export async function writeGuarded(
  db: Db,
  ctx: SignalContext,
  metric: { id: string; state: PlanState; version: number },
  data: Record<string, unknown>
): Promise<void> {
  const moved = await db.signalPlanMetric.updateMany({
    where: {
      id: metric.id,
      tenantId: ctx.tenantId,
      state: metric.state,
      version: metric.version,
    },
    data,
  });
  if (moved.count !== 1) {
    throw new SignalStateConflictError(
      "plan.concurrent",
      "A métrica mudou enquanto você agia. Recarregue o plano e refaça a ação."
    );
  }
}

export const stateLabel = (s: PlanState) => PLAN_STATE_META[s].label;

export function invalidTransition(metric: Loaded, verb: string): never {
  throw new SignalStateConflictError(
    "plan.transition.invalid",
    `Não dá para ${verb} uma métrica ${stateLabel(metric.state).toLowerCase()}.`
  );
}

export function revalidate(code: string) {
  revalidatePath(`/signal/initiative/${code}`);
  revalidatePath("/signal/models");
}
