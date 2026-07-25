import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  costSnapshotFindMany: vi.fn(),
  strategicThemeFindMany: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
}));
vi.mock("@repo/database", () => ({
  database: {
    costSnapshot: {
      findMany: mocks.costSnapshotFindMany,
    },
    strategicTheme: {
      findMany: mocks.strategicThemeFindMany,
    },
  },
}));

import { getBudgetOverview } from "../../../app/actions/billing/snapshots";

const TENANT_ID = "tenant-test";
const NOW = new Date("2025-01-15T00:00:00Z");
const START = new Date("2025-01-01T00:00:00Z");
const END = new Date("2025-01-31T00:00:00Z");

const makeSnapshot = (
  overrides: Partial<{
    themeId: string | null;
    actualCost: number | string;
    cloudCost: number | string;
    unmappedAmount: number | string;
    plannedCost: number | string | null;
    period: Date;
  }> = {}
) => ({
  themeId: "theme-1",
  actualCost: 100,
  cloudCost: 50,
  unmappedAmount: 10,
  plannedCost: 200,
  period: NOW,
  ...overrides,
});

describe("getBudgetOverview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({
      tenantId: TENANT_ID,
      userId: "user-1",
    });
    mocks.costSnapshotFindMany.mockResolvedValue([]);
    mocks.strategicThemeFindMany.mockResolvedValue([]);
  });

  it("returns ok:true with empty array when no snapshots exist", async () => {
    const result = await getBudgetOverview({
      granularity: "MONTHLY",
      periodStart: START,
      periodEnd: END,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected ok");
    expect(result.data).toEqual([]);
  });

  it("queries snapshots scoped to the authenticated tenantId", async () => {
    await getBudgetOverview({
      granularity: "MONTHLY",
      periodStart: START,
      periodEnd: END,
    });

    expect(mocks.costSnapshotFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: TENANT_ID }),
      })
    );
  });

  it("aggregates multiple snapshots for the same theme", async () => {
    mocks.costSnapshotFindMany.mockResolvedValue([
      makeSnapshot({
        themeId: "theme-1",
        actualCost: 100,
        cloudCost: 50,
        unmappedAmount: 10,
        plannedCost: 200,
      }),
      makeSnapshot({
        themeId: "theme-1",
        actualCost: 50,
        cloudCost: 20,
        unmappedAmount: 5,
        plannedCost: 100,
      }),
    ]);
    mocks.strategicThemeFindMany.mockResolvedValue([
      { id: "theme-1", title: "Platform" },
    ]);

    const result = await getBudgetOverview({
      granularity: "MONTHLY",
      periodStart: START,
      periodEnd: END,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected ok");
    expect(result.data).toHaveLength(1);
    expect(result.data![0]).toMatchObject({
      themeId: "theme-1",
      themeName: "Platform",
      actualCost: 150,
      cloudCost: 70,
      unmappedAmount: 15,
      plannedCost: 300,
    });
  });

  it("enriches items with theme names from strategicTheme", async () => {
    mocks.costSnapshotFindMany.mockResolvedValue([
      makeSnapshot({ themeId: "theme-42" }),
    ]);
    mocks.strategicThemeFindMany.mockResolvedValue([
      { id: "theme-42", title: "AI Platform" },
    ]);

    const result = await getBudgetOverview({
      granularity: "DAILY",
      periodStart: START,
      periodEnd: END,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected ok");
    expect(result.data![0].themeName).toBe("AI Platform");
  });

  it("handles snapshots with null themeId (unmapped costs)", async () => {
    mocks.costSnapshotFindMany.mockResolvedValue([
      makeSnapshot({
        themeId: null,
        actualCost: 75,
        cloudCost: 30,
        unmappedAmount: 75,
        plannedCost: null,
      }),
    ]);

    const result = await getBudgetOverview({
      granularity: "MONTHLY",
      periodStart: START,
      periodEnd: END,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected ok");
    expect(result.data![0]).toMatchObject({
      themeId: null,
      themeName: null,
      actualCost: 75,
      plannedCost: 0,
    });
  });

  it("returns ok:false when requireTenantSession throws", async () => {
    mocks.requireTenantSession.mockRejectedValue(new Error("UNAUTHORIZED"));

    const result = await getBudgetOverview({
      granularity: "MONTHLY",
      periodStart: START,
      periodEnd: END,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected error");
    expect(result.error).toContain("UNAUTHORIZED");
  });
});
