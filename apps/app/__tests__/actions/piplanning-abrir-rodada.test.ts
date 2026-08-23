// piplanning-abrir-rodada.test.ts — a abertura da rodada de confidence vote.
//
// A cerimônia depende de três linhas encadeadas — PISession, rodada e placar —
// e nenhuma tela as criava: o card de voto só sabia dizer "nenhuma rodada
// aberta", sem caminho no produto para abrir uma. Estes casos guardam o elo que
// faltava, e o que ele não pode quebrar: quórum real, máquina de estado no
// comando da abertura, e nada de rodada empilhada por clique.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthError, tenantCtx } from "../helpers/action-mocks";

const h = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  requireRole: vi.fn(),
  revalidateTag: vi.fn(),
  pIPlanFindFirst: vi.fn(),
  pIParticipantCount: vi.fn(),
  tenantMemberCount: vi.fn(),
  pISessionFindFirst: vi.fn(),
  pISessionCreate: vi.fn(),
  voteSessionFindFirst: vi.fn(),
  tallyFindFirst: vi.fn(),
  txVoteSessionCreate: vi.fn(),
  txVoteSessionUpdate: vi.fn(),
  txTallyFindFirst: vi.fn(),
  txTallyCreate: vi.fn(),
  transaction: vi.fn(),
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
    pIParticipant: { count: h.pIParticipantCount },
    tenantMember: { count: h.tenantMemberCount },
    pISession: { findFirst: h.pISessionFindFirst, create: h.pISessionCreate },
    confidenceVoteSession: { findFirst: h.voteSessionFindFirst },
    confidenceVoteTally: { findFirst: h.tallyFindFirst },
    $transaction: h.transaction,
  },
}));
vi.mock("../../app/actions/audit/log-audit", () => ({ logAudit: h.logAudit }));

import { abrirRodadaDeConfianca } from "../../app/(cosmos)/actions/piplanning";

describe("abrirRodadaDeConfianca", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.headers.mockResolvedValue(new Headers());
    h.requireTenantSession.mockResolvedValue({ ...tenantCtx, role: "RTE" });
    h.pIPlanFindFirst.mockResolvedValue({ id: "pi-1" });
    h.pIParticipantCount.mockResolvedValue(0);
    h.tenantMemberCount.mockResolvedValue(4);
    h.pISessionFindFirst.mockResolvedValue({ id: "sess-1" });
    h.voteSessionFindFirst.mockResolvedValue(null);
    h.tallyFindFirst.mockResolvedValue(null);
    h.txVoteSessionCreate.mockResolvedValue({ id: "cvs-1" });
    h.txVoteSessionUpdate.mockResolvedValue({});
    h.txTallyFindFirst.mockResolvedValue(null);
    h.txTallyCreate.mockResolvedValue({ id: "tly-1", round: 1 });
    h.transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
      fn({
        confidenceVoteSession: {
          create: h.txVoteSessionCreate,
          update: h.txVoteSessionUpdate,
        },
        confidenceVoteTally: {
          findFirst: h.txTallyFindFirst,
          create: h.txTallyCreate,
        },
      })
    );
  });

  it("abre a rodada 1 com quórum e placar quando não há nenhuma", async () => {
    const res = await abrirRodadaDeConfianca();

    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    expect(res.data).toEqual({
      round: 1,
      participantCount: 4,
      jaAberta: false,
    });
    // O placar nasce junto com a rodada: rodada aberta sem placar aceita o
    // clique do votante e depois recusa o voto dizendo que não há rodada.
    expect(h.txTallyCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ round: 1, participantCount: 4 }),
      })
    );
  });

  it("abre pela máquina de estado, não por escrita direta", async () => {
    await abrirRodadaDeConfianca();

    expect(h.txVoteSessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ xStateStatus: "NOT_STARTED" }),
      })
    );
    expect(h.txVoteSessionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { xStateStatus: "OPEN" },
      })
    );
  });

  it("é idempotente: rodada aberta com placar aberto não vira rodada nova", async () => {
    h.voteSessionFindFirst.mockResolvedValue({
      id: "cvs-1",
      roundNumber: 1,
      xStateStatus: "OPEN",
    });
    h.tallyFindFirst.mockResolvedValue({
      id: "tly-1",
      round: 1,
      participantCount: 4,
    });

    const res = await abrirRodadaDeConfianca();

    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    expect(res.data.jaAberta).toBe(true);
    expect(h.transaction).not.toHaveBeenCalled();
  });

  // Confiança baixa não é impasse: o ART replaneja e vota de novo. Depois da
  // revelação a rodada está fechada, e abrir votação é abrir a próxima.
  it("abre a rodada seguinte quando a anterior já foi apurada", async () => {
    h.voteSessionFindFirst.mockResolvedValue({
      id: "cvs-1",
      roundNumber: 1,
      xStateStatus: "TALLYING",
    });
    h.txTallyCreate.mockResolvedValue({ id: "tly-2", round: 2 });

    const res = await abrirRodadaDeConfianca();

    expect(res.ok).toBe(true);
    expect(h.txVoteSessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ roundNumber: 2 }),
      })
    );
  });

  // `@@unique([voteSessionId, round])` proíbe repetir o número dentro da mesma
  // rodada de voto — e uma sessão reaproveitada pode carregar placar de antes.
  it("numera o placar a partir do último placar da rodada", async () => {
    h.voteSessionFindFirst.mockResolvedValue({
      id: "cvs-1",
      roundNumber: 1,
      xStateStatus: "OPEN",
    });
    h.tallyFindFirst.mockResolvedValue(null); // nenhum placar aberto
    h.txTallyFindFirst.mockResolvedValue({ round: 3 });
    h.txTallyCreate.mockResolvedValue({ id: "tly-4", round: 4 });

    await abrirRodadaDeConfianca();

    expect(h.txTallyCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ round: 4 }),
      })
    );
  });

  it("recusa quando não há ninguém para compor o quórum", async () => {
    h.tenantMemberCount.mockResolvedValue(0);

    const res = await abrirRodadaDeConfianca();

    expect(res.ok).toBe(false);
    if (res.ok) {
      return;
    }
    expect(res.error).toContain("quórum");
    expect(h.transaction).not.toHaveBeenCalled();
  });

  it("recusa quando não há PI aberto", async () => {
    h.pIPlanFindFirst.mockResolvedValue(null);

    const res = await abrirRodadaDeConfianca();

    expect(res.ok).toBe(false);
    if (res.ok) {
      return;
    }
    expect(res.error).toContain("Nenhum PI aberto");
  });

  it("abrir é ato de facilitação: passa pelo gate de papel", async () => {
    await abrirRodadaDeConfianca();

    expect(h.requireRole).toHaveBeenCalledWith(
      ["ADMIN", "RTE"],
      expect.objectContaining({ tenantId: tenantCtx.tenantId })
    );
  });
});
