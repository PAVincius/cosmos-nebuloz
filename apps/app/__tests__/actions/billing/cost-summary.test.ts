// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("@repo/auth/server", () => ({
  requireTenantSession: vi.fn().mockResolvedValue({ tenantId: "t1" }),
}));
vi.mock("next/headers", () => ({ headers: vi.fn().mockResolvedValue({}) }));
vi.mock("@repo/database", () => ({
  database: {
    billingEntry: {
      groupBy: vi.fn().mockResolvedValue([
        { themeId: "theme-1", _sum: { effectiveCost: "1200.50" } },
        { themeId: null, _sum: { effectiveCost: "300.00" } },
      ]),
      findMany: vi.fn().mockResolvedValue([]),
      aggregate: vi
        .fn()
        .mockResolvedValue({ _sum: { effectiveCost: "5432.10" } }),
    },
    strategicTheme: {
      findMany: vi
        .fn()
        .mockResolvedValue([{ id: "theme-1", title: "Cloud Modernization" }]),
    },
    epic: {
      findFirst: vi
        .fn()
        .mockResolvedValue({ id: "epic-1", strategicThemeId: "theme-1" }),
    },
  },
}));

import {
  costSummaryByTheme,
  costTrendByMonth,
} from "@/app/actions/billing/cost-summary";
import { getEpicCost } from "@/app/actions/billing/epic-cost";

describe("costSummaryByTheme", () => {
  it("returns mapped and unmapped costs", async () => {
    const result = await costSummaryByTheme();
    expect(result.mapped).toHaveLength(1);
    expect(result.mapped[0].themeName).toBe("Cloud Modernization");
    expect(result.mapped[0].cost).toBeCloseTo(1200.5);
    expect(result.unmappedCost).toBeCloseTo(300.0);
    expect(result.unmappedPct).toBeGreaterThan(0);
  });

  it("sets totalCost as sum of all entries", async () => {
    const result = await costSummaryByTheme();
    expect(result.totalCost).toBeCloseTo(1500.5);
    expect(result.currency).toBe("USD");
  });

  it("sorts mapped rows by cost descending", async () => {
    const result = await costSummaryByTheme();
    const costs = result.mapped.map((r) => r.cost);
    const sorted = [...costs].sort((a, b) => b - a);
    expect(costs).toEqual(sorted);
  });

  it("computes pct correctly", async () => {
    const result = await costSummaryByTheme();
    const total = result.totalCost;
    for (const row of result.mapped) {
      const expected = Math.round((row.cost / total) * 100);
      expect(row.pct).toBe(expected);
    }
  });
});

describe("costTrendByMonth", () => {
  it("returns empty array when no entries", async () => {
    const result = await costTrendByMonth(6);
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("getEpicCost", () => {
  it("returns cost for epic via theme mapping", async () => {
    const result = await getEpicCost("epic-1");
    expect(result.totalCost).toBeCloseTo(5432.1);
    expect(result.hasMapping).toBe(true);
    expect(result.currency).toBe("USD");
    expect(result.epicId).toBe("epic-1");
  });

  it("returns hasMapping false when epic has no themeId", async () => {
    const { database } = await import("@repo/database");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(database.epic.findFirst).mockResolvedValueOnce({
      id: "epic-2",
    } as any);
    const result = await getEpicCost("epic-2");
    expect(result.hasMapping).toBe(false);
    expect(result.totalCost).toBe(0);
  });
});
