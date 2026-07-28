/**
 * scripts/flow-status-chains.ts
 *
 * Cadeia de transições de status usada pelo `seedFlowHistory` em
 * seed-e2e.ts para gerar StateTransitionHistory coerente, e reutilizada
 * por verify-seed.ts para checar que o que foi semeado bate com a cadeia
 * esperada — em vez de re-hardcodar a mesma tabela nos dois lugares (o
 * que a deixaria fora de sincronia silenciosamente).
 *
 * Extraído para este módulo à parte porque seed-e2e.ts roda `main()` como
 * efeito colateral do import (sem guard de `require.main`/`import.meta`) —
 * importar seed-e2e.ts direto de verify-seed.ts dispararia um seed
 * completo dentro do verificador.
 */
export type TransitionStep = { from: string; to: string; daysAgo: number };

export const STATUS_CHAINS: Record<string, TransitionStep[]> = {
  BACKLOG: [{ from: "CREATED", to: "BACKLOG", daysAgo: 18 }],
  TODO: [
    { from: "CREATED", to: "BACKLOG", daysAgo: 16 },
    { from: "BACKLOG", to: "TODO", daysAgo: 9 },
  ],
  IN_PROGRESS: [
    { from: "CREATED", to: "BACKLOG", daysAgo: 19 },
    { from: "BACKLOG", to: "TODO", daysAgo: 13 },
    { from: "TODO", to: "IN_PROGRESS", daysAgo: 4 },
  ],
  REVIEW: [
    { from: "CREATED", to: "BACKLOG", daysAgo: 20 },
    { from: "BACKLOG", to: "TODO", daysAgo: 15 },
    { from: "TODO", to: "IN_PROGRESS", daysAgo: 8 },
    { from: "IN_PROGRESS", to: "REVIEW", daysAgo: 2 },
  ],
  DONE: [
    { from: "CREATED", to: "BACKLOG", daysAgo: 20 },
    { from: "BACKLOG", to: "TODO", daysAgo: 17 },
    { from: "TODO", to: "IN_PROGRESS", daysAgo: 13 },
    { from: "IN_PROGRESS", to: "REVIEW", daysAgo: 11 },
    { from: "REVIEW", to: "DONE", daysAgo: 10 },
  ],
  // Split pode acontecer direto do refinamento, sem passar por
  // IN_PROGRESS/REVIEW — a história nunca chegou a ser trabalhada.
  SPLIT_INTO: [
    { from: "CREATED", to: "BACKLOG", daysAgo: 12 },
    { from: "BACKLOG", to: "TODO", daysAgo: 7 },
    { from: "TODO", to: "SPLIT_INTO", daysAgo: 3 },
  ],
};
