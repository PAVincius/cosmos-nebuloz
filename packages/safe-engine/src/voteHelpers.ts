import type { ConfidenceVoteEvent } from "./confidenceVoteMachine";

// Static map mirrors the XState machine transitions — keeps UI/server in sync
// without needing to hydrate an actor just for state inspection.
const STATE_TRANSITIONS: Record<string, ConfidenceVoteEvent["type"][]> = {
  NOT_STARTED: ["START_VOTING"],
  OPEN: ["SUBMIT_VOTE", "CLOSE_VOTING"],
  TALLYING: ["APPROVE_PI", "REQUIRE_REWORK"],
  REWORK: ["RESET_VOTING"],
  APPROVED: [],
};

// State machine transition table — mirrors the XState machine but without runtime overhead.
const NEXT_STATE: Record<string, Partial<Record<ConfidenceVoteEvent["type"], string>>> = {
  NOT_STARTED: { START_VOTING: "OPEN" },
  OPEN: { CLOSE_VOTING: "TALLYING" },
  TALLYING: { APPROVE_PI: "APPROVED", REQUIRE_REWORK: "REWORK" },
  REWORK: { RESET_VOTING: "OPEN" },
  APPROVED: {},
};

export function getNextVoteEvents(ctx: {
  xStateStatus: string;
  votes: number[];
}): string[] {
  return STATE_TRANSITIONS[ctx.xStateStatus] ?? [];
}

export function canSendVoteEvent(
  ctx: { xStateStatus: string; votes: number[] },
  event: ConfidenceVoteEvent
): boolean {
  return getNextVoteEvents(ctx).includes(event.type);
}

export function applyVoteEvent(
  ctx: { xStateStatus: string; votes: number[] },
  event: ConfidenceVoteEvent
): { xStateStatus: string; votes: number[] } | null {
  if (!canSendVoteEvent(ctx, event)) return null;

  const nextStatus =
    event.type === "SUBMIT_VOTE"
      ? ctx.xStateStatus // SUBMIT_VOTE is a self-transition (stays OPEN)
      : NEXT_STATE[ctx.xStateStatus]?.[event.type] ?? ctx.xStateStatus;

  const updatedVotes =
    event.type === "SUBMIT_VOTE"
      ? [...ctx.votes, event.vote]
      : event.type === "RESET_VOTING"
        ? []
        : ctx.votes;

  return { xStateStatus: nextStatus, votes: updatedVotes };
}
