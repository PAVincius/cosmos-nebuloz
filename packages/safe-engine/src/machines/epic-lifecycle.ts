import { setup } from "xstate";

export type EpicLifecycleStatus =
  | "FUNNEL"
  | "ANALYZING"
  | "PORTFOLIO_BACKLOG"
  | "IMPLEMENTING"
  | "DONE"
  | "REJECTED";

export type EpicLifecycleContext = {
  investScore: number | null;
  hypothesis: string | null;
  leanBudgetAllocation: number | null;
  hasGovernanceApproval: boolean;
  rejectionReason: string | null;
};

export type EpicLifecycleEvent =
  | { type: "ANALYZE" }
  | { type: "MOVE_TO_BACKLOG" }
  | { type: "START_IMPLEMENTING" }
  | { type: "COMPLETE" }
  | { type: "REJECT"; reason: string };

/** INVEST mínimo para um épico sair da análise. */
export const INVEST_MINIMO = 40;
/** Tamanho mínimo de hipótese. Abaixo disto é título, não hipótese. */
export const HIPOTESE_MINIMA = 50;
/** Tamanho mínimo do motivo de rejeição. "Não gostei" não é motivo. */
export const MOTIVO_MINIMO = 20;

/**
 * Os predicados de cada portão, como funções.
 *
 * Antes existiam duas vezes: uma como guard nomeado que nenhuma transição
 * usava, outra copiada dentro dos guards compostos. Duas cópias da mesma regra
 * são livres para divergir — mudar o mínimo de INVEST num lugar e não no outro
 * não quebra nada e ninguém percebe até um épico passar por onde não devia.
 */
export function temInvest(ctx: Pick<EpicLifecycleContext, "investScore">) {
  return (ctx.investScore ?? 0) >= INVEST_MINIMO;
}

export function temHipotese(ctx: Pick<EpicLifecycleContext, "hypothesis">) {
  return (ctx.hypothesis?.length ?? 0) >= HIPOTESE_MINIMA;
}

export function temVerba(
  ctx: Pick<EpicLifecycleContext, "leanBudgetAllocation">
) {
  return (ctx.leanBudgetAllocation ?? 0) > 0;
}

export const epicLifecycleMachine = setup({
  types: {
    context: {} as EpicLifecycleContext,
    events: {} as EpicLifecycleEvent,
    input: {} as Partial<EpicLifecycleContext>,
  },
  guards: {
    hasValidRejectionReason: ({ event }) =>
      event.type === "REJECT" && event.reason.length >= MOTIVO_MINIMO,
    canTransitionToBacklog: ({ context }) =>
      temInvest(context) && temHipotese(context),
    canTransitionToImplementing: ({ context }) =>
      context.hasGovernanceApproval && temVerba(context),
  },
}).createMachine({
  id: "epicLifecycle",
  initial: "FUNNEL",
  context: ({ input }) => ({
    investScore: input?.investScore ?? null,
    hypothesis: input?.hypothesis ?? null,
    leanBudgetAllocation: input?.leanBudgetAllocation ?? null,
    hasGovernanceApproval: input?.hasGovernanceApproval ?? false,
    rejectionReason: input?.rejectionReason ?? null,
  }),
  states: {
    FUNNEL: {
      on: {
        ANALYZE: "ANALYZING",
        REJECT: { target: "REJECTED", guard: "hasValidRejectionReason" },
      },
    },
    ANALYZING: {
      on: {
        MOVE_TO_BACKLOG: {
          target: "PORTFOLIO_BACKLOG",
          guard: "canTransitionToBacklog",
        },
        REJECT: { target: "REJECTED", guard: "hasValidRejectionReason" },
      },
    },
    PORTFOLIO_BACKLOG: {
      on: {
        START_IMPLEMENTING: {
          target: "IMPLEMENTING",
          guard: "canTransitionToImplementing",
        },
        REJECT: { target: "REJECTED", guard: "hasValidRejectionReason" },
      },
    },
    IMPLEMENTING: {
      on: {
        COMPLETE: "DONE",
        REJECT: { target: "REJECTED", guard: "hasValidRejectionReason" },
      },
    },
    DONE: { type: "final" },
    REJECTED: { type: "final" },
  },
});

export type EpicLifecycleMachine = typeof epicLifecycleMachine;

// Mapping from XState event type to target status — used for validation
export const EVENT_TO_STATUS: Record<
  EpicLifecycleEvent["type"],
  EpicLifecycleStatus
> = {
  ANALYZE: "ANALYZING",
  MOVE_TO_BACKLOG: "PORTFOLIO_BACKLOG",
  START_IMPLEMENTING: "IMPLEMENTING",
  COMPLETE: "DONE",
  REJECT: "REJECTED",
};

// Elevated transitions requiring PO/SM/RTE/STE/ADMIN role
export const ELEVATED_EVENTS: ReadonlySet<EpicLifecycleEvent["type"]> = new Set(
  ["MOVE_TO_BACKLOG", "START_IMPLEMENTING", "COMPLETE"]
);
