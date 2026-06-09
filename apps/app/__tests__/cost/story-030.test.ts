import { describe, expect, it } from "vitest";
import {
  ANOMALY_VARIANCE_THRESHOLD,
  anomalySeverity,
  calcDailyBaseline,
  calcVariancePct,
  HIGH_SEVERITY_THRESHOLD,
  isAnomaly,
} from "../../lib/cost/anomaly";
import {
  BUDGET_THRESHOLDS,
  calcUtilization,
  findNewCrossings,
  hasThresholdBeenCrossed,
  recordCrossings,
} from "../../lib/cost/hysteresis";

// ─── Cost anomaly detection (AC-001) ─────────────────────────────────────────

describe("calcVariancePct (AC-001)", () => {
  it("returns 0 for baseline=0", () => {
    expect(calcVariancePct(100, 0)).toBe(0);
  });

  it("100% variance when latest = 2× baseline", () => {
    expect(calcVariancePct(200, 100)).toBe(100);
  });

  it("200% variance when latest = 3× baseline", () => {
    expect(calcVariancePct(300, 100)).toBe(200);
  });

  it("negative variance when latest < baseline", () => {
    expect(calcVariancePct(50, 100)).toBe(-50);
  });
});

describe("isAnomaly (AC-001)", () => {
  it("ANOMALY_VARIANCE_THRESHOLD is 100", () => {
    expect(ANOMALY_VARIANCE_THRESHOLD).toBe(100);
  });

  it("not anomaly at exactly 100%", () => {
    expect(isAnomaly(100)).toBe(false);
  });

  it("anomaly above 100%", () => {
    expect(isAnomaly(101)).toBe(true);
    expect(isAnomaly(250)).toBe(true);
  });
});

describe("anomalySeverity (AC-001)", () => {
  it("HIGH_SEVERITY_THRESHOLD is 200", () => {
    expect(HIGH_SEVERITY_THRESHOLD).toBe(200);
  });

  it("null for non-anomaly", () => {
    expect(anomalySeverity(50)).toBeNull();
    expect(anomalySeverity(100)).toBeNull();
  });

  it("MEDIUM for variance 101-200", () => {
    expect(anomalySeverity(150)).toBe("MEDIUM");
    expect(anomalySeverity(200)).toBe("MEDIUM");
  });

  it("HIGH for variance > 200", () => {
    expect(anomalySeverity(201)).toBe("HIGH");
    expect(anomalySeverity(500)).toBe("HIGH");
  });
});

describe("calcDailyBaseline (AC-001)", () => {
  it("returns 0 for dayCount=0", () => {
    expect(calcDailyBaseline(1000, 0)).toBe(0);
  });

  it("divides total by days", () => {
    expect(calcDailyBaseline(1400, 14)).toBe(100);
  });
});

// ─── Budget hysteresis (AC-002) ───────────────────────────────────────────────

describe("calcUtilization (AC-002)", () => {
  it("returns 0 when totalAmount=0", () => {
    expect(calcUtilization(500, 0)).toBe(0);
  });

  it("calculates percentage correctly", () => {
    expect(calcUtilization(70, 100)).toBe(70);
    expect(calcUtilization(100, 100)).toBe(100);
  });
});

describe("findNewCrossings (AC-002)", () => {
  it("BUDGET_THRESHOLDS are 70/90/100", () => {
    expect([...BUDGET_THRESHOLDS]).toEqual([70, 90, 100]);
  });

  it("finds all uncrossed thresholds at high utilization", () => {
    expect(findNewCrossings(100, {})).toEqual([70, 90, 100]);
  });

  it("skips already crossed thresholds", () => {
    const crossed = { 70: "2026-01-01" };
    expect(findNewCrossings(100, crossed)).toEqual([90, 100]);
  });

  it("no crossings when below lowest threshold", () => {
    expect(findNewCrossings(65, {})).toEqual([]);
  });

  it("only crosses thresholds at or below utilization", () => {
    expect(findNewCrossings(75, {})).toEqual([70]);
  });
});

describe("recordCrossings (AC-002)", () => {
  it("immutably records crossings with timestamp", () => {
    const original = {};
    const updated = recordCrossings(original, [70, 90], "2026-06-09");
    expect(updated[70]).toBe("2026-06-09");
    expect(updated[90]).toBe("2026-06-09");
    expect(original).toEqual({});
  });
});

describe("hasThresholdBeenCrossed (AC-002)", () => {
  it("false when not crossed", () => {
    expect(hasThresholdBeenCrossed({}, 70)).toBe(false);
  });

  it("true when crossed", () => {
    expect(hasThresholdBeenCrossed({ 70: "2026-06-09" }, 70)).toBe(true);
  });
});
