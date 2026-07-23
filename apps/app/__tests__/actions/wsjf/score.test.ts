import { beforeEach, describe, expect, it, vi } from "vitest";
import { tenantCtx } from "../../helpers/action-mocks";

const featureBase = {
  id: "feat-1",
  bv: 5,
  tc: 3,
  rr: 2,
  js: 3,
  wsjfScore: 3.33,
  piPlanId: "pi-1",
  wsjfJobSizeLockedBy: null,
};

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  revalidatePath: vi.fn(),
  featureFindFirstOrThrow: vi.fn(),
  featureUpdate: vi.fn(),
  featureUpdateMany: vi.fn(),
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
      updateMany: mocks.featureUpdateMany,
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

import {
  lockJobSizeAction,
  scoreWsjfAction,
} from "../../../app/actions/wsjf/score";

describe("scoreWsjfAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx, role: "PO" });
    mocks.featureFindFirstOrThrow.mockResolvedValue(featureBase);
    mocks.featureFindMany.mockResolvedValue([
      { id: "feat-1", wsjfScore: 3.2 },
      { id: "feat-2", wsjfScore: 6.4 },
    ]);
    mocks.featureUpdate.mockResolvedValue({});
    mocks.scoringEventCreate.mockResolvedValue({});
    mocks.wsjfSettingsFindUnique.mockResolvedValue(null);
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

  it("computes WSJF formula correctly", async () => {
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
    // costOfDelay = 8+5+3 = 16, wsjfScore = 16/5 = 3.20
    expect(result.data.wsjfScore).toBe(3.2);
  });

  it("creates immutable ScoringEvent with prev values", async () => {
    await scoreWsjfAction({
      featureId: "feat-1",
      bv: 8,
      tc: 5,
      rr: 3,
      js: 5,
      source: "MANUAL",
    });

    expect(mocks.scoringEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          prevBv: featureBase.bv,
          prevTc: featureBase.tc,
          prevRr: featureBase.rr,
          prevJs: featureBase.js,
          bv: 8,
          tc: 5,
          rr: 3,
          js: 5,
          source: "MANUAL",
        }),
      })
    );
  });

  it("COPILOT source stored when AI suggests", async () => {
    await scoreWsjfAction({
      featureId: "feat-1",
      bv: 8,
      tc: 5,
      rr: 3,
      js: 5,
      source: "COPILOT",
    });

    expect(mocks.scoringEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ source: "COPILOT" }),
      })
    );
  });

  it("rejects non-Fibonacci bv value", async () => {
    const result = await scoreWsjfAction({
      featureId: "feat-1",
      bv: 7, // not Fibonacci
      tc: 5,
      rr: 3,
      js: 5,
      source: "MANUAL",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("INVALID_WSJF_VALUE");
  });

  it("rejects non-Fibonacci js value", async () => {
    const result = await scoreWsjfAction({
      featureId: "feat-1",
      bv: 8,
      tc: 5,
      rr: 3,
      js: 4, // not Fibonacci
      source: "MANUAL",
    });

    expect(result.ok).toBe(false);
  });

  it("blocks js change when locked", async () => {
    mocks.featureFindFirstOrThrow.mockResolvedValue({
      ...featureBase,
      wsjfJobSizeLockedBy: "sa-user-1",
    });

    const result = await scoreWsjfAction({
      featureId: "feat-1",
      bv: 8,
      tc: 5,
      rr: 3,
      js: 8, // different from locked js=3
      source: "MANUAL",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("WSJF_JOB_SIZE_LOCKED");
  });

  it("allows score when js unchanged and locked", async () => {
    mocks.featureFindFirstOrThrow.mockResolvedValue({
      ...featureBase,
      js: 5,
      wsjfJobSizeLockedBy: "sa-user-1",
    });

    const result = await scoreWsjfAction({
      featureId: "feat-1",
      bv: 8,
      tc: 5,
      rr: 3,
      js: 5, // same as locked value
      source: "MANUAL",
    });

    expect(result.ok).toBe(true);
  });
});

describe("lockJobSizeAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({
      ...tenantCtx,
      role: "STE",
    });
    mocks.featureUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("STE can lock job size", async () => {
    const result = await lockJobSizeAction({
      featureId: "feat-1",
      lock: true,
    });

    expect(result.ok).toBe(true);
    expect(mocks.featureUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          wsjfJobSizeLockedBy: tenantCtx.userId,
        }),
      })
    );
  });

  it("PO role is rejected with FORBIDDEN", async () => {
    mocks.requireTenantSession.mockResolvedValue({
      ...tenantCtx,
      role: "PO",
    });

    const result = await lockJobSizeAction({
      featureId: "feat-1",
      lock: true,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("FORBIDDEN");
  });

  it("unlock clears wsjfJobSizeLockedBy", async () => {
    const result = await lockJobSizeAction({
      featureId: "feat-1",
      lock: false,
    });

    expect(result.ok).toBe(true);
    expect(mocks.featureUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          wsjfJobSizeLockedBy: null,
        }),
      })
    );
  });
});
