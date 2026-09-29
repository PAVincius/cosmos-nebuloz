// Leitura do plano de controles do caso — CH-DEV-04.
//
// Puro, sem banco: a aba, o modal e os testes leem a MESMA resposta para "que
// estado é este", "o que este papel pode fazer agora" e "essa evidência venceu".
// As regras de fluxo (quais transições existem) são as do backend, em
// `case-controls.ts`; aqui só se traduz para a tela.

import {
  type ControlAction,
  type ControlState,
  nextControlState,
} from "./case-controls";
import { DATA_CLASS_LABEL } from "./rules";

type Tone = "accent" | "blue" | "purple" | "green" | "amber" | "red";

/** Estado nunca vai só na cor (Color-Plus-Word Rule): rótulo + tom. */
export const CONTROL_STATE_META: Record<
  ControlState,
  { label: string; tone: Tone }
> = {
  NO_EVIDENCE: { label: "Sem evidência", tone: "red" },
  IN_PROGRESS: { label: "Em elaboração", tone: "blue" },
  IN_REVIEW: { label: "Em revisão", tone: "amber" },
  ADJUSTMENT_REQUESTED: { label: "Ajuste pedido", tone: "amber" },
  ACCEPTED: { label: "Aceita", tone: "green" },
  EXPIRED: { label: "Vencida", tone: "red" },
  DISPENSED: { label: "Dispensado", tone: "accent" },
  REOPENED: { label: "Reaberto", tone: "amber" },
};

export const CADENCE_LABEL = {
  WEEKLY: "Semanal",
  MONTHLY: "Mensal",
  QUARTERLY: "Trimestral",
  SEMIANNUAL: "Semestral",
  ANNUAL: "Anual",
  PER_CYCLE: "A cada ciclo",
} as const;

export const CONTROL_ROLE_LABEL: Record<string, string> = {
  COMPLIANCE: "Compliance",
  LEGAL: "Jurídico",
  SECURITY: "Segurança",
  HR: "People Ops",
  REQUESTER: "Solicitante",
  EXEC: "Executivo",
  AUDITOR: "Auditor",
};

export function progressLabel(accepted: number, total: number): string {
  return `${accepted}/${total} com evidência aceita`;
}

/** "N controles não se aplicam à classe X"; nulo quando N é zero (ausência não
 *  vira "0 controles"). */
export function notApplicableLabel(
  count: number,
  dataClass: keyof typeof DATA_CLASS_LABEL
): string | null {
  if (count === 0) {
    return null;
  }
  const klass = DATA_CLASS_LABEL[dataClass].split(" (")[0];
  return count === 1
    ? `1 controle não se aplica à classe ${klass}`
    : `${count} controles não se aplicam à classe ${klass}`;
}

export function filterControls<
  T extends { state: string; blocksDecision: boolean },
>(rows: readonly T[], filter: { state?: string; blocking?: boolean }): T[] {
  return rows.filter(
    (r) =>
      (!filter.state || r.state === filter.state) &&
      (!filter.blocking || r.blocksDecision)
  );
}

export type ControlActionView = {
  action: Exclude<ControlAction, "EXPIRE">;
  label: string;
  allowed: boolean;
  /** Motivo escrito quando `allowed` é falso — vai para a tela, não só hover. */
  reason: string;
  needsComment: boolean;
};

const ACTIONS: {
  action: ControlActionView["action"];
  label: string;
  by: "submit" | "decide";
  needsComment: boolean;
}[] = [
  {
    action: "ATTACH",
    label: "Anexar evidência",
    by: "submit",
    needsComment: false,
  },
  {
    action: "SUBMIT",
    label: "Enviar para revisão",
    by: "submit",
    needsComment: false,
  },
  { action: "ACCEPT", label: "Aceitar", by: "decide", needsComment: false },
  {
    action: "REQUEST_ADJUSTMENT",
    label: "Pedir ajuste",
    by: "decide",
    needsComment: true,
  },
  { action: "DISPENSE", label: "Dispensar", by: "decide", needsComment: true },
  { action: "REOPEN", label: "Reabrir", by: "decide", needsComment: true },
];

const DENIAL = {
  submit: "Só quem submete o caso anexa e envia evidência.",
  decide: "Só quem decide o caso aceita, pede ajuste, dispensa e reabre.",
} as const;

function legal(state: ControlState, action: ControlAction): boolean {
  try {
    nextControlState(state, action);
    return true;
  } catch {
    return false;
  }
}

/** As ações que o fluxo admite no estado, com a permissão e o motivo da negativa. */
export function controlActionsFor(
  state: ControlState,
  can: { submit: boolean; decide: boolean },
  dispensable: boolean
): ControlActionView[] {
  return ACTIONS.filter((a) => legal(state, a.action)).map((a) => {
    let reason = can[a.by] ? "" : DENIAL[a.by];
    if (a.action === "DISPENSE" && !dispensable) {
      reason = "Este controle não pode ser dispensado (obrigação do perfil).";
    }
    return {
      action: a.action,
      label: a.label,
      allowed: reason === "",
      reason,
      needsComment: a.needsComment,
    };
  });
}

const WARN_DAYS = 14;

export function expiryWarning(
  control: { state: ControlState | string; expiresAt: Date | null },
  now: Date
): { tone: "red" | "amber"; text: string } | null {
  if (control.state === "EXPIRED") {
    const when = control.expiresAt
      ? ` em ${control.expiresAt.toLocaleDateString("pt-BR")}`
      : "";
    return {
      tone: "red",
      text: `A evidência venceu${when}. Anexe uma evidência nova e envie para revisão; enquanto isso o controle bloqueia a decisão do caso.`,
    };
  }
  if (control.state === "ACCEPTED" && control.expiresAt) {
    const days = Math.ceil(
      (control.expiresAt.getTime() - now.getTime()) / 86_400_000
    );
    if (days <= WARN_DAYS) {
      return {
        tone: "amber",
        text: `A evidência vence em ${days} dia${days === 1 ? "" : "s"} (${control.expiresAt.toLocaleDateString("pt-BR")}). Prepare a renovação.`,
      };
    }
  }
  return null;
}
