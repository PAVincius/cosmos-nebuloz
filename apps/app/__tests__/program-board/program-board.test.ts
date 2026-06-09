import { describe, expect, it } from "vitest";
import {
  computeVoteAverage,
  getConfidenceZone,
  isRevealThresholdMet,
} from "../../lib/collaboration/confidence-vote";
import {
  buildAdjacency,
  wouldCreateCycle,
} from "../../lib/collaboration/dependency-cycle";

// ─── DFS cycle detection (AC-003) ─────────────────────────────────────────────

describe("wouldCreateCycle (AC-003)", () => {
  it("detects cycle: F-C → F-A would close A→B→C→A", () => {
    const adj = new Map([
      ["F-A", ["F-B"]],
      ["F-B", ["F-C"]],
    ]);

    expect(wouldCreateCycle(adj, "F-C", "F-A")).toBe(true);
  });

  it("allows valid new dependency F-A → F-D (no cycle)", () => {
    const adj = new Map([
      ["F-A", ["F-B"]],
      ["F-B", ["F-C"]],
    ]);

    expect(wouldCreateCycle(adj, "F-A", "F-D")).toBe(false);
  });

  it("self-loop F-A → F-A is a cycle", () => {
    const adj = new Map<string, string[]>();
    expect(wouldCreateCycle(adj, "F-A", "F-A")).toBe(true);
  });

  it("empty graph: any new link is valid", () => {
    expect(wouldCreateCycle(new Map(), "F-1", "F-2")).toBe(false);
  });

  it("long chain: F-A → F-Z would close existing path", () => {
    const nodes = ["F-A", "F-B", "F-C", "F-D", "F-E", "F-Z"];
    const adj = new Map<string, string[]>();
    for (let i = 0; i < nodes.length - 1; i++) {
      adj.set(nodes[i] as string, [nodes[i + 1] as string]);
    }
    // F-Z → F-A would create a cycle
    expect(wouldCreateCycle(adj, "F-Z", "F-A")).toBe(true);
  });

  it("buildAdjacency constructs correct map", () => {
    const links = [
      { sourceFeatureId: "A", targetFeatureId: "B" },
      { sourceFeatureId: "A", targetFeatureId: "C" },
    ];

    const adj = buildAdjacency(links);
    expect(adj.get("A")).toEqual(["B", "C"]);
    expect(adj.get("B")).toBeUndefined();
  });
});

// ─── Confidence vote (AC-005, AC-006) ────────────────────────────────────────

describe("computeVoteAverage (AC-005)", () => {
  it("computes correct weighted average", () => {
    const breakdown = { 4: 3, 5: 2 };
    const avg = computeVoteAverage(breakdown);
    // (4*3 + 5*2) / 5 = 22/5 = 4.4
    expect(avg).toBeCloseTo(4.4, 5);
  });

  it("returns 0 for empty breakdown", () => {
    expect(computeVoteAverage({})).toBe(0);
  });

  it("single score returns that score", () => {
    expect(computeVoteAverage({ 3: 5 })).toBe(3);
  });
});

describe("isRevealThresholdMet (AC-006)", () => {
  it("returns false when below 50% threshold", () => {
    expect(isRevealThresholdMet(4, 10)).toBe(false);
  });

  it("returns true at exactly 50%", () => {
    expect(isRevealThresholdMet(5, 10)).toBe(true);
  });

  it("returns true above 50%", () => {
    expect(isRevealThresholdMet(7, 10)).toBe(true);
  });

  it("returns false for zero expected total", () => {
    expect(isRevealThresholdMet(5, 0)).toBe(false);
  });
});

// ─── Confidence zone coloring (AC-007) ────────────────────────────────────────

describe("getConfidenceZone (AC-007)", () => {
  it("returns red for avg < 3", () => {
    expect(getConfidenceZone(2.9)).toBe("red");
    expect(getConfidenceZone(1)).toBe("red");
  });

  it("returns yellow for avg 3–4", () => {
    expect(getConfidenceZone(3)).toBe("yellow");
    expect(getConfidenceZone(3.8)).toBe("yellow");
    expect(getConfidenceZone(4)).toBe("yellow");
  });

  it("returns green for avg > 4", () => {
    expect(getConfidenceZone(4.1)).toBe("green");
    expect(getConfidenceZone(5)).toBe("green");
  });
});

// ─── Read-only guard logic (AC-008) ───────────────────────────────────────────

describe("Read-only state detection (AC-008)", () => {
  const READ_ONLY_STATES = new Set(["COMMITTED", "CLOSED"]);

  it("COMMITTED state is read-only", () => {
    expect(READ_ONLY_STATES.has("COMMITTED")).toBe(true);
  });

  it("CLOSED state is read-only", () => {
    expect(READ_ONLY_STATES.has("CLOSED")).toBe(true);
  });

  it("PLANNING_IN_PROGRESS is editable", () => {
    expect(READ_ONLY_STATES.has("PLANNING_IN_PROGRESS")).toBe(false);
  });

  it("DRAFT is editable", () => {
    expect(READ_ONLY_STATES.has("DRAFT")).toBe(false);
  });
});
