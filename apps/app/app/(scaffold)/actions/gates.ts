"use server";

import { withTenantDb } from "@repo/database";
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { caseDecisionBlockers } from "@/lib/charter/case-controls";
import { emitProductEvent } from "@/lib/inngest/emit-product-event";
import type { ProductEventData } from "@/lib/inngest/product-events";
import { type ScaffoldResult, scaffoldAction } from "@/lib/scaffold/action";
import {
  type GateReviewState,
  phaseGateState,
} from "@/lib/scaffold/deliverable-machine";
import { ScaffoldRuleError } from "@/lib/scaffold/errors";
import {
  type CriterionFact,
  canEnterGateReady,
  type EvaluatedCriterion,
  evaluateCriteria,
  nextState,
  pendingRequiredSteps,
} from "@/lib/scaffold/gate-machine";
import type { ScaffoldContext } from "@/lib/scaffold/guards";
import { requireScaffoldPermissionContext } from "@/lib/scaffold/guards";
import { OBSERVATION_WINDOW_DAYS } from "@/lib/scaffold/observation";
import { nextPhase } from "@/lib/scaffold/phases";
import {
  AcknowledgeCharterPolicySchema,
  ClosePhaseSchema,
  EvaluateGateSchema,
  OverridePhaseSchema,
  ReopenPhaseSchema,
} from "@/lib/scaffold/schemas";
import { type Db, logScaffoldAudit } from "./_shared";

// O GATE ENGINE. É o produto.
//
// SRD, invariante crítico: "o comportamento bloqueante do gate é o produto.
// Qualquer caminho de código que feche uma fase sem registrar critérios
// atendidos ou um override atribuído é defeito de correção de severidade
// máxima, não atalho de UX."
//
// `closePhase()` é a ÚNICA função no repositório autorizada a escrever
// `ScaffoldPhaseInstance.state = CLOSED`. `gates-architecture.test.ts` falha se
// a atribuição aparecer em outro arquivo, e `gates-negative.test.ts` tem uma
// asserção por linha do contrato de bloqueio.
//
// `overridePhase` NÃO fecha por conta própria: monta a decisão e delega a
// `closePhase`. Duas portas para o mesmo estado seriam duas portas para
// esquecer um guard.

const DAY_MS = 86_400_000;

type PhaseWithContext = NonNullable<Awaited<ReturnType<typeof loadPhase>>>;

/** Carrega a fase com tudo que os guards precisam, numa consulta. Buscar por
 *  partes abriria janela entre o guard e a escrita. */
async function loadPhase(db: Db, tenantId: string, phaseInstanceId: string) {
  return db.scaffoldPhaseInstance.findFirst({
    where: { id: phaseInstanceId, track: { tenantId } },
    include: {
      steps: {
        select: { id: true, required: true, state: true, statement: true },
        orderBy: { seq: "asc" },
      },
      track: {
        select: {
          id: true,
          code: true,
          processName: true,
          tenantId: true,
          templateVersionId: true,
          businessCase: { select: { state: true, signedVersionId: true } },
        },
      },
    },
  });
}

async function loadCriteria(db: Db, versionId: string, phase: string) {
  return db.scaffoldGateCriterion.findMany({
    where: { versionId, phase: phase as never },
    orderBy: { seq: "asc" },
    select: {
      key: true,
      statement: true,
      phase: true,
      seq: true,
      evaluationType: true,
    },
  });
}

// ── Guards de fechamento ──────────────────────────────────────────────────────

/** SG-01. */
function assertStepsComplete(phase: PhaseWithContext): void {
  if (!canEnterGateReady(phase.steps)) {
    throw new ScaffoldRuleError(
      "STEPS_INCOMPLETE",
      pendingRequiredSteps(phase.steps).map((s) => s.statement)
    );
  }
}

/**
 * SG-04 — a Fase 1 não fecha sem caso de negócio assinado.
 *
 * Roda ANTES da avaliação de critérios e vale TAMBÉM no caminho de override:
 * override dispensa critério de gate, e a assinatura do baseline não é
 * critério — é a condição de existir promessa medida. Se o override a
 * contornasse, a Fase 1 fecharia sem ninguém ter assinado nada, e o Signal
 * apuraria contra o vazio.
 *
 * `ScaffoldBusinessCase` existe hoje como âncora mínima — US4 acrescenta
 * versões, métricas e contestação por cima. Até lá, nenhuma trilha tem caso
 * assinado e toda ASSESS é reprovada aqui. Isso é o comportamento correto, não
 * um bug de fatia incompleta: sem baseline assinado, a Fase 1 não deve fechar.
 */
function assertBaselineSigned(phase: PhaseWithContext): void {
  if (phase.phase !== "ASSESS") {
    return;
  }
  const bc = phase.track.businessCase;
  if (!bc?.signedVersionId) {
    throw new ScaffoldRuleError("BASELINE_NOT_SIGNED");
  }
}

/**
 * SG-05 — a Fase 3 exige aceite da política do Charter, quando o Charter existe.
 *
 * Condicional de propósito (SRD §8): toda interface degrada graciosamente
 * quando o produto contraparte não está provisionado. Bloquear um cliente que
 * não comprou o Charter seria puni-lo por uma decisão comercial.
 */
async function assertCharterPolicyAcked(
  db: Db,
  tenantId: string,
  phase: PhaseWithContext
): Promise<void> {
  if (phase.phase !== "SCALE" || phase.charterPolicyAckAt) {
    return;
  }
  const charter = await db.tenantModule.findFirst({
    where: {
      tenantId,
      module: "CHARTER",
      status: { in: ["ACTIVE", "TRIAL"] },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: { module: true },
  });
  if (charter) {
    throw new ScaffoldRuleError("CHARTER_POLICY_NOT_ACKED");
  }
}

/**
 * SG-01 (SC-DEV-06) — entregáveis obrigatórios da fase aprovados.
 *
 * Trilha SEM nenhum entregável (criada antes de os templates os terem) segue só
 * a regra de passos: não há o que exigir, e bloquear todas as trilhas antigas
 * por dado ausente as prenderia sem saída. Trilha COM entregáveis é regida por
 * eles, e fase sem nenhum obrigatório também bloqueia (ver `gateReviewState`).
 *
 * A regra vive em `phaseGateState`, compartilhada com a tela.
 */
async function loadDeliverableGate(
  db: Db,
  tenantId: string,
  phase: PhaseWithContext
): Promise<GateReviewState> {
  const all = await db.scaffoldDeliverableInstance.findMany({
    where: { tenantId, trackId: phase.track.id },
    select: {
      code: true,
      title: true,
      status: true,
      required: true,
      phaseInstanceId: true,
    },
  });
  return phaseGateState(
    all,
    phase.id,
    Boolean(phase.track.businessCase?.signedVersionId)
  );
}

function assertDeliverablesApproved(state: GateReviewState): void {
  if (state.blocked) {
    throw new ScaffoldRuleError(
      "DELIVERABLES_PENDING",
      state.pending.map((p) => p.code)
    );
  }
}

/**
 * G-CHARTER (Norte c.2 / CH-PM-03) — a Fase 3 só fecha se o caso de uso LIGADO à
 * trilha no Charter não tem controle sem evidência, com ajuste pedido, vencido
 * ou reaberto. Devolve os motivos (vazio = livre).
 *
 * É LEITURA, não evento: o gate olha o estado no instante do fechamento, então
 * `charter/control.accepted` não precisa de consumidor aqui. Vale só com Charter
 * contratado E caso ligado (degradação graciosa, como SG-05); o vínculo vem do
 * ProcessRegistry (trilha -> caso de uso).
 */
async function charterControlBlockers(
  db: Db,
  tenantId: string,
  phase: PhaseWithContext
): Promise<string[]> {
  if (phase.phase !== "SCALE") {
    return [];
  }
  const charter = await db.tenantModule.findFirst({
    where: {
      tenantId,
      module: "CHARTER",
      status: { in: ["ACTIVE", "TRIAL"] },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: { module: true },
  });
  if (!charter) {
    return [];
  }
  const link = await db.processRegistry.findFirst({
    where: {
      tenantId,
      scaffoldTrackId: phase.track.id,
      charterUseCaseId: { not: null },
    },
    select: { charterUseCaseId: true },
  });
  if (!link?.charterUseCaseId) {
    return [];
  }
  const controls = await db.charterCaseControl.findMany({
    where: { tenantId, useCaseId: link.charterUseCaseId },
    select: { code: true, name: true, state: true },
  });
  return caseDecisionBlockers(controls).map((b) => b.reason);
}

/** Recusa o fechamento com controle do Charter pendente. NÃO é dispensável por
 *  override: override cobre critério de gate, e controle de risco não é critério. */
async function assertCharterControlsClear(
  db: Db,
  tenantId: string,
  phase: PhaseWithContext
): Promise<void> {
  const blockers = await charterControlBlockers(db, tenantId, phase);
  if (blockers.length > 0) {
    throw new ScaffoldRuleError("CHARTER_CONTROLS_NOT_CLEAR", blockers);
  }
}

// ── Leitura ───────────────────────────────────────────────────────────────────

export type GateEvaluation = {
  phase: string;
  state: string;
  criteria: EvaluatedCriterion[];
  canClose: boolean;
  blockers: string[];
  /** Enunciado dos passos requeridos pendentes — SG-01. */
  pendingSteps: string[];
  /** Códigos dos entregáveis obrigatórios pendentes — SG-01 (SC-DEV-06). */
  pendingDeliverables: string[];
  /** Motivo pronto para o controle desabilitado. Nulo quando liberado. */
  deliverablesReason: string | null;
};

/** Avalia o gate sem escrever nada. É o que a tela do detalhe de trilha
 *  consome para desabilitar o botão com motivo, em vez de deixar clicar e
 *  falhar. */
export async function evaluateGate(
  raw: z.input<typeof EvaluateGateSchema>
): Promise<ScaffoldResult<GateEvaluation>> {
  return scaffoldAction(async () => {
    const ctx = await requireScaffoldPermissionContext("portfolio.read");
    const input = EvaluateGateSchema.parse(raw);

    return withTenantDb(ctx.tenantId, async (db) => {
      const phase = await loadPhase(db, ctx.tenantId, input.phaseInstanceId);
      if (!phase) {
        throw new ScaffoldRuleError("PHASE_NOT_CLOSABLE");
      }
      const criteria = await loadCriteria(
        db,
        phase.track.templateVersionId,
        phase.phase
      );
      const evaluation = evaluateCriteria(
        criteria,
        (input.criteriaFacts ?? {}) as Record<string, CriterionFact>
      );
      const pending = pendingRequiredSteps(phase.steps).map((s) => s.statement);
      const deliverables = await loadDeliverableGate(db, ctx.tenantId, phase);
      const controlBlockers = await charterControlBlockers(
        db,
        ctx.tenantId,
        phase
      );
      return {
        phase: phase.phase,
        state: phase.state,
        criteria: evaluation.criteria,
        canClose:
          evaluation.canClose &&
          pending.length === 0 &&
          !deliverables.blocked &&
          controlBlockers.length === 0,
        blockers: [...evaluation.blockers, ...controlBlockers],
        pendingSteps: pending,
        pendingDeliverables: deliverables.pending.map((p) => p.code),
        deliverablesReason: deliverables.reason,
      };
    });
  });
}

// ── Fechamento ────────────────────────────────────────────────────────────────

type CloseArgs = {
  db: Db;
  ctx: ScaffoldContext;
  phase: PhaseWithContext;
  approverId: string;
  criteria: EvaluatedCriterion[];
  outcome: "PASSED" | "OVERRIDDEN";
};

/**
 * A escrita do fechamento. Ponto único.
 *
 * Chamada por `closePhase` (critérios atendidos) e por `overridePhase`
 * (override atribuído), depois de os dois terem passado pelos mesmos guards.
 */
async function writeClose({
  db,
  ctx,
  phase,
  approverId,
  criteria,
  outcome,
}: CloseArgs) {
  const isEmbed = phase.phase === "EMBED";
  // SG-06: fechar a EMBED NÃO entrega a trilha — abre a janela de observação.
  const to = isEmbed
    ? nextState(
        nextState(
          phase.state,
          outcome === "OVERRIDDEN" ? "OVERRIDE" : "CRITERIA_MET"
        ),
        "ENTER_OBSERVATION"
      )
    : nextState(
        phase.state,
        outcome === "OVERRIDDEN" ? "OVERRIDE" : "CRITERIA_MET"
      );

  const now = new Date();
  const result = await db.scaffoldGateResult.create({
    data: {
      tenantId: ctx.tenantId,
      phaseInstanceId: phase.id,
      cycle: phase.reopenCount,
      outcome,
      approverId,
      decidedAt: now,
      // Congelado. Editar o template depois não pode reescrever a história do
      // gate — SG-07.
      criteriaSnapshot: criteria.map((c) => ({
        key: c.key,
        statement: c.statement,
        met: c.met,
        note: c.note,
      })),
    },
    select: { id: true },
  });

  await db.scaffoldPhaseInstance.update({
    where: { id: phase.id },
    data: {
      state: to,
      closedAt: now,
      ...(isEmbed
        ? {
            observationEndsAt: new Date(
              now.getTime() + OBSERVATION_WINDOW_DAYS * DAY_MS
            ),
            // Congela o contador: o que invalida a entrega é reabrir DEPOIS
            // daqui, não o histórico de tropeços antes.
            reopenCountAtClose: phase.reopenCount,
          }
        : {}),
    },
  });

  // Fase fechada avança a trilha. Sem isto, fechar a ASSESS deixa a trilha em
  // ASSESS com a PILOT em IDLE — o gate registra a decisão e o produto não anda.
  // A EMBED não avança: não há quinta fase, e a entrega é a janela de observação.
  const advanced = isEmbed ? null : nextPhase(phase.phase);

  // `lastGateAt` é o que a varredura de estagnação percorre (S-09). Sem esta
  // linha, uma trilha que acabou de mover um gate apareceria estagnada.
  await db.scaffoldTrack.update({
    where: { id: phase.track.id },
    data: { lastGateAt: now, ...(advanced ? { currentPhase: advanced } : {}) },
  });

  if (advanced) {
    // `state: "IDLE"` no where, e não um update por id: refechar uma fase
    // reaberta não pode reabrir a seguinte, que já andou.
    await db.scaffoldPhaseInstance.updateMany({
      where: {
        // A fase não tem `tenantId` próprio: é escopada pela trilha. O filtro
        // pela relação mantém a defesa de tenant dentro da própria consulta.
        track: { tenantId: ctx.tenantId },
        trackId: phase.track.id,
        phase: advanced,
        state: "IDLE",
      },
      data: { state: "OPEN", openedAt: now },
    });
  }

  return { resultId: result.id, to, at: now, openedPhase: advanced };
}

/** Dados do evento `scaffold/gate.closed` (X-04), montados dentro da transação
 *  e emitidos só depois dela: o evento anuncia um fato já confirmado. */
function gateClosedEvent(
  ctx: ScaffoldContext,
  phase: PhaseWithContext,
  write: Awaited<ReturnType<typeof writeClose>>,
  outcome: "PASSED" | "OVERRIDDEN"
): ProductEventData<"scaffoldGateClosed"> {
  return {
    tenantId: ctx.tenantId,
    trackId: phase.track.id,
    trackCode: phase.track.code,
    processName: phase.track.processName,
    closedPhase: phase.phase,
    openedPhase: write.openedPhase,
    outcome,
    gateResultId: write.resultId,
    at: write.at.toISOString(),
  };
}

/**
 * Fecha a fase com os critérios atendidos.
 *
 * ÚNICA função no repositório que escreve `state: "CLOSED"` numa fase.
 * `gates-architecture.test.ts` falha se outra aparecer.
 */
export async function closePhase(
  raw: z.input<typeof ClosePhaseSchema>
): Promise<ScaffoldResult<{ gateResultId: string }>> {
  return scaffoldAction(async () => {
    const ctx = await requireScaffoldPermissionContext("gate.close");
    const input = ClosePhaseSchema.parse(raw);

    const closedEvents: ProductEventData<"scaffoldGateClosed">[] = [];

    const out = await withTenantDb(ctx.tenantId, async (db) => {
      const phase = await loadPhase(db, ctx.tenantId, input.phaseInstanceId);
      if (!phase) {
        throw new ScaffoldRuleError("PHASE_NOT_CLOSABLE");
      }

      // Ordem deliberada: passos e entregáveis (SG-01) → baseline (SG-04) → Charter (SG-05)
      // → critérios (SG-02). Do mais barato e mais comum ao mais caro, para
      // que a recusa mais provável não pague uma consulta extra.
      assertStepsComplete(phase);
      assertDeliverablesApproved(
        await loadDeliverableGate(db, ctx.tenantId, phase)
      );
      assertBaselineSigned(phase);
      await assertCharterPolicyAcked(db, ctx.tenantId, phase);
      await assertCharterControlsClear(db, ctx.tenantId, phase);

      const criteria = await loadCriteria(
        db,
        phase.track.templateVersionId,
        phase.phase
      );
      const evaluation = evaluateCriteria(
        criteria,
        input.criteriaFacts as Record<string, CriterionFact>
      );

      if (!evaluation.canClose) {
        // SG-02. A fase vai para BLOCKED e NENHUM resultado é gravado:
        // resultado só nasce ao fechar, e gate que não passa não é resultado.
        //
        // A recusa é DEVOLVIDA, não lançada daqui: `withTenantDb` é uma transação
        // interativa, e um throw dentro dela desfaz o update. Era o defeito do
        // #286 — o BLOCKED nunca chegava ao banco, e o override (que só age em
        // BLOCKED) ficava inalcançável. O erro sai depois do commit, abaixo.
        if (phase.state === "GATE_READY" || phase.state === "OPEN") {
          await db.scaffoldPhaseInstance.update({
            where: { id: phase.id },
            data: { state: "BLOCKED" },
          });
          // A transição de estado é fato auditável: quem tentou fechar, e o que
          // faltava. Só quando a fase de fato mudou de estado.
          await logScaffoldAudit(db, ctx, {
            action: "scaffold.gate.close-refused",
            entityType: "scaffold.phase",
            entityId: phase.id,
            target: `${phase.track.code} · ${phase.phase}`,
            diff: [["Estado", phase.state, "BLOCKED"]],
            note: `Critérios não atendidos: ${evaluation.blockers.join(", ")}.`,
          });
        }
        return { refusedBlockers: evaluation.blockers };
      }

      const write = await writeClose({
        db,
        ctx,
        phase,
        approverId: input.approverId,
        criteria: evaluation.criteria,
        outcome: "PASSED",
      });
      const { resultId, to } = write;
      closedEvents.push(gateClosedEvent(ctx, phase, write, "PASSED"));

      await logScaffoldAudit(db, ctx, {
        action: "scaffold.gate.close",
        entityType: "scaffold.gateresult",
        entityId: resultId,
        target: `${phase.track.code} · ${phase.phase}`,
        diff: [["Estado", phase.state, to]],
      });

      return { gateResultId: resultId };
    });

    // Recusa do SG-02: a transação já commitou o BLOCKED e a auditoria; só agora
    // o erro sobe, para a tela mostrar o motivo e oferecer o override.
    if ("refusedBlockers" in out) {
      throw new ScaffoldRuleError("CRITERIA_UNMET", out.refusedBlockers);
    }

    // Depois da transação: o Cosmos cria o épico e as features a partir disto.
    for (const event of closedEvents) {
      await emitProductEvent("scaffoldGateClosed", event);
    }

    revalidatePath("/scaffold");
    return out;
  });
}

/**
 * Fecha a fase por override atribuído — SG-03.
 *
 * Exige ator autenticado (vem da sessão, nunca do payload), a lista dos
 * critérios dispensados e uma justificativa com substância. O PRD §7 nomeia
 * "gate vira formalidade que todo mundo waiva" como o risco número um do
 * produto, e estes três campos são a mitigação escrita lá.
 *
 * Só age sobre fase BLOCKED: override sobre gate que passou é override sem o
 * que justificar.
 */
export async function overridePhase(
  raw: z.input<typeof OverridePhaseSchema>
): Promise<ScaffoldResult<{ gateResultId: string; overrideId: string }>> {
  return scaffoldAction(async () => {
    const ctx = await requireScaffoldPermissionContext("gate.override");
    const input = OverridePhaseSchema.parse(raw);

    const closedEvents: ProductEventData<"scaffoldGateClosed">[] = [];

    const out = await withTenantDb(ctx.tenantId, async (db) => {
      const phase = await loadPhase(db, ctx.tenantId, input.phaseInstanceId);
      if (!phase) {
        throw new ScaffoldRuleError("PHASE_NOT_CLOSABLE");
      }

      // Os mesmos guards do fechamento normal. SG-04 e SG-05 NÃO são
      // dispensáveis por override: override cobre critério de gate, e nem a
      // assinatura do baseline nem o aceite de política são critério.
      assertStepsComplete(phase);
      assertDeliverablesApproved(
        await loadDeliverableGate(db, ctx.tenantId, phase)
      );
      assertBaselineSigned(phase);
      await assertCharterPolicyAcked(db, ctx.tenantId, phase);
      await assertCharterControlsClear(db, ctx.tenantId, phase);

      const criteria = await loadCriteria(
        db,
        phase.track.templateVersionId,
        phase.phase
      );
      // Os critérios dispensados entram no snapshot como NÃO atendidos, com a
      // razão. O snapshot é a evidência: ele precisa mostrar o que foi passado
      // por cima, não uma versão limpa da decisão.
      const evaluation = evaluateCriteria(
        criteria,
        Object.fromEntries(
          criteria.map((c) => [
            c.key,
            input.unmetCriteria.includes(c.key)
              ? { met: false, note: input.rationale }
              : { met: true },
          ])
        )
      );

      const write = await writeClose({
        db,
        ctx,
        phase,
        approverId: ctx.userId,
        criteria: evaluation.criteria,
        outcome: "OVERRIDDEN",
      });
      const { resultId, to } = write;
      closedEvents.push(gateClosedEvent(ctx, phase, write, "OVERRIDDEN"));

      const override = await db.scaffoldGateOverride.create({
        data: {
          tenantId: ctx.tenantId,
          gateResultId: resultId,
          // Da sessão, nunca do payload: um override atribuído a quem o cliente
          // digitar não é atribuição.
          actorId: ctx.userId,
          unmetCriteria: input.unmetCriteria,
          rationale: input.rationale,
        },
        select: { id: true },
      });

      await logScaffoldAudit(db, ctx, {
        action: "scaffold.gate.override",
        entityType: "scaffold.override",
        entityId: override.id,
        target: `${phase.track.code} · ${phase.phase}`,
        note: input.rationale,
        diff: [
          ["Estado", phase.state, to],
          ["Critérios não atendidos", "—", input.unmetCriteria.join(", ")],
        ],
      });

      return { gateResultId: resultId, overrideId: override.id };
    });

    for (const event of closedEvents) {
      await emitProductEvent("scaffoldGateClosed", event);
    }

    revalidatePath("/scaffold");
    return out;
  });
}

/**
 * Reabre uma fase fechada.
 *
 * NÃO toca no `ScaffoldGateResult` anterior (SG-07): incrementa `reopenCount`,
 * e o próximo fechamento grava um resultado novo com `cycle` novo. A história
 * de um gate reaberto três vezes são três linhas.
 */
export async function reopenPhase(
  raw: z.input<typeof ReopenPhaseSchema>
): Promise<ScaffoldResult<void>> {
  return scaffoldAction(async () => {
    const ctx = await requireScaffoldPermissionContext("gate.close");
    const input = ReopenPhaseSchema.parse(raw);

    const reopenedEvents: ProductEventData<"scaffoldGateReopened">[] = [];

    await withTenantDb(ctx.tenantId, async (db) => {
      const phase = await loadPhase(db, ctx.tenantId, input.phaseInstanceId);
      if (!phase) {
        throw new ScaffoldRuleError("PHASE_NOT_CLOSABLE");
      }
      // Lança GateTransitionError se a fase não estiver CLOSED nem OBSERVING.
      nextState(phase.state, "REOPEN");

      const reopenedAt = new Date();
      reopenedEvents.push({
        tenantId: ctx.tenantId,
        trackId: phase.track.id,
        trackCode: phase.track.code,
        phase: phase.phase,
        phaseInstanceId: phase.id,
        reopenCount: phase.reopenCount + 1,
        at: reopenedAt.toISOString(),
      });

      await db.scaffoldPhaseInstance.update({
        where: { id: phase.id },
        data: {
          state: "OPEN",
          reopenedAt,
          reopenCount: { increment: 1 },
          closedAt: null,
          observationEndsAt: null,
        },
      });

      // A trilha volta para a fase reaberta. Deixá-la na fase seguinte mostraria
      // a pessoa trabalhando numa fase que a casca diz não ser a atual.
      await db.scaffoldTrack.update({
        where: { id: phase.track.id },
        data: { currentPhase: phase.phase },
      });

      await logScaffoldAudit(db, ctx, {
        action: "scaffold.gate.reopen",
        entityType: "scaffold.phase",
        entityId: phase.id,
        target: `${phase.track.code} · ${phase.phase}`,
        note: input.rationale,
        diff: [["Estado", phase.state, "OPEN"]],
      });
    });

    for (const event of reopenedEvents) {
      await emitProductEvent("scaffoldGateReopened", event);
    }

    revalidatePath("/scaffold");
  });
}

/** S-11 / SG-05 — registra o aceite da política do Charter na Fase 3. */
export async function acknowledgeCharterPolicy(
  raw: z.input<typeof AcknowledgeCharterPolicySchema>
): Promise<ScaffoldResult<void>> {
  return scaffoldAction(async () => {
    const ctx = await requireScaffoldPermissionContext("gate.close");
    const input = AcknowledgeCharterPolicySchema.parse(raw);

    await withTenantDb(ctx.tenantId, async (db) => {
      const phase = await loadPhase(db, ctx.tenantId, input.phaseInstanceId);
      if (!phase) {
        throw new ScaffoldRuleError("PHASE_NOT_CLOSABLE");
      }
      await db.scaffoldPhaseInstance.update({
        where: { id: phase.id },
        data: {
          charterPolicyId: input.policyId,
          charterPolicyAckAt: new Date(),
        },
      });
      await logScaffoldAudit(db, ctx, {
        action: "scaffold.gate.charter-ack",
        entityType: "scaffold.phase",
        entityId: phase.id,
        target: `${phase.track.code} · ${phase.phase}`,
        note: `Política ${input.policyId} aceita.`,
      });
    });

    revalidatePath("/scaffold");
  });
}
