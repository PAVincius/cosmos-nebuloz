import { describe, expect, it } from "vitest";
import { crossedThresholds } from "../../../app/actions/okrs/threshold-logic";

describe("crossedThresholds — pure threshold crossing logic", () => {
  it("detects single threshold crossing (74% → 76% crosses 75%)", () => {
    expect(crossedThresholds(74, 76, 100)).toEqual([75]);
  });

  it("returns empty when no threshold crossed (76% → 80%)", () => {
    expect(crossedThresholds(76, 80, 100)).toEqual([]);
  });

  it("detects multiple thresholds crossed in one update (40% → 80% crosses 50% and 75%)", () => {
    expect(crossedThresholds(40, 80, 100)).toEqual([50, 75]);
  });

  it("detects 100% threshold", () => {
    expect(crossedThresholds(90, 100, 100)).toEqual([100]);
  });

  it("detects all four thresholds (0% → 100%)", () => {
    expect(crossedThresholds(0, 100, 100)).toEqual([25, 50, 75, 100]);
  });

  it("returns empty when target is 0 (guard against division by zero)", () => {
    expect(crossedThresholds(0, 5, 0)).toEqual([]);
  });

  it("returns empty when value stays below first threshold (10% → 20%)", () => {
    expect(crossedThresholds(10, 20, 100)).toEqual([]);
  });

  it("does not fire when prevValue exactly equals threshold (75% → 80% stays at 75 boundary)", () => {
    // prev=75 means prevPct=75, which is NOT < 75, so no crossing
    expect(crossedThresholds(75, 80, 100)).toEqual([]);
  });

  it("works with non-percent units (deploys/day: 8 → 12 with target=10 crosses 100%)", () => {
    // prev=80%, new=120% — crosses 100%
    expect(crossedThresholds(8, 12, 10)).toEqual([100]);
  });
});
