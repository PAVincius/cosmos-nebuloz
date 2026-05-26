import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  generateObject: vi.fn(),
  getAIModel: vi.fn(),
  getActiveProvider: vi.fn(),
  epicFindFirst: vi.fn(),
  epicUpdate: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
}));
vi.mock("@repo/database", () => ({
  database: {
    epic: {
      findFirst: mocks.epicFindFirst,
      update: mocks.epicUpdate,
    },
  },
}));
vi.mock("ai", () => ({
  generateObject: mocks.generateObject,
}));
vi.mock("@repo/ai/lib/models", () => ({
  getAIModel: mocks.getAIModel,
  getActiveProvider: mocks.getActiveProvider,
}));

import { analyzeInvest } from "../../app/actions/epics/analyze-invest";

const defaultEpic = {
  id: "e1",
  title: "Payments module",
  descriptionMd: "Enable credit card payments",
  investScore: null,
  investHash: null,
  investBreakdown: null,
};

const defaultInvestObject = {
  breakdown: { I: 80, N: 70, V: 75, E: 65, S: 60, T: 85 },
  rationale: {
    I: "Independent",
    N: "Negotiable",
    V: "Valuable",
    E: "Estimable",
    S: "Small",
    T: "Testable",
  },
  compositeScore: 72,
  isSmall: true,
};

describe("analyzeInvest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue({});
    mocks.requireTenantSession.mockResolvedValue({ tenantId: "t1", userId: "u1" });
    mocks.epicFindFirst.mockResolvedValue(defaultEpic);
    mocks.epicUpdate.mockResolvedValue({ id: "e1" });
    mocks.generateObject.mockResolvedValue({ object: defaultInvestObject });
    mocks.getAIModel.mockReturnValue({});
    mocks.getActiveProvider.mockReturnValue("anthropic");
  });

  it("returns invest breakdown on valid epic", async () => {
    const result = await analyzeInvest({ epicId: "e1" });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected ok result");
    expect(result.data?.compositeScore).toBe(72);
    expect(result.data?.breakdown.I).toBe(80);
  });

  it("persists result to database after AI call", async () => {
    await analyzeInvest({ epicId: "e1" });
    expect(mocks.epicUpdate).toHaveBeenCalledWith({
      where: { id: "e1", tenantId: "t1" },
      data: expect.objectContaining({
        investScore: 72,
        investBreakdown: defaultInvestObject,
      }),
    });
  });

  it("returns error when epic not found", async () => {
    mocks.epicFindFirst.mockResolvedValueOnce(null);

    const result = await analyzeInvest({ epicId: "nonexistent" });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected error result");
    expect(result.error).toContain("não encontrado");
  });

  it("uses cache when hash matches", async () => {
    const { createHash } = await import("node:crypto");
    const cachedBreakdown = {
      breakdown: { I: 90, N: 85, V: 80, E: 75, S: 70, T: 88 },
      rationale: {
        I: "Cached",
        N: "Cached",
        V: "Cached",
        E: "Cached",
        S: "Cached",
        T: "Cached",
      },
      compositeScore: 81,
      isSmall: true,
    };
    const hash = createHash("sha256")
      .update("Payments module||Enable credit card payments")
      .digest("hex");

    mocks.epicFindFirst.mockResolvedValueOnce({
      ...defaultEpic,
      investScore: 81,
      investHash: hash,
      investBreakdown: cachedBreakdown,
    });

    const result = await analyzeInvest({ epicId: "e1" });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected ok result");
    expect(result.data?.compositeScore).toBe(81);

    // Should NOT call AI or update when cache hits
    expect(mocks.generateObject).not.toHaveBeenCalled();
    expect(mocks.epicUpdate).not.toHaveBeenCalled();
  });

  it("calls AI again when content changes (hash miss)", async () => {
    // Epic has a stored hash but content has changed
    mocks.epicFindFirst.mockResolvedValueOnce({
      ...defaultEpic,
      investScore: 50,
      investHash: "old-stale-hash",
      investBreakdown: { breakdown: {}, compositeScore: 50 },
    });

    const result = await analyzeInvest({ epicId: "e1" });
    expect(result.ok).toBe(true);
    // Should call AI and persist new result
    expect(mocks.generateObject).toHaveBeenCalledTimes(1);
    expect(mocks.epicUpdate).toHaveBeenCalledTimes(1);
  });
});
