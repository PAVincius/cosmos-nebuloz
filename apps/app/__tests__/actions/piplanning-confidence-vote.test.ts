// piplanning-confidence-vote.test.ts — caminho de escrita do confidence vote do
// ART na tela /cosmos/piplanning. story-060 AC-001 (voto anônimo agregado),
// AC-002 (só na rodada aberta, pela máquina do @repo/safe-engine) e AC-003
// (gate de participação + RBAC do facilitador). Arquivo separado de
// piplanning.test.ts porque a leitura e a escrita precisam de mocks de banco
// com valores diferentes para o mesmo modelo.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthError, tenantCtx } from "../helpers/action-mocks";

const h = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  requireRole: vi.fn(),
  revalidateTag: vi.fn(),
  pIPlanFindFirst: vi.fn(),
  confidenceVoteSessionFindFirst: vi.fn(),
  confidenceVoteSessionUpdate: vi.fn(),
  confidenceVoteTallyFindFirst: vi.fn(),
  confidenceVoteTallyUpdate: vi.fn(),
  logAudit: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: h.headers }));
vi.mock("next/cache", () => ({ revalidateTag: h.revalidateTag }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: h.requireTenantSession,
  requireRole: h.requireRole,
  AuthError: MockAuthError,
}));
vi.mock("@repo/database", () => ({
  database: {
    pIPlan: { findFirst: h.pIPlanFindFirst },
    confidenceVoteSession: {
      findFirst: h.confidenceVoteSessionFindFirst,
      update: h.confidenceVoteSessionUpdate,
    },
    confidenceVoteTally: {
      findFirst: h.confidenceVoteTallyFindFirst,
      update: h.confidenceVoteTallyUpdate,
    },
  },
}));
vi.mock("../../app/actions/audit/log-audit", () => ({ logAudit: h.logAudit }));

import {
  castConfidenceVote,
  revealTally,
} from "../../app/(cosmos)/actions/piplanning";

const openRound = {
  id: "cvs-1",
  xStateStatus: "OPEN",
  roundNumber: 1,
};

const tally = (over: Record<string, unknown>) => ({
  id: "tly-1",
  voteSessionId: "cvs-1",
  round: 1,
  score1Count: 0,
  score2Count: 0,
  score3Count: 2,
  score4Count: 3,
  score5Count: 1,
  totalVotes: 6,
  participantCount: 10,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.headers.mockResolvedValue(new Headers());
  h.requireTenantSession.mockResolvedValue(tenantCtx);
  h.requireRole.mockReturnValue(undefined);
  h.pIPlanFindFirst.mockResolvedValue({ id: "pi-1" });
  h.confidenceVoteSessionFindFirst.mockResolvedValue(openRound);
  h.confidenceVoteTallyFindFirst.mockResolvedValue(tally({}));
  h.confidenceVoteTallyUpdate.mockResolvedValue(tally({}));
  h.confidenceVoteSessionUpdate.mockResolvedValue({ id: "cvs-1" });
});

describe("castConfidenceVote", () => {
  it("increments only the voted score and the total, with no voter id — AC-001", async () => {
    const res = await castConfidenceVote({ score: 4 });

    expect(res.ok).toBe(true);
    expect(h.confidenceVoteTallyUpdate).toHaveBeenCalledWith({
      where: { id: "tly-1" },
      data: {
        score4Count: { increment: 1 },
        totalVotes: { increment: 1 },
      },
    });
    const written = JSON.stringify(
      h.confidenceVoteTallyUpdate.mock.calls[0][0]
    );
    expect(written).not.toContain(tenantCtx.userId);
    expect(written).not.toContain("userId");
    // Auditar o voto seria desfazer o anonimato pela porta dos fundos: o
    // AuditLog guarda userId, ator e carimbo de tempo.
    expect(h.logAudit).not.toHaveBeenCalled();
  });

  it("scopes the round and the tally lookup to the tenant — AC-001", async () => {
    await castConfidenceVote({ score: 3 });

    expect(h.confidenceVoteSessionFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: tenantCtx.tenantId }),
      })
    );
    expect(h.confidenceVoteTallyFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: tenantCtx.tenantId,
          voteSessionId: "cvs-1",
          closedAt: null,
        }),
      })
    );
  });

  it("refuses a vote when the round is not OPEN — AC-002", async () => {
    h.confidenceVoteSessionFindFirst.mockResolvedValue({
      ...openRound,
      xStateStatus: "TALLYING",
    });

    const res = await castConfidenceVote({ score: 3 });

    expect(res.ok).toBe(false);
    expect(h.confidenceVoteTallyUpdate).not.toHaveBeenCalled();
  });

  it("refuses a vote when there is no active PI — AC-002", async () => {
    h.pIPlanFindFirst.mockResolvedValue(null);

    const res = await castConfidenceVote({ score: 3 });

    expect(res.ok).toBe(false);
    expect(h.confidenceVoteSessionFindFirst).not.toHaveBeenCalled();
    expect(h.confidenceVoteTallyUpdate).not.toHaveBeenCalled();
  });

  it("refuses a vote when the PI has no open round — AC-002", async () => {
    h.confidenceVoteSessionFindFirst.mockResolvedValue(null);

    const res = await castConfidenceVote({ score: 3 });

    expect(res.ok).toBe(false);
    expect(h.confidenceVoteTallyUpdate).not.toHaveBeenCalled();
  });

  it("refuses a score outside the 1-5 fist-of-five scale — AC-001", async () => {
    const res = await castConfidenceVote({ score: 6 });

    expect(res.ok).toBe(false);
    expect(h.confidenceVoteTallyUpdate).not.toHaveBeenCalled();
  });
});

describe("revealTally", () => {
  it("is denied when the role is not the facilitator (RBAC) — AC-003", async () => {
    h.requireRole.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "nope");
    });

    const res = await revealTally();

    expect(res.ok).toBe(false);
    expect(h.requireRole).toHaveBeenCalledWith(["ADMIN", "RTE"], tenantCtx);
    expect(h.confidenceVoteTallyUpdate).not.toHaveBeenCalled();
  });

  it("refuses to reveal below the participation gate, naming the numbers — AC-003", async () => {
    h.confidenceVoteTallyFindFirst.mockResolvedValue(
      tally({ totalVotes: 4, participantCount: 10 })
    );

    const res = await revealTally();

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain("40");
      expect(res.error).toContain("50");
    }
    expect(h.confidenceVoteTallyUpdate).not.toHaveBeenCalled();
    expect(h.confidenceVoteSessionUpdate).not.toHaveBeenCalled();
  });

  it("writes the weighted score, participation and timestamps — AC-003", async () => {
    const res = await revealTally();

    // (3×2 + 4×3 + 5×1) / 6 = 23/6
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.aggregateScore).toBeCloseTo(23 / 6, 5);
      expect(res.data.histogram).toEqual([0, 0, 2, 3, 1]);
    }
    expect(h.confidenceVoteTallyUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tly-1" },
        data: expect.objectContaining({
          participationRate: 60,
          revealedAt: expect.any(Date),
          closedAt: expect.any(Date),
        }),
      })
    );
  });

  it("closes the round through the state machine, not by hand — AC-003", async () => {
    await revealTally();

    expect(h.confidenceVoteSessionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "cvs-1" },
        data: expect.objectContaining({ xStateStatus: "TALLYING" }),
      })
    );
  });

  it("refuses to reveal a round the machine cannot close — AC-003", async () => {
    h.confidenceVoteSessionFindFirst.mockResolvedValue({
      ...openRound,
      xStateStatus: "APPROVED",
    });

    const res = await revealTally();

    expect(res.ok).toBe(false);
    expect(h.confidenceVoteTallyUpdate).not.toHaveBeenCalled();
  });

  it("audits the revealed score — AC-003", async () => {
    await revealTally();

    expect(h.logAudit).toHaveBeenCalledWith(
      tenantCtx.tenantId,
      expect.objectContaining({
        action: "status_changed",
        entityType: "confidence_vote",
        entityId: "tly-1",
      })
    );
    expect(h.revalidateTag).toHaveBeenCalled();
  });
});
