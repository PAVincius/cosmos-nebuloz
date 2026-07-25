import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: vi.fn().mockResolvedValue({ tenantId: "t1" }),
}));
vi.mock("@repo/database", () => ({
  database: {
    costSnapshot: {
      aggregate: vi
        .fn()
        .mockResolvedValueOnce({ _sum: { cloudCost: 48_200 } })
        .mockResolvedValueOnce({ _sum: { cloudCost: 43_000 } }),
    },
    costAnomaly: {
      count: vi.fn().mockResolvedValue(2),
    },
  },
}));

import { database } from "@repo/database";
import { getCloudCostSummary } from "../../app/(cosmos)/actions/finops";

describe("getCloudCostSummary", () => {
  it("returns tenant-scoped current/previous month cloud cost and open anomaly count", async () => {
    const r = await getCloudCostSummary();
    expect(r.ok).toBe(true);
    expect(database.costSnapshot.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "t1",
          granularity: "DAILY",
        }),
        _sum: { cloudCost: true },
      })
    );
    expect(database.costAnomaly.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "t1", status: "OPEN" },
      })
    );
    if (r.ok) {
      expect(r.data.currentMonthCostUsd).toBe(48_200);
      expect(r.data.previousMonthCostUsd).toBe(43_000);
      expect(r.data.deltaPct).toBe(12);
      expect(r.data.openAnomalyCount).toBe(2);
    }
  });

  it("returns null costs when no CostSnapshot rows exist for the period", async () => {
    (database.costSnapshot.aggregate as ReturnType<typeof vi.fn>)
      .mockReset()
      .mockResolvedValue({ _sum: { cloudCost: null } });
    (database.costAnomaly.count as ReturnType<typeof vi.fn>).mockResolvedValue(
      0
    );

    const r = await getCloudCostSummary();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.currentMonthCostUsd).toBeNull();
      expect(r.data.deltaPct).toBeNull();
      expect(r.data.openAnomalyCount).toBe(0);
    }
  });
});
