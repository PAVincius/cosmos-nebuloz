import { beforeEach, describe, expect, it, vi } from "vitest";
import { tenantCtx } from "../../helpers/action-mocks";

// ── Hoist mocks before any imports ──────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  flowMetricSnapshotFindFirst: vi.fn(),
  flowMetricSnapshotCreate: vi.fn(),
  flowMetricSnapshotUpdate: vi.fn(),
  storyFindMany: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
}));
vi.mock("@repo/database", () => ({
  database: {
    flowMetricSnapshot: {
      findFirst: mocks.flowMetricSnapshotFindFirst,
      create: mocks.flowMetricSnapshotCreate,
      update: mocks.flowMetricSnapshotUpdate,
    },
    story: {
      findMany: mocks.storyFindMany,
    },
  },
}));

import { reEvaluateSnapshot } from "@/app/actions/flow-intelligence/re-evaluate-snapshot";

const OLD_SNAPSHOT = {
  id: "snap-old",
  tenantId: "tenant-1",
  scope: "team",
  scopeId: "team-1",
  period: "sprint",
  periodRef: "sprint-5",
  staleness: "STALE",
  isArchived: false,
  flowVelocityTotal: 0,
  flowDistribution: {},
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.headers.mockResolvedValue(new Headers());
  mocks.requireTenantSession.mockResolvedValue({
    ...tenantCtx,
    tenantId: "tenant-1",
  });
  mocks.flowMetricSnapshotFindFirst.mockResolvedValue(OLD_SNAPSHOT);
  mocks.flowMetricSnapshotCreate.mockResolvedValue({ id: "snap-new" });
  mocks.flowMetricSnapshotUpdate.mockResolvedValue({});
  mocks.storyFindMany.mockResolvedValue([]);
});

describe("reEvaluateSnapshot", () => {
  it("creates new snapshot with versionOf reference", async () => {
    const result = await reEvaluateSnapshot("snap-old");
    expect(result.ok).toBe(true);
    expect(mocks.flowMetricSnapshotCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          versionOf: "snap-old",
          staleness: "FRESH",
          tenantId: "tenant-1",
        }),
      })
    );
  });

  it("archives the old snapshot (isArchived=true)", async () => {
    await reEvaluateSnapshot("snap-old");
    expect(mocks.flowMetricSnapshotUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "snap-old" },
        data: expect.objectContaining({ isArchived: true }),
      })
    );
  });

  it("returns new snapshot id on success", async () => {
    const result = await reEvaluateSnapshot("snap-old");
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.newSnapshotId).toBe("snap-new");
  });

  it("returns err when snapshot not found", async () => {
    mocks.flowMetricSnapshotFindFirst.mockResolvedValue(null);
    const result = await reEvaluateSnapshot("snap-missing");
    expect(result.ok).toBe(false);
  });

  it("returns err when snapshot already archived", async () => {
    // When isArchived:false filter applied, already-archived snapshot won't be returned
    mocks.flowMetricSnapshotFindFirst.mockResolvedValue(null);
    const result = await reEvaluateSnapshot("snap-old");
    expect(result.ok).toBe(false);
  });
});
