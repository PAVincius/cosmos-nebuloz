// Máquina de estados do entregável — pura, sem banco.
//
// Fluxo (SC-DEV-03): Não iniciado → Em elaboração → Em revisão → Ajuste pedido
// ou Aprovado → Reaberto. As actions só chamam `decideTransition`, gravam o
// `to` e o evento append-only; a regra mora aqui para ser testada sem banco e
// não ser reescrita por action.
//
// Nomes de status e ação são os do schema (`ScaffoldDeliverableStatus`,
// `ScaffoldDeliverableAction`). Declarados aqui, e não importados de
// `@repo/database`, para o módulo seguir puro e cliente-seguro.

/** Código do entregável que É o caso de negócio assinado: o estado dele deriva
 *  da assinatura (SG-04) e ninguém o aprova à mão. */
export const BUSINESS_CASE_DELIVERABLE_CODE = "A3.2";

export type DeliverableStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "IN_REVIEW"
  | "ADJUSTMENT_REQUESTED"
  | "APPROVED"
  | "REOPENED";

export type DeliverableTransition =
  | "START"
  | "SUBMIT"
  | "APPROVE"
  | "REQUEST_ADJUSTMENT"
  | "REOPEN";

/** Estados de partida de cada transição, e o estado de chegada. */
const TRANSITIONS: Record<
  DeliverableTransition,
  { from: readonly DeliverableStatus[]; to: DeliverableStatus }
> = {
  START: { from: ["NOT_STARTED"], to: "IN_PROGRESS" },
  SUBMIT: {
    from: ["IN_PROGRESS", "ADJUSTMENT_REQUESTED", "REOPENED"],
    to: "IN_REVIEW",
  },
  APPROVE: { from: ["IN_REVIEW"], to: "APPROVED" },
  REQUEST_ADJUSTMENT: { from: ["IN_REVIEW"], to: "ADJUSTMENT_REQUESTED" },
  REOPEN: { from: ["APPROVED"], to: "REOPENED" },
};

/** Mínimo do comentário de ajuste e de reabertura: uma frase. "ok" não diz a
 *  quem produz o que mudar (Crivo F6). Cancelar trilha, que é mais grave, exige
 *  20. */
export const MIN_COMMENT_LENGTH = 10;

/** Transições que exigem comentário (SC-PO-03). */
const COMMENT_REQUIRED: readonly DeliverableTransition[] = [
  "REQUEST_ADJUSTMENT",
  "REOPEN",
];

/**
 * O que um papel de adoção pode fazer num entregável (SC-PO-04).
 *
 *  - `work`: "own" só no que é responsável; "any" em qualquer um; "none" nada;
 *  - `review`: aprova ou pede ajuste — só se for o aprovador (regra na decisão);
 *  - `reopen`: mesmo peso de fechar gate.
 *
 * Papel desconhecido — ou futuro, como SPONSOR e TEAM_LEAD — não pode nada além
 * de ler: negar por omissão.
 */
export type DeliverableGrants = {
  work: "any" | "own" | "none";
  review: boolean;
  reopen: boolean;
};

const NONE: DeliverableGrants = { work: "none", review: false, reopen: false };

const GRANTS: Record<string, DeliverableGrants> = {
  TEAM_MEMBER: { work: "own", review: false, reopen: false },
  PROCESS_OWNER: { work: "own", review: true, reopen: true },
  TRANSFORMATION_LEAD: { work: "any", review: true, reopen: true },
  CONSULTANT: { work: "any", review: true, reopen: true },
  // Administrar acesso não é decidir risco: ADMIN não mexe em entregável.
  ADMIN: NONE,
  SPONSOR: NONE,
  TEAM_LEAD: NONE,
};

export function deliverableGrants(role: string): DeliverableGrants {
  return GRANTS[role] ?? NONE;
}

/** Estado da fase do entregável (`ScaffoldPhaseState`), declarado aqui para o
 *  módulo seguir puro e cliente-seguro. */
export type PhaseState =
  | "IDLE"
  | "OPEN"
  | "GATE_READY"
  | "BLOCKED"
  | "CLOSED"
  | "OBSERVING"
  | "REOPENED";

export type DeliverableSubject = {
  status: DeliverableStatus;
  ownerId: string | null;
  approverId: string | null;
  phaseState: PhaseState;
  /** Há arquivo anexado na versão atual. Enviar para revisão exige. */
  hasFile: boolean;
  /** Dispensado (por módulo, por regra do molde ou por overlay): não vale para
   *  esta trilha e não tem ação nenhuma. Ausente = não dispensado. */
  dispensed?: boolean;
};

/** Fases em que se trabalha num entregável. A que ainda não abriu (IDLE) é só
 *  leitura, e a fechada só admite reabrir (SC-PO-03). */
const WORKABLE_PHASES: readonly PhaseState[] = [
  "OPEN",
  "GATE_READY",
  "BLOCKED",
  "REOPENED",
];
const REOPENABLE_PHASES: readonly PhaseState[] = [
  ...WORKABLE_PHASES,
  "CLOSED",
  "OBSERVING",
];

const DISPENSED_MESSAGE =
  "Este entregável está dispensado e não tem ação: o motivo da dispensa está na linha dele.";

const PHASE_NOT_OPEN_MESSAGE =
  "A fase deste entregável ainda não abriu: ele é só leitura até o gate da fase anterior fechar.";

export type DeliverableActor = { userId: string; grants: DeliverableGrants };

export type TransitionDenial =
  | "INVALID_TRANSITION"
  | "FORBIDDEN"
  | "SELF_REVIEW"
  | "COMMENT_REQUIRED"
  | "FILE_REQUIRED"
  | "PHASE_NOT_OPEN"
  | "DISPENSED";

export type TransitionResult =
  | { ok: true; to: DeliverableStatus }
  | { ok: false; code: TransitionDenial; message: string };

const deny = (code: TransitionDenial, message: string): TransitionResult => ({
  ok: false,
  code,
  message,
});

/**
 * Decide se `actor` pode aplicar `transition` ao entregável.
 *
 * Ordem: transição válida → permissão do papel → ninguém revisa o que é seu →
 * aprovador designado → comentário. A ordem importa para a mensagem: quem não
 * pode nem tentar não deve ouvir "falta comentário".
 */
export function decideTransition(
  transition: DeliverableTransition,
  subject: DeliverableSubject,
  actor: DeliverableActor,
  comment?: string
): TransitionResult {
  const rule = TRANSITIONS[transition];
  if (subject.dispensed) {
    return deny("DISPENSED", DISPENSED_MESSAGE);
  }
  if (!rule.from.includes(subject.status)) {
    return deny(
      "INVALID_TRANSITION",
      "O entregável não está num estado que permita esta ação."
    );
  }

  const phases = transition === "REOPEN" ? REOPENABLE_PHASES : WORKABLE_PHASES;
  if (!phases.includes(subject.phaseState)) {
    return deny("PHASE_NOT_OPEN", PHASE_NOT_OPEN_MESSAGE);
  }

  const isOwner = subject.ownerId !== null && subject.ownerId === actor.userId;

  if (transition === "START" || transition === "SUBMIT") {
    const { work } = actor.grants;
    if (work === "none" || (work === "own" && !isOwner)) {
      return deny(
        "FORBIDDEN",
        "Só o responsável, o líder de transformação ou o consultor trabalham neste entregável."
      );
    }
  }

  if (transition === "SUBMIT" && !subject.hasFile) {
    return deny(
      "FILE_REQUIRED",
      "Anexe o arquivo do entregável antes de enviar para revisão."
    );
  }

  if (transition === "APPROVE" || transition === "REQUEST_ADJUSTMENT") {
    if (!actor.grants.review) {
      return deny("FORBIDDEN", "Seu papel não revisa entregável.");
    }
    if (isOwner) {
      return deny(
        "SELF_REVIEW",
        "Ninguém aprova nem pede ajuste no que é seu. Outra pessoa precisa revisar."
      );
    }
    if (subject.approverId !== null && subject.approverId !== actor.userId) {
      return deny(
        "FORBIDDEN",
        "Só o aprovador designado revisa este entregável."
      );
    }
  }

  if (transition === "REOPEN" && !actor.grants.reopen) {
    return deny(
      "FORBIDDEN",
      "Reabrir entregável aprovado exige dono do processo, líder de transformação ou consultor."
    );
  }

  if (
    COMMENT_REQUIRED.includes(transition) &&
    (comment?.trim().length ?? 0) < MIN_COMMENT_LENGTH
  ) {
    return deny(
      "COMMENT_REQUIRED",
      transition === "REOPEN"
        ? `Reabrir exige um comentário de ao menos ${MIN_COMMENT_LENGTH} caracteres dizendo por quê.`
        : `Pedir ajuste exige um comentário de ao menos ${MIN_COMMENT_LENGTH} caracteres dizendo o que ajustar.`
    );
  }

  return { ok: true, to: rule.to };
}

/** Estados em que o resumo pode ser editado. Em revisão e aprovado o conteúdo
 *  está congelado: quem revisa precisa ver o que foi enviado. */
const EDITABLE: readonly DeliverableStatus[] = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "ADJUSTMENT_REQUESTED",
  "REOPENED",
];

type WorkDecision =
  | { ok: true }
  | { ok: false; code: TransitionDenial; message: string };

/** Escopo de `work` (próprio ou qualquer), a fase aberta e o estado do
 *  entregável: o que edição de resumo e anexo de versão têm em comum. */
function decideWorkOn(
  subject: DeliverableSubject,
  actor: DeliverableActor,
  allowed: readonly DeliverableStatus[],
  stateMessage: string
): WorkDecision {
  if (subject.dispensed) {
    return { ok: false, code: "DISPENSED", message: DISPENSED_MESSAGE };
  }
  if (!WORKABLE_PHASES.includes(subject.phaseState)) {
    return {
      ok: false,
      code: "PHASE_NOT_OPEN",
      message: PHASE_NOT_OPEN_MESSAGE,
    };
  }
  if (!allowed.includes(subject.status)) {
    return { ok: false, code: "INVALID_TRANSITION", message: stateMessage };
  }
  const { work } = actor.grants;
  const isOwner = subject.ownerId !== null && subject.ownerId === actor.userId;
  if (work === "none" || (work === "own" && !isOwner)) {
    return {
      ok: false,
      code: "FORBIDDEN",
      message:
        "Só o responsável, o líder de transformação ou o consultor trabalham neste entregável.",
    };
  }
  return { ok: true };
}

/** Edição do resumo: mesmo escopo de `work` e só nos estados editáveis. */
export function decideEdit(
  subject: DeliverableSubject,
  actor: DeliverableActor
): WorkDecision {
  return decideWorkOn(
    subject,
    actor,
    EDITABLE,
    "O entregável não está num estado editável. Reabra o aprovado ou aguarde a revisão."
  );
}

/** Estados em que se anexa versão de arquivo: já iniciado e ainda não enviado.
 *  Em revisão o que foi enviado não muda; aprovado pede reabrir. */
const ATTACHABLE: readonly DeliverableStatus[] = [
  "IN_PROGRESS",
  "ADJUSTMENT_REQUESTED",
  "REOPENED",
];

export function decideAttach(
  subject: DeliverableSubject,
  actor: DeliverableActor
): WorkDecision {
  return decideWorkOn(
    subject,
    actor,
    ATTACHABLE,
    "Só se anexa arquivo a entregável em elaboração, com ajuste pedido ou reaberto. Inicie antes, ou reabra."
  );
}

/** Designar responsável ou aprovador. Dispensado não recebe ninguém: precisa ser
 *  reativado antes (Vigia, #331). Quem pode designar é regra de papel, na action. */
export function decideAssign(subject: DeliverableSubject): WorkDecision {
  if (subject.dispensed) {
    return { ok: false, code: "DISPENSED", message: DISPENSED_MESSAGE };
  }
  return { ok: true };
}

/** Vínculo com item externo (S6): referência, vale em qualquer estado do
 *  entregável, com o mesmo escopo de `work` e a fase aberta. */
export function decideLink(
  subject: DeliverableSubject,
  actor: DeliverableActor
): WorkDecision {
  return decideWorkOn(
    subject,
    actor,
    [
      "NOT_STARTED",
      "IN_PROGRESS",
      "IN_REVIEW",
      "ADJUSTMENT_REQUESTED",
      "APPROVED",
      "REOPENED",
    ],
    "O entregável não está num estado que admita vínculo."
  );
}

export type GateDeliverable = {
  code: string;
  title: string;
  status: DeliverableStatus;
  required: boolean;
};

export type GateReviewState = {
  blocked: boolean;
  /** Motivo visível no controle desabilitado. Nulo quando liberado. */
  reason: string | null;
  pending: GateDeliverable[];
};

/**
 * Estado do gate "Revisar e assinar" de uma fase (SG-01): fica bloqueado
 * enquanto houver entregável obrigatório fora de APPROVED. Reaberto volta a
 * bloquear. Fase sem nenhum obrigatório também bloqueia — vazio libera o gate
 * por dado ausente, e isso esconderia o defeito em vez de apontá-lo.
 */
export function gateReviewState(
  deliverables: readonly GateDeliverable[]
): GateReviewState {
  const required = deliverables.filter((d) => d.required);
  if (required.length === 0) {
    return {
      blocked: true,
      reason: "A fase não tem entregável obrigatório cadastrado.",
      pending: [],
    };
  }
  const pending = required.filter((d) => d.status !== "APPROVED");
  if (pending.length === 0) {
    return { blocked: false, reason: null, pending: [] };
  }
  const n = pending.length;
  return {
    blocked: true,
    reason: `${n} ${n === 1 ? "entregável obrigatório pendente" : "entregáveis obrigatórios pendentes"}: ${pending.map((p) => p.code).join(", ")}.`,
    pending,
  };
}

export type ActionAvailability = { allowed: boolean; reason: string | null };

/**
 * O que cada botão pode, com o motivo quando não pode (controle desabilitado
 * com o porquê, nunca escondido). Não cobra o comentário: ele é pedido no
 * diálogo, e sumir com o botão por falta dele impediria de chegar lá.
 */
export function availableActions(
  subject: DeliverableSubject,
  actor: DeliverableActor
): Record<DeliverableTransition, ActionAvailability> {
  const out = {} as Record<DeliverableTransition, ActionAvailability>;
  for (const t of Object.keys(TRANSITIONS) as DeliverableTransition[]) {
    const r = decideTransition(
      t,
      subject,
      actor,
      "x".repeat(MIN_COMMENT_LENGTH)
    );
    out[t] = r.ok
      ? { allowed: true, reason: null }
      : { allowed: false, reason: r.message };
  }
  return out;
}

/**
 * Estado que vale para o gate, o contador e a lista. O A3.2 é o caso de negócio:
 * o estado dele deriva da assinatura (SG-04) e ninguém o aprova à mão, então é
 * aprovado quando o caso está assinado, seja qual for o estado gravado. Uma regra
 * só, para os três lugares não divergirem (Crivo G1).
 */
export function effectiveStatus(
  code: string,
  status: DeliverableStatus,
  businessCaseSigned: boolean
): DeliverableStatus {
  return code === BUSINESS_CASE_DELIVERABLE_CODE && businessCaseSigned
    ? "APPROVED"
    : status;
}

export type PhaseDeliverable = GateDeliverable & { phaseInstanceId: string };

/**
 * Estado do gate de UMA fase a partir de todos os entregáveis da trilha.
 * Compartilhado por `closePhase` (servidor) e pela tela (motivo no botão), para
 * que os dois nunca discordem.
 *
 * Trilha sem nenhum entregável (anterior ao modelo) não é bloqueada: segue só a
 * regra de passos. O A3.2 é o caso de negócio e conta como aprovado quando o
 * caso está assinado (SG-04): ninguém o aprova à mão.
 */
export function phaseGateState(
  all: readonly PhaseDeliverable[],
  phaseInstanceId: string,
  businessCaseSigned: boolean
): GateReviewState {
  if (all.length === 0) {
    return { blocked: false, reason: null, pending: [] };
  }
  return gateReviewState(
    all
      .filter((d) => d.phaseInstanceId === phaseInstanceId)
      .map((d) => ({
        code: d.code,
        title: d.title,
        required: d.required,
        status: effectiveStatus(d.code, d.status, businessCaseSigned),
      }))
  );
}
