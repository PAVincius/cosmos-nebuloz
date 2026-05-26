// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  canTransition,
  nextStates,
  GOVERNANCE_STATES,
} from "@/app/actions/governance/state-machine";

describe("governance state machine", () => {
  it("allows FUNNEL -> ANALYZING", () => {
    expect(canTransition("FUNNEL", "ANALYZING")).toBe(true);
  });

  it("rejects FUNNEL -> DONE skip", () => {
    expect(canTransition("FUNNEL", "DONE")).toBe(false);
  });

  it("rejects FUNNEL -> IMPLEMENTING skip", () => {
    expect(canTransition("FUNNEL", "IMPLEMENTING")).toBe(false);
  });

  it("allows any non-terminal state -> CANCELLED", () => {
    for (const s of GOVERNANCE_STATES) {
      if (s === "CANCELLED" || s === "DONE") {
        continue;
      }
      expect(canTransition(s, "CANCELLED")).toBe(true);
    }
  });

  it("DONE has no next states", () => {
    expect(nextStates("DONE")).toHaveLength(0);
  });

  it("CANCELLED has no next states", () => {
    expect(nextStates("CANCELLED")).toHaveLength(0);
  });

  it("PORTFOLIO_BACKLOG -> IMPLEMENTING allowed", () => {
    expect(canTransition("PORTFOLIO_BACKLOG", "IMPLEMENTING")).toBe(true);
  });
});
