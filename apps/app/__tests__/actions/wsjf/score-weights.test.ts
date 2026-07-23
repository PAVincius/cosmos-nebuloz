// score-weights.test.ts — Task 16: verifies scoreWsjfAction applies the
// tenant's WsjfSettings weights (weightBv/weightTc/weightRr) and that the
// 1.0 defaults reproduce the classic (pre-Task-16) formula byte-for-byte.
// Kept separate from score.test.ts, which must stay unmodified.
import { beforeEach, describe, expect, it, vi } from "vitest";

const featureBase = {
  id: "feat-1",
  bv: 8,
  tc: 5,
  rr: 3,
  js: 5,
  wsjfScore: 3.2,
  piPlanId: null,
  wsjfJobSizeLockedBy: null,
};

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  revalidatePath: vi.fn(),
  featureFindFirstOrThrow: vi.fn(),
  featureUpdate: vi.fn(),
  featureFindMany: vi.fn(),
  scoringEventCreate: vi.fn(),
  transaction: vi.fn(),
  wsjfSettingsFindUnique: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
}));
vi.mock("@repo/database", () => ({
  database: {
    feature: {
      findFirstOrThrow: mocks.featureFindFirstOrThrow,
      update: mocks.featureUpdate,
      findMany: mocks.featureFindMany,
    },
    scoringEvent: {
      create: mocks.scoringEventCreate,
    },
    wsjfSettings: {
      findUnique: mocks.wsjfSettingsFindUnique,
    },
    $transaction: mocks.transaction,
  },
}));

import { scoreWsjfAction } from "../../../app/actions/wsjf/score";

describe("scoreWsjfAction — tenant WSJF weights", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({
      tenantId: "tenant-test",
      userId: "user-test",
      role: "PO",
    });
    mocks.featureFindFirstOrThrow.mockResolvedValue(featureBase);
    mocks.featureFindMany.mockResolvedValue([{ id: "feat-1", wsjfScore: 3.2 }]);
    mocks.featureUpdate.mockResolvedValue({});
    mocks.scoringEventCreate.mockResolvedValue({});
    mocks.transaction.mockImplementation((fn: (tx: unknown) => unknown) => {
      if (typeof fn === "function") {
        return fn({
          feature: { update: mocks.featureUpdate },
          scoringEvent: { create: mocks.scoringEventCreate },
        });
      }
      return Promise.all(fn as Promise<unknown>[]);
    });
  });

  it("reproduces the classic formula when no settings row exists (defaults 1.0/1.0/1.0)", async () => {
    mocks.wsjfSettingsFindUnique.mockResolvedValue(null);

    const result = await scoreWsjfAction({
      featureId: "feat-1",
      bv: 8,
      tc: 5,
      rr: 3,
      js: 5,
      source: "MANUAL",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    // costOfDelay = 8+5+3 = 16, wsjfScore = 16/5 = 3.20 — identical to the
    // pre-Task-16 unweighted formula.
    expect(result.data.wsjfScore).toBe(3.2);
  });

  it("applies weightBv to scale Business Value's contribution", async () => {
    mocks.wsjfSettingsFindUnique.mockResolvedValue({
      weightBv: 2,
      weightTc: 1,
      weightRr: 1,
      scale: "fibonacci",
      autoRecalc: "daily",
      rebalanceApprover: "rte",
      staleDays: 14,
    });

    const result = await scoreWsjfAction({
      featureId: "feat-1",
      bv: 8,
      tc: 5,
      rr: 3,
      js: 5,
      source: "MANUAL",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    // costOfDelay = (8*2)+5+3 = 24, wsjfScore = 24/5 = 4.80
    expect(result.data.wsjfScore).toBe(4.8);
  });
});
