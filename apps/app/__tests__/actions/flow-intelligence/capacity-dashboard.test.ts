import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  sprintFindFirst: vi.fn(),
  teamMemberAssignmentFindMany: vi.fn(),
  memberThroughputBaselineFindMany: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
}));
vi.mock("@repo/database", () => ({
  database: {
    sprint: { findFirst: mocks.sprintFindFirst },
    teamMemberAssignment: { findMany: mocks.teamMemberAssignmentFindMany },
    memberThroughputBaseline: {
      findMany: mocks.memberThroughputBaselineFindMany,
    },
  },
}));
vi.mock("server-only", () => ({}));

import { getTeamCapacityDashboard } from "@/app/actions/flow-intelligence/capacity";

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

describe("getTeamCapacityDashboard", () => {
  it("returns error when no active sprint found", async () => {
    mocks.sprintFindFirst.mockResolvedValue(null);

    const result = await getTeamCapacityDashboard("team-1");
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toBe(
      "Nenhum sprint ativo encontrado"
    );
  });

  it("returns empty members when no assignments", async () => {
    mocks.sprintFindFirst.mockResolvedValue({ id: "sprint-1" });
    mocks.teamMemberAssignmentFindMany.mockResolvedValue([]);

    const result = await getTeamCapacityDashboard("team-1");
    expect(result.ok).toBe(true);
    const data = (
      result as {
        ok: true;
        data: {
          members: unknown[];
          totalExpected: number;
          totalMin: number;
          totalMax: number;
          teamId: string;
        };
      }
    ).data;
    expect(data.members).toHaveLength(0);
    expect(data.totalExpected).toBe(0);
    expect(data.totalMin).toBe(0);
    expect(data.totalMax).toBe(0);
    expect(data.teamId).toBe("team-1");
  });

  it("computes expectedSp, minSp, maxSp from baseline * capacityFactor", async () => {
    mocks.sprintFindFirst.mockResolvedValue({ id: "sprint-1" });
    mocks.teamMemberAssignmentFindMany.mockResolvedValue([
      { userId: "u1", role: "DEV", capacityFactor: 0.8 },
    ]);
    mocks.memberThroughputBaselineFindMany.mockResolvedValue([
      {
        userId: "u1",
        avgSpPerSprint: 10,
        p10Estimate: 6,
        p50Estimate: 10,
        p90Estimate: 14,
        trend: "UP",
        volatility: 1.5,
        sprintCount: 5,
      },
    ]);

    const result = await getTeamCapacityDashboard("team-1");
    expect(result.ok).toBe(true);
    const data = (
      result as {
        ok: true;
        data: {
          members: Array<{
            expectedSp: number;
            minSp: number;
            maxSp: number;
            trend: string;
          }>;
        };
      }
    ).data;
    expect(data.members[0].expectedSp).toBe(8); // round(10 * 0.8)
    expect(data.members[0].minSp).toBe(5); // round(6 * 0.8)
    expect(data.members[0].maxSp).toBe(11); // round(14 * 0.8)
    expect(data.members[0].trend).toBe("UP");
  });

  it("uses zero values for members without baselines", async () => {
    mocks.sprintFindFirst.mockResolvedValue({ id: "sprint-1" });
    mocks.teamMemberAssignmentFindMany.mockResolvedValue([
      { userId: "u2", role: null, capacityFactor: 1.0 },
    ]);
    mocks.memberThroughputBaselineFindMany.mockResolvedValue([]);

    const result = await getTeamCapacityDashboard("team-1");
    expect(result.ok).toBe(true);
    const data = (
      result as {
        ok: true;
        data: {
          members: Array<{
            expectedSp: number;
            minSp: number;
            maxSp: number;
            trend: string;
            sprintCount: number;
          }>;
        };
      }
    ).data;
    expect(data.members[0].expectedSp).toBe(0);
    expect(data.members[0].minSp).toBe(0);
    expect(data.members[0].maxSp).toBe(0);
    expect(data.members[0].trend).toBe("NEUTRAL");
    expect(data.members[0].sprintCount).toBe(0);
  });

  it("sums totals across all members", async () => {
    mocks.sprintFindFirst.mockResolvedValue({ id: "sprint-1" });
    mocks.teamMemberAssignmentFindMany.mockResolvedValue([
      { userId: "u1", role: "DEV", capacityFactor: 1.0 },
      { userId: "u2", role: "QA", capacityFactor: 0.5 },
    ]);
    mocks.memberThroughputBaselineFindMany.mockResolvedValue([
      {
        userId: "u1",
        avgSpPerSprint: 10,
        p10Estimate: 8,
        p50Estimate: 10,
        p90Estimate: 12,
        trend: "NEUTRAL",
        volatility: 0,
        sprintCount: 4,
      },
      {
        userId: "u2",
        avgSpPerSprint: 6,
        p10Estimate: 4,
        p50Estimate: 6,
        p90Estimate: 8,
        trend: "NEUTRAL",
        volatility: 0,
        sprintCount: 3,
      },
    ]);

    const result = await getTeamCapacityDashboard("team-1");
    expect(result.ok).toBe(true);
    const data = (
      result as {
        ok: true;
        data: { totalExpected: number; totalMin: number; totalMax: number };
      }
    ).data;
    // u1: 10*1.0=10, 8*1.0=8, 12*1.0=12
    // u2: round(6*0.5)=3, round(4*0.5)=2, round(8*0.5)=4
    expect(data.totalExpected).toBe(13);
    expect(data.totalMin).toBe(10);
    expect(data.totalMax).toBe(16);
  });
});
