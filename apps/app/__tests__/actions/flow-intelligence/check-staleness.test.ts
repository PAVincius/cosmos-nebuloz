import { beforeEach, describe, expect, it, vi } from "vitest";
import { tenantCtx } from "../../helpers/action-mocks";

// ── Hoist mocks before any imports ──────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  flowMetricSnapshotFindFirst: vi.fn(),
  flowMetricSnapshotUpdate: vi.fn(),
  competencyAssessmentFindFirst: vi.fn(),
  stalenessAuditLogCreate: vi.fn(),
  teamMemberAssignmentFindMany: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
}));
vi.mock("@repo/database", () => ({
  database: {
    flowMetricSnapshot: {
      findFirst: mocks.flowMetricSnapshotFindFirst,
      update: mocks.flowMetricSnapshotUpdate,
    },
    competencyAssessment: {
      findFirst: mocks.competencyAssessmentFindFirst,
    },
    stalenessAuditLog: {
      create: mocks.stalenessAuditLogCreate,
    },
    teamMemberAssignment: {
      findMany: mocks.teamMemberAssignmentFindMany,
    },
  },
}));

import { checkSnapshotStaleness } from "@/app/actions/flow-intelligence/check-staleness";

// 30 days old → AGING (2–4 sprints at 14 days/sprint)
const FRESH_SNAPSHOT = {
  id: "snap-1",
  tenantId: "tenant-test",
  scope: "team",
  scopeId: "team-1",
  staleness: "FRESH",
  recordedAt: new Date(Date.now() - 30 * 86_400_000),
  teamCompositionHash: "hash-abc",
  flowVelocityTotal: 45,
  flowEfficiency: 0.8,
  flowPredictability: 0.85,
  flowLoadCurrent: 10,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.headers.mockResolvedValue(new Headers());
  mocks.requireTenantSession.mockResolvedValue(tenantCtx);
  mocks.flowMetricSnapshotFindFirst.mockResolvedValue(FRESH_SNAPSHOT);
  mocks.flowMetricSnapshotUpdate.mockResolvedValue({
    ...FRESH_SNAPSHOT,
    staleness: "AGING",
  });
  mocks.stalenessAuditLogCreate.mockResolvedValue({ id: "log-1" });
  mocks.competencyAssessmentFindFirst.mockResolvedValue(null);
  mocks.teamMemberAssignmentFindMany.mockResolvedValue([]);
});

describe("checkSnapshotStaleness", () => {
  it("returns ok with transition from FRESH to AGING", async () => {
    const result = await checkSnapshotStaleness("snap-1");
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.oldState).toBe("FRESH");
    expect(result.data.newState).toBe("AGING");
    expect(result.data.changed).toBe(true);
  });

  it("writes StalenessAuditLog when state changes", async () => {
    await checkSnapshotStaleness("snap-1");
    expect(mocks.stalenessAuditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          snapshotId: "snap-1",
          oldState: "FRESH",
          newState: "AGING",
          triggeredBy: "system",
        }),
      })
    );
  });

  it("updates snapshot staleness when state changes", async () => {
    await checkSnapshotStaleness("snap-1");
    expect(mocks.flowMetricSnapshotUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "snap-1" },
        data: expect.objectContaining({ staleness: "AGING" }),
      })
    );
  });

  it("returns err when snapshot not found", async () => {
    mocks.flowMetricSnapshotFindFirst.mockResolvedValue(null);
    const result = await checkSnapshotStaleness("snap-missing");
    expect(result.ok).toBe(false);
  });

  it("only updates lastStalenessCheck when state unchanged", async () => {
    // Snapshot already AGING → no state change expected
    mocks.flowMetricSnapshotFindFirst.mockResolvedValue({
      ...FRESH_SNAPSHOT,
      staleness: "AGING",
    });
    mocks.flowMetricSnapshotUpdate.mockResolvedValue({
      ...FRESH_SNAPSHOT,
      staleness: "AGING",
    });
    await checkSnapshotStaleness("snap-1");
    expect(mocks.stalenessAuditLogCreate).not.toHaveBeenCalled();
  });
});
