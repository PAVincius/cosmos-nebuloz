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

export type DeliverableSubject = {
  status: DeliverableStatus;
  ownerId: string | null;
  approverId: string | null;
};

export type DeliverableActor = { userId: string; grants: DeliverableGrants };

export type TransitionDenial =
  | "INVALID_TRANSITION"
  | "FORBIDDEN"
  | "SELF_REVIEW"
  | "COMMENT_REQUIRED";

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
  if (!rule.from.includes(subject.status)) {
    return deny(
      "INVALID_TRANSITION",
      "O entregável não está num estado que permita esta ação."
    );
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

  if (COMMENT_REQUIRED.includes(transition) && !comment?.trim()) {
    return deny(
      "COMMENT_REQUIRED",
      transition === "REOPEN"
        ? "Reabrir exige um comentário dizendo por quê."
        : "Pedir ajuste exige um comentário dizendo o que ajustar."
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

/** Edição do resumo: mesmo escopo de `work` e só nos estados editáveis. */
export function decideEdit(
  subject: DeliverableSubject,
  actor: DeliverableActor
): { ok: true } | { ok: false; code: TransitionDenial; message: string } {
  if (!EDITABLE.includes(subject.status)) {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      message:
        "O entregável não está num estado editável. Reabra o aprovado ou aguarde a revisão.",
    };
  }
  const { work } = actor.grants;
  const isOwner = subject.ownerId !== null && subject.ownerId === actor.userId;
  if (work === "none" || (work === "own" && !isOwner)) {
    return {
      ok: false,
      code: "FORBIDDEN",
      message:
        "Só o responsável, o líder de transformação ou o consultor editam este entregável.",
    };
  }
  return { ok: true };
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
