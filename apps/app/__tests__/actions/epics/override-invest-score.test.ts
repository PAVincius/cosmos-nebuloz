import { beforeEach, describe, expect, it, vi } from "vitest";
import { tenantCtx } from "../../helpers/action-mocks";

const epicBase = {
  id: "epic-1",
  investScore: 42,
  lifecycleStatus: "ANALYZING",
};

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  epicFindFirstOrThrow: vi.fn(),
  epicUpdate: vi.fn(),
  decisionLogCreate: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
}));
vi.mock("@repo/database", () => ({
  database: {
    epic: {
      findFirstOrThrow: mocks.epicFindFirstOrThrow,
      update: mocks.epicUpdate,
    },
    decisionLogEntry: {
      create: mocks.decisionLogCreate,
    },
  },
}));

import { overrideInvestScore } from "../../../app/actions/epics/override-invest-score";

describe("overrideInvestScore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({
      ...tenantCtx,
      role: "RTE",
    });
    mocks.epicFindFirstOrThrow.mockResolvedValue(epicBase);
    mocks.epicUpdate.mockResolvedValue({});
    mocks.decisionLogCreate.mockResolvedValue({});
  });

  it("RTE can override invest score", async () => {
    const result = await overrideInvestScore({
      epicId: "epic-1",
      score: 65,
      justification: "Risk reduction validated by SA review",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.investScore).toBe(65);
    expect(mocks.epicUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          investScore: 65,
          investScoreOverridden: true,
        }),
      })
    );
  });

  it("writes DecisionLogEntry with prevScore and newScore", async () => {
    await overrideInvestScore({
      epicId: "epic-1",
      score: 65,
      justification: "Risk reduction validated by SA review",
    });

    expect(mocks.decisionLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tipo: "INVEST_OVERRIDE",
          targetType: "epic",
          targetId: "epic-1",
          dadosSuporte: expect.objectContaining({
            prevScore: 42,
            newScore: 65,
          }),
        }),
      })
    );
  });

  it("ADMIN can override invest score", async () => {
    mocks.requireTenantSession.mockResolvedValue({
      ...tenantCtx,
      role: "ADMIN",
    });

    const result = await overrideInvestScore({
      epicId: "epic-1",
      score: 55,
      justification: "Approved by portfolio governance board",
    });

    expect(result.ok).toBe(true);
  });

  it("non-RTE role is rejected with FORBIDDEN", async () => {
    mocks.requireTenantSession.mockResolvedValue({
      ...tenantCtx,
      role: "DEV",
    });

    const result = await overrideInvestScore({
      epicId: "epic-1",
      score: 65,
      justification: "Risk reduction validated by SA review",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("FORBIDDEN");
    expect(mocks.epicUpdate).not.toHaveBeenCalled();
  });

  it("rejects score out of 0-100 range", async () => {
    const result = await overrideInvestScore({
      epicId: "epic-1",
      score: 150,
      justification: "Too high",
    });

    expect(result.ok).toBe(false);
  });

  it("rejects justification under 10 chars", async () => {
    const result = await overrideInvestScore({
      epicId: "epic-1",
      score: 65,
      justification: "Short",
    });

    expect(result.ok).toBe(false);
  });
});
