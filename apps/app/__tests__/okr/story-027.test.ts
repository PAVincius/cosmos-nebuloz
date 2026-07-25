import { describe, expect, it } from "vitest";
import {
  calcKrProgress,
  calcProgress,
  detectThresholdCrossings,
  exceedsKrLimit,
  exceedsOkrLimit,
  isAtRisk,
  MAX_KEY_RESULTS_PER_OKR,
  MAX_OKRS_PER_QUARTER,
  THRESHOLD_MILESTONES,
} from "../../lib/okr/progress";

describe("calcKrProgress (AC-001)", () => {
  it("returns 0 for target=0", () => {
    expect(calcKrProgress(50, 0)).toBe(0);
  });

  it("returns 0 for negative target", () => {
    expect(calcKrProgress(10, -5)).toBe(0);
  });

  it("returns 50 for half completion", () => {
    expect(calcKrProgress(5, 10)).toBe(50);
  });

  it("caps at 100 for over-completion", () => {
    expect(calcKrProgress(15, 10)).toBe(100);
  });

  it("returns exactly 100 at target", () => {
    expect(calcKrProgress(10, 10)).toBe(100);
  });

  it("rounds correctly", () => {
    expect(calcKrProgress(1, 3)).toBe(33);
    expect(calcKrProgress(2, 3)).toBe(67);
  });
});

describe("calcProgress (AC-001)", () => {
  it("returns 0 for empty KR list", () => {
    expect(calcProgress([])).toBe(0);
  });

  it("returns 100 when all KRs at target", () => {
    expect(
      calcProgress([
        { current: 10, target: 10 },
        { current: 5, target: 5 },
      ])
    ).toBe(100);
  });

  it("returns avg of KR progresses", () => {
    // 50% + 100% = 75%
    expect(
      calcProgress([
        { current: 5, target: 10 },
        { current: 10, target: 10 },
      ])
    ).toBe(75);
  });

  it("caps over-completion at 100", () => {
    expect(calcProgress([{ current: 20, target: 10 }])).toBe(100);
  });

  it("target=0 treated as 0% progress (no division by zero)", () => {
    expect(calcProgress([{ current: 0, target: 0 }])).toBe(0);
  });
});

describe("isAtRisk (AC-002)", () => {
  it("at risk when projected < 85% of target", () => {
    expect(isAtRisk(60, 100)).toBe(true);
    expect(isAtRisk(84, 100)).toBe(true);
  });

  it("not at risk when projected >= 85% of target", () => {
    expect(isAtRisk(85, 100)).toBe(false);
    expect(isAtRisk(100, 100)).toBe(false);
  });

  it("at risk when target 50 and projected < 42.5", () => {
    expect(isAtRisk(40, 50)).toBe(true);
    expect(isAtRisk(43, 50)).toBe(false);
  });
});

describe("detectThresholdCrossings (AC-003)", () => {
  it("THRESHOLD_MILESTONES are 25/50/75/100", () => {
    expect([...THRESHOLD_MILESTONES]).toEqual([25, 50, 75, 100]);
  });

  it("detects single crossing", () => {
    expect(detectThresholdCrossings(20, 30)).toEqual([25]);
  });

  it("detects multiple crossings in one update", () => {
    expect(detectThresholdCrossings(0, 80)).toEqual([25, 50, 75]);
  });

  it("no crossing when already past threshold", () => {
    expect(detectThresholdCrossings(30, 40)).toEqual([]);
  });

  it("detects 100% crossing", () => {
    expect(detectThresholdCrossings(90, 100)).toEqual([100]);
  });

  it("no crossing when below threshold", () => {
    expect(detectThresholdCrossings(10, 20)).toEqual([]);
  });
});

describe("limit enforcement (AC-004)", () => {
  it("MAX_KEY_RESULTS_PER_OKR is 5", () => {
    expect(MAX_KEY_RESULTS_PER_OKR).toBe(5);
  });

  it("MAX_OKRS_PER_QUARTER is 10", () => {
    expect(MAX_OKRS_PER_QUARTER).toBe(10);
  });

  it("exceedsKrLimit: false at 5, true at 6", () => {
    expect(exceedsKrLimit(5)).toBe(false);
    expect(exceedsKrLimit(6)).toBe(true);
  });

  it("exceedsOkrLimit: false at 10, true at 11", () => {
    expect(exceedsOkrLimit(10)).toBe(false);
    expect(exceedsOkrLimit(11)).toBe(true);
  });
});
