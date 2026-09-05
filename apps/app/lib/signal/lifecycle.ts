// Ciclo de vida da iniciativa.
//
// A máquina de estados vive aqui, fora da action, porque é regra de domínio e
// não de transporte: o mesmo grafo governa a transição vinda da tela, a vinda
// de um job e a que um teste exercita.

export type InitiativeStatus =
  | "DRAFT"
  | "ACTIVE"
  | "PAUSED"
  | "CLOSED"
  | "CANCELLED";

/**
 * Transições permitidas.
 *
 * `CLOSED` e `CANCELLED` são terminais de propósito: reabrir uma iniciativa
 * encerrada apagaria o motivo do encerramento da história do portfólio. Quem
 * quer tentar de novo cria uma iniciativa nova, com hipótese nova — e o comitê
 * vê as duas lado a lado.
 */
export const TRANSITIONS: Record<InitiativeStatus, InitiativeStatus[]> = {
  DRAFT: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["PAUSED", "CLOSED", "CANCELLED"],
  PAUSED: ["ACTIVE", "CLOSED", "CANCELLED"],
  CLOSED: [],
  CANCELLED: [],
};

export function canTransition(
  from: InitiativeStatus,
  to: InitiativeStatus
): boolean {
  return TRANSITIONS[from].includes(to);
}

export function isTerminal(status: InitiativeStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

/** Transições que exigem motivo escrito. */
export function requiresReason(to: InitiativeStatus): boolean {
  return to === "CLOSED" || to === "CANCELLED";
}

/** Transições que exigem baseline assinado — medir melhora sem linha de base
 *  é opinião, não medição. */
export function requiresSignedBaseline(to: InitiativeStatus): boolean {
  return to === "ACTIVE";
}

export const STATUS_LABEL: Record<InitiativeStatus, string> = {
  DRAFT: "Rascunho",
  ACTIVE: "Ativa",
  PAUSED: "Pausada",
  CLOSED: "Encerrada",
  CANCELLED: "Cancelada",
};

export const STATUS_TONE: Record<InitiativeStatus, string> = {
  DRAFT: "neutral",
  ACTIVE: "green",
  PAUSED: "amber",
  CLOSED: "blue",
  CANCELLED: "red",
};

export const CATEGORY_LABEL = {
  PRODUCTIVITY: "Produtividade",
  QUALITY: "Qualidade",
  RISK: "Risco",
  REVENUE: "Receita",
} as const;

export const CATEGORY_ICON = {
  PRODUCTIVITY: "gauge",
  QUALITY: "check",
  RISK: "shield",
  REVENUE: "dollar",
} as const;

export const CATEGORY_TONE = {
  PRODUCTIVITY: "accent",
  QUALITY: "purple",
  RISK: "amber",
  REVENUE: "green",
} as const;

/** As cinco dimensões mínimas do baseline (FR-5). Assinar sem elas deixaria o
 *  ganho sem contra-prova em pelo menos um eixo. */
export const REQUIRED_BASELINE_KEYS = [
  "TIME",
  "COST",
  "THROUGHPUT",
  "QUALITY",
  "USER_BASE",
] as const;

export const BASELINE_KEY_LABEL: Record<string, string> = {
  TIME: "Tempo",
  COST: "Custo",
  THROUGHPUT: "Volume",
  QUALITY: "Qualidade",
  USER_BASE: "Base de usuários",
};
