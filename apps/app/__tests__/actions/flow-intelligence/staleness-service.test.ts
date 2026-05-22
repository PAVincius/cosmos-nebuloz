import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@repo/database", () => ({
  database: {
    flowMetricSnapshot: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    stalenessAuditLog: { create: vi.fn() },
    teamMemberAssignment: { findMany: vi.fn() },
    competencyAssessment: { findFirst: vi.fn() },
  },
}));

describe("scoreSnapshotStaleness", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns early when snapshot not found", async () => {
    const { database } = await import("@repo/database");
    vi.mocked(database.flowMetricSnapshot.findUnique).mockResolvedValue(null);

    const { scoreSnapshotStaleness } = await import(
      "@/app/actions/flow-intelligence/staleness-service"
    );
    await scoreSnapshotStaleness("snap-1", "tenant-1");

    expect(database.flowMetricSnapshot.update).not.toHaveBeenCalled();
  });

  it("updates snapshot staleness when state changes to CRITICAL (90+ days old)", async () => {
    const { database } = await import("@repo/database");
    // >6 sprints × 14 days = >84 days triggers R1_AGE_CRITICAL
    const oldDate = new Date(Date.now() - 90 * 24 * 3600 * 1000);

    vi.mocked(database.flowMetricSnapshot.findUnique).mockResolvedValue({
      id: "snap-1",
      tenantId: "tenant-1",
      scope: "team",
      scopeId: "team-1",
      recordedAt: oldDate,
      staleness: "FRESH",
      flowVelocityTotal: 40,
      flowEfficiency: 0.8,
      flowPredictability: 0.85,
      flowLoadCurrent: 10,
      teamCompositionHash: null,
    } as never);
    vi.mocked(database.teamMemberAssignment.findMany).mockResolvedValue([]);
    vi.mocked(database.competencyAssessment.findFirst).mockResolvedValue(null);
    vi.mocked(database.flowMetricSnapshot.update).mockResolvedValue(
      {} as never
    );
    vi.mocked(database.stalenessAuditLog.create).mockResolvedValue({} as never);

    const { scoreSnapshotStaleness } = await import(
      "@/app/actions/flow-intelligence/staleness-service"
    );
    await scoreSnapshotStaleness("snap-1", "tenant-1");

    expect(database.flowMetricSnapshot.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "snap-1" },
        data: expect.objectContaining({ staleness: "CRITICAL" }),
      })
    );
    expect(database.stalenessAuditLog.create).toHaveBeenCalled();
  });

  it("only updates lastStalenessCheck when state unchanged", async () => {
    const { database } = await import("@repo/database");
    // Fresh snapshot — 1 day old
    const recentDate = new Date(Date.now() - 1 * 24 * 3600 * 1000);

    vi.mocked(database.flowMetricSnapshot.findUnique).mockResolvedValue({
      id: "snap-2",
      tenantId: "tenant-1",
      scope: "team",
      scopeId: "team-1",
      recordedAt: recentDate,
      staleness: "FRESH",
      flowVelocityTotal: 40,
      flowEfficiency: 0.8,
      flowPredictability: 0.85,
      flowLoadCurrent: 10,
      teamCompositionHash: null,
    } as never);
    vi.mocked(database.teamMemberAssignment.findMany).mockResolvedValue([]);
    vi.mocked(database.competencyAssessment.findFirst).mockResolvedValue(null);
    vi.mocked(database.flowMetricSnapshot.update).mockResolvedValue(
      {} as never
    );

    const { scoreSnapshotStaleness } = await import(
      "@/app/actions/flow-intelligence/staleness-service"
    );
    await scoreSnapshotStaleness("snap-2", "tenant-1");

    expect(database.flowMetricSnapshot.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lastStalenessCheck: expect.any(Date) }),
      })
    );
    expect(database.stalenessAuditLog.create).not.toHaveBeenCalled();
  });
});
