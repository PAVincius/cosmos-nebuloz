import { beforeEach, describe, expect, it, vi } from "vitest";
import { tenantCtx } from "../../helpers/action-mocks";

// ─── Pure function tests (no mocks needed) ────────────────────────────────────

import {
  computeBenchmarkComparisons,
  computeWeightedAverage,
  detectCycleTimeOutliers,
  monteCarloForecast,
} from "../../../lib/analytics/monte-carlo";

describe("monteCarloForecast (AC-004)", () => {
  const throughput = [12, 14, 11, 13, 15, 12, 14, 11];

  it("returns 4 percentile results (AC-004)", () => {
    const result = monteCarloForecast(throughput, 50, 1000);
    expect(result).toHaveProperty("p50");
    expect(result).toHaveProperty("p70");
    expect(result).toHaveProperty("p85");
    expect(result).toHaveProperty("p95");
  });

  it("p50 <= p70 <= p85 <= p95 (monotone) (AC-004)", () => {
    const result = monteCarloForecast(throughput, 50, 1000);
    expect(result.p50).toBeLessThanOrEqual(result.p70);
    expect(result.p70).toBeLessThanOrEqual(result.p85);
    expect(result.p85).toBeLessThanOrEqual(result.p95);
  });

  it("p50 is in reasonable range for 50 items at avg~13 throughput (AC-004)", () => {
    // 50/13 ≈ 3.8 sprints, so p50 should be around 4
    const result = monteCarloForecast(throughput, 50, 2000);
    expect(result.p50).toBeGreaterThanOrEqual(3);
    expect(result.p50).toBeLessThanOrEqual(6);
  });

  it("throws on empty throughput (AC-004)", () => {
    expect(() => monteCarloForecast([], 50)).toThrow("INSUFFICIENT_DATA");
  });
});

describe("computeWeightedAverage (AC-002)", () => {
  it("computes weighted average for ART teams (AC-002)", () => {
    // Team A: cycleTime=5d, weight=5 members
    // Team B: cycleTime=8d, weight=8 members
    // Weighted: (5×5 + 8×8) / 13 = (25 + 64) / 13 = 89/13 ≈ 6.846
    const result = computeWeightedAverage([
      { value: 5, weight: 5 },
      { value: 8, weight: 8 },
    ]);
    expect(result).toBeCloseTo(6.846, 2);
  });

  it("returns 0 for empty input (AC-002)", () => {
    expect(computeWeightedAverage([])).toBe(0);
  });

  it("returns the single value for single-item input (AC-002)", () => {
    expect(computeWeightedAverage([{ value: 4.2, weight: 3 }])).toBeCloseTo(
      4.2,
      5
    );
  });
});

describe("detectCycleTimeOutliers (AC-003)", () => {
  it("identifies outliers above median + 2×IQR (AC-003)", () => {
    const cycleTimes = [1, 2, 2, 3, 3, 3, 4, 4, 5, 20]; // 20 is an outlier
    const result = detectCycleTimeOutliers(cycleTimes);

    expect(result.outlierIndices).toContain(9); // index of 20
    expect(result.median).toBeCloseTo(3, 0);
    expect(result.iqr).toBeGreaterThan(0);
  });

  it("returns empty outlierIndices for uniform data (AC-003)", () => {
    const cycleTimes = [5, 5, 5, 5, 5];
    const result = detectCycleTimeOutliers(cycleTimes);
    expect(result.outlierIndices).toHaveLength(0);
  });

  it("handles single element (AC-003)", () => {
    const result = detectCycleTimeOutliers([3]);
    expect(result.median).toBe(3);
    expect(result.outlierIndices).toHaveLength(0);
  });
});

describe("computeBenchmarkComparisons (AC-007)", () => {
  it("flags RED for > 20% cycle time increase (AC-007)", () => {
    const result = computeBenchmarkComparisons([
      { teamId: "t1", priorCycleTime: 5, currentCycleTime: 7 }, // +40%
      { teamId: "t2", priorCycleTime: 5, currentCycleTime: 5.5 }, // +10% → NEUTRAL
    ]);

    const t1 = result.find((r) => r.teamId === "t1")!;
    const t2 = result.find((r) => r.teamId === "t2")!;

    expect(t1.status).toBe("RED");
    expect(t2.status).toBe("NEUTRAL");
  });

  it("flags GREEN for > 10% improvement (AC-007)", () => {
    const result = computeBenchmarkComparisons([
      { teamId: "t1", priorCycleTime: 5, currentCycleTime: 4 }, // -20%
    ]);
    expect(result[0].status).toBe("GREEN");
  });
});

// ─── getForecast (server action) ──────────────────────────────────────────────

const actionMocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  sprintFindMany: vi.fn(),
  redisGet: vi.fn(),
  redisSet: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: actionMocks.headers }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: actionMocks.requireTenantSession,
}));
vi.mock("@repo/database", () => ({
  database: {
    sprint: { findMany: actionMocks.sprintFindMany },
    flowMetricSnapshot: { findFirst: vi.fn().mockResolvedValue(null) },
  },
}));
vi.mock("@repo/rate-limit", () => ({
  redis: { get: actionMocks.redisGet, set: actionMocks.redisSet },
}));

import { getForecast } from "../../../app/actions/analytics/flowMetrics";

describe("getForecast (AC-004)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actionMocks.headers.mockResolvedValue(new Headers());
    actionMocks.requireTenantSession.mockResolvedValue(tenantCtx);
    actionMocks.redisGet.mockResolvedValue(null);
    actionMocks.redisSet.mockResolvedValue("OK");
  });

  it("returns forecast from historical sprints (AC-004)", async () => {
    actionMocks.sprintFindMany.mockResolvedValue([
      { velocity: 12 },
      { velocity: 14 },
      { velocity: 11 },
      { velocity: 13 },
    ]);

    const result = await getForecast({
      teamId: "team-1",
      remainingItems: 50,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.p50).toBeGreaterThan(0);
    expect(result.data.fromCache).toBe(false);
    expect(actionMocks.redisSet).toHaveBeenCalled();
  });

  it("returns from cache when available (AC-004)", async () => {
    actionMocks.sprintFindMany.mockResolvedValue([{ velocity: 12 }]);
    actionMocks.redisGet.mockResolvedValue({ p50: 4, p70: 5, p85: 6, p95: 7 });

    const result = await getForecast({
      teamId: "team-1",
      remainingItems: 50,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.fromCache).toBe(true);
    expect(result.data.p50).toBe(4);
  });

  it("errors with no sprint history (AC-004)", async () => {
    actionMocks.sprintFindMany.mockResolvedValue([]);

    const result = await getForecast({
      teamId: "team-1",
      remainingItems: 50,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("INSUFFICIENT_DATA");
  });
});
