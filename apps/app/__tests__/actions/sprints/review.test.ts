import { beforeEach, describe, expect, it, vi } from "vitest";
import { tenantCtx } from "../../helpers/action-mocks";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  revalidatePath: vi.fn(),
  sprintReviewUpsert: vi.fn(),
  sprintFindFirst: vi.fn(),
  sprintUpdateMany: vi.fn(),
  piObjectiveFindFirstOrThrow: vi.fn(),
  piObjectiveUpdateMany: vi.fn(),
  piObjectiveFindMany: vi.fn(),
  piPlanUpdateMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
}));
vi.mock("@repo/database", () => ({
  database: {
    sprintReview: { upsert: mocks.sprintReviewUpsert },
    sprint: {
      findFirst: mocks.sprintFindFirst,
      updateMany: mocks.sprintUpdateMany,
    },
    pIObjective: {
      findFirstOrThrow: mocks.piObjectiveFindFirstOrThrow,
      updateMany: mocks.piObjectiveUpdateMany,
      findMany: mocks.piObjectiveFindMany,
    },
    pIPlan: { updateMany: mocks.piPlanUpdateMany },
    $transaction: mocks.transaction,
  },
}));

import { ppmFormula } from "../../../app/actions/sprints/ppm-formula";
import {
  computePIPPM,
  saveSprintReview,
  updatePIObjectiveAchieved,
} from "../../../app/actions/sprints/review";

// ─── ppmFormula (pure, no mocks needed) ──────────────────────────────────────

describe("ppmFormula (AC-008)", () => {
  it("computes PPM excluding stretch objectives", () => {
    const objectives = [
      {
        plannedValue: 8,
        achievedValue: 7,
        businessValue: 10,
        isStretch: false,
      },
      { plannedValue: 5, achievedValue: 5, businessValue: 8, isStretch: false },
      { plannedValue: 3, achievedValue: 3, businessValue: 6, isStretch: true },
    ];
    const ppm = ppmFormula(objectives);
    // numerator = (7/8)*10 + (5/5)*8 = 8.75 + 8.0 = 16.75
    // denominator = 10 + 8 = 18
    // ppm = 16.75/18 ≈ 0.9306
    expect(ppm).toBeCloseTo(0.9306, 3);
  });

  it("returns 0 when all objectives are stretch", () => {
    const objectives = [
      { plannedValue: 5, achievedValue: 5, businessValue: 8, isStretch: true },
    ];
    expect(ppmFormula(objectives)).toBe(0);
  });

  it("returns 0 when denominator is 0", () => {
    expect(ppmFormula([])).toBe(0);
  });

  it("excludes objectives with plannedValue=0", () => {
    const objectives = [
      {
        plannedValue: 0,
        achievedValue: 5,
        businessValue: 10,
        isStretch: false,
      },
      { plannedValue: 5, achievedValue: 5, businessValue: 8, isStretch: false },
    ];
    const ppm = ppmFormula(objectives);
    // Only second objective counts: (5/5)*8 / 8 = 1.0
    expect(ppm).toBe(1.0);
  });
});

// ─── saveSprintReview ─────────────────────────────────────────────────────────

describe("saveSprintReview (AC-001)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx, role: "PO" });
    mocks.sprintReviewUpsert.mockResolvedValue({
      id: "review-1",
      velocity: 30,
    });
    mocks.sprintUpdateMany.mockResolvedValue({ count: 1 });
    mocks.sprintFindFirst.mockResolvedValue({ id: "sprint-1" });
  });

  it("rejects a sprintId that is not owned by the tenant (IDOR guard)", async () => {
    mocks.sprintFindFirst.mockResolvedValue(null);

    const result = await saveSprintReview({
      sprintId: "sprint-of-another-tenant",
      completedPoints: 40,
      acceptedPoints: 30,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("SPRINT_NOT_FOUND");
    // the upsert key is sprintId alone — never reach it for a foreign sprint
    expect(mocks.sprintReviewUpsert).not.toHaveBeenCalled();
  });

  it("saves review with accepted ≤ completed (AC-001)", async () => {
    const result = await saveSprintReview({
      sprintId: "sprint-1",
      completedPoints: 40,
      acceptedPoints: 30,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.velocity).toBe(30);
    expect(mocks.sprintReviewUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          acceptedPoints: 30,
          completedPoints: 40,
          velocity: 30,
        }),
      })
    );
  });

  it("rejects when acceptedPoints > completedPoints (AC-001)", async () => {
    const result = await saveSprintReview({
      sprintId: "sprint-1",
      completedPoints: 40,
      acceptedPoints: 45,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("ACCEPTED_EXCEEDS_COMPLETED");
    expect(mocks.sprintReviewUpsert).not.toHaveBeenCalled();
  });
});

// ─── updatePIObjectiveAchieved ────────────────────────────────────────────────

describe("updatePIObjectiveAchieved (AC-002)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx, role: "PO" });
    mocks.piObjectiveUpdateMany.mockResolvedValue({ count: 1 });
    mocks.transaction.mockImplementation(
      (fn: (tx: Record<string, unknown>) => unknown) => {
        if (typeof fn === "function") {
          return fn({
            pIObjective: {
              findFirstOrThrow: mocks.piObjectiveFindFirstOrThrow,
              updateMany: mocks.piObjectiveUpdateMany,
            },
          });
        }
        return Promise.all(fn as Promise<unknown>[]);
      }
    );
  });

  it("adds points to achievedValue (AC-002)", async () => {
    mocks.piObjectiveFindFirstOrThrow.mockResolvedValue({
      id: "obj-1",
      achievedValue: 6,
      sprintContributions: {},
    });

    const result = await updatePIObjectiveAchieved({
      objectiveId: "obj-1",
      sprintId: "sprint-3",
      points: 3,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.achievedValue).toBe(9);
    expect(mocks.piObjectiveUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ achievedValue: 9 }),
      })
    );
  });

  it("is idempotent for the same sprint (AC-002)", async () => {
    // Prior: sprint-3 already contributed 3 points, achievedValue=9
    mocks.piObjectiveFindFirstOrThrow.mockResolvedValue({
      id: "obj-1",
      achievedValue: 9,
      sprintContributions: { "sprint-3": 3 },
    });

    // Re-save sprint-3 with same 3 points
    const result = await updatePIObjectiveAchieved({
      objectiveId: "obj-1",
      sprintId: "sprint-3",
      points: 3,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    // 9 - 3 (prior) + 3 (new) = 9: no double-count
    expect(result.data.achievedValue).toBe(9);
  });
});

// ─── computePIPPM ─────────────────────────────────────────────────────────────

describe("computePIPPM (AC-008)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx, role: "RTE" });
    mocks.piPlanUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("computes and stores PPM on PIPlan (AC-008)", async () => {
    mocks.piObjectiveFindMany.mockResolvedValue([
      {
        plannedValue: 8,
        achievedValue: 7,
        businessValue: 10,
        isStretch: false,
      },
      { plannedValue: 5, achievedValue: 5, businessValue: 8, isStretch: false },
      { plannedValue: 3, achievedValue: 3, businessValue: 6, isStretch: true },
    ]);

    const result = await computePIPPM({ piPlanId: "pi-1" });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.ppm).toBeCloseTo(0.9306, 3);
    expect(mocks.piPlanUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { ppm: expect.any(Number) },
      })
    );
  });
});
