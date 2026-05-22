import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  storyFindMany: vi.fn(),
  memberSprintMetricsUpsert: vi.fn(),
  memberSprintMetricsFindMany: vi.fn(),
  memberThroughputBaselineUpsert: vi.fn(),
  teamMemberAssignmentFindMany: vi.fn(),
  teamMemberAssignmentUpsert: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
}));
vi.mock("@repo/database", () => ({
  database: {
    story: { findMany: mocks.storyFindMany },
    memberSprintMetrics: {
      upsert: mocks.memberSprintMetricsUpsert,
      findMany: mocks.memberSprintMetricsFindMany,
    },
    memberThroughputBaseline: {
      upsert: mocks.memberThroughputBaselineUpsert,
    },
    teamMemberAssignment: {
      findMany: mocks.teamMemberAssignmentFindMany,
      upsert: mocks.teamMemberAssignmentUpsert,
    },
  },
}));
vi.mock("server-only", () => ({}));

import {
  computeMemberBaseline,
  computeSprintMetrics,
  upsertMemberAssignment,
} from "@/app/actions/flow-intelligence/capacity";

const tenantCtx = {
  tenantId: "tenant-test",
  userId: "user-test",
  role: "PO" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.headers.mockResolvedValue(new Headers());
  mocks.requireTenantSession.mockResolvedValue(tenantCtx);
});

describe("computeSprintMetrics", () => {
  it("groups DONE stories by assigneeUserId and upserts MemberSprintMetrics", async () => {
    mocks.storyFindMany.mockResolvedValue([
      {
        assigneeUserId: "u1",
        storyPoints: 5,
        startedAt: new Date("2026-05-01"),
        completedAt: new Date("2026-05-03"),
      },
      {
        assigneeUserId: "u1",
        storyPoints: 3,
        startedAt: new Date("2026-05-04"),
        completedAt: new Date("2026-05-05"),
      },
      {
        assigneeUserId: "u2",
        storyPoints: 8,
        startedAt: new Date("2026-05-01"),
        completedAt: new Date("2026-05-06"),
      },
    ]);
    mocks.memberSprintMetricsUpsert.mockResolvedValue({});

    const result = await computeSprintMetrics("sprint-1", "team-1");
    expect(result.ok).toBe(true);
    expect(mocks.memberSprintMetricsUpsert).toHaveBeenCalledTimes(2);

    const calls = mocks.memberSprintMetricsUpsert.mock.calls as [
      {
        create: { storyPointsDelivered: number; userId: string };
        where: unknown;
        update: unknown;
      },
    ][];
    const u1Call = calls.find((c) => c[0].create.userId === "u1");
    expect(u1Call?.[0].create.storyPointsDelivered).toBe(8); // 5+3
  });

  it("skips stories without assigneeUserId", async () => {
    mocks.storyFindMany.mockResolvedValue([
      {
        assigneeUserId: null,
        storyPoints: 5,
        startedAt: null,
        completedAt: new Date(),
      },
    ]);

    const result = await computeSprintMetrics("sprint-1", "team-1");
    expect(result.ok).toBe(true);
    expect(mocks.memberSprintMetricsUpsert).not.toHaveBeenCalled();
  });

  it("calculates average flow time hours", async () => {
    mocks.storyFindMany.mockResolvedValue([
      {
        assigneeUserId: "u1",
        storyPoints: 5,
        startedAt: new Date("2026-05-01T00:00:00"),
        completedAt: new Date("2026-05-01T06:00:00"), // 6 hours
      },
      {
        assigneeUserId: "u1",
        storyPoints: 3,
        startedAt: new Date("2026-05-02T00:00:00"),
        completedAt: new Date("2026-05-02T12:00:00"), // 12 hours
      },
    ]);
    mocks.memberSprintMetricsUpsert.mockResolvedValue({});

    await computeSprintMetrics("sprint-1", "team-1");

    const calls = mocks.memberSprintMetricsUpsert.mock.calls as [
      { create: { avgFlowTimeHours: number }; where: unknown; update: unknown },
    ][];
    expect(calls[0][0].create.avgFlowTimeHours).toBe(9); // (6+12)/2
  });
});

describe("computeMemberBaseline", () => {
  it("computes average from up to 6 sprints", async () => {
    mocks.memberSprintMetricsFindMany.mockResolvedValue([
      { storyPointsDelivered: 10 },
      { storyPointsDelivered: 8 },
      { storyPointsDelivered: 12 },
      { storyPointsDelivered: 9 },
      { storyPointsDelivered: 11 },
      { storyPointsDelivered: 10 },
    ]);
    mocks.memberThroughputBaselineUpsert.mockResolvedValue({});

    const result = await computeMemberBaseline("team-1", "u1");
    expect(result.ok).toBe(true);

    const calls = mocks.memberThroughputBaselineUpsert.mock.calls as [
      { create: { avgSpPerSprint: number; sprintCount: number } },
    ][];
    expect(calls[0][0].create.sprintCount).toBe(6);
    expect(calls[0][0].create.avgSpPerSprint).toBe(10); // (10+8+12+9+11+10)/6 = 10
  });

  it("returns ok with sprintCount=0 when no metrics", async () => {
    mocks.memberSprintMetricsFindMany.mockResolvedValue([]);
    mocks.memberThroughputBaselineUpsert.mockResolvedValue({});

    const result = await computeMemberBaseline("team-1", "u1");
    expect(result.ok).toBe(true);
    expect(result.data.sprintCount).toBe(0);
  });

  it("computes p10, p50, p90 percentiles", async () => {
    mocks.memberSprintMetricsFindMany.mockResolvedValue([
      { storyPointsDelivered: 5 },
      { storyPointsDelivered: 8 },
      { storyPointsDelivered: 10 },
      { storyPointsDelivered: 12 },
      { storyPointsDelivered: 15 },
    ]);
    mocks.memberThroughputBaselineUpsert.mockResolvedValue({});

    await computeMemberBaseline("team-1", "u1");

    const calls = mocks.memberThroughputBaselineUpsert.mock.calls as [
      {
        create: {
          p10Estimate: number;
          p50Estimate: number;
          p90Estimate: number;
        };
      },
    ][];
    expect(calls[0][0].create.p10Estimate).toBeDefined();
    expect(calls[0][0].create.p50Estimate).toBeDefined();
    expect(calls[0][0].create.p90Estimate).toBeDefined();
  });

  it("computes trend: UP when recent > older*1.1", async () => {
    mocks.memberSprintMetricsFindMany.mockResolvedValue([
      { storyPointsDelivered: 12 }, // recent avg: (12+11+10)/3 = 11
      { storyPointsDelivered: 11 },
      { storyPointsDelivered: 10 },
      { storyPointsDelivered: 8 }, // older avg: (8+7+6)/3 = 7
      { storyPointsDelivered: 7 },
      { storyPointsDelivered: 6 },
    ]);
    mocks.memberThroughputBaselineUpsert.mockResolvedValue({});

    await computeMemberBaseline("team-1", "u1");

    const calls = mocks.memberThroughputBaselineUpsert.mock.calls as [
      { create: { trend: string } },
    ][];
    expect(calls[0][0].create.trend).toBe("UP");
  });

  it("computes trend: DOWN when recent < older*0.9", async () => {
    mocks.memberSprintMetricsFindMany.mockResolvedValue([
      { storyPointsDelivered: 6 }, // recent avg: (6+7+8)/3 = 7
      { storyPointsDelivered: 7 },
      { storyPointsDelivered: 8 },
      { storyPointsDelivered: 12 }, // older avg: (12+11+10)/3 = 11
      { storyPointsDelivered: 11 },
      { storyPointsDelivered: 10 },
    ]);
    mocks.memberThroughputBaselineUpsert.mockResolvedValue({});

    await computeMemberBaseline("team-1", "u1");

    const calls = mocks.memberThroughputBaselineUpsert.mock.calls as [
      { create: { trend: string } },
    ][];
    expect(calls[0][0].create.trend).toBe("DOWN");
  });

  it("computes volatility (std dev)", async () => {
    mocks.memberSprintMetricsFindMany.mockResolvedValue([
      { storyPointsDelivered: 10 },
      { storyPointsDelivered: 10 },
      { storyPointsDelivered: 10 },
    ]);
    mocks.memberThroughputBaselineUpsert.mockResolvedValue({});

    await computeMemberBaseline("team-1", "u1");

    const calls = mocks.memberThroughputBaselineUpsert.mock.calls as [
      { create: { volatility: number } },
    ][];
    expect(calls[0][0].create.volatility).toBe(0); // no variance
  });
});

describe("upsertMemberAssignment", () => {
  it("rejects capacityFactor > 1", async () => {
    const result = await upsertMemberAssignment("sprint-1", "team-1", "u1", {
      capacityFactor: 1.5,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("capacityFactor");
  });

  it("rejects capacityFactor < 0", async () => {
    const result = await upsertMemberAssignment("sprint-1", "team-1", "u1", {
      capacityFactor: -0.1,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("capacityFactor");
  });

  it("accepts capacityFactor in range [0, 1]", async () => {
    mocks.teamMemberAssignmentUpsert.mockResolvedValue({
      id: "assign-1",
    });

    const result = await upsertMemberAssignment("sprint-1", "team-1", "u1", {
      capacityFactor: 0.5,
    });
    expect(result.ok).toBe(true);
    expect(mocks.teamMemberAssignmentUpsert).toHaveBeenCalled();
  });

  it("upserts with optional role", async () => {
    mocks.teamMemberAssignmentUpsert.mockResolvedValue({
      id: "assign-1",
    });

    await upsertMemberAssignment("sprint-1", "team-1", "u1", {
      capacityFactor: 0.8,
      role: "DEVELOPER",
    });

    const calls = mocks.teamMemberAssignmentUpsert.mock.calls as [
      { create: { role: string | undefined } },
    ][];
    expect(calls[0][0].create.role).toBe("DEVELOPER");
  });
});
