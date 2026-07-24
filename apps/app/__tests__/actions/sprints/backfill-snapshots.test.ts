import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthError, tenantCtx } from "../../helpers/action-mocks";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  requireRole: vi.fn(),
  sprintFindMany: vi.fn(),
  storyFindMany: vi.fn(),
  storyAggregate: vi.fn(),
  defectFindMany: vi.fn(),
  stateTransitionHistoryFindMany: vi.fn(),
  memberFindMany: vi.fn(),
  flowMetricSnapshotFindFirst: vi.fn(),
  flowMetricSnapshotCreate: vi.fn(),
  teamCapacitySnapshotFindFirst: vi.fn(),
  teamCapacitySnapshotCreate: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
  requireRole: mocks.requireRole,
  AuthError: MockAuthError,
}));
vi.mock("@repo/observability/log", () => ({
  log: { error: mocks.logError },
}));
vi.mock("@repo/database", () => ({
  database: {
    sprint: { findMany: mocks.sprintFindMany },
    story: {
      findMany: mocks.storyFindMany,
      aggregate: mocks.storyAggregate,
    },
    defect: { findMany: mocks.defectFindMany },
    stateTransitionHistory: { findMany: mocks.stateTransitionHistoryFindMany },
    teamMemberAssignment: { findMany: mocks.memberFindMany },
    flowMetricSnapshot: {
      findFirst: mocks.flowMetricSnapshotFindFirst,
      create: mocks.flowMetricSnapshotCreate,
    },
    teamCapacitySnapshot: {
      findFirst: mocks.teamCapacitySnapshotFindFirst,
      create: mocks.teamCapacitySnapshotCreate,
    },
  },
}));

import { backfillPeriodSnapshots } from "../../../app/actions/sprints/backfill-snapshots";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.headers.mockResolvedValue(new Headers());
  mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx, role: "ADMIN" });
  mocks.requireRole.mockReturnValue(undefined);
  mocks.sprintFindMany.mockResolvedValue([
    { id: "sprint-1", teamId: "team-1", velocity: 30 },
    { id: "sprint-2", teamId: "team-1", velocity: 20 },
  ]);
  mocks.storyFindMany.mockResolvedValue([]);
  mocks.storyAggregate.mockResolvedValue({ _sum: { storyPoints: 0 } });
  mocks.defectFindMany.mockResolvedValue([]);
  mocks.stateTransitionHistoryFindMany.mockResolvedValue([]);
  mocks.memberFindMany.mockResolvedValue([]);
  mocks.flowMetricSnapshotFindFirst.mockResolvedValue(null);
  mocks.flowMetricSnapshotCreate.mockResolvedValue({ id: "snap" });
  mocks.teamCapacitySnapshotFindFirst.mockResolvedValue(null);
  mocks.teamCapacitySnapshotCreate.mockResolvedValue({ id: "cap" });
});

describe("backfillPeriodSnapshots", () => {
  it("is denied when the role is not ADMIN (RBAC)", async () => {
    mocks.requireRole.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "nope");
    });

    const res = await backfillPeriodSnapshots();

    expect(res.ok).toBe(false);
    expect(mocks.requireRole).toHaveBeenCalledWith(["ADMIN"], {
      ...tenantCtx,
      role: "ADMIN",
    });
    expect(mocks.sprintFindMany).not.toHaveBeenCalled();
  });

  it("is tenant-scoped to CLOSED sprints only", async () => {
    await backfillPeriodSnapshots();

    expect(mocks.sprintFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: tenantCtx.tenantId, status: "CLOSED" },
      })
    );
  });

  it("originates a flow + capacity snapshot per closed sprint missing one", async () => {
    const res = await backfillPeriodSnapshots();

    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    expect(res.data).toEqual({
      sprintsProcessed: 2,
      flowSnapshotsCreated: 2,
      capacitySnapshotsCreated: 2,
    });
    expect(mocks.flowMetricSnapshotCreate).toHaveBeenCalledTimes(2);
    expect(mocks.teamCapacitySnapshotCreate).toHaveBeenCalledTimes(2);
  });

  it("is idempotent — a second run creates nothing new", async () => {
    await backfillPeriodSnapshots();

    // Second run: snapshots now "exist" for every sprint.
    mocks.flowMetricSnapshotFindFirst.mockResolvedValue({ id: "existing" });
    mocks.teamCapacitySnapshotFindFirst.mockResolvedValue({ id: "existing" });

    const res = await backfillPeriodSnapshots();

    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    expect(res.data.flowSnapshotsCreated).toBe(0);
    expect(res.data.capacitySnapshotsCreated).toBe(0);
    expect(res.data.sprintsProcessed).toBe(2);
  });

  it("continues processing remaining sprints when one snapshot computation throws", async () => {
    mocks.flowMetricSnapshotFindFirst
      .mockRejectedValueOnce(new Error("db hiccup"))
      .mockResolvedValue(null);

    const res = await backfillPeriodSnapshots();

    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    // sprint-1's flow snapshot failed; sprint-2's still succeeded.
    expect(res.data.flowSnapshotsCreated).toBe(1);
    expect(res.data.capacitySnapshotsCreated).toBe(2);
    expect(mocks.logError).toHaveBeenCalledWith(
      expect.stringContaining("flow snapshot"),
      expect.objectContaining({ sprintId: "sprint-1" })
    );
  });
});
