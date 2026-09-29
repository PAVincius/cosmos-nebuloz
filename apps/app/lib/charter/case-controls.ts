// Plano de controles do caso — regras puras (CH-DEV-02/03/05/06/07).
//
// Sem banco e sem `server-only`: as actions, o job de vencimento e os testes
// importam daqui. Fonte das regras: decisões provisórias do Norte, 2026-09-29,
// CH-PO-01..04, e o fluxo do PDF §04:
//
//   Sem evidência → Em elaboração → Em revisão → Ajuste pedido / Aceita → Vencida
//   Sem evidência / Ajuste pedido → Dispensado
//   Aceita / Dispensado → Reaberto
//
// Pedir ajuste, dispensar e reabrir exigem comentário. Só quem decide o caso
// (`case.decide`) aceita, dispensa e reabre; quem submete (`case.submit`) anexa,
// envia e edita. Essas permissões são checadas nas actions; aqui mora o que
// independe de quem chama.

export type ControlClass =
  | "PUBLIC"
  | "INTERNAL"
  | "CONFIDENTIAL"
  | "RESTRICTED";

export type ControlState =
  | "NO_EVIDENCE"
  | "IN_PROGRESS"
  | "IN_REVIEW"
  | "ADJUSTMENT_REQUESTED"
  | "ACCEPTED"
  | "EXPIRED"
  | "DISPENSED"
  | "REOPENED";

export type ControlAction =
  | "ATTACH"
  | "SUBMIT"
  | "ACCEPT"
  | "REQUEST_ADJUSTMENT"
  | "DISPENSE"
  | "REOPEN"
  | "EXPIRE";

export type ControlCadence =
  | "WEEKLY"
  | "MONTHLY"
  | "QUARTERLY"
  | "SEMIANNUAL"
  | "ANNUAL"
  | "PER_CYCLE";

/** Prazo máximo de uma dispensa (CH-PO-04): 6 meses. HIPÓTESE do Norte. */
export const MAX_DISPENSE_DAYS = 183;

const CLASS_RANK: Record<ControlClass, number> = {
  PUBLIC: 0,
  INTERNAL: 1,
  CONFIDENTIAL: 2,
  RESTRICTED: 3,
};

/**
 * CH-PO-03. O controle se aplica quando `classe do caso >= classe mínima`, na
 * ordem PUBLIC < INTERNAL < CONFIDENTIAL < RESTRICTED. Os que não se aplicam
 * voltam separados, porque a tela conta e mostra ("N controles não se aplicam
 * à classe X").
 */
export function partitionByClass<T extends { minClass: ControlClass }>(
  controls: readonly T[],
  caseClass: ControlClass
): { applicable: T[]; notApplicable: T[] } {
  const applicable: T[] = [];
  const notApplicable: T[] = [];
  for (const control of controls) {
    if (CLASS_RANK[caseClass] >= CLASS_RANK[control.minClass]) {
      applicable.push(control);
    } else {
      notApplicable.push(control);
    }
  }
  return { applicable, notApplicable };
}

/** Transição recusada pelo fluxo. Vira 409 (conflito de estado) na action. */
export class ControlTransitionError extends Error {
  readonly from: ControlState;
  readonly action: ControlAction;

  constructor(from: ControlState, action: ControlAction) {
    super(`Ação ${action} não é permitida com o controle em ${from}.`);
    this.name = "ControlTransitionError";
    this.from = from;
    this.action = action;
  }
}

const TRANSITIONS: Record<
  ControlAction,
  Partial<Record<ControlState, ControlState>>
> = {
  // Anexar volta o controle a "Em elaboração" de qualquer estado que ainda
  // precisa de evidência. Anexar sobre Aceita ou Dispensado exige reabrir antes.
  ATTACH: {
    NO_EVIDENCE: "IN_PROGRESS",
    IN_PROGRESS: "IN_PROGRESS",
    ADJUSTMENT_REQUESTED: "IN_PROGRESS",
    REOPENED: "IN_PROGRESS",
    EXPIRED: "IN_PROGRESS",
  },
  SUBMIT: { IN_PROGRESS: "IN_REVIEW" },
  ACCEPT: { IN_REVIEW: "ACCEPTED" },
  REQUEST_ADJUSTMENT: { IN_REVIEW: "ADJUSTMENT_REQUESTED" },
  DISPENSE: { NO_EVIDENCE: "DISPENSED", ADJUSTMENT_REQUESTED: "DISPENSED" },
  REOPEN: { ACCEPTED: "REOPENED", DISPENSED: "REOPENED" },
  // Só o job de vencimento usa. Aceita → Vencida.
  EXPIRE: { ACCEPTED: "EXPIRED" },
};

export function nextControlState(
  from: ControlState,
  action: ControlAction
): ControlState {
  const to = TRANSITIONS[action][from];
  if (!to) {
    throw new ControlTransitionError(from, action);
  }
  return to;
}

/** Estados em que o texto do controle (resumo, responsável) ainda pode ser
 *  editado. Aceita e Dispensado exigem reabrir: editar evidência aceita sem
 *  passar pela revisão desfaria o ato de quem aceitou. */
export const EDITABLE_STATES: readonly ControlState[] = [
  "NO_EVIDENCE",
  "IN_PROGRESS",
  "ADJUSTMENT_REQUESTED",
  "REOPENED",
];

function addMonthsUtc(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)
  ).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

/**
 * Fim da validade de uma evidência aceita, pela cadência. `PER_CYCLE` não vence
 * por calendário (o ciclo é do processo do cliente, não do relógio): devolve
 * `null` e o job não a toca.
 */
export function expiresAtFor(
  cadence: ControlCadence,
  acceptedAt: Date
): Date | null {
  switch (cadence) {
    case "WEEKLY":
      return new Date(acceptedAt.getTime() + 7 * 86_400_000);
    case "MONTHLY":
      return addMonthsUtc(acceptedAt, 1);
    case "QUARTERLY":
      return addMonthsUtc(acceptedAt, 3);
    case "SEMIANNUAL":
      return addMonthsUtc(acceptedAt, 6);
    case "ANNUAL":
      return addMonthsUtc(acceptedAt, 12);
    case "PER_CYCLE":
      return null;
    default:
      return null;
  }
}

const BLOCKER_REASON: Partial<Record<ControlState, string>> = {
  NO_EVIDENCE: "sem evidência",
  ADJUSTMENT_REQUESTED: "com ajuste pedido",
  EXPIRED: "com evidência vencida",
  // Reaberto perdeu a evidência que valia: é "sem evidência" outra vez.
  REOPENED: "reaberto, sem evidência válida",
};

export type DecisionBlocker = { code: string; name: string; reason: string };

/**
 * CH-DEV-06. A decisão de aprovar o caso fica bloqueada com controle sem
 * evidência, com ajuste pedido ou vencido. Reaberto entra na mesma conta: ele
 * voltou a não ter evidência que valha. Em elaboração e em revisão não bloqueiam
 * (trabalho em andamento); aceito e dispensado (com prazo e motivo) estão
 * resolvidos.
 */
export function caseDecisionBlockers(
  controls: readonly { code: string; name: string; state: ControlState }[]
): DecisionBlocker[] {
  return controls.flatMap((control) => {
    const reason = BLOCKER_REASON[control.state];
    return reason
      ? [
          {
            code: control.code,
            name: control.name,
            reason: `${control.code} · ${control.name}: ${reason}`,
          },
        ]
      : [];
  });
}

/** "X/Y com evidência aceita" da aba Controles. */
export function controlProgress(controls: readonly { state: ControlState }[]): {
  accepted: number;
  total: number;
  dispensed: number;
} {
  return {
    accepted: controls.filter((c) => c.state === "ACCEPTED").length,
    dispensed: controls.filter((c) => c.state === "DISPENSED").length,
    total: controls.length,
  };
}

/**
 * A chave do arquivo de evidência pertence ao tenant? Chave opaca do bucket
 * privado, sempre `<tenantId>/<segmento>(/<segmento>)*`.
 *
 * `startsWith("<tenantId>/")` não basta: "t1/../t2/x.pdf" começa com "t1/" e
 * resolve em "t2" (IDOR). Por isso a chave inteira é validada: só
 * `[A-Za-z0-9._-]` por segmento, sem segmento vazio ("//"), sem "\" e sem "." ou
 * ".." como segmento. O tenantId entra escapado: id com "." ou "|" não vira
 * regex.
 */
export function isTenantFileKey(tenantId: string, fileKey: string): boolean {
  const escaped = tenantId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const shape = new RegExp(`^${escaped}/[A-Za-z0-9._-]+(?:/[A-Za-z0-9._-]+)*$`);
  if (!shape.test(fileKey)) {
    return false;
  }
  return fileKey
    .split("/")
    .every((segment) => segment !== "." && segment !== "..");
}
