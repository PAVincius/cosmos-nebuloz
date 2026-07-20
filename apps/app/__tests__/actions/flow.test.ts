import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: vi.fn().mockResolvedValue({ tenantId: "t1" }),
}));
vi.mock("@repo/database", () => ({
  database: {
    flowMetricSnapshot: {
      findFirst: vi.fn().mockResolvedValue({
        flowDistribution: { story: 54, defect: 19 },
        flowVelocityTotal: 71,
        flowTimeAvgHours: 200.4,
        flowLoadCurrent: 31,
        flowEfficiency: 0.42,
        flowPredictability: 0.87,
        recordedAt: new Date("2026-02-01"),
      }),
    },
  },
}));

import { database } from "@repo/database";
import { getLatestFlowMetrics } from "../../app/(cosmos)/actions/flow";

describe("getLatestFlowMetrics", () => {
  it("returns the tenant-scoped most recent snapshot", async () => {
    const r = await getLatestFlowMetrics();
    expect(r.ok).toBe(true);
    expect(database.flowMetricSnapshot.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "t1" },
        orderBy: { recordedAt: "desc" },
      })
    );
    if (r.ok) {
      expect(r.data?.flowVelocityTotal).toBe(71);
      expect(typeof r.data?.recordedAt).toBe("string");
    }
  });
});
