import { describe, expect, it } from "vitest";
import {
  DEFAULT_SENSITIVITY_THRESHOLD,
  detectCostAnomaly,
  MIN_HISTORY_POINTS,
  median,
  medianAbsoluteDeviation,
  modifiedZScore,
} from "../../lib/cost/anomaly-detection";

describe("median", () => {
  it("returns the middle value for an odd-length series", () => {
    expect(median([1, 3, 2])).toBe(2);
  });

  it("averages the two middle values for an even-length series", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it("returns 0 for an empty series", () => {
    expect(median([])).toBe(0);
  });
});

describe("medianAbsoluteDeviation", () => {
  it("computes MAD around a given center", () => {
    // series [1,1,2,2,4,6,9], median=2, |x-2|=[1,1,0,0,2,4,7], median=1
    expect(medianAbsoluteDeviation([1, 1, 2, 2, 4, 6, 9], 2)).toBe(1);
  });
});

describe("modifiedZScore", () => {
  it("applies the 0.6745 Iglewicz & Hoaglin constant", () => {
    // z = 0.6745 * (10 - 5) / 2 = 1.68625
    expect(modifiedZScore(10, 5, 2)).toBeCloseTo(1.686_25, 5);
  });

  it("returns 0 when MAD is 0 (avoids divide-by-zero)", () => {
    expect(modifiedZScore(10, 5, 0)).toBe(0);
  });
});

describe("detectCostAnomaly — known series", () => {
  // History: stable ~$1000/mo with light noise. Current: a clear spike.
  // median=997.5, MAD=7.5 (worked out by hand from the sorted series).
  const history = [980, 1010, 990, 1000, 1005, 995];

  it("computes median/MAD/z-score/severity for a known spike", () => {
    const result = detectCostAnomaly({ current: 4000, history });
    expect(result).not.toBeNull();
    if (!result) {
      return;
    }
    expect(result.median).toBe(997.5);
    expect(result.mad).toBeCloseTo(7.5, 5);
    expect(result.actual).toBe(4000);
    // z = 0.6745 * (4000 - 997.5) / 7.5 = 270.0248...
    expect(result.modifiedZScore).toBeCloseTo(270.0248, 3);
    expect(result.deltaAbs).toBeCloseTo(3002.5, 5);
    expect(result.deltaPct).toBeCloseTo(301.0025, 2);
    expect(result.severity).toBe("CRITICAL");
  });

  it("returns null when the series is within the default threshold", () => {
    const result = detectCostAnomaly({ current: 1002, history });
    expect(result).toBeNull();
  });
});

describe("detectCostAnomaly — threshold behavior", () => {
  // median=100, MAD=1 (worked out by hand: deviations [0,0,2,2,1,1] -> median 1).
  const series = [100, 100, 102, 98, 101, 99];

  it("uses DEFAULT_SENSITIVITY_THRESHOLD (3.5) when no threshold is passed", () => {
    expect(DEFAULT_SENSITIVITY_THRESHOLD).toBe(3.5);
    // z = 0.6745*(105-100)/1 = 3.3725 -> below 3.5, not flagged
    expect(detectCostAnomaly({ current: 105, history: series })).toBeNull();
    // z = 0.6745*(115-100)/1 = 10.1175 -> above 3.5, flagged
    expect(detectCostAnomaly({ current: 115, history: series })).not.toBeNull();
  });

  it("honors a custom (more sensitive) threshold override", () => {
    // z for current=105 is 3.3725; a threshold of 2 flags it, the default doesn't.
    expect(
      detectCostAnomaly({ current: 105, history: series, threshold: 2 })
    ).not.toBeNull();
    expect(detectCostAnomaly({ current: 105, history: series })).toBeNull();
  });
});

describe("detectCostAnomaly — insufficient history", () => {
  it("returns null with fewer than MIN_HISTORY_POINTS entries (never fabricates a baseline)", () => {
    expect(MIN_HISTORY_POINTS).toBe(4);
    const result = detectCostAnomaly({
      current: 5000,
      history: [1000, 1000, 1000], // 3 points, below MIN_HISTORY_POINTS
    });
    expect(result).toBeNull();
  });

  it("returns null for an empty history", () => {
    expect(detectCostAnomaly({ current: 5000, history: [] })).toBeNull();
  });
});

describe("detectCostAnomaly — zero-variance baseline", () => {
  it("returns null rather than an infinite/fabricated z-score when MAD is 0", () => {
    const result = detectCostAnomaly({
      current: 5000,
      history: [1000, 1000, 1000, 1000],
    });
    expect(result).toBeNull();
  });
});

describe("detectCostAnomaly — severity bands", () => {
  // median=100, MAD=5 (deviations [10,0,0,10] -> median 5).
  const history = [90, 100, 100, 110];

  it("LOW just above a lowered threshold", () => {
    // z = 0.6745*(122-100)/5 = 2.9678 -> in [2, 5) => LOW
    const result = detectCostAnomaly({
      current: 122,
      history,
      threshold: 2,
    });
    expect(result?.severity).toBe("LOW");
  });

  it("HIGH for a z-score in [7, 10)", () => {
    // z = 0.6745*(159-100)/5 = 7.9591 -> HIGH
    const result = detectCostAnomaly({ current: 159, history });
    expect(result?.severity).toBe("HIGH");
  });

  it("CRITICAL for a z-score >= 10", () => {
    // z = 0.6745*(1000-100)/5 = 121.41 -> CRITICAL
    const result = detectCostAnomaly({ current: 1000, history });
    expect(result?.severity).toBe("CRITICAL");
  });
});
