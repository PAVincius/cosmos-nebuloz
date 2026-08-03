import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  originateCapacitySnapshot,
  originateFlowSnapshot,
} from "../../../app/actions/sprints/snapshot-origination";

function makeDb(overrides: Record<string, unknown> = {}) {
  return {
    story: {
      findMany: vi.fn().mockResolvedValue([]),
      aggregate: vi.fn().mockResolvedValue({ _sum: { storyPoints: 0 } }),
    },
    defect: { findMany: vi.fn().mockResolvedValue([]) },
    stateTransitionHistory: { findMany: vi.fn().mockResolvedValue([]) },
    flowMetricSnapshot: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "snap-1" }),
    },
    teamMemberAssignment: { findMany: vi.fn().mockResolvedValue([]) },
    teamCapacitySnapshot: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "cap-1" }),
    },
    ...overrides,
  } as any;
}

const params = { tenantId: "t1", teamId: "team-1", sprintId: "sprint-1" };

describe("originateFlowSnapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes exactly one FlowMetricSnapshot keyed on (tenantId, scope, scopeId, period, periodRef)", async () => {
    const db = makeDb({
      story: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "s1",
            status: "DONE",
            storyPoints: 5,
            startedAt: new Date("2026-01-01T00:00:00Z"),
            completedAt: new Date("2026-01-03T00:00:00Z"),
            createdAt: new Date("2025-12-30T00:00:00Z"),
          },
          {
            id: "s2",
            status: "IN_PROGRESS",
            storyPoints: 3,
            startedAt: null,
            completedAt: null,
            createdAt: new Date("2025-12-30T00:00:00Z"),
          },
        ]),
      },
    });

    const result = await originateFlowSnapshot(db, params);

    expect(result).toEqual({ created: true });
    expect(db.flowMetricSnapshot.create).toHaveBeenCalledTimes(1);
    expect(db.flowMetricSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: "t1",
          scope: "team",
          scopeId: "team-1",
          period: "sprint",
          periodRef: "sprint-1",
          flowVelocityTotal: 5,
          plannedItems: 2,
          deliveredItems: 1,
          flowLoadCurrent: 1, // the IN_PROGRESS story
        }),
      })
    );
  });

  it("is idempotent — skips the write when a snapshot already exists for this sprint", async () => {
    const db = makeDb({
      flowMetricSnapshot: {
        findFirst: vi.fn().mockResolvedValue({ id: "existing" }),
        create: vi.fn(),
      },
    });

    const result = await originateFlowSnapshot(db, params);

    expect(result).toEqual({ created: false });
    expect(db.flowMetricSnapshot.create).not.toHaveBeenCalled();
    expect(db.story.findMany).not.toHaveBeenCalled();
  });

  it("does not persist a second row when two originations race on the same key — mirrors TeamCapacitySnapshot's @@unique race-safety: pre-check races (both see null), the DB unique constraint stops the duplicate write, and the error propagates for the caller's try/catch (lifecycle.ts / backfill-snapshots.ts) to catch", async () => {
    const rows: Record<string, unknown>[] = [];
    const db = makeDb({
      flowMetricSnapshot: {
        // Simulate the race: both concurrent callers' pre-check ran before
        // either write landed, so findFirst returns null for both.
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi
          .fn()
          .mockImplementation(({ data }: { data: Record<string, unknown> }) => {
            const isDuplicate = rows.some(
              (r) =>
                r.tenantId === data.tenantId &&
                r.scope === data.scope &&
                r.scopeId === data.scopeId &&
                r.period === data.period &&
                r.periodRef === data.periodRef
            );
            if (isDuplicate) {
              const error = new Error(
                "Unique constraint failed on the fields: (`tenantId`,`scope`,`scopeId`,`period`,`periodRef`)"
              ) as Error & { code: string };
              error.code = "P2002";
              return Promise.reject(error);
            }
            rows.push(data);
            return Promise.resolve({ id: `snap-${rows.length}` });
          }),
      },
    });

    const first = await originateFlowSnapshot(db, params);
    expect(first).toEqual({ created: true });

    await expect(originateFlowSnapshot(db, params)).rejects.toMatchObject({
      code: "P2002",
    });

    expect(rows).toHaveLength(1);
    expect(db.flowMetricSnapshot.create).toHaveBeenCalledTimes(2);
  });

  it("computes flowPredictability as deliveredItems/plannedItems", async () => {
    const db = makeDb({
      story: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "s1",
            status: "DONE",
            storyPoints: 2,
            startedAt: new Date(),
            completedAt: new Date(),
            createdAt: new Date(),
          },
          {
            id: "s2",
            status: "TODO",
            storyPoints: 2,
            startedAt: null,
            completedAt: null,
            createdAt: new Date(),
          },
        ]),
      },
    });

    await originateFlowSnapshot(db, params);

    expect(db.flowMetricSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ flowPredictability: 0.5 }),
      })
    );
  });
});

describe("originateCapacitySnapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const capacityParams = { ...params, velocity: 30 };

  it("writes exactly one TeamCapacitySnapshot keyed on (tenantId, sprintId, teamId)", async () => {
    const db = makeDb({
      teamMemberAssignment: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ capacityFactor: 1 }, { capacityFactor: 0.5 }]),
      },
      story: {
        findMany: vi.fn().mockResolvedValue([]),
        aggregate: vi.fn().mockResolvedValue({ _sum: { storyPoints: 40 } }),
      },
    });

    const result = await originateCapacitySnapshot(db, capacityParams);

    expect(result).toEqual({ created: true });
    expect(db.teamCapacitySnapshot.create).toHaveBeenCalledTimes(1);
    expect(db.teamCapacitySnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: "t1",
          sprintId: "sprint-1",
          teamId: "team-1",
          totalMembersCommitted: 2,
          totalCapacityFactor: 1.5,
          expectedSpNextSprint: 40,
          actualSpDelivered: 30,
          actualCapacityUtil: 0.75,
        }),
      })
    );
  });

  it("is idempotent — skips the write when a snapshot already exists for this sprint+team", async () => {
    const db = makeDb({
      teamCapacitySnapshot: {
        findFirst: vi.fn().mockResolvedValue({ id: "existing" }),
        create: vi.fn(),
      },
    });

    const result = await originateCapacitySnapshot(db, capacityParams);

    expect(result).toEqual({ created: false });
    expect(db.teamCapacitySnapshot.create).not.toHaveBeenCalled();
    expect(db.teamMemberAssignment.findMany).not.toHaveBeenCalled();
  });

  it("does not clamp utilization over 100% (real over-commitment signal)", async () => {
    const db = makeDb({
      story: {
        findMany: vi.fn().mockResolvedValue([]),
        aggregate: vi.fn().mockResolvedValue({ _sum: { storyPoints: 20 } }),
      },
    });

    await originateCapacitySnapshot(db, { ...capacityParams, velocity: 30 });

    expect(db.teamCapacitySnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actualCapacityUtil: 1.5 }),
      })
    );
  });

  it("guards divide-by-zero when nothing was committed to the sprint", async () => {
    const db = makeDb({
      story: {
        findMany: vi.fn().mockResolvedValue([]),
        aggregate: vi.fn().mockResolvedValue({ _sum: { storyPoints: null } }),
      },
    });

    await originateCapacitySnapshot(db, { ...capacityParams, velocity: 0 });

    expect(db.teamCapacitySnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          expectedSpNextSprint: 0,
          actualCapacityUtil: 0,
        }),
      })
    );
  });
});
