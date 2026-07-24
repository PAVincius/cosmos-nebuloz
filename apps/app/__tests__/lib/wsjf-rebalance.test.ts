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
    const { moves, skippedUnscored } = computeEpicRebalanceMoves([
      epic({ id: "e1", order: 0, wsjf: 20 }),
      epic({ id: "e2", order: 1, wsjf: 10 }),
    ]);
    expect(moves).toHaveLength(0);
    expect(skippedUnscored).toBe(0);
  });

  it("reports a move for every epic whose column-relative rank changes", () => {
    const { moves } = computeEpicRebalanceMoves([
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
    const { moves } = computeEpicRebalanceMoves([
      epic({ id: "funnel-1", lifecycleStatus: "FUNNEL", order: 0, wsjf: 5 }),
      epic({ id: "done-1", lifecycleStatus: "DONE", order: 0, wsjf: 99 }),
    ]);
    // Each is already first (only occupant) of its own column — no global
    // reshuffle even though DONE's epic vastly outscores FUNNEL's.
    expect(moves).toHaveLength(0);
  });

  it("writes column-relative order values, not a global rank", () => {
    const { moves } = computeEpicRebalanceMoves([
      epic({ id: "a1", lifecycleStatus: "FUNNEL", order: 0, wsjf: 1 }),
      epic({ id: "a2", lifecycleStatus: "FUNNEL", order: 1, wsjf: 10 }),
      epic({ id: "b1", lifecycleStatus: "DONE", order: 0, wsjf: 1 }),
      epic({ id: "b2", lifecycleStatus: "DONE", order: 1, wsjf: 99 }),
    ]);
    // Each column independently promotes its higher-WSJF epic to order 0 —
    // FUNNEL's outcome doesn't leak into DONE's order-value space or
    // vice versa.
    expect(moves.find((m) => m.id === "a2")?.toOrder).toBe(0);
    expect(moves.find((m) => m.id === "a1")?.toOrder).toBe(1);
    expect(moves.find((m) => m.id === "b2")?.toOrder).toBe(0);
    expect(moves.find((m) => m.id === "b1")?.toOrder).toBe(1);
  });

  // ─── H2: unscored (wsjf === null) epics must never be ranked ────────────

  it("produces zero moves for a column where every epic is unscored, and reports them as skipped", () => {
    const { moves, skippedUnscored } = computeEpicRebalanceMoves([
      epic({ id: "e1", order: 0, wsjf: null }),
      epic({ id: "e2", order: 1, wsjf: null }),
      epic({ id: "e3", order: 2, wsjf: null }),
    ]);
    expect(moves).toHaveLength(0);
    expect(skippedUnscored).toBe(3);
  });

  it("reorders only the scored epics in a mixed column and leaves unscored epics' order untouched", () => {
    // Column has 4 epics; e2 and e4 have never been scored (wsjf null) and
    // must keep exactly their current order. Only e1/e3 (scored) may move,
    // and only among the order VALUES the scored epics already occupy (1
    // and 3), so the unscored epics at 0 and 2 are never touched or
    // collided with.
    const { moves, skippedUnscored } = computeEpicRebalanceMoves([
      epic({ id: "e2-unscored", order: 0, wsjf: null }),
      epic({ id: "e1-low", order: 1, wsjf: 5 }),
      epic({ id: "e4-unscored", order: 2, wsjf: null }),
      epic({ id: "e3-high", order: 3, wsjf: 50 }),
    ]);

    expect(skippedUnscored).toBe(2);
    expect(moves.find((m) => m.id === "e2-unscored")).toBeUndefined();
    expect(moves.find((m) => m.id === "e4-unscored")).toBeUndefined();

    // e3-high outranks e1-low, so they swap the two slots scored epics
    // occupy (1 and 3) — e3-high takes the lower of the two (1), e1-low
    // the higher (3). The unscored epics' values (0, 2) never appear here.
    const e3Move = moves.find((m) => m.id === "e3-high");
    const e1Move = moves.find((m) => m.id === "e1-low");
    expect(e3Move).toMatchObject({ toOrder: 1 });
    expect(e1Move).toMatchObject({ toOrder: 3 });
  });

  it("does not rebalance a column with fewer than two scored epics", () => {
    const { moves, skippedUnscored } = computeEpicRebalanceMoves([
      epic({ id: "e1", order: 0, wsjf: 10 }),
      epic({ id: "e2", order: 1, wsjf: null }),
    ]);
    expect(moves).toHaveLength(0);
    expect(skippedUnscored).toBe(1);
  });

  it("treats a stored wsjf of 0 as a real (if minimal) score, not as unscored", () => {
    // computeEpicWsjf (kanban.ts) only ever returns a number when all four
    // components are supplied — a stored 0 means bv=tc=rr=0 was
    // deliberately entered, never "not yet scored" (the DB default is
    // null). It must therefore rank normally, not be excluded.
    const { moves, skippedUnscored } = computeEpicRebalanceMoves([
      epic({ id: "positive", order: 0, wsjf: 10 }),
      epic({ id: "zero", order: 1, wsjf: 0 }),
    ]);
    expect(skippedUnscored).toBe(0);
    expect(moves).toHaveLength(0); // already in the right order: positive first
  });
});
