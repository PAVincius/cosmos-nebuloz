import { beforeEach, describe, expect, it, vi } from "vitest";
import { tenantCtx } from "../../helpers/action-mocks";

const tallyBase = {
  id: "tally-1",
  tenantId: tenantCtx.tenantId,
  voteSessionId: "vs-1",
  piPlanId: "pi-1",
  round: 1,
  score1Count: 0,
  score2Count: 0,
  score3Count: 2,
  score4Count: 3,
  score5Count: 0,
  totalVotes: 5,
  participantCount: 8,
  participationRate: 0,
  aggregateScore: null,
  revealedAt: null,
  closedAt: null,
};

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  revalidatePath: vi.fn(),
  tallyFindFirst: vi.fn(),
  tallyFindFirstOrThrow: vi.fn(),
  tallyCreate: vi.fn(),
  tallyUpdate: vi.fn(),
  voteSessionFindFirstOrThrow: vi.fn(),
  voteSessionUpdate: vi.fn(),
  piParticipantCount: vi.fn(),
  piPlanFindMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
}));
vi.mock("@repo/database", () => ({
  database: {
    confidenceVoteTally: {
      findFirst: mocks.tallyFindFirst,
      findFirstOrThrow: mocks.tallyFindFirstOrThrow,
      create: mocks.tallyCreate,
      update: mocks.tallyUpdate,
    },
    confidenceVoteSession: {
      findFirstOrThrow: mocks.voteSessionFindFirstOrThrow,
      update: mocks.voteSessionUpdate,
    },
    pIParticipant: { count: mocks.piParticipantCount },
    pIPlan: { findMany: mocks.piPlanFindMany },
    $transaction: mocks.transaction,
  },
}));

import {
  castAnonymousVote,
  openNextVoteRound,
  revealVoteResults,
} from "../../../app/actions/arts/tally-vote";

describe("castAnonymousVote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx, role: "DEV" });
    mocks.tallyFindFirst.mockResolvedValue(tallyBase);
    mocks.tallyUpdate.mockResolvedValue({ totalVotes: 6 });
  });

  it("atomically increments score count with no userId stored", async () => {
    const result = await castAnonymousVote({
      voteSessionId: "vs-1",
      score: 3,
    });

    expect(result.ok).toBe(true);
    expect(mocks.tallyUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          score3Count: { increment: 1 },
          totalVotes: { increment: 1 },
        }),
      })
    );
    // Verify no userId in the update call
    const updateCall = mocks.tallyUpdate.mock.calls[0][0];
    expect(updateCall.data).not.toHaveProperty("userId");
  });

  it("rejects vote on closed round", async () => {
    mocks.tallyFindFirst.mockResolvedValue({
      ...tallyBase,
      closedAt: new Date(),
    });

    const result = await castAnonymousVote({
      voteSessionId: "vs-1",
      score: 3,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("ROUND_CLOSED");
  });

  it("rejects when no active tally found", async () => {
    mocks.tallyFindFirst.mockResolvedValue(null);

    const result = await castAnonymousVote({
      voteSessionId: "vs-1",
      score: 4,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("TALLY_NOT_FOUND");
  });
});

describe("revealVoteResults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx, role: "RTE" });
    mocks.tallyFindFirstOrThrow.mockResolvedValue(tallyBase);
    mocks.tallyUpdate.mockResolvedValue({});
    mocks.voteSessionUpdate.mockResolvedValue({});
    mocks.transaction.mockImplementation((fn: (tx: unknown) => unknown) => {
      if (typeof fn === "function") {
        return fn({
          confidenceVoteTally: { update: mocks.tallyUpdate },
          confidenceVoteSession: { update: mocks.voteSessionUpdate },
        });
      }
      return Promise.all(fn as Promise<unknown>[]);
    });
  });

  it("computes aggregateScore = weighted sum / totalVotes", async () => {
    // score3Count=2, score4Count=3, total=5 → (3×2 + 4×3)/5 = 18/5 = 3.6
    mocks.tallyFindFirstOrThrow.mockResolvedValue({
      ...tallyBase,
      participantCount: 8,
      totalVotes: 5,
    });

    const result = await revealVoteResults({ tallyId: "tally-1" });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.aggregateScore).toBeCloseTo(3.6, 2);
  });

  it("rejects reveal below 50% participation", async () => {
    // 5/8 = 62.5% — OK; let's test 3/8 = 37.5% → below 50
    mocks.tallyFindFirstOrThrow.mockResolvedValue({
      ...tallyBase,
      totalVotes: 3,
      participantCount: 8,
    });

    const result = await revealVoteResults({ tallyId: "tally-1" });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("REVEAL_GATE_NOT_MET");
    expect(result.error).toContain("38");
  });

  it("allows reveal at exactly 50% participation", async () => {
    mocks.tallyFindFirstOrThrow.mockResolvedValue({
      ...tallyBase,
      totalVotes: 4,
      participantCount: 8, // 4/8 = 50%
    });

    const result = await revealVoteResults({ tallyId: "tally-1" });

    expect(result.ok).toBe(true);
  });

  it("rejects reveal on already-closed round", async () => {
    mocks.tallyFindFirstOrThrow.mockResolvedValue({
      ...tallyBase,
      closedAt: new Date(),
    });

    const result = await revealVoteResults({ tallyId: "tally-1" });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("ROUND_CLOSED");
  });

  it("FORBIDDEN for non-RTE/ADMIN", async () => {
    mocks.requireTenantSession.mockResolvedValue({
      ...tenantCtx,
      role: "DEV",
    });

    const result = await revealVoteResults({ tallyId: "tally-1" });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("FORBIDDEN");
  });
});

describe("openNextVoteRound", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx, role: "RTE" });
    mocks.tallyFindFirst.mockResolvedValue({
      ...tallyBase,
      closedAt: new Date(),
    });
    mocks.voteSessionFindFirstOrThrow.mockResolvedValue({
      id: "vs-1",
      piSession: { piPlan: { id: "pi-1" } },
    });
    mocks.piParticipantCount.mockResolvedValue(8);
    mocks.tallyCreate.mockResolvedValue({ id: "tally-2", round: 2 });
    mocks.voteSessionUpdate.mockResolvedValue({});
  });

  it("creates round 2 after round 1 is closed", async () => {
    const result = await openNextVoteRound({ voteSessionId: "vs-1" });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.round).toBe(2);
  });

  it("prior round tally immutable — new tally created per round", async () => {
    await openNextVoteRound({ voteSessionId: "vs-1" });

    expect(mocks.tallyCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ round: 2 }),
      })
    );
    expect(mocks.tallyUpdate).not.toHaveBeenCalled();
  });

  it("blocks if current round not closed yet", async () => {
    mocks.tallyFindFirst.mockResolvedValue({
      ...tallyBase,
      closedAt: null,
    });

    const result = await openNextVoteRound({ voteSessionId: "vs-1" });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("CURRENT_ROUND_NOT_CLOSED");
  });

  it("requires facilitator note after 10 rounds", async () => {
    mocks.tallyFindFirst.mockResolvedValue({
      ...tallyBase,
      round: 10,
      closedAt: new Date(),
    });

    const result = await openNextVoteRound({ voteSessionId: "vs-1" });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("FACILITATOR_NOTE_REQUIRED");
  });

  it("proceeds past 10 rounds with facilitator note", async () => {
    mocks.tallyFindFirst.mockResolvedValue({
      ...tallyBase,
      round: 10,
      closedAt: new Date(),
    });
    mocks.tallyCreate.mockResolvedValue({ id: "tally-11", round: 11 });

    const result = await openNextVoteRound({
      voteSessionId: "vs-1",
      facilitatorNote: "Team is still misaligned on scope",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.round).toBe(11);
  });
});
