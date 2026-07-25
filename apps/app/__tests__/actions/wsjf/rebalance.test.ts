import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthError, tenantCtx } from "../../helpers/action-mocks";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  requireRole: vi.fn(),
  tenantFindFirst: vi.fn(),
  piPlanFindFirst: vi.fn(),
  epicFindMany: vi.fn(),
  teamFindMany: vi.fn(),
  tenantUpdate: vi.fn(),
  generateObject: vi.fn(),
  getAIModel: vi.fn(),
  getActiveProvider: vi.fn(),
  createRebalanceTrace: vi.fn(),
  resolveModelName: vi.fn(),
  flushLangfuse: vi.fn(),
  getMemberVelocityStats: vi.fn(),
  getWSJFConfig: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
  requireRole: mocks.requireRole,
  AuthError: MockAuthError,
}));
vi.mock("@repo/database", () => ({
  database: {
    tenant: { findFirst: mocks.tenantFindFirst, update: mocks.tenantUpdate },
    pIPlan: { findFirst: mocks.piPlanFindFirst },
    epic: { findMany: mocks.epicFindMany },
    team: { findMany: mocks.teamFindMany },
  },
}));
vi.mock("ai", () => ({ generateObject: mocks.generateObject }));
vi.mock("@repo/ai/lib/models", () => ({
  getAIModel: mocks.getAIModel,
  getActiveProvider: mocks.getActiveProvider,
}));
vi.mock("@repo/ai/lib/langfuse", () => ({
  createRebalanceTrace: mocks.createRebalanceTrace,
  resolveModelName: mocks.resolveModelName,
  flushLangfuse: mocks.flushLangfuse,
}));
vi.mock("@/app/actions/velocity", () => ({
  getMemberVelocityStats: mocks.getMemberVelocityStats,
}));
vi.mock("@/app/actions/wsjf", () => ({
  getWSJFConfig: mocks.getWSJFConfig,
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

import {
  getAIAccessStatus,
  rebalanceWSJFWithAI,
} from "../../../app/actions/wsjf/rebalance";

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const sampleEpics = [
  {
    id: "e1",
    title: "Epic 1",
    statusId: "IN_PROGRESS",
    features: [
      {
        id: "f1",
        title: "Feature 1",
        statusId: "BACKLOG",
        storyPoints: 3,
        bv: 8,
        tc: 5,
        rr: 3,
        js: 2,
        wsjfScore: 5,
        assigneeUserId: null,
        blocks: [],
        blockedBy: [],
        completedAt: null,
      },
    ],
  },
];

const sampleTeams = [
  { id: "t1", name: "Team A", velocity: 20, sprintLengthDays: 14, members: [] },
];

const sampleGenerateResult = {
  object: {
    suggestions: [
      {
        featureId: "f1",
        suggestedBV: 9,
        suggestedTC: 5,
        suggestedRR: 3,
        suggestedJS: 2,
        suggestedWSJF: 6,
        delta: 1,
        confidence: 0.9,
        justification: "test",
        impactFactor: "velocity_trend",
        modifiedCount: 1,
        unchangedCount: 0,
      },
    ],
    modifiedCount: 1,
    unchangedCount: 0,
    portfolioInsight: "test insight",
  },
  usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
};

// ─── beforeEach: happy-path defaults ─────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  mocks.headers.mockResolvedValue(new Headers());
  mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx, role: "RTE" });
  mocks.requireRole.mockReturnValue(undefined); // pass by default

  // UNIVERSE plan – always allowed
  mocks.tenantFindFirst.mockResolvedValue({
    plan: "UNIVERSE",
    metadata: {
      wsjfAiUsage: { currentPiId: "pi-1", usedThisPi: 0, usedTotal: 0 },
    },
  });
  mocks.piPlanFindFirst.mockResolvedValue({ id: "pi-1" });

  // rebalanceWSJFWithAI deps
  mocks.epicFindMany.mockResolvedValue(sampleEpics);
  mocks.teamFindMany.mockResolvedValue(sampleTeams);
  mocks.getMemberVelocityStats.mockResolvedValue([]);
  mocks.getWSJFConfig.mockResolvedValue({ scale: [1, 2, 3, 5, 8, 13] });
  mocks.getActiveProvider.mockReturnValue("anthropic");
  mocks.getAIModel.mockReturnValue({ id: "claude-mock" });
  mocks.resolveModelName.mockReturnValue("claude-sonnet-4-5");
  mocks.createRebalanceTrace.mockReturnValue(null); // no-op langfuse trace
  mocks.flushLangfuse.mockResolvedValue(undefined);
  mocks.tenantUpdate.mockResolvedValue({});
  mocks.generateObject.mockResolvedValue(sampleGenerateResult);
});

// ─── getAIAccessStatus ────────────────────────────────────────────────────────

describe("getAIAccessStatus", () => {
  it("UNIVERSE plan → allowed: true, remainingUses: -1 (infinite)", async () => {
    mocks.tenantFindFirst.mockResolvedValue({
      plan: "UNIVERSE",
      metadata: {
        wsjfAiUsage: { currentPiId: "pi-1", usedThisPi: 2, usedTotal: 10 },
      },
    });

    const result = await getAIAccessStatus();

    expect(result.allowed).toBe(true);
    expect(result.remainingUses).toBe(-1);
    expect(result.plan).toBe("UNIVERSE");
  });

  it("ORBIT plan, usedTotal < 1 → allowed: true, remainingUses: 1", async () => {
    mocks.tenantFindFirst.mockResolvedValue({
      plan: "ORBIT",
      metadata: {
        wsjfAiUsage: { currentPiId: "pi-1", usedThisPi: 0, usedTotal: 0 },
      },
    });

    const result = await getAIAccessStatus();

    expect(result.allowed).toBe(true);
    expect(result.remainingUses).toBe(1);
    expect(result.plan).toBe("ORBIT");
  });

  it("ORBIT plan, usedTotal >= 1 → allowed: false, has reason message", async () => {
    mocks.tenantFindFirst.mockResolvedValue({
      plan: "ORBIT",
      metadata: {
        wsjfAiUsage: { currentPiId: "pi-1", usedThisPi: 1, usedTotal: 1 },
      },
    });

    const result = await getAIAccessStatus();

    expect(result.allowed).toBe(false);
    expect(result.reason).toBeTruthy();
    expect(result.reason).toMatch(/ORBIT/i);
  });

  it("GALAXY plan, usedThisPi < 5 → allowed: true", async () => {
    mocks.tenantFindFirst.mockResolvedValue({
      plan: "GALAXY",
      metadata: {
        wsjfAiUsage: { currentPiId: "pi-1", usedThisPi: 3, usedTotal: 3 },
      },
    });

    const result = await getAIAccessStatus();

    expect(result.allowed).toBe(true);
    expect(result.remainingUses).toBe(2);
  });

  it("GALAXY plan, usedThisPi >= 5 → allowed: false, has reason message", async () => {
    mocks.tenantFindFirst.mockResolvedValue({
      plan: "GALAXY",
      metadata: {
        wsjfAiUsage: { currentPiId: "pi-1", usedThisPi: 5, usedTotal: 5 },
      },
    });

    const result = await getAIAccessStatus();

    expect(result.allowed).toBe(false);
    expect(result.reason).toBeTruthy();
    expect(result.reason).toMatch(/GALAXY/i);
  });

  it("throws when tenant not found", async () => {
    mocks.tenantFindFirst.mockResolvedValue(null);

    await expect(getAIAccessStatus()).rejects.toThrow(/tenant/i);
  });

  it("PI changed → resets usedThisPi to 0 (piChanged branch)", async () => {
    // stored currentPiId = "pi-old", but latest PI is "pi-new"
    mocks.tenantFindFirst.mockResolvedValue({
      plan: "GALAXY",
      metadata: {
        wsjfAiUsage: { currentPiId: "pi-old", usedThisPi: 5, usedTotal: 5 },
      },
    });
    mocks.piPlanFindFirst.mockResolvedValue({ id: "pi-new" });

    const result = await getAIAccessStatus();

    // After PI reset, usedThisPi effectively becomes 0 → allowed
    expect(result.allowed).toBe(true);
    expect(result.usedThisPi).toBe(0);
  });
});

// ─── rebalanceWSJFWithAI ──────────────────────────────────────────────────────

describe("rebalanceWSJFWithAI", () => {
  it("throws when role is insufficient (non-RTE/ADMIN/STE)", async () => {
    mocks.requireRole.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "Insufficient role");
    });

    await expect(rebalanceWSJFWithAI()).rejects.toThrow(/insufficient role/i);
    expect(mocks.generateObject).not.toHaveBeenCalled();
  });

  it("throws when access.allowed is false (plan limit reached)", async () => {
    // ORBIT exhausted
    mocks.tenantFindFirst.mockResolvedValue({
      plan: "ORBIT",
      metadata: {
        wsjfAiUsage: { currentPiId: "pi-1", usedThisPi: 1, usedTotal: 1 },
      },
    });

    await expect(rebalanceWSJFWithAI()).rejects.toThrow();
    expect(mocks.generateObject).not.toHaveBeenCalled();
  });

  it("throws when no features in portfolio", async () => {
    // epics with empty features arrays → totalFeatures === 0
    mocks.epicFindMany.mockResolvedValue([
      { id: "e1", title: "Empty Epic", statusId: "BACKLOG", features: [] },
    ]);

    await expect(rebalanceWSJFWithAI()).rejects.toThrow(/feature/i);
    expect(mocks.generateObject).not.toHaveBeenCalled();
  });

  it("happy path: calls generateObject, returns RebalancingResult with suggestions", async () => {
    const result = await rebalanceWSJFWithAI();

    expect(mocks.generateObject).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      modifiedCount: expect.any(Number),
      unchangedCount: expect.any(Number),
      portfolioInsight: expect.any(String),
      suggestions: expect.any(Array),
    });

    // The confident suggestion should be enriched with featureTitle
    const [suggestion] = result.suggestions;
    expect(suggestion).toMatchObject({
      featureId: "f1",
      featureTitle: "Feature 1",
      epicTitle: "Epic 1",
    });

    expect(result.modifiedCount).toBeGreaterThanOrEqual(0);
  });
});
