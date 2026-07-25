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

export const epicLifecycleMachine = setup({
  types: {
    context: {} as EpicLifecycleContext,
    events: {} as EpicLifecycleEvent,
    input: {} as Partial<EpicLifecycleContext>,
  },
  guards: {
    hasInvestScore: ({ context }) => (context.investScore ?? 0) >= 40,
    hasHypothesis: ({ context }) => (context.hypothesis?.length ?? 0) >= 50,
    hasGovernanceApproval: ({ context }) => context.hasGovernanceApproval,
    hasBudgetAllocation: ({ context }) =>
      (context.leanBudgetAllocation ?? 0) > 0,
    hasValidRejectionReason: ({ event }) =>
      event.type === "REJECT" && event.reason.length >= 20,
    canTransitionToBacklog: ({ context }) =>
      (context.investScore ?? 0) >= 40 &&
      (context.hypothesis?.length ?? 0) >= 50,
    canTransitionToImplementing: ({ context }) =>
      context.hasGovernanceApproval && (context.leanBudgetAllocation ?? 0) > 0,
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
