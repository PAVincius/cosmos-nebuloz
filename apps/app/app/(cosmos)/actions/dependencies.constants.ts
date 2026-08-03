// Vocabulário de `DependencyLink.boardStatus` (story-020 AC-006). Fica fora de
// dependencies.ts porque aquele arquivo é "use server": um módulo de Server
// Actions só pode exportar função async, não constante. Importado pela action
// (validação Zod) e pela tela de dependências (rótulo e cor).
export const DEPENDENCY_BOARD_STATUSES = [
  "IDENTIFIED",
  "IN_PROGRESS",
  "RESOLVED",
] as const;
export type DependencyBoardStatus = (typeof DEPENDENCY_BOARD_STATUSES)[number];

export const DEPENDENCY_BOARD_STATUS_LABEL: Record<
  DependencyBoardStatus,
  string
> = {
  IDENTIFIED: "Identificada",
  IN_PROGRESS: "Em resolução",
  RESOLVED: "Resolvida",
};

// story-020 AC-006 — "IDENTIFIED yellow · IN_PROGRESS blue · RESOLVED green".
export const DEPENDENCY_BOARD_STATUS_TONE: Record<
  DependencyBoardStatus,
  "amber" | "blue" | "green"
> = {
  IDENTIFIED: "amber",
  IN_PROGRESS: "blue",
  RESOLVED: "green",
};

/**
 * Próximo passo do bloqueio, ou `null` quando ele já está resolvido. RESOLVED é
 * terminal: reabrir um bloqueio resolvido reescreveria a história do PI e não
 * tem AC que o autorize.
 */
export function nextBoardStatus(current: string): DependencyBoardStatus | null {
  if (current === "IDENTIFIED") {
    return "IN_PROGRESS";
  }
  if (current === "IN_PROGRESS") {
    return "RESOLVED";
  }
  return null;
}

export const DEPENDENCY_NEXT_STATUS_LABEL: Record<
  DependencyBoardStatus,
  string
> = {
  IDENTIFIED: "Iniciar resolução",
  IN_PROGRESS: "Marcar resolvida",
  RESOLVED: "Resolvida",
};
