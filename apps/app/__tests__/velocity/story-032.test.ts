import { describe, expect, it } from "vitest";
import {
  anonymizeMetrics,
  HEATMAP_RED_THRESHOLD,
  HEATMAP_YELLOW_THRESHOLD,
  heatmapBand,
  type MemberMetrics,
} from "../../lib/velocity/heatmap";
import {
  computePredictability,
  isLowPredictability,
  LOW_PREDICTABILITY_CONSECUTIVE_PIS,
  LOW_PREDICTABILITY_THRESHOLD,
  type SprintReview,
} from "../../lib/velocity/predictability";
import {
  COST_INCREASE_THRESHOLD_PCT,
  calcConfidenceScore,
  calcCostPerPoint,
  isCostIncreasing,
} from "../../lib/velocity/roi";

// ─── Velocity predictability (AC-001) ────────────────────────────────────────

const mkSprint = (
  committedPoints: number,
  acceptedPoints: number
): SprintReview => ({ committedPoints, acceptedPoints });

describe("computePredictability (AC-001)", () => {
  it("returns null when all sprints have 0 committed", () => {
    expect(computePredictability([mkSprint(0, 10)])).toBeNull();
  });

  it("returns null for empty sprint list", () => {
    expect(computePredictability([])).toBeNull();
  });

  it("100% predictability when accepted == committed", () => {
    expect(computePredictability([mkSprint(10, 10)])).toBe(1);
  });

  it("calculates average across sprints with commitment", () => {
    // 1.0 + 0.5 = 0.75
    const result = computePredictability([mkSprint(10, 10), mkSprint(10, 5)]);
    expect(result).toBe(0.75);
  });

  it("skips sprints with 0 commitment in average", () => {
    const result = computePredictability([mkSprint(0, 5), mkSprint(10, 10)]);
    expect(result).toBe(1);
  });

  it("no division by zero for single zero-commitment sprint", () => {
    expect(() => computePredictability([mkSprint(0, 0)])).not.toThrow();
    expect(computePredictability([mkSprint(0, 0)])).toBeNull();
  });
});

describe("isLowPredictability (AC-002)", () => {
  it("LOW_PREDICTABILITY_THRESHOLD is 0.7", () => {
    expect(LOW_PREDICTABILITY_THRESHOLD).toBe(0.7);
  });

  it("LOW_PREDICTABILITY_CONSECUTIVE_PIS is 3", () => {
    expect(LOW_PREDICTABILITY_CONSECUTIVE_PIS).toBe(3);
  });

  it("false when fewer than 3 PIs", () => {
    expect(isLowPredictability([0.5, 0.6])).toBe(false);
  });

  it("true when last 3 PIs all < 70%", () => {
    expect(isLowPredictability([0.9, 0.6, 0.6, 0.6])).toBe(true);
  });

  it("false when last 3 include one >= 70%", () => {
    expect(isLowPredictability([0.6, 0.6, 0.7])).toBe(false);
  });

  it("false when nulls in last 3", () => {
    expect(isLowPredictability([null, 0.6, 0.6])).toBe(false);
  });
});

// ─── Capacity heatmap (AC-003) ────────────────────────────────────────────────

describe("heatmapBand (AC-003)", () => {
  it("HEATMAP_YELLOW_THRESHOLD is 1.0", () => {
    expect(HEATMAP_YELLOW_THRESHOLD).toBe(1.0);
  });

  it("HEATMAP_RED_THRESHOLD is 1.2", () => {
    expect(HEATMAP_RED_THRESHOLD).toBe(1.2);
  });

  it("green when allocated <= capacity", () => {
    expect(heatmapBand(80, 100)).toBe("green");
    expect(heatmapBand(100, 100)).toBe("green");
  });

  it("yellow when 100% < ratio <= 120%", () => {
    expect(heatmapBand(110, 100)).toBe("yellow");
    expect(heatmapBand(120, 100)).toBe("yellow");
  });

  it("red when ratio > 120%", () => {
    expect(heatmapBand(121, 100)).toBe("red");
    expect(heatmapBand(200, 100)).toBe("red");
  });

  it("red when capacity is 0", () => {
    expect(heatmapBand(50, 0)).toBe("red");
  });
});

describe("anonymizeMetrics (AC-004)", () => {
  const metrics: MemberMetrics = {
    throughput: 5,
    cycleTime: 3,
    defectRate: 0.1,
    standupCadence: 0.9,
    memberId: "user-123",
  };

  it("DEVELOPER gets anonymized metrics", () => {
    const result = anonymizeMetrics(metrics, "DEVELOPER");
    expect(result.throughput).toBe(0);
    expect(result.memberId).toBe("anonymous");
  });

  it("SM gets full metrics", () => {
    const result = anonymizeMetrics(metrics, "SCRUM_MASTER");
    expect(result.throughput).toBe(5);
    expect(result.memberId).toBe("user-123");
  });

  it("RTE gets full metrics", () => {
    const result = anonymizeMetrics(metrics, "RTE");
    expect(result.throughput).toBe(5);
  });
});

// ─── ROI hypothesis (AC-005) ─────────────────────────────────────────────────

describe("calcConfidenceScore (AC-005)", () => {
  it("returns null when total=0", () => {
    expect(calcConfidenceScore(0, 0)).toBeNull();
    expect(calcConfidenceScore(5, 0)).toBeNull();
  });

  it("returns ratio confirmed/total", () => {
    expect(calcConfidenceScore(3, 4)).toBe(0.75);
    expect(calcConfidenceScore(0, 5)).toBe(0);
    expect(calcConfidenceScore(5, 5)).toBe(1);
  });
});

describe("isCostIncreasing (AC-005)", () => {
  it("COST_INCREASE_THRESHOLD_PCT is 0.1", () => {
    expect(COST_INCREASE_THRESHOLD_PCT).toBe(0.1);
  });

  it("false for single element", () => {
    expect(isCostIncreasing([100])).toBe(false);
  });

  it("false for empty array", () => {
    expect(isCostIncreasing([])).toBe(false);
  });

  it("true when any period increases > 10%", () => {
    expect(isCostIncreasing([100, 115])).toBe(true);
  });

  it("false when all increases <= 10%", () => {
    expect(isCostIncreasing([100, 108, 115])).toBe(false);
  });

  it("false when decreasing", () => {
    expect(isCostIncreasing([200, 100, 50])).toBe(false);
  });
});

describe("calcCostPerPoint (AC-005)", () => {
  it("returns null when acceptedPoints=0", () => {
    expect(calcCostPerPoint(1000, 0)).toBeNull();
  });

  it("divides total spend by accepted points", () => {
    expect(calcCostPerPoint(1000, 10)).toBe(100);
  });
});
