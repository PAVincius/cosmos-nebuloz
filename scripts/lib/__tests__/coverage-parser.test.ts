import { describe, expect, it } from "vitest";
import { computeRiskScore, parseCoverage } from "../coverage-parser.js";

describe("computeRiskScore", () => {
  it("returns 0 when importCount is 0", () => {
    expect(computeRiskScore(0, 20, 5)).toBe(0);
  });

  it("returns 0 when all lines are covered", () => {
    expect(computeRiskScore(10, 20, 20)).toBe(0);
  });

  it("returns higher score for more imports and more uncovered lines", () => {
    const highRisk = computeRiskScore(20, 20, 4);
    const lowRisk = computeRiskScore(2, 20, 18);
    expect(highRisk).toBeGreaterThan(lowRisk);
  });

  it("score doubles when imports double", () => {
    const s1 = computeRiskScore(5, 20, 10);
    const s2 = computeRiskScore(10, 20, 10);
    expect(s2).toBeCloseTo(s1 * 2, 5);
  });
});

describe("parseCoverage", () => {
  it("returns empty array when no coverage files exist", () => {
    const result = parseCoverage("/nonexistent-dir-12345");
    expect(result).toEqual([]);
  });

  it("returns an array", () => {
    const result = parseCoverage(process.cwd());
    expect(Array.isArray(result)).toBe(true);
  });

  it("returns at most 5 files", () => {
    const result = parseCoverage(process.cwd());
    expect(result.length).toBeLessThanOrEqual(5);
  });
});
