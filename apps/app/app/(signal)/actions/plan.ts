"use server";

import { type WorkForm, withTenantDb } from "@repo/database";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { emitProductEvent } from "@/lib/inngest/emit-product-event";
import { SignalRuleError, SignalStateConflictError } from "@/lib/signal/errors";
import {
  requireInitiativeOwnership,
  requireSignalPermissionContext,
  type SignalContext,
} from "@/lib/signal/guards";
import {
  COMMENT_REQUIRED,
  diffMetricEdit,
  nextStateFor,
  PLAN_STATE_META,
  type PlanAction,
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

// Plano de medição da iniciativa — SG-DEV-05.
//
// Toda mutação segue a mesma ordem: sessão + módulo + papel → papel pode mover
// o plano (ADMIN não, SG-PO-03) → a métrica é lida pelo tenant do contexto →
// posse da iniciativa → regra de estado → escrita + histórico + trilha, na
// mesma transação. O histórico da métrica (SignalPlanMetricEvent) é o "antes e
// depois" do plano; a trilha (AuditLog) é a prova para fora do produto.

const Id = z.object({ id: nnStr });
const Comment = z.string().trim().min(3).max(2000);

type Loaded = NonNullable<Awaited<ReturnType<typeof loadMetric>>>;

/** Permissão de escrever no plano + papel que decide. */
async function decisionContext(action: PlanAction): Promise<SignalContext> {
  const ctx = await requireSignalPermissionContext("signal.initiative.write");
  const denial = planActionDenial(ctx.signalRole, action);
  if (denial) {
    throw new SignalRuleError("plan.role.denied", denial);
  }
  return ctx;
}

const LOAD_INITIATIVE = {
  id: true,
  code: true,
  name: true,
  ownerId: true,
  scaffoldTrackId: true,
} as const;

/** A métrica é procurada pelo tenant do contexto, nunca só por id: id de outro
 *  tenant vira "não encontrada", não "proibida" (não confirma que existe). */
async function loadMetric(db: Db, tenantId: string, id: string) {
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

async function loadInitiative(db: Db, tenantId: string, code: string) {
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
async function loadInitiativeLocked(db: Db, tenantId: string, code: string) {
  const first = await loadInitiative(db, tenantId, code);
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`signal-plan:${tenantId}:${first.id}`}, 0))`;
  return loadInitiative(db, tenantId, code);
}

function recordEvent(
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
async function writeGuarded(
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

const stateLabel = (s: PlanState) => PLAN_STATE_META[s].label;

function invalidTransition(metric: Loaded, verb: string): never {
  throw new SignalStateConflictError(
    "plan.transition.invalid",
    `Não dá para ${verb} uma métrica ${stateLabel(metric.state).toLowerCase()}.`
  );
}

function revalidate(code: string) {
  revalidatePath(`/signal/initiative/${code}`);
  revalidatePath("/signal/models");
}

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

// ── Transições de estado ──────────────────────────────────────────────────────

type TransitionSpec = {
  action: "pause" | "resume";
  event: "PAUSE" | "RESUME";
  verb: string;
  audit: string;
};

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

  await writeGuarded(db, ctx, metric, { state: next });
  await recordEvent(db, ctx, metric, {
    action: spec.event,
    fromState: metric.state,
    toState: next,
    version: metric.version,
    comment,
  });
  await logSignalAudit(db, ctx, {
    action: spec.audit,
    entityType: "signal.planmetric",
    entityId: metric.id,
    target: `${metric.initiative.code} · ${metric.name}`,
    note: comment,
    diff: [[FIELD_LABELS.state, stateLabel(metric.state), stateLabel(next)]],
  });
  return { state: next, code: metric.initiative.code };
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

// ── Editar (nova versão) ──────────────────────────────────────────────────────

const EditSchema = Id.extend({
  name: nnStr.optional(),
  formula: z.string().trim().min(3).max(2000).optional(),
  targetValue: z.number().finite().nullable().optional(),
  ownerId: nnStr.nullable().optional(),
});

export async function editMetric(
  raw: z.input<typeof EditSchema>
): Promise<SignalResult<{ version: number }>> {
  return await signalAction(async () => {
    const ctx = await decisionContext("edit");
    const input = EditSchema.parse(raw);

    const result = await withTenantDb(ctx.tenantId, async (db) => {
      const metric = await loadMetric(db, ctx.tenantId, input.id);
      requireInitiativeOwnership(ctx, metric.initiative);

      const { patch, changes } = diffMetricEdit(metric, input);
      if (patch.ownerId) {
        await requireTenantMember(db, ctx.tenantId, String(patch.ownerId));
      }

      const version = metric.version + 1;
      await writeGuarded(db, ctx, metric, { ...patch, version });
      await recordEvent(db, ctx, metric, {
        action: "EDIT",
        fromState: metric.state,
        toState: metric.state,
        version,
        changes,
      });
      await logSignalAudit(db, ctx, {
        action: "Métrica editada (nova versão)",
        entityType: "signal.planmetric",
        entityId: metric.id,
        target: `${metric.initiative.code} · ${metric.name}`,
        diff: changes,
      });
      return { version, code: metric.initiative.code };
    });

    revalidate(result.code);
    return { version: result.version };
  });
}

/** Responsável precisa ser da organização E ter papel no Signal: quem não tem
 *  papel não enxerga o plano que estaria respondendo. */
async function requireTenantMember(db: Db, tenantId: string, userId: string) {
  const member = await db.signalMember.findFirst({
    where: { tenantId, userId },
    select: { id: true },
  });
  if (!member) {
    throw new SignalRuleError(
      "plan.owner.not-member",
      "O responsável precisa ser membro desta organização com papel no Signal."
    );
  }
}

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
