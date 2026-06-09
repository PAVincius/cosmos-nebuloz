import { beforeEach, describe, expect, it, vi } from "vitest";
import { tenantCtx } from "../../helpers/action-mocks";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  revalidatePath: vi.fn(),
  sprintFindFirstOrThrow: vi.fn(),
  sprintFindFirst: vi.fn(),
  sprintFindMany: vi.fn(),
  sprintUpdateMany: vi.fn(),
  storyAggregate: vi.fn(),
  storyFindFirstOrThrow: vi.fn(),
  storyUpdateMany: vi.fn(),
  storyCreate: vi.fn(),
  standupCreate: vi.fn(),
  standupFindMany: vi.fn(),
  memberFindMany: vi.fn(),
  anomalyRunCreate: vi.fn(),
  anomalyCreate: vi.fn(),
  stateTransitionCreate: vi.fn(),
  queryRaw: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
}));
vi.mock("@repo/database", () => ({
  database: {
    sprint: {
      findFirstOrThrow: mocks.sprintFindFirstOrThrow,
      findFirst: mocks.sprintFindFirst,
      findMany: mocks.sprintFindMany,
      updateMany: mocks.sprintUpdateMany,
    },
    story: {
      aggregate: mocks.storyAggregate,
      findFirstOrThrow: mocks.storyFindFirstOrThrow,
      updateMany: mocks.storyUpdateMany,
      create: mocks.storyCreate,
    },
    standupEntry: {
      create: mocks.standupCreate,
      findMany: mocks.standupFindMany,
    },
    teamMemberAssignment: { findMany: mocks.memberFindMany },
    anomalyDetectionRun: { create: mocks.anomalyRunCreate },
    anomaly: { create: mocks.anomalyCreate },
    stateTransitionHistory: { create: mocks.stateTransitionCreate },
    $transaction: mocks.transaction,
    $queryRaw: mocks.queryRaw,
  },
}));

import {
  activateSprint,
  checkEstimationDrift,
  closeSprint,
  getSilentMembers,
  moveStoryOnBoard,
  submitStandup,
} from "../../../app/actions/sprints/lifecycle";

// Default transaction mock: pass-through for callback shape
function makeTransactionMock() {
  mocks.transaction.mockImplementation(
    (fn: ((tx: Record<string, unknown>) => unknown) | Promise<unknown>[]) => {
      if (typeof fn === "function") {
        return fn({
          sprint: {
            findFirstOrThrow: mocks.sprintFindFirstOrThrow,
            findFirst: mocks.sprintFindFirst,
            findMany: mocks.sprintFindMany,
            updateMany: mocks.sprintUpdateMany,
          },
          story: {
            aggregate: mocks.storyAggregate,
            findFirstOrThrow: mocks.storyFindFirstOrThrow,
            updateMany: mocks.storyUpdateMany,
          },
          anomalyDetectionRun: { create: mocks.anomalyRunCreate },
          anomaly: { create: mocks.anomalyCreate },
          stateTransitionHistory: { create: mocks.stateTransitionCreate },
        });
      }
      return Promise.all(fn as Promise<unknown>[]);
    }
  );
}

// ─── activateSprint ───────────────────────────────────────────────────────────

describe("activateSprint (AC-001)", () => {
  const baseSprint = {
    id: "sprint-1",
    teamId: "team-1",
    capacity: 40,
    status: "PLANNING",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx, role: "SM" });
    mocks.sprintFindFirstOrThrow.mockResolvedValue(baseSprint);
    mocks.sprintFindFirst.mockResolvedValue(null); // no active sprint
    mocks.storyAggregate.mockResolvedValue({ _sum: { storyPoints: 30 } });
    mocks.sprintUpdateMany.mockResolvedValue({ count: 1 });
    makeTransactionMock();
  });

  it("activates sprint when no active sprint exists (AC-001)", async () => {
    const result = await activateSprint({ sprintId: "sprint-1" });

    expect(result.ok).toBe(true);
    expect(mocks.sprintUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "ACTIVE" }),
      })
    );
  });

  it("rejects when team already has ACTIVE sprint (AC-001)", async () => {
    mocks.sprintFindFirst.mockResolvedValue({ id: "sprint-existing" });

    const result = await activateSprint({ sprintId: "sprint-1" });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("ACTIVE_SPRINT_EXISTS");
    expect(mocks.sprintUpdateMany).not.toHaveBeenCalled();
  });
});

describe("activateSprint overcommitment (AC-002)", () => {
  const overloadSprint = {
    id: "sprint-1",
    teamId: "team-1",
    capacity: 40,
    status: "PLANNING",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx, role: "SM" });
    mocks.sprintFindFirstOrThrow.mockResolvedValue(overloadSprint);
    mocks.sprintFindFirst.mockResolvedValue(null);
    // 50 points on 40-capacity sprint = 25% over threshold
    mocks.storyAggregate.mockResolvedValue({ _sum: { storyPoints: 50 } });
    mocks.sprintUpdateMany.mockResolvedValue({ count: 1 });
    mocks.anomalyRunCreate.mockResolvedValue({ id: "run-1" });
    mocks.anomalyCreate.mockResolvedValue({ id: "anomaly-1" });
    makeTransactionMock();
  });

  it("rejects activation without override when overcommitted (AC-002)", async () => {
    const result = await activateSprint({ sprintId: "sprint-1" });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("OVERCOMMITMENT_REQUIRES_OVERRIDE");
    expect(mocks.sprintUpdateMany).not.toHaveBeenCalled();
  });

  it("activates with override + creates SCOPE_CREEP anomaly (AC-002)", async () => {
    const result = await activateSprint({
      sprintId: "sprint-1",
      overcommitmentOverride: true,
      overcommitmentJustification: "Holiday adjusted capacity — CTO approved",
    });

    expect(result.ok).toBe(true);
    expect(mocks.anomalyCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rule: "SCOPE_CREEP",
          severity: "MEDIUM",
        }),
      })
    );
    expect(mocks.sprintUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          overcommitmentOverride: true,
          overcommitmentJustification:
            "Holiday adjusted capacity — CTO approved",
        }),
      })
    );
  });
});

// ─── closeSprint + VELOCITY_DROP ─────────────────────────────────────────────

describe("closeSprint velocity anomaly (AC-007)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx, role: "SM" });
    mocks.sprintFindFirstOrThrow.mockResolvedValue({
      id: "sprint-1",
      teamId: "team-1",
      status: "ACTIVE",
    });
    mocks.sprintUpdateMany.mockResolvedValue({ count: 1 });
    mocks.anomalyRunCreate.mockResolvedValue({ id: "run-1" });
    mocks.anomalyCreate.mockResolvedValue({ id: "anomaly-1" });
    makeTransactionMock();
  });

  it("computes velocity from DONE stories at close", async () => {
    mocks.storyAggregate.mockResolvedValue({ _sum: { storyPoints: 38 } });
    // Not enough history for anomaly check
    mocks.sprintFindMany.mockResolvedValue([
      { velocity: 40 },
      { velocity: 42 },
    ]);

    const result = await closeSprint({ sprintId: "sprint-1" });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.velocity).toBe(38);
  });

  it("creates VELOCITY_DROP anomaly when velocity < mean - 2σ (AC-007)", async () => {
    // Mean=40, σ≈1.5, threshold=37. Velocity 33 < 37.
    mocks.storyAggregate.mockResolvedValue({ _sum: { storyPoints: 33 } });
    mocks.sprintFindMany.mockResolvedValue([
      { velocity: 40 },
      { velocity: 42 },
      { velocity: 39 },
      { velocity: 41 },
      { velocity: 38 },
    ]);

    const result = await closeSprint({ sprintId: "sprint-1" });

    expect(result.ok).toBe(true);
    expect(mocks.anomalyCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rule: "VELOCITY_DROP",
          severity: "HIGH",
        }),
      })
    );
  });

  it("does NOT create anomaly when velocity within normal range", async () => {
    // Mean=40, σ≈1.5 → threshold=37. Velocity 39 > 37 → OK.
    mocks.storyAggregate.mockResolvedValue({ _sum: { storyPoints: 39 } });
    mocks.sprintFindMany.mockResolvedValue([
      { velocity: 40 },
      { velocity: 42 },
      { velocity: 39 },
      { velocity: 41 },
      { velocity: 38 },
    ]);

    await closeSprint({ sprintId: "sprint-1" });

    expect(mocks.anomalyCreate).not.toHaveBeenCalled();
  });

  it("skips velocity check when fewer than 3 history records", async () => {
    mocks.storyAggregate.mockResolvedValue({ _sum: { storyPoints: 5 } });
    mocks.sprintFindMany.mockResolvedValue([
      { velocity: 40 },
      { velocity: 42 },
    ]);

    const result = await closeSprint({ sprintId: "sprint-1" });

    expect(result.ok).toBe(true);
    expect(mocks.anomalyCreate).not.toHaveBeenCalled();
  });
});

// ─── moveStoryOnBoard ─────────────────────────────────────────────────────────

describe("moveStoryOnBoard (AC-003)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({
      ...tenantCtx,
      userId: "user-1",
      role: "DEV",
    });
    mocks.storyFindFirstOrThrow.mockResolvedValue({
      id: "story-1",
      status: "TODO",
    });
    mocks.storyUpdateMany.mockResolvedValue({ count: 1 });
    mocks.stateTransitionCreate.mockResolvedValue({ id: "trans-1" });
    makeTransactionMock();
  });

  it("moves story to IN_PROGRESS and writes StateTransitionHistory (AC-003)", async () => {
    const result = await moveStoryOnBoard({
      storyId: "story-1",
      toColumn: "IN_PROGRESS",
    });

    expect(result.ok).toBe(true);
    expect(mocks.storyUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "IN_PROGRESS" }),
      })
    );
    expect(mocks.stateTransitionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entityType: "Story",
          fromStatus: "TODO",
          toStatus: "IN_PROGRESS",
        }),
      })
    );
  });

  it("rejects move to unknown column", async () => {
    const result = await moveStoryOnBoard({
      storyId: "story-1",
      toColumn: "INVALID_COLUMN",
    });

    expect(result.ok).toBe(false);
  });
});

// ─── submitStandup ────────────────────────────────────────────────────────────

describe("submitStandup blocker match (AC-005)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({
      ...tenantCtx,
      userId: "user-1",
      role: "DEV",
    });
    mocks.queryRaw.mockResolvedValue([]);
    mocks.standupCreate.mockResolvedValue({ id: "standup-1" });
  });

  it("creates standup entry without blocker link when no match (AC-005)", async () => {
    const result = await submitStandup({
      teamId: "team-1",
      yesterday: "Finished auth",
      today: "Start tests",
      blockers: "Waiting for API docs",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.linkedImpedimentId).toBeNull();
    expect(mocks.standupCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ linkedImpedimentId: null }),
      })
    );
  });

  it("links blocker to matching impediment when similarity >= 0.8 (AC-005)", async () => {
    mocks.queryRaw.mockResolvedValue([
      { id: "impediment-1", similarity: 0.92 },
    ]);

    const result = await submitStandup({
      teamId: "team-1",
      blockers: "Can't proceed — waiting for payment API from integration team",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.linkedImpedimentId).toBe("impediment-1");
  });
});

// ─── getSilentMembers ─────────────────────────────────────────────────────────

describe("getSilentMembers (AC-006)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx, role: "SM" });
    mocks.memberFindMany.mockResolvedValue([
      { userId: "dev-a" },
      { userId: "dev-b" },
      { userId: "dev-c" },
    ]);
  });

  it("returns silent members who have no standup entry since sinceDate (AC-006)", async () => {
    // dev-a and dev-b submitted, dev-c did not
    mocks.standupFindMany.mockResolvedValue([
      { userId: "dev-a", date: new Date("2026-06-09") },
      { userId: "dev-b", date: new Date("2026-06-09") },
    ]);

    const result = await getSilentMembers({
      sprintId: "sprint-1",
      teamId: "team-1",
      sinceDate: "2026-06-09T00:00:00.000Z",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.silentMembers).toHaveLength(1);
    expect(result.data.silentMembers[0].userId).toBe("dev-c");
  });

  it("returns empty when all members submitted standup", async () => {
    mocks.standupFindMany.mockResolvedValue([
      { userId: "dev-a", date: new Date("2026-06-09") },
      { userId: "dev-b", date: new Date("2026-06-09") },
      { userId: "dev-c", date: new Date("2026-06-09") },
    ]);

    const result = await getSilentMembers({
      sprintId: "sprint-1",
      teamId: "team-1",
      sinceDate: "2026-06-09T00:00:00.000Z",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.silentMembers).toHaveLength(0);
  });
});

// ─── checkEstimationDrift ─────────────────────────────────────────────────────

describe("checkEstimationDrift (AC-008)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx, role: "SM" });
    mocks.sprintFindFirstOrThrow.mockResolvedValue({
      id: "sprint-1",
      teamId: "team-1",
      status: "ACTIVE",
    });
    mocks.anomalyRunCreate.mockResolvedValue({ id: "run-1" });
    mocks.anomalyCreate.mockResolvedValue({ id: "anomaly-1" });
    makeTransactionMock();
  });

  it("creates ESTIMATION_DRIFT anomaly when points exceed original by >30% (AC-008)", async () => {
    // original=40, current=55 = 37.5% over threshold
    mocks.storyAggregate.mockResolvedValue({ _sum: { storyPoints: 55 } });

    const result = await checkEstimationDrift({
      sprintId: "sprint-1",
      originalPoints: 40,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.drifted).toBe(true);
    expect(result.data.driftPercent).toBeGreaterThan(30);
    expect(mocks.anomalyCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rule: "ESTIMATION_DRIFT",
          severity: "MEDIUM",
        }),
      })
    );
  });

  it("returns drifted=false when change is within threshold", async () => {
    // original=40, current=44 = 10% over — below 30% threshold
    mocks.storyAggregate.mockResolvedValue({ _sum: { storyPoints: 44 } });

    const result = await checkEstimationDrift({
      sprintId: "sprint-1",
      originalPoints: 40,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.drifted).toBe(false);
    expect(mocks.anomalyCreate).not.toHaveBeenCalled();
  });

  it("rejects when sprint is not ACTIVE", async () => {
    mocks.sprintFindFirstOrThrow.mockResolvedValue({
      id: "sprint-1",
      teamId: "team-1",
      status: "PLANNING",
    });

    const result = await checkEstimationDrift({
      sprintId: "sprint-1",
      originalPoints: 40,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("SPRINT_NOT_ACTIVE");
  });
});
