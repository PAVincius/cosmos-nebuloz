import { describe, expect, it } from "vitest";
import {
  computeEpicRebalanceMoves,
  type EpicForRebalance,
} from "../../lib/wsjf-rebalance";

function epic(overrides: Partial<EpicForRebalance>): EpicForRebalance {
  return {
    id: "e0",
    title: "Untitled",
    lifecycleStatus: "FUNNEL",
    order: 0,
    wsjf: 0,
    ...overrides,
  };
}

describe("computeEpicRebalanceMoves", () => {
  it("returns no moves when order already matches WSJF-desc rank", () => {
    const moves = computeEpicRebalanceMoves([
      epic({ id: "e1", order: 0, wsjf: 20 }),
      epic({ id: "e2", order: 1, wsjf: 10 }),
    ]);
    expect(moves).toHaveLength(0);
  });

  it("reports a move for every epic whose column-relative rank changes", () => {
    const moves = computeEpicRebalanceMoves([
      epic({ id: "e1", order: 0, wsjf: 10 }),
      epic({ id: "e2", order: 1, wsjf: 20 }),
    ]);
    expect(moves).toHaveLength(2);
    expect(moves.find((m) => m.id === "e2")).toMatchObject({
      fromRank: 2,
      toRank: 1,
      toOrder: 0,
    });
    expect(moves.find((m) => m.id === "e1")).toMatchObject({
      fromRank: 1,
      toRank: 2,
      toOrder: 1,
    });
  });

  it("ranks each lifecycle column independently — a low-WSJF epic in one column never displaces a high-WSJF epic in another", () => {
    const moves = computeEpicRebalanceMoves([
      epic({ id: "funnel-1", lifecycleStatus: "FUNNEL", order: 0, wsjf: 5 }),
      epic({ id: "done-1", lifecycleStatus: "DONE", order: 0, wsjf: 99 }),
    ]);
    // Each is already first (only occupant) of its own column — no global
    // reshuffle even though DONE's epic vastly outscores FUNNEL's.
    expect(moves).toHaveLength(0);
  });

  it("writes 0-based, column-relative order values, not a global rank", () => {
    const moves = computeEpicRebalanceMoves([
      epic({ id: "a", lifecycleStatus: "FUNNEL", order: 5, wsjf: 10 }),
      epic({ id: "b", lifecycleStatus: "DONE", order: 5, wsjf: 1 }),
    ]);
    const aMove = moves.find((m) => m.id === "a");
    const bMove = moves.find((m) => m.id === "b");
    // Both are the sole epic in their column, so each becomes order 0 in
    // its own column, independent of the other column's values.
    expect(aMove?.toOrder).toBe(0);
    expect(bMove?.toOrder).toBe(0);
  });

  it("treats a null wsjf as the lowest value (ranked last within its column)", () => {
    const moves = computeEpicRebalanceMoves([
      epic({ id: "scored", order: 1, wsjf: 5 }),
      epic({ id: "unscored", order: 0, wsjf: null }),
    ]);
    expect(moves.find((m) => m.id === "scored")).toMatchObject({
      toRank: 1,
      toOrder: 0,
    });
    expect(moves.find((m) => m.id === "unscored")).toMatchObject({
      toRank: 2,
      toOrder: 1,
    });
  });
});
