import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  flowMetricSnapshotFindFirst: vi.fn(),
  storyFindMany: vi.fn(),
  featureFindMany: vi.fn(),
  epicFindMany: vi.fn(),
  stateTransitionHistoryFindMany: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: h.headers }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: h.requireTenantSession,
}));
vi.mock("@repo/database", () => ({
  database: {
    flowMetricSnapshot: { findFirst: h.flowMetricSnapshotFindFirst },
    story: { findMany: h.storyFindMany },
    feature: { findMany: h.featureFindMany },
    epic: { findMany: h.epicFindMany },
    stateTransitionHistory: { findMany: h.stateTransitionHistoryFindMany },
  },
}));

import { database } from "@repo/database";
import {
  AGING_WIP_SLA_DAYS,
  getAgingWip,
  getLatestFlowMetrics,
} from "../../app/(cosmos)/actions/flow";

beforeEach(() => {
  vi.clearAllMocks();
  h.headers.mockResolvedValue(new Headers());
  h.requireTenantSession.mockResolvedValue({ tenantId: "t1" });
  h.flowMetricSnapshotFindFirst.mockResolvedValue({
    flowDistribution: { story: 54, defect: 19 },
    flowVelocityTotal: 71,
    flowTimeAvgHours: 200.4,
    flowLoadCurrent: 31,
    flowEfficiency: 0.42,
    flowPredictability: 0.87,
    recordedAt: new Date("2026-02-01"),
  });
  h.storyFindMany.mockResolvedValue([]);
  h.featureFindMany.mockResolvedValue([]);
  h.epicFindMany.mockResolvedValue([]);
  h.stateTransitionHistoryFindMany.mockResolvedValue([]);
});

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

describe("getAgingWip", () => {
  const NOW = new Date("2026-07-24T00:00:00.000Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is tenant-scoped for every entity query (fails if the where were dropped)", async () => {
    await getAgingWip();
    expect(h.storyFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "t1" }),
      })
    );
    expect(h.featureFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "t1" }),
      })
    );
    expect(h.epicFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "t1" }),
      })
    );
  });

  it("returns an empty list when nothing is in progress", async () => {
    const r = await getAgingWip();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data).toEqual([]);
    }
  });

  it("computes days-in-state from the latest transition into the entity's current status", async () => {
    h.storyFindMany.mockResolvedValue([
      { id: "s1", title: "Tenant isolation", status: "IN_PROGRESS" },
    ]);
    h.stateTransitionHistoryFindMany.mockResolvedValue([
      {
        entityId: "s1",
        toStatus: "IN_PROGRESS",
        transitionedAt: new Date("2026-07-06T00:00:00.000Z"), // 18 days before NOW
      },
    ]);

    const r = await getAgingWip();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data).toHaveLength(1);
      expect(r.data[0]).toMatchObject({
        entityType: "Story",
        entityId: "s1",
        title: "Tenant isolation",
        status: "IN_PROGRESS",
        days: 18,
        slaDays: AGING_WIP_SLA_DAYS,
        overSla: true,
      });
    }
  });

  it("drops entities with no transition into their current status instead of fabricating one", async () => {
    h.featureFindMany.mockResolvedValue([
      { id: "f1", title: "Feature store", statusId: "IMPLEMENTING" },
    ]);
    // history exists but never transitions INTO "IMPLEMENTING" for f1
    h.stateTransitionHistoryFindMany.mockResolvedValue([
      {
        entityId: "f1",
        toStatus: "REVIEW",
        transitionedAt: new Date("2026-07-01T00:00:00.000Z"),
      },
    ]);

    const r = await getAgingWip();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data).toEqual([]);
    }
  });

  it("flags an item under the SLA threshold as not over SLA", async () => {
    h.epicFindMany.mockResolvedValue([
      { id: "e1", title: "Pix agendado", lifecycleStatus: "IMPLEMENTING" },
    ]);
    h.stateTransitionHistoryFindMany.mockResolvedValue([
      {
        entityId: "e1",
        toStatus: "IMPLEMENTING",
        transitionedAt: new Date("2026-07-17T00:00:00.000Z"), // 7 days before NOW
      },
    ]);

    const r = await getAgingWip();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data[0].days).toBe(7);
      expect(r.data[0].overSla).toBe(false);
    }
  });
});
