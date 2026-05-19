import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  tenantFindFirst: vi.fn(),
  tenantUpdate: vi.fn(),
  pIPlanFindFirst: vi.fn(),
}));

vi.mock("@repo/database", () => ({
  database: {
    tenant: { findFirst: mocks.tenantFindFirst, update: mocks.tenantUpdate },
    pIPlan: { findFirst: mocks.pIPlanFindFirst },
  },
}));

import {
  checkCopilotQuota,
  incrementCopilotUsage,
} from "../../app/actions/safe-copilot/quota";

const TID = "tenant-1";
const CURRENT_PI = "pi-current";

function tenantWithPlan(
  plan: string,
  aiUsage: Record<string, unknown> | null = null
) {
  return {
    plan,
    metadata: aiUsage ? { aiUsage } : null,
  };
}

describe("checkCopilotQuota", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pIPlanFindFirst.mockResolvedValue({ id: CURRENT_PI });
    mocks.tenantUpdate.mockResolvedValue({});
  });

  it("throws when tenant not found", async () => {
    mocks.tenantFindFirst.mockResolvedValue(null);
    await expect(checkCopilotQuota(TID)).rejects.toThrow("Tenant");
  });

  it("UNIVERSE plan — always allowed, limit=-1", async () => {
    mocks.tenantFindFirst.mockResolvedValue(tenantWithPlan("UNIVERSE"));
    const result = await checkCopilotQuota(TID);
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(-1);
    expect(result.remainingUses).toBe(-1);
  });

  it("ORBIT plan — allowed when usedThisPi < 20", async () => {
    mocks.tenantFindFirst.mockResolvedValue(
      tenantWithPlan("ORBIT", {
        currentPiId: CURRENT_PI,
        copilotUsedThisPi: 5,
        copilotUsedTotal: 5,
        copilotInteractionsUsed: 5,
      })
    );
    const result = await checkCopilotQuota(TID);
    expect(result.allowed).toBe(true);
    expect(result.usedThisPi).toBe(5);
    expect(result.remainingUses).toBe(15);
  });

  it("ORBIT plan — denied when limit reached", async () => {
    mocks.tenantFindFirst.mockResolvedValue(
      tenantWithPlan("ORBIT", {
        currentPiId: CURRENT_PI,
        copilotUsedThisPi: 20,
        copilotUsedTotal: 20,
        copilotInteractionsUsed: 20,
      })
    );
    const result = await checkCopilotQuota(TID);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/20/);
  });

  it("resets usage when PI changes", async () => {
    mocks.tenantFindFirst.mockResolvedValue(
      tenantWithPlan("GALAXY", {
        currentPiId: "old-pi",
        copilotUsedThisPi: 100,
        copilotUsedTotal: 100,
        copilotInteractionsUsed: 100,
      })
    );
    mocks.pIPlanFindFirst.mockResolvedValue({ id: "new-pi" });
    const result = await checkCopilotQuota(TID);
    expect(result.usedThisPi).toBe(0);
    expect(result.allowed).toBe(true);
  });

  it("unknown plan — denied (limit=0)", async () => {
    mocks.tenantFindFirst.mockResolvedValue(tenantWithPlan("UNKNOWN"));
    const result = await checkCopilotQuota(TID);
    expect(result.allowed).toBe(false);
  });
});

describe("incrementCopilotUsage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pIPlanFindFirst.mockResolvedValue({ id: CURRENT_PI });
    mocks.tenantUpdate.mockResolvedValue({});
  });

  it("increments counters on same PI", async () => {
    mocks.tenantFindFirst.mockResolvedValue(
      tenantWithPlan("GALAXY", {
        currentPiId: CURRENT_PI,
        copilotUsedThisPi: 3,
        copilotUsedTotal: 10,
        copilotInteractionsUsed: 10,
      })
    );
    await incrementCopilotUsage(TID);
    expect(mocks.tenantUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TID },
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            aiUsage: expect.objectContaining({
              copilotUsedThisPi: 4,
              copilotUsedTotal: 11,
            }),
          }),
        }),
      })
    );
  });

  it("resets usedThisPi to 1 when PI rotates", async () => {
    mocks.tenantFindFirst.mockResolvedValue(
      tenantWithPlan("GALAXY", {
        currentPiId: "old-pi",
        copilotUsedThisPi: 50,
        copilotUsedTotal: 50,
        copilotInteractionsUsed: 50,
      })
    );
    mocks.pIPlanFindFirst.mockResolvedValue({ id: "new-pi" });
    await incrementCopilotUsage(TID);
    const call = mocks.tenantUpdate.mock.calls[0][0];
    expect(call.data.metadata.aiUsage.copilotUsedThisPi).toBe(1);
    expect(call.data.metadata.aiUsage.currentPiId).toBe("new-pi");
  });

  it("handles tenant with no prior metadata", async () => {
    mocks.tenantFindFirst.mockResolvedValue({ metadata: null });
    await incrementCopilotUsage(TID);
    const call = mocks.tenantUpdate.mock.calls[0][0];
    expect(call.data.metadata.aiUsage.copilotUsedThisPi).toBe(1);
  });
});
