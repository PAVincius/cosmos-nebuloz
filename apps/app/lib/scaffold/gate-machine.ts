import type {
  ScaffoldPhase,
  ScaffoldPhaseState,
  ScaffoldStepState,
} from "@repo/database";

// A máquina de fase do Scaffold (SRD §4).
//
// Lógica PURA: sem Prisma, sem sessão, sem I/O. Isso não é preferência de
// estilo — é o que permite testar a invariante do produto sem atravessar três
// camadas de mock, onde o teste passa a medir os mocks em vez da regra.
//
// O comportamento bloqueante do gate É o produto. O SRD é explícito: qualquer
// caminho de código que feche uma fase sem registrar critérios atendidos ou um
// override atribuído é defeito de correção de severidade máxima, não atalho de
// UX. Este arquivo define quando a transição é legal; `actions/gates.ts` é o
// único lugar que a executa.

export type GateEvent =
  | "OPEN"
  | "STEPS_COMPLETE"
  | "STEPS_REGRESSED"
  | "CRITERIA_MET"
  | "CRITERIA_UNMET"
  | "OVERRIDE"
  | "REOPEN"
  | "ENTER_OBSERVATION";

/** Transição ilegal tentada. Não é erro de permissão (403) nem de regra de
 *  negócio (422): é estado impossível, e a mensagem nomeia o que foi tentado
 *  para que o log diga o suficiente sem reproduzir. */
export class GateTransitionError extends Error {
  readonly from: ScaffoldPhaseState;
  readonly event: GateEvent;

  constructor(from: ScaffoldPhaseState, event: GateEvent) {
    super(`Transição ilegal: ${from} não aceita ${event}.`);
    this.name = "GateTransitionError";
    this.from = from;
    this.event = event;
  }
}

/**
 * Tabela de transição. Célula ausente = recusado.
 *
 * O que NÃO existe aqui é tão normativo quanto o que existe:
 *   • `OPEN → CLOSED` não existe — pular GATE_READY é pular SG-01.
 *   • `GATE_READY → CLOSED` por OVERRIDE não existe — override sem critério
 *     não atendido é override sem o que justificar, e a justificativa viraria
 *     formulário decorativo.
 *   • `OBSERVING → CLOSED` não existe — a janela de 30 dias termina sozinha
 *     (SG-06) ou reabre.
 */
const TRANSITIONS: Partial<
  Record<ScaffoldPhaseState, Partial<Record<GateEvent, ScaffoldPhaseState>>>
> = {
  IDLE: { OPEN: "OPEN" },
  OPEN: { STEPS_COMPLETE: "GATE_READY" },
  GATE_READY: {
    CRITERIA_MET: "CLOSED",
    CRITERIA_UNMET: "BLOCKED",
    STEPS_REGRESSED: "OPEN",
  },
  BLOCKED: {
    // Override fecha, e só a partir daqui. É a única porta de saída de um
    // bloqueio que não passa por atender o critério.
    OVERRIDE: "CLOSED",
    CRITERIA_MET: "CLOSED",
    STEPS_REGRESSED: "OPEN",
  },
  CLOSED: { REOPEN: "REOPENED", ENTER_OBSERVATION: "OBSERVING" },
  OBSERVING: { REOPEN: "REOPENED" },
  REOPENED: { OPEN: "OPEN" },
};

export function nextState(
  from: ScaffoldPhaseState,
  event: GateEvent
): ScaffoldPhaseState {
  const to = TRANSITIONS[from]?.[event];
  if (!to) {
    throw new GateTransitionError(from, event);
  }
  return to;
}

/** A transição é legal? Para a UI desabilitar controle sem provocar exceção. */
export function canTransition(
  from: ScaffoldPhaseState,
  event: GateEvent
): boolean {
  return Boolean(TRANSITIONS[from]?.[event]);
}

// ── SG-01 ─────────────────────────────────────────────────────────────────────

export type StepFact = { required: boolean; state: ScaffoldStepState };

/**
 * Uma fase só entra em `GATE_READY` com todo passo requerido concluído.
 *
 * `ACTIVE` não conta: em andamento não é concluído. Passo opcional pendente não
 * bloqueia — se bloqueasse, "opcional" não significaria nada.
 *
 * Fase sem passo nenhum passa. Um template pode legitimamente não ter passo
 * numa fase, e travar aqui deixaria a trilha presa sem nada que a pessoa
 * pudesse fazer para destravar.
 */
export function canEnterGateReady(steps: readonly StepFact[]): boolean {
  return steps.every((s) => !s.required || s.state === "DONE");
}

/** Os passos requeridos que faltam, para a UI listar em vez de mandar
 *  procurar. */
export function pendingRequiredSteps<T extends StepFact>(
  steps: readonly T[]
): T[] {
  return steps.filter((s) => s.required && s.state !== "DONE");
}

// ── SG-02 ─────────────────────────────────────────────────────────────────────

export type CriterionSpec = {
  key: string;
  statement: string;
  evaluationType: "MANUAL" | "DERIVED";
};

/** Veredito por critério. `MANUAL` vem de quem avaliou; `DERIVED` é computado
 *  pela action antes de chamar aqui — a pureza é mantida passando o fato, não
 *  buscando-o. */
export type CriterionFact = { met: boolean; note?: string };

export type EvaluatedCriterion = CriterionSpec & {
  met: boolean;
  note: string | null;
};

export type CriteriaEvaluation = {
  criteria: EvaluatedCriterion[];
  canClose: boolean;
  /** `key` dos não atendidos. É o que alimenta `unmetCriteria` do override. */
  blockers: string[];
};

/**
 * Avalia os critérios do gate.
 *
 * Critério sem fato conta como NÃO atendido. O default importa mais do que
 * parece: se ausência contasse como atendido, um critério novo publicado numa
 * versão de template passaria a fechar sozinho todo gate que ainda não o
 * avaliou — a versão que endurece a regra afrouxaria o produto.
 */
export function evaluateCriteria(
  criteria: readonly CriterionSpec[],
  facts: Readonly<Record<string, CriterionFact>>
): CriteriaEvaluation {
  const evaluated = criteria.map((c): EvaluatedCriterion => {
    const fact = facts[c.key];
    return { ...c, met: fact?.met === true, note: fact?.note ?? null };
  });
  const blockers = evaluated.filter((c) => !c.met).map((c) => c.key);
  return { criteria: evaluated, canClose: blockers.length === 0, blockers };
}

// ── SG-06 ─────────────────────────────────────────────────────────────────────

/**
 * Fechar esta fase entrega a trilha?
 *
 * Nunca. Nem a `EMBED`: fechá-la abre a janela de observação de 30 dias, e a
 * trilha só é `EMBEDDED` ao fim dela sem reabertura. A função existe para que
 * a resposta seja explícita no código em vez de implícita na ausência de um
 * `if` — é o tipo de regra que alguém "otimiza" sem perceber.
 */
export function isTerminalForTrack(
  _phase: ScaffoldPhase,
  _state: ScaffoldPhaseState
): boolean {
  return false;
}
