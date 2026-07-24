import { beforeEach, describe, expect, it, vi } from "vitest";
import { originateFlowSnapshot } from "../../../app/actions/sprints/snapshot-origination";

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
    ...overrides,
    // biome-ignore lint/suspicious/noExplicitAny: test double, structural subset of the Prisma client
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
