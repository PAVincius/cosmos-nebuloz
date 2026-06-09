import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthError, tenantCtx } from "../../helpers/action-mocks";

const RE_PI_NOT_FOUND = /PI não encontrado/i;
const RE_ROLE_DENIED = /role denied/;
const RE_INVALID_TRANSITION = /Transição inválida/i;
const RE_SESSION_NOT_FOUND = /não encontrada/i;

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  requireRole: vi.fn(),
  revalidatePath: vi.fn(),
  applyVoteEvent: vi.fn(),
  // pISession
  piSessionFindFirst: vi.fn(),
  piSessionCreate: vi.fn(),
  piSessionFindMany: vi.fn(),
  // pIPlan
  piPlanFindFirst: vi.fn(),
  // confidenceVoteSession
  confidenceFindFirst: vi.fn(),
  confidenceCreate: vi.fn(),
  confidenceFindMany: vi.fn(),
  confidenceUpdate: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
  requireRole: mocks.requireRole,
  AuthError: MockAuthError,
}));
vi.mock("@repo/database", () => ({
  database: {
    pISession: {
      findFirst: mocks.piSessionFindFirst,
      create: mocks.piSessionCreate,
      findMany: mocks.piSessionFindMany,
    },
    pIPlan: {
      findFirst: mocks.piPlanFindFirst,
    },
    confidenceVoteSession: {
      findFirst: mocks.confidenceFindFirst,
      create: mocks.confidenceCreate,
      findMany: mocks.confidenceFindMany,
      update: mocks.confidenceUpdate,
    },
  },
}));
vi.mock("@repo/safe-engine", () => ({
  applyVoteEvent: mocks.applyVoteEvent,
}));

import {
  createReplanSession,
  getAllVoteRounds,
  getOrCreatePISession,
  getOrCreateVoteRound,
  sendVoteEvent,
} from "../../../app/actions/arts/confidence-vote";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const PI_SESSION = {
  id: "pi-session-1",
  tenantId: tenantCtx.tenantId,
  piPlanId: "pi-plan-1",
  type: "PLANNING" as const,
  createdAt: new Date(),
};

const REPLAN_SESSION = {
  ...PI_SESSION,
  id: "pi-session-2",
  type: "REPLAN" as const,
};

const PI_PLAN = {
  id: "pi-plan-1",
  tenantId: tenantCtx.tenantId,
  art: { id: "art-1" },
};

const VOTE_ROUND = {
  id: "vote-round-1",
  tenantId: tenantCtx.tenantId,
  piSessionId: "pi-session-1",
  roundNumber: 1,
  xStateStatus: "NOT_STARTED",
  votes: [] as number[],
};

const VOTE_SESSION_WITH_RELATIONS = {
  ...VOTE_ROUND,
  xStateStatus: "OPEN",
  piSession: {
    piPlan: { art: { id: "art-1" } },
  },
};

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mocks.headers.mockResolvedValue(new Headers());
  mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx });
  mocks.requireRole.mockReturnValue(undefined);
  mocks.revalidatePath.mockReturnValue(undefined);
  mocks.applyVoteEvent.mockReturnValue({ xStateStatus: "OPEN", votes: [5] });
  mocks.piSessionFindFirst.mockResolvedValue(PI_SESSION);
  mocks.piSessionCreate.mockResolvedValue(PI_SESSION);
  mocks.piPlanFindFirst.mockResolvedValue(PI_PLAN);
  mocks.confidenceFindFirst.mockResolvedValue(VOTE_ROUND);
  mocks.confidenceCreate.mockResolvedValue(VOTE_ROUND);
  mocks.confidenceFindMany.mockResolvedValue([VOTE_ROUND]);
  mocks.confidenceUpdate.mockImplementation(async ({ data }) => ({
    ...VOTE_ROUND,
    ...data,
  }));
});

// ─── getOrCreatePISession ─────────────────────────────────────────────────────

describe("getOrCreatePISession", () => {
  it("returns existing session when found (no create call)", async () => {
    mocks.piSessionFindFirst.mockResolvedValue(PI_SESSION);

    const result = await getOrCreatePISession("pi-plan-1");

    expect(result).toMatchObject({ id: "pi-session-1", type: "PLANNING" });
    expect(mocks.piSessionCreate).not.toHaveBeenCalled();
  });

  it("creates new session when not found", async () => {
    mocks.piSessionFindFirst.mockResolvedValue(null);
    const newSession = { ...PI_SESSION, id: "pi-session-new" };
    mocks.piSessionCreate.mockResolvedValue(newSession);

    const result = await getOrCreatePISession("pi-plan-1");

    expect(mocks.piSessionCreate).toHaveBeenCalledWith({
      data: {
        tenantId: tenantCtx.tenantId,
        piPlanId: "pi-plan-1",
        type: "PLANNING",
      },
    });
    expect(result).toMatchObject({ id: "pi-session-new" });
  });
});

// ─── createReplanSession ──────────────────────────────────────────────────────

describe("createReplanSession", () => {
  it("creates REPLAN session for valid PI and calls revalidatePath", async () => {
    mocks.piSessionCreate.mockResolvedValue(REPLAN_SESSION);

    const result = await createReplanSession("pi-plan-1");

    expect(mocks.requireRole).toHaveBeenCalledWith(
      ["ADMIN", "STE", "RTE"],
      expect.objectContaining({ tenantId: tenantCtx.tenantId })
    );
    expect(mocks.piSessionCreate).toHaveBeenCalledWith({
      data: {
        tenantId: tenantCtx.tenantId,
        piPlanId: "pi-plan-1",
        type: "REPLAN",
      },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/arts/art-1/pi-planning"
    );
    expect(result).toMatchObject({ type: "REPLAN" });
  });

  it("throws when PI not found", async () => {
    mocks.piPlanFindFirst.mockResolvedValue(null);

    await expect(createReplanSession("pi-plan-missing")).rejects.toThrow(
      RE_PI_NOT_FOUND
    );
    expect(mocks.piSessionCreate).not.toHaveBeenCalled();
  });

  it("throws when role is insufficient (non-RTE/ADMIN/STE)", async () => {
    mocks.requireRole.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "role denied");
    });

    await expect(createReplanSession("pi-plan-1")).rejects.toThrow(
      RE_ROLE_DENIED
    );
    expect(mocks.piSessionCreate).not.toHaveBeenCalled();
  });
});

// ─── getOrCreateVoteRound ─────────────────────────────────────────────────────

describe("getOrCreateVoteRound", () => {
  it("returns existing round when found", async () => {
    mocks.confidenceFindFirst.mockResolvedValue(VOTE_ROUND);

    const result = await getOrCreateVoteRound("pi-session-1");

    expect(result).toMatchObject({ id: "vote-round-1", roundNumber: 1 });
    expect(mocks.confidenceCreate).not.toHaveBeenCalled();
  });

  it("creates round 1 when none exists", async () => {
    mocks.confidenceFindFirst.mockResolvedValue(null);
    const newRound = { ...VOTE_ROUND, id: "vote-round-new" };
    mocks.confidenceCreate.mockResolvedValue(newRound);

    const result = await getOrCreateVoteRound("pi-session-1");

    expect(mocks.confidenceCreate).toHaveBeenCalledWith({
      data: {
        tenantId: tenantCtx.tenantId,
        piSessionId: "pi-session-1",
        roundNumber: 1,
        xStateStatus: "NOT_STARTED",
        votes: [],
      },
    });
    expect(result).toMatchObject({ roundNumber: 1 });
  });
});

// ─── getAllVoteRounds ─────────────────────────────────────────────────────────

describe("getAllVoteRounds", () => {
  it("returns rounds ordered by roundNumber", async () => {
    const rounds = [
      { ...VOTE_ROUND, roundNumber: 1 },
      { ...VOTE_ROUND, id: "vote-round-2", roundNumber: 2 },
    ];
    mocks.confidenceFindMany.mockResolvedValue(rounds);

    const result = await getAllVoteRounds("pi-session-1");

    expect(mocks.confidenceFindMany).toHaveBeenCalledWith({
      where: { piSessionId: "pi-session-1", tenantId: tenantCtx.tenantId },
      orderBy: { roundNumber: "asc" },
    });
    expect(result).toHaveLength(2);
    expect(result[0].roundNumber).toBe(1);
    expect(result[1].roundNumber).toBe(2);
  });
});

// ─── sendVoteEvent ────────────────────────────────────────────────────────────

describe("sendVoteEvent", () => {
  it("updates session state for valid CAST_VOTE (SUBMIT_VOTE) transition", async () => {
    mocks.confidenceFindFirst.mockResolvedValue({
      ...VOTE_SESSION_WITH_RELATIONS,
      xStateStatus: "OPEN",
    });
    mocks.applyVoteEvent.mockReturnValue({ xStateStatus: "OPEN", votes: [5] });

    const result = await sendVoteEvent("vote-round-1", {
      type: "SUBMIT_VOTE",
      vote: 5,
    });

    expect(mocks.applyVoteEvent).toHaveBeenCalledWith(
      { xStateStatus: "OPEN", votes: [] },
      { type: "SUBMIT_VOTE", vote: 5 }
    );
    expect(mocks.confidenceUpdate).toHaveBeenCalledWith({
      where: { id: "vote-round-1" },
      data: { xStateStatus: "OPEN", votes: [5] },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/arts/art-1/pi-planning"
    );
    expect(result).toMatchObject({ xStateStatus: "OPEN", votes: [5] });
  });

  it("throws for invalid transition (applyVoteEvent returns null)", async () => {
    mocks.confidenceFindFirst.mockResolvedValue({
      ...VOTE_SESSION_WITH_RELATIONS,
      xStateStatus: "NOT_STARTED",
    });
    mocks.applyVoteEvent.mockReturnValue(null);

    await expect(
      sendVoteEvent("vote-round-1", { type: "SUBMIT_VOTE", vote: 3 })
    ).rejects.toThrow(RE_INVALID_TRANSITION);
    expect(mocks.confidenceUpdate).not.toHaveBeenCalled();
  });

  it("throws when session not found", async () => {
    mocks.confidenceFindFirst.mockResolvedValue(null);

    await expect(
      sendVoteEvent("vote-round-missing", { type: "SUBMIT_VOTE", vote: 5 })
    ).rejects.toThrow(RE_SESSION_NOT_FOUND);
    expect(mocks.confidenceUpdate).not.toHaveBeenCalled();
  });

  it("requires privileged role for APPROVE_PI event (throws for non-RTE)", async () => {
    mocks.requireRole.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "role denied");
    });

    await expect(
      sendVoteEvent("vote-round-1", { type: "APPROVE_PI" })
    ).rejects.toThrow(RE_ROLE_DENIED);
    expect(mocks.confidenceFindFirst).not.toHaveBeenCalled();
    expect(mocks.confidenceUpdate).not.toHaveBeenCalled();
  });

  it("allows SUBMIT_VOTE without privileged role check", async () => {
    mocks.confidenceFindFirst.mockResolvedValue({
      ...VOTE_SESSION_WITH_RELATIONS,
      xStateStatus: "OPEN",
    });
    mocks.applyVoteEvent.mockReturnValue({ xStateStatus: "OPEN", votes: [3] });

    // requireRole should NOT be called for non-privileged events
    await sendVoteEvent("vote-round-1", { type: "SUBMIT_VOTE", vote: 3 });

    expect(mocks.requireRole).not.toHaveBeenCalled();
    expect(mocks.confidenceUpdate).toHaveBeenCalled();
  });
});
