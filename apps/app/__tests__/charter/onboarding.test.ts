import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  requireCtx: vi.fn(),
  ackFindFirst: vi.fn(),
  ackUpdate: vi.fn(),
  auditCreate: vi.fn(),
}));

// Fake local, não a classe real de @/lib/charter/guards: acknowledge() importa
// GovernanceError direto de lá (não de ./_shared), e o mock desse módulo
// precisa fornecer algo com a mesma forma (rule, message) para o teste
// verificar a mensagem em res.error via safeAction (que só olha
// `error instanceof Error`). Dentro de vi.hoisted porque vi.mock é hoisted
// para o topo do arquivo — uma classe declarada fora não estaria acessível
// ainda quando a factory do mock roda.
const { FakeGovernanceError } = vi.hoisted(() => {
  class GovernanceError extends Error {
    rule: string;
    status = 422;
    constructor(rule: string, message: string) {
      super(message);
      this.name = "GovernanceError";
      this.rule = rule;
    }
  }
  return { FakeGovernanceError: GovernanceError };
});

vi.mock("@/lib/charter/guards", () => ({
  requireCharterContext: h.requireCtx,
  requireCharterPermissionContext: vi.fn(),
  GovernanceError: FakeGovernanceError,
}));
// acknowledge chama revalidatePath no caminho de sucesso — sem mock, a
// chamada real lança fora de um request Next.js (mesmo padrão de
// settings.test.ts / grounded-draft.test.ts).
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@repo/database", () => ({
  withTenantDb: (_t: string, fn: (db: unknown) => unknown) =>
    fn({
      charterAcknowledgment: {
        findFirst: h.ackFindFirst,
        update: h.ackUpdate,
      },
      auditLog: { create: h.auditCreate },
    }),
}));

import { acknowledge } from "../../app/(charter)/actions/onboarding";

const ACTOR_ID = "cuser0000000000000000001"; // quem clica "Registrar"
const OWNER_ID = "cuser0000000000000000002"; // dono do aceite, quando houver
const ACK_ID = "cack0000000000000000000a";

const ctx = {
  tenantId: "t-1",
  userId: ACTOR_ID,
  charterRole: "HR",
  user: { name: "Duda", email: "duda@x.com" },
};

function pendingAck(overrides: Record<string, unknown> = {}) {
  return {
    id: ACK_ID,
    trackId: "tr-1",
    userId: null,
    personName: "Fulano",
    track: { code: "TR-01", name: "Onboarding geral" },
    ...overrides,
  };
}

describe("acknowledge", () => {
  beforeEach(() => {
    for (const m of Object.values(h)) {
      m.mockReset();
    }
    h.requireCtx.mockResolvedValue(ctx);
    h.ackUpdate.mockResolvedValue({});
    h.auditCreate.mockResolvedValue({});
  });

  it("terceiro sem justificativa recusa com mensagem clara e não grava", async () => {
    h.ackFindFirst.mockResolvedValue(pendingAck());

    const res = await acknowledge({ id: ACK_ID });

    expect(res.ok).toBe(false);
    if (res.ok) {
      return;
    }
    expect(res.error).toContain("justificativa");
    expect(h.ackUpdate).not.toHaveBeenCalled();
    expect(h.auditCreate).not.toHaveBeenCalled();
  });

  it("justificativa curta demais (menos de 10 caracteres) é recusada", async () => {
    h.ackFindFirst.mockResolvedValue(pendingAck());

    const res = await acknowledge({ id: ACK_ID, justificativa: "pq sim" });

    expect(res.ok).toBe(false);
    if (res.ok) {
      return;
    }
    expect(h.ackUpdate).not.toHaveBeenCalled();
  });

  it("terceiro com justificativa grava e audita 'em nome de' com a justificativa", async () => {
    h.ackFindFirst.mockResolvedValue(pendingAck());

    const res = await acknowledge({
      id: ACK_ID,
      justificativa: "Fulano está de licença e me pediu para registrar.",
    });

    expect(res.ok).toBe(true);
    expect(h.ackUpdate).toHaveBeenCalledWith({
      where: { id: ACK_ID, tenantId: "t-1" },
      data: {
        status: "ACKNOWLEDGED",
        acknowledgedAt: expect.any(Date),
        userId: ACTOR_ID,
      },
    });
    expect(h.auditCreate).toHaveBeenCalledTimes(1);
    const entry = h.auditCreate.mock.calls[0][0].data;
    expect(entry.action).toBe("Registrou aceite em nome de terceiro");
    expect(entry.tenantId).toBe("t-1");
    expect(entry.metadata.target).toBe("Fulano · Onboarding geral");
    expect(entry.metadata.note).toContain("Registrado por Duda");
    expect(entry.metadata.note).toContain("em nome de Fulano");
    expect(entry.metadata.note).toContain(
      "Fulano está de licença e me pediu para registrar."
    );
  });

  it("aceite próprio (ctx.userId === ack.userId) passa sem justificativa e audita como aceite normal", async () => {
    h.ackFindFirst.mockResolvedValue(
      pendingAck({ userId: ACTOR_ID, personName: "Duda" })
    );

    const res = await acknowledge({ id: ACK_ID });

    expect(res.ok).toBe(true);
    expect(h.auditCreate).toHaveBeenCalledTimes(1);
    const entry = h.auditCreate.mock.calls[0][0].data;
    expect(entry.action).toBe("Registrou aceite");
    expect(entry.metadata.note).toBeNull();
  });

  it("dono do aceite diferente do ator (mesmo com userId preenchido) continua exigindo justificativa", async () => {
    h.ackFindFirst.mockResolvedValue(pendingAck({ userId: OWNER_ID }));

    const res = await acknowledge({ id: ACK_ID });

    expect(res.ok).toBe(false);
    expect(h.ackUpdate).not.toHaveBeenCalled();
  });

  it("findFirst busca sempre com tenantId", async () => {
    h.ackFindFirst.mockResolvedValue(
      pendingAck({ userId: ACTOR_ID, personName: "Duda" })
    );

    await acknowledge({ id: ACK_ID });

    expect(h.ackFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ACK_ID, tenantId: "t-1" },
      })
    );
  });

  it("atribuição desconhecida recusa antes de checar justificativa", async () => {
    h.ackFindFirst.mockResolvedValue(null);

    const res = await acknowledge({ id: ACK_ID });

    expect(res.ok).toBe(false);
    if (res.ok) {
      return;
    }
    expect(res.error).toContain("não encontrada");
  });
});
