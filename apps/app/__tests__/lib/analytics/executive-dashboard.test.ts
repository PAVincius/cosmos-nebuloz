import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  artFindMany: vi.fn(),
  flowMetricSnapshotFindMany: vi.fn(),
  anomalyFindMany: vi.fn(),
  retroActionItemFindMany: vi.fn(),
}));

vi.mock("@repo/database", () => ({
  database: {
    aRT: { findMany: mocks.artFindMany },
    flowMetricSnapshot: { findMany: mocks.flowMetricSnapshotFindMany },
    anomaly: { findMany: mocks.anomalyFindMany },
    retroActionItem: { findMany: mocks.retroActionItemFindMany },
  },
}));

import { buildExecutiveDashboardData } from "../../../lib/analytics/executive-dashboard";

const TENANT_ID = "tenant-a";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.artFindMany.mockResolvedValue([]);
  mocks.flowMetricSnapshotFindMany.mockResolvedValue([]);
  mocks.anomalyFindMany.mockResolvedValue([]);
  mocks.retroActionItemFindMany.mockResolvedValue([]);
});

describe("buildExecutiveDashboardData — flow/retro KPI honesty", () => {
  it("reports flowSnapshotCount:0 and totalRetroActions:0 with no source data (never a measured-looking 0%)", async () => {
    const result = await buildExecutiveDashboardData(TENANT_ID);

    expect(result.kpis.flowSnapshotCount).toBe(0);
    expect(result.kpis.totalRetroActions).toBe(0);
    // Underlying averages are still 0 (no data to average) — callers must
    // gate rendering on the *count* fields above, not on these being truthy.
    expect(result.kpis.flowEfficiency).toBe(0);
    expect(result.kpis.cycleTimeDays).toBe(0);
    expect(result.kpis.actionCompletionRate).toBe(0);
  });

  it("reports a real flowSnapshotCount and computed averages when FlowMetricSnapshot rows exist", async () => {
    mocks.flowMetricSnapshotFindMany.mockResolvedValue([
      {
        scopeId: "art-1",
        flowEfficiency: 0.5,
        flowTimeMedianHours: 48,
        flowVelocityTotal: 20,
      },
    ]);

    const result = await buildExecutiveDashboardData(TENANT_ID);

    expect(result.kpis.flowSnapshotCount).toBe(1);
    expect(result.kpis.flowEfficiency).toBe(0.5);
    expect(result.kpis.cycleTimeDays).toBe(2);
  });

  it("reports a real totalRetroActions count when RetroActionItem rows exist", async () => {
    mocks.retroActionItemFindMany.mockResolvedValue([
      { status: "COMPLETE" },
      { status: "OPEN" },
    ]);

    const result = await buildExecutiveDashboardData(TENANT_ID);

    expect(result.kpis.totalRetroActions).toBe(2);
    expect(result.kpis.actionCompletionRate).toBe(50);
  });
});
