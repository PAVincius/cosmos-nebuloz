import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  gitHubDeploymentEventFindMany: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: h.headers }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: h.requireTenantSession,
}));
vi.mock("@repo/database", () => ({
  database: {
    gitHubDeploymentEvent: { findMany: h.gitHubDeploymentEventFindMany },
  },
}));

import { getDoraMetrics } from "../../app/(cosmos)/actions/dora";

beforeEach(() => {
  vi.clearAllMocks();
  h.headers.mockResolvedValue(new Headers());
  h.requireTenantSession.mockResolvedValue({ tenantId: "t1" });
  h.gitHubDeploymentEventFindMany.mockResolvedValue([]);
});

describe("getDoraMetrics", () => {
  it("is tenant-scoped and filtered to production deployments (fails if the where were dropped)", async () => {
    await getDoraMetrics();

    expect(h.gitHubDeploymentEventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "t1",
          environment: "production",
        }),
      })
    );
  });

  it("returns an honest empty result when the tenant has no production deployments — not a fabricated cadence", async () => {
    h.gitHubDeploymentEventFindMany.mockResolvedValue([]);

    const r = await getDoraMetrics();

    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    expect(r.data.hasProductionDeployments).toBe(false);
    expect(r.data.deploymentFrequency).toEqual({
      status: "unavailable",
      reason: expect.any(String),
    });
    expect(r.data.leadTimeHours.status).toBe("unavailable");
  });

  it("computes a real deployment frequency and lead time from successful production deployments", async () => {
    h.gitHubDeploymentEventFindMany.mockResolvedValue([
      {
        deployedAt: new Date("2026-07-20T12:00:00.000Z"),
        firstCommitAt: new Date("2026-07-20T10:00:00.000Z"), // 2h lead time
        state: "success",
      },
      {
        deployedAt: new Date("2026-07-21T12:00:00.000Z"),
        firstCommitAt: new Date("2026-07-21T08:00:00.000Z"), // 4h lead time
        state: "success",
      },
    ]);

    const r = await getDoraMetrics();

    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    expect(r.data.hasProductionDeployments).toBe(true);
    expect(r.data.totalProductionDeployments).toBe(2);
    expect(r.data.successfulProductionDeployments).toBe(2);
    expect(r.data.deploymentFrequency).toEqual({
      status: "measured",
      value: 2 / 30,
    });
    expect(r.data.leadTimeHours).toEqual({ status: "measured", value: 3 }); // avg(2h, 4h)
  });

  it("marks lead time unavailable (not a fabricated 0) when no deployment has a linked commit", async () => {
    h.gitHubDeploymentEventFindMany.mockResolvedValue([
      {
        deployedAt: new Date("2026-07-20T12:00:00.000Z"),
        firstCommitAt: null,
        state: "success",
      },
    ]);

    const r = await getDoraMetrics();

    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    expect(r.data.deploymentFrequency).toEqual({
      status: "measured",
      value: 1 / 30,
    });
    expect(r.data.leadTimeHours.status).toBe("unavailable");
  });

  it("marks deployment frequency unavailable (not a fabricated 0) when production events exist but none has a recognized GitHub state", async () => {
    h.gitHubDeploymentEventFindMany.mockResolvedValue([
      {
        deployedAt: new Date("2026-07-20T12:00:00.000Z"),
        firstCommitAt: new Date("2026-07-20T10:00:00.000Z"),
        state: "pending", // not in VALID_DEPLOYMENT_STATES
      },
      {
        deployedAt: new Date("2026-07-21T12:00:00.000Z"),
        firstCommitAt: new Date("2026-07-21T08:00:00.000Z"),
        state: "queued", // not in VALID_DEPLOYMENT_STATES
      },
    ]);

    const r = await getDoraMetrics();

    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    expect(r.data.deploymentFrequency).toEqual({
      status: "unavailable",
      reason: expect.any(String),
    });
    expect(r.data.totalProductionDeployments).toBe(0);
  });

  it("never reports change-failure-rate or MTTR as a measured 0 — always the unavailable marker", async () => {
    h.gitHubDeploymentEventFindMany.mockResolvedValue([
      {
        deployedAt: new Date("2026-07-20T12:00:00.000Z"),
        firstCommitAt: new Date("2026-07-20T10:00:00.000Z"),
        state: "success",
      },
    ]);

    const r = await getDoraMetrics();

    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    expect(r.data.changeFailureRate).toEqual({
      status: "unavailable",
      reason: "sem fonte de incidente",
    });
    expect(r.data.mttrHours).toEqual({
      status: "unavailable",
      reason: "sem fonte de incidente",
    });
  });
});
