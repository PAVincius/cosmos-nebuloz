import { describe, expect, it } from "vitest";
import {
  applyVoteEvent,
  canSendVoteEvent,
  getNextVoteEvents,
} from "../voteHelpers";

const NOT_STARTED = { xStateStatus: "NOT_STARTED", votes: [] };
const OPEN = { xStateStatus: "OPEN", votes: [] };
const TALLYING = { xStateStatus: "TALLYING", votes: [4, 5] };
const REWORK = { xStateStatus: "REWORK", votes: [3] };
const APPROVED = { xStateStatus: "APPROVED", votes: [5] };

describe("getNextVoteEvents", () => {
  it("returns START_VOTING from NOT_STARTED", () => {
    expect(getNextVoteEvents(NOT_STARTED)).toEqual(["START_VOTING"]);
  });

  it("returns SUBMIT_VOTE and CLOSE_VOTING from OPEN", () => {
    expect(getNextVoteEvents(OPEN)).toEqual(["SUBMIT_VOTE", "CLOSE_VOTING"]);
  });

  it("returns APPROVE_PI and REQUIRE_REWORK from TALLYING", () => {
    expect(getNextVoteEvents(TALLYING)).toEqual([
      "APPROVE_PI",
      "REQUIRE_REWORK",
    ]);
  });

  it("returns RESET_VOTING from REWORK", () => {
    expect(getNextVoteEvents(REWORK)).toEqual(["RESET_VOTING"]);
  });

  it("returns empty array from APPROVED", () => {
    expect(getNextVoteEvents(APPROVED)).toEqual([]);
  });

  it("returns empty array for unknown state", () => {
    expect(getNextVoteEvents({ xStateStatus: "UNKNOWN", votes: [] })).toEqual(
      []
    );
  });
});

describe("canSendVoteEvent", () => {
  it("allows valid event for state", () => {
    expect(canSendVoteEvent(NOT_STARTED, { type: "START_VOTING" })).toBe(true);
  });

  it("rejects invalid event for state", () => {
    expect(canSendVoteEvent(NOT_STARTED, { type: "CLOSE_VOTING" })).toBe(false);
  });

  it("allows SUBMIT_VOTE in OPEN state", () => {
    expect(canSendVoteEvent(OPEN, { type: "SUBMIT_VOTE", vote: 5 })).toBe(true);
  });
});

describe("applyVoteEvent", () => {
  it("transitions NOT_STARTED to OPEN on START_VOTING", () => {
    const result = applyVoteEvent(NOT_STARTED, { type: "START_VOTING" });
    expect(result).toEqual({ xStateStatus: "OPEN", votes: [] });
  });

  it("returns null for invalid event", () => {
    expect(applyVoteEvent(NOT_STARTED, { type: "CLOSE_VOTING" })).toBeNull();
  });

  it("appends vote on SUBMIT_VOTE (stays OPEN)", () => {
    const ctx = { xStateStatus: "OPEN", votes: [4] };
    const result = applyVoteEvent(ctx, { type: "SUBMIT_VOTE", vote: 5 });
    expect(result).toEqual({ xStateStatus: "OPEN", votes: [4, 5] });
  });

  it("transitions OPEN to TALLYING on CLOSE_VOTING", () => {
    const result = applyVoteEvent(OPEN, { type: "CLOSE_VOTING" });
    expect(result).toEqual({ xStateStatus: "TALLYING", votes: [] });
  });

  it("transitions TALLYING to APPROVED on APPROVE_PI", () => {
    const result = applyVoteEvent(TALLYING, { type: "APPROVE_PI" });
    expect(result).toEqual({ xStateStatus: "APPROVED", votes: [4, 5] });
  });

  it("transitions TALLYING to REWORK on REQUIRE_REWORK", () => {
    const result = applyVoteEvent(TALLYING, { type: "REQUIRE_REWORK" });
    expect(result).toEqual({ xStateStatus: "REWORK", votes: [4, 5] });
  });

  it("resets votes on RESET_VOTING from REWORK", () => {
    const result = applyVoteEvent(REWORK, { type: "RESET_VOTING" });
    expect(result).toEqual({ xStateStatus: "OPEN", votes: [] });
  });
});
