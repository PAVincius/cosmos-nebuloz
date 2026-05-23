import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  taskAssigneeFind: vi.fn(),
  storyFindFirst: vi.fn(),
  memberThroughputFindFirst: vi.fn(),
  memberThroughputFindMany: vi.fn(),
  pairSynergyUpsert: vi.fn(),
  pairSynergyUpdate: vi.fn(),
  pairSynergyFindMany: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
}));
vi.mock("@repo/database", () => ({
  database: {
    taskAssignee: { findMany: mocks.taskAssigneeFind },
    story: { findFirst: mocks.storyFindFirst },
    memberThroughputBaseline: {
      findFirst: mocks.memberThroughputFindFirst,
      findMany: mocks.memberThroughputFindMany,
    },
    pairSynergy: {
      upsert: mocks.pairSynergyUpsert,
      update: mocks.pairSynergyUpdate,
      findMany: mocks.pairSynergyFindMany,
    },
  },
}));

import {
  getSynergyMatrix,
  updatePairSynergiesForTask,
} from "@/app/actions/flow-intelligence/synergy";
import {
  canonicalPair,
  computeSynergyScore,
} from "@/app/actions/flow-intelligence/synergy-utils";

const tenantId = "t1";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.headers.mockResolvedValue(new Headers());
  mocks.requireTenantSession.mockResolvedValue({ tenantId });
});

describe("canonicalPair", () => {
  it("sorts lexicographically", () => {
    const [u1, u2] = canonicalPair("user-zeta", "user-alpha");
    expect(u1).toBe("user-alpha");
    expect(u2).toBe("user-zeta");
  });

  it("idempotent when already sorted", () => {
    const [u1, u2] = canonicalPair("user-alpha", "user-zeta");
    expect(u1).toBe("user-alpha");
    expect(u2).toBe("user-zeta");
  });

  it("handles same user (edge case)", () => {
    const [u1, u2] = canonicalPair("user-a", "user-a");
    expect(u1).toBe("user-a");
    expect(u2).toBe("user-a");
  });
});

describe("computeSynergyScore", () => {
  it("positive when outperforms baseline", () => {
    expect(computeSynergyScore({ actualSp: 18, predictedSp: 14 })).toBeCloseTo(
      28.57,
      1
    );
  });

  it("negative when underperforms (friction)", () => {
    expect(computeSynergyScore({ actualSp: 10, predictedSp: 14 })).toBeCloseTo(
      -28.57,
      1
    );
  });

  it("returns 0 when predictedSp is 0", () => {
    expect(computeSynergyScore({ actualSp: 5, predictedSp: 0 })).toBe(0);
  });

  it("returns 0 for zero actual and predicted", () => {
    expect(computeSynergyScore({ actualSp: 0, predictedSp: 0 })).toBe(0);
  });
});

// ── Server action tests ────────────────────────────────────────────────────────

describe("updatePairSynergiesForTask", () => {
  it("skips when < 2 assignees", async () => {
    mocks.taskAssigneeFind.mockResolvedValue([{ userId: "u1" }]);
    mocks.storyFindFirst.mockResolvedValue({
      storyPoints: 5,
      taskType: "any",
    });

    const result = await updatePairSynergiesForTask("task-1", "team-1");
    expect(result.ok).toBe(true);
    expect(
      (result as { ok: true; data: { pairsUpdated: number } }).data.pairsUpdated
    ).toBe(0);
    expect(mocks.pairSynergyUpsert).not.toHaveBeenCalled();
  });

  it("upserts with canonical ordering (u1 < u2)", async () => {
    mocks.taskAssigneeFind.mockResolvedValue([
      { userId: "user-zeta" },
      { userId: "user-alpha" },
    ]);
    mocks.storyFindFirst.mockResolvedValue({
      storyPoints: 10,
      taskType: "any",
    });
    mocks.memberThroughputFindFirst
      .mockResolvedValueOnce({ p50Estimate: 5 })
      .mockResolvedValueOnce({ p50Estimate: 4 });

    mocks.pairSynergyUpsert.mockResolvedValue({
      id: "ps-1",
      samples: 1,
      score: 11,
      variance: 0,
      totalSp: 10,
    });

    const result = await updatePairSynergiesForTask("task-1", "team-1");
    expect(result.ok).toBe(true);
    expect(
      (result as { ok: true; data: { pairsUpdated: number } }).data.pairsUpdated
    ).toBe(1);

    const call = mocks.pairSynergyUpsert.mock.calls[0][0] as any;
    expect(call.where.tenantId_userId1_userId2_taskType.userId1).toBe(
      "user-alpha"
    );
    expect(call.where.tenantId_userId1_userId2_taskType.userId2).toBe(
      "user-zeta"
    );
  });

  it("handles 3 assignees creating 3 pairs", async () => {
    mocks.taskAssigneeFind.mockResolvedValue([
      { userId: "u1" },
      { userId: "u2" },
      { userId: "u3" },
    ]);
    mocks.storyFindFirst.mockResolvedValue({
      storyPoints: 12,
      taskType: "backend",
    });
    mocks.memberThroughputFindFirst.mockResolvedValue({
      p50Estimate: 3,
    });

    mocks.pairSynergyUpsert.mockResolvedValue({
      id: "ps-1",
      samples: 1,
      score: 33,
      variance: 0,
      totalSp: 12,
    });

    const result = await updatePairSynergiesForTask("task-1", "team-1");
    expect(result.ok).toBe(true);
    expect(
      (result as { ok: true; data: { pairsUpdated: number } }).data.pairsUpdated
    ).toBe(3); // 3 pairs: (u1,u2), (u1,u3), (u2,u3)
  });
});

describe("getSynergyMatrix", () => {
  it("returns empty pairs when < 2 members", async () => {
    mocks.memberThroughputFindMany.mockResolvedValue([{ userId: "u1" }]);

    const result = await getSynergyMatrix("team-1");
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.pairs).toHaveLength(0);
    expect(result.data.teamId).toBe("team-1");
  });

  it("returns pairs with hasEnoughData flag", async () => {
    mocks.memberThroughputFindMany.mockResolvedValue([
      { userId: "u1" },
      { userId: "u2" },
      { userId: "u3" },
    ]);
    mocks.pairSynergyFindMany.mockResolvedValue([
      {
        userId1: "u1",
        userId2: "u2",
        score: 25,
        samples: 10,
        confidence: 1.0,
        taskType: "any",
        variance: 5,
      },
      {
        userId1: "u1",
        userId2: "u3",
        score: -10,
        samples: 2,
        confidence: 0.25,
        taskType: "any",
        variance: 15,
      },
    ]);

    const result = await getSynergyMatrix("team-1");
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.pairs).toHaveLength(2);
    expect(result.data.pairs[0].hasEnoughData).toBe(true); // confidence 1.0 >= 0.5
    expect(result.data.pairs[1].hasEnoughData).toBe(false); // confidence 0.25 < 0.5
  });
});
