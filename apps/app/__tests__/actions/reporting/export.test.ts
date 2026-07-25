import { beforeEach, describe, expect, it, vi } from "vitest";

const CTX = { tenantId: "t1", userId: "u1", role: "RTE" as const };

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  epicCount: vi.fn(),
  epicFindMany: vi.fn(),
  featureCount: vi.fn(),
  featureFindMany: vi.fn(),
  storyCount: vi.fn(),
  storyFindMany: vi.fn(),
  riskCount: vi.fn(),
  riskFindMany: vi.fn(),
  impedimentCount: vi.fn(),
  impedimentFindMany: vi.fn(),
  inngestSend: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
}));
vi.mock("@repo/database", () => ({
  database: {
    epic: { count: mocks.epicCount, findMany: mocks.epicFindMany },
    feature: { count: mocks.featureCount, findMany: mocks.featureFindMany },
    story: { count: mocks.storyCount, findMany: mocks.storyFindMany },
    risk: { count: mocks.riskCount, findMany: mocks.riskFindMany },
    impediment: {
      count: mocks.impedimentCount,
      findMany: mocks.impedimentFindMany,
    },
  },
}));
vi.mock("@/lib/inngest/client", () => ({
  inngest: { send: mocks.inngestSend },
}));

import { exportData } from "../../../app/actions/reporting/export";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.headers.mockResolvedValue(new Headers());
  mocks.requireTenantSession.mockResolvedValue(CTX);
  mocks.inngestSend.mockResolvedValue({ ids: ["evt-123"] });
});

describe("exportData — sync path (≤5000 rows)", () => {
  it("returns csv dataUrl for epics under limit", async () => {
    const row = {
      id: "e1",
      title: "Epic 1",
      state: "ACTIVE",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-02"),
    };
    mocks.epicCount.mockResolvedValue(2);
    mocks.epicFindMany.mockResolvedValue([row]);

    const result = await exportData({ entityType: "epics" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.mode).toBe("sync");
      if (result.data.mode === "sync") {
        expect(result.data.dataUrl).toMatch(/^data:text\/csv;base64,/);
        expect(result.data.rows).toBe(1);
      }
    }
    expect(mocks.inngestSend).not.toHaveBeenCalled();
  });

  it("filters by tenantId — never by body tenantId", async () => {
    mocks.epicCount.mockResolvedValue(0);
    mocks.epicFindMany.mockResolvedValue([]);

    await exportData({ entityType: "epics", tenantId: "evil" });

    expect(mocks.epicCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "t1" }),
      })
    );
  });

  it("filters by artId when provided", async () => {
    mocks.featureCount.mockResolvedValue(1);
    mocks.featureFindMany.mockResolvedValue([
      {
        id: "f1",
        title: "F",
        state: "DONE",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const artId = "clxxxxxxxxxxxxxxxxxxxxxxxx";
    await exportData({ entityType: "features", artId });

    expect(mocks.featureCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "t1", artId }),
      })
    );
  });

  it("returns empty csv for zero rows", async () => {
    mocks.riskCount.mockResolvedValue(0);
    mocks.riskFindMany.mockResolvedValue([]);

    const result = await exportData({ entityType: "risks" });

    expect(result.ok).toBe(true);
    if (result.ok && result.data.mode === "sync") {
      expect(result.data.rows).toBe(0);
    }
  });

  it("rejects unknown entityType", async () => {
    const result = await exportData({ entityType: "invalid_entity" });
    expect(result.ok).toBe(false);
  });
});

describe("exportData — async path (>5000 rows)", () => {
  it("enqueues Inngest job and returns jobId", async () => {
    mocks.epicCount.mockResolvedValue(5001);

    const result = await exportData({ entityType: "epics" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.mode).toBe("async");
      if (result.data.mode === "async") {
        expect(result.data.jobId).toBe("evt-123");
      }
    }
    expect(mocks.inngestSend).toHaveBeenCalledWith(
      expect.objectContaining({ name: "reporting/export.run" })
    );
    expect(mocks.epicFindMany).not.toHaveBeenCalled();
  });

  it("sends userId and tenantId from session in event payload", async () => {
    mocks.epicCount.mockResolvedValue(10_000);

    await exportData({ entityType: "epics" });

    expect(mocks.inngestSend).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: "t1", userId: "u1" }),
      })
    );
  });
});
