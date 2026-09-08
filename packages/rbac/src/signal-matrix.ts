// Signal — matriz de permissões da medição de valor.
//
// Transcrição de `specs/003-signal-measure/contracts/server-actions.md`. Célula
// vazia da tabela = negado. Nada é implícito.
//
// Mesma diferença deliberada do Charter e do Meridian em relação à
// PERMISSION_MATRIX (SAFe): aqui não há coringa "*". O ADMIN do tenant NÃO
// herda permissão de Signal — quem versiona uma fórmula de ROI precisa ser
// nomeável, e um admin que contorna o papel invalida a trilha. Admin de tenant
// gerencia SignalMember; para congelar um relatório precisa de papel de Signal.
//
// A escada é cumulativa: cada papel concede tudo do anterior mais o seu.
// `initiative.write` aparece em OWNER e em ANALYST com significados diferentes
// — OWNER escreve só nas próprias iniciativas. Essa restrição NÃO cabe numa
// matriz papel × permissão (depende da linha, não do papel) e por isso vive em
// `ownsInitiative()`, chamada pela action depois desta checagem passar.

import type { SignalRole } from "@repo/database";

export type SignalPermission =
  | "signal.read"
  | "signal.initiative.write"
  | "signal.initiative.close"
  | "signal.baseline.write"
  | "signal.evidence.write"
  | "signal.mapping.write"
  | "signal.formula.write"
  | "signal.alert.write"
  | "signal.report.write"
  | "signal.report.freeze"
  | "signal.connection.write"
  | "signal.settings.write"
  | "signal.member.write";

export const SIGNAL_PERMISSIONS: readonly SignalPermission[] = [
  "signal.read",
  "signal.initiative.write",
  "signal.initiative.close",
  "signal.baseline.write",
  "signal.evidence.write",
  "signal.mapping.write",
  "signal.formula.write",
  "signal.alert.write",
  "signal.report.write",
  "signal.report.freeze",
  "signal.connection.write",
  "signal.settings.write",
  "signal.member.write",
] as const;

/** Rótulo pt-BR de cada permissão, para o motivo visível no controle
 *  desabilitado. */
export const SIGNAL_PERMISSION_LABEL: Record<SignalPermission, string> = {
  "signal.read": "Ler iniciativas, evidências e relatórios",
  "signal.initiative.write": "Criar e editar iniciativa",
  "signal.initiative.close": "Encerrar iniciativa",
  "signal.baseline.write": "Capturar e assinar baseline",
  "signal.evidence.write": "Registrar observação de métrica",
  "signal.mapping.write": "Mapear evento de origem para métrica",
  "signal.formula.write": "Versionar fórmula de ROI e fatores de confiança",
  "signal.alert.write": "Avaliar e tratar alertas",
  "signal.report.write": "Montar rascunho de relatório",
  "signal.report.freeze": "Congelar relatório",
  "signal.connection.write": "Configurar fontes de dado",
  "signal.settings.write": "Alterar limiares do tenant",
  "signal.member.write": "Gerenciar papéis do Signal",
};

export const SIGNAL_ROLE_LABEL: Record<SignalRole, string> = {
  VIEWER: "Leitor",
  OWNER: "Dono de iniciativa",
  ANALYST: "Analista",
  ADMIN: "Administrador",
};

export const SIGNAL_ROLE_TONE: Record<SignalRole, string> = {
  VIEWER: "neutral",
  OWNER: "blue",
  ANALYST: "purple",
  ADMIN: "accent",
};

export const SIGNAL_MATRIX: Record<SignalRole, readonly SignalPermission[]> = {
  VIEWER: ["signal.read"],
  OWNER: [
    "signal.read",
    // Restrita às próprias iniciativas — ver `ownsInitiative()`.
    "signal.initiative.write",
    "signal.baseline.write",
    "signal.evidence.write",
  ],
  ANALYST: [
    "signal.read",
    "signal.initiative.write",
    "signal.baseline.write",
    "signal.evidence.write",
    "signal.mapping.write",
    "signal.formula.write",
    "signal.alert.write",
    "signal.report.write",
  ],
  ADMIN: [
    "signal.read",
    "signal.initiative.write",
    "signal.initiative.close",
    "signal.baseline.write",
    "signal.evidence.write",
    "signal.mapping.write",
    "signal.formula.write",
    "signal.alert.write",
    "signal.report.write",
    "signal.report.freeze",
    "signal.connection.write",
    "signal.settings.write",
    "signal.member.write",
  ],
} as const;

export function hasSignalPermission(
  role: SignalRole | null | undefined,
  permission: SignalPermission
): boolean {
  if (!role) {
    return false;
  }
  return SIGNAL_MATRIX[role].includes(permission);
}

/** Papéis que concedem a permissão — o texto do "peça a quem?". */
export function signalRolesGranting(
  permission: SignalPermission
): readonly SignalRole[] {
  return (Object.keys(SIGNAL_MATRIX) as SignalRole[]).filter((role) =>
    SIGNAL_MATRIX[role].includes(permission)
  );
}

/**
 * Motivo legível da negativa, para a UI dizer o que falta em vez de só
 * desabilitar o botão. Um controle cinza sem explicação manda a pessoa abrir
 * chamado; o motivo manda ela falar com quem resolve.
 */
export function signalDenialReason(
  role: SignalRole | null | undefined,
  permission: SignalPermission
): string | null {
  if (hasSignalPermission(role, permission)) {
    return null;
  }
  const need = signalRolesGranting(permission)
    .map((r) => SIGNAL_ROLE_LABEL[r])
    .join(" ou ");
  if (!role) {
    return `Você não tem papel no Signal desta organização. ${SIGNAL_PERMISSION_LABEL[permission]} exige ${need}.`;
  }
  return `Seu papel (${SIGNAL_ROLE_LABEL[role]}) não permite: ${SIGNAL_PERMISSION_LABEL[permission]}. Exige ${need}.`;
}

/**
 * OWNER escreve só nas próprias iniciativas; ANALYST e ADMIN, em qualquer uma.
 *
 * Separado da matriz porque a regra depende da LINHA, não do papel — e
 * misturar as duas coisas numa matriz papel × permissão levaria a checar posse
 * onde ela não se aplica (settings, conexões) ou a esquecer de checá-la onde se
 * aplica. Chamada pela action DEPOIS de `hasSignalPermission` passar.
 */
export function ownsOrOutranksInitiative(
  role: SignalRole | null | undefined,
  userId: string,
  initiativeOwnerId: string
): boolean {
  if (!role) {
    return false;
  }
  if (role === "ANALYST" || role === "ADMIN") {
    return true;
  }
  if (role === "OWNER") {
    return userId === initiativeOwnerId;
  }
  return false;
}
