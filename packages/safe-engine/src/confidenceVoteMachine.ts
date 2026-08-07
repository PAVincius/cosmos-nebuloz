import { assign, setup } from "xstate";

/**
 * Valid states for the Confidence Vote process in SAFe.
 */
export type ConfidenceVoteState = "OPEN" | "TALLYING" | "REWORK" | "APPROVED";

/**
 * The event structure that the machine can receive.
 */
export type ConfidenceVoteEvent =
  | { type: "START_VOTING" }
  | { type: "CLOSE_VOTING" }
  | { type: "SUBMIT_VOTE"; vote: number }
  | { type: "REQUIRE_REWORK" }
  | { type: "APPROVE_PI" }
  | { type: "RESET_VOTING" };

/**
 * XState Machine that strictly controls the Confidence Vote flow of a PI.
 * Ensures that a PI cannot just arbitrarily change from 'OPEN' to 'APPROVED'.
 */
export const confidenceVoteMachine = setup({
  types: {
    context: {} as { totalVotes: number; votes: number[] },
    events: {} as ConfidenceVoteEvent,
  },
  actions: {
    recordVote: assign(({ context, event }) => {
      if (event.type === "SUBMIT_VOTE") {
        return {
          votes: [...context.votes, event.vote],
          totalVotes: context.totalVotes + 1,
        };
      }
      return context;
    }),
    resetVotes: assign(({ context }) => ({
      votes: [],
      totalVotes: 0,
    })),
  },
}).createMachine({
  id: "confidenceVote",
  initial: "NOT_STARTED",
  context: () => ({
    totalVotes: 0,
    votes: [],
  }),
  states: {
    NOT_STARTED: {
      on: {
        START_VOTING: {
          target: "OPEN",
        },
      },
    },
    OPEN: {
      on: {
        SUBMIT_VOTE: {
          actions: "recordVote",
        },
        CLOSE_VOTING: {
          target: "TALLYING",
        },
      },
    },
    TALLYING: {
      on: {
        APPROVE_PI: {
          target: "APPROVED",
        },
        REQUIRE_REWORK: {
          target: "REWORK",
        },
      },
    },
    REWORK: {
      on: {
        RESET_VOTING: {
          target: "OPEN",
          actions: "resetVotes",
        },
      },
    },
    APPROVED: {
      type: "final",
    },
  },
});
