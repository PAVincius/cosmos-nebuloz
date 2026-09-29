import { beforeEach, describe, expect, it, vi } from "vitest";

// Actions do entregável — SC-DEV-03/05/07, SC-PO-03/04.
//
// Guard e matriz são os REAIS: o 403 de sponsor, team lead e admin tem de vir
// da matriz de verdade. Só sessão, módulo e resolução de papel são simulados.

const h = vi.hoisted(() => ({
  role: "CONSULTANT" as string | null,
  userId: "clx0000000000000000actor01",
  requireTenantSession: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  eventCreate: vi.fn(),
  eventFindMany: vi.fn(),
  commentFindMany: vi.fn(),
  linkFindMany: vi.fn(),
  memberFindFirst: vi.fn(),
  phaseFindFirst: vi.fn(),
  sequenceUpsert: vi.fn(),
  auditCreate: vi.fn(),
  AuthError: class AuthError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.name = "AuthError";
      this.code = code;
    }
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: () => new Headers() }));
vi.mock("@repo/auth/server", () => ({
  AuthError: h.AuthError,
  requireTenantSession: h.requireTenantSession,
}));
vi.mock("@repo/rbac", async () => {
  const matrix = await import("../../../../packages/rbac/src/scaffold-matrix");
  return {
    ...matrix,
    hasModule: async () => true,
    getScaffoldRole: async () => h.role,
  };
});
vi.mock("@repo/database", () => ({
  withTenantDb: (_t: string, fn: (db: unknown) => unknown) =>
    fn({
      scaffoldDeliverableInstance: {
        findFirst: h.findFirst,
        findMany: h.findMany,
        create: h.create,
        update: h.update,
        updateMany: h.updateMany,
      },
      scaffoldDeliverableEvent: {
        create: h.eventCreate,
        findMany: h.eventFindMany,
      },
      scaffoldDeliverableComment: { findMany: h.commentFindMany },
      scaffoldDeliverableLink: { findMany: h.linkFindMany },
      tenantMember: { findFirst: h.memberFindFirst },
      scaffoldPhaseInstance: { findFirst: h.phaseFindFirst },
      scaffoldSequence: { upsert: h.sequenceUpsert },
      auditLog: { create: h.auditCreate },
    }),
}));

import {
  addDeliverable,
  approveDeliverable,
  assignDeliverable,
  editDeliverableSummary,
  getDeliverable,
  listDeliverables,
  reopenDeliverable,
  requestDeliverableAdjustment,
  startDeliverable,
  submitDeliverable,
} from "@/app/(scaffold)/actions/deliverables";

const DEL = "clx00000000000000000del001";
const TRACK = "clx00000000000000000trk001";
const OWNER = "clx000000000000000000own01";
const APPROVER = "clx0000000000000000appr001";

const row = (status: string, over: Record<string, unknown> = {}) => ({
  id: DEL,
  code: "B1.2",
  title: "Configuração do piloto",
  status,
  ownerId: OWNER,
  approverId: APPROVER,
  trackId: TRACK,
  version: 2,
  ...over,
});

const asUser = (role: string, userId: string) => {
  h.role = role;
  h.requireTenantSession.mockResolvedValue({
    tenantId: "t1",
    userId,
    role: "ADMIN",
    user: { name: "Marina", email: "m@x.com" },
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  asUser("CONSULTANT", h.userId);
  h.findFirst.mockResolvedValue(row("NOT_STARTED"));
  h.updateMany.mockResolvedValue({ count: 1 });
  h.update.mockResolvedValue({});
  h.eventCreate.mockResolvedValue({});
  h.auditCreate.mockResolvedValue({});
  h.memberFindFirst.mockResolvedValue({ userId: OWNER });
  h.phaseFindFirst.mockResolvedValue({ id: "ph1" });
  h.sequenceUpsert.mockResolvedValue({ next: 2 });
  h.create.mockResolvedValue({ id: "new1", code: "X-001" });
});

describe("transições gravam status, evento append-only e auditoria", () => {
  it("startDeliverable", async () => {
    const r = await startDeliverable({ deliverableId: DEL });
    expect(r.ok).toBe(true);
    expect(h.updateMany).toHaveBeenCalledWith({
      where: { id: DEL, tenantId: "t1", status: "NOT_STARTED" },
      data: { status: "IN_PROGRESS" },
    });
    expect(h.eventCreate.mock.calls[0]?.[0].data).toMatchObject({
      tenantId: "t1",
      deliverableId: DEL,
      action: "START",
      actorId: h.userId,
      fromStatus: "NOT_STARTED",
      toStatus: "IN_PROGRESS",
    });
    expect(h.auditCreate.mock.calls[0]?.[0].data).toMatchObject({
      action: "scaffold.deliverable.start",
      entityType: "scaffold.deliverable",
      entityId: DEL,
      tenantId: "t1",
    });
  });

  it("fluxo completo: enviar, pedir ajuste, aprovar, reabrir", async () => {
    h.findFirst.mockResolvedValue(row("IN_PROGRESS"));
    expect((await submitDeliverable({ deliverableId: DEL })).ok).toBe(true);
    expect(h.updateMany.mock.calls[0]?.[0].data.status).toBe("IN_REVIEW");

    asUser("PROCESS_OWNER", APPROVER);
    h.findFirst.mockResolvedValue(row("IN_REVIEW"));
    expect(
      (
        await requestDeliverableAdjustment({
          deliverableId: DEL,
          comment: "Falta o volume por canal.",
        })
      ).ok
    ).toBe(true);
    expect(h.eventCreate.mock.calls[1]?.[0].data).toMatchObject({
      action: "REQUEST_ADJUSTMENT",
      comment: "Falta o volume por canal.",
    });

    expect((await approveDeliverable({ deliverableId: DEL })).ok).toBe(true);
    expect(h.updateMany.mock.calls[2]?.[0].data.status).toBe("APPROVED");

    asUser("CONSULTANT", h.userId);
    h.findFirst.mockResolvedValue(row("APPROVED"));
    expect(
      (
        await reopenDeliverable({
          deliverableId: DEL,
          comment: "Baseline mudou.",
        })
      ).ok
    ).toBe(true);
    expect(h.updateMany.mock.calls[3]?.[0].data.status).toBe("REOPENED");
  });

  it("ajuste pedido sem comentário é recusado e nada é gravado", async () => {
    h.findFirst.mockResolvedValue(row("IN_REVIEW"));
    asUser("PROCESS_OWNER", APPROVER);
    const r = await requestDeliverableAdjustment({ deliverableId: DEL });
    expect(r).toMatchObject({
      ok: false,
      code: "DELIVERABLE_COMMENT_REQUIRED",
    });
    expect(h.updateMany).not.toHaveBeenCalled();
    expect(h.eventCreate).not.toHaveBeenCalled();
  });

  it("reabrir sem comentário é recusado", async () => {
    h.findFirst.mockResolvedValue(row("APPROVED"));
    const r = await reopenDeliverable({ deliverableId: DEL, comment: "  " });
    expect(r).toMatchObject({
      ok: false,
      code: "DELIVERABLE_COMMENT_REQUIRED",
    });
  });

  it("estado que não permite a ação é recusado com código", async () => {
    h.findFirst.mockResolvedValue(row("APPROVED"));
    const r = await startDeliverable({ deliverableId: DEL });
    expect(r).toMatchObject({
      ok: false,
      code: "DELIVERABLE_TRANSITION_INVALID",
    });
  });

  it("corrida: outra pessoa moveu o estado entre a leitura e a escrita", async () => {
    h.updateMany.mockResolvedValue({ count: 0 });
    const r = await startDeliverable({ deliverableId: DEL });
    expect(r).toMatchObject({
      ok: false,
      code: "DELIVERABLE_TRANSITION_INVALID",
    });
    expect(h.eventCreate).not.toHaveBeenCalled();
    expect(h.auditCreate).not.toHaveBeenCalled();
  });

  it("entregável de outro tenant não existe", async () => {
    h.findFirst.mockResolvedValue(null);
    const r = await startDeliverable({ deliverableId: DEL });
    expect(r).toMatchObject({ ok: false, code: "DELIVERABLE_NOT_FOUND" });
    expect(h.findFirst.mock.calls[0]?.[0].where).toEqual({
      id: DEL,
      tenantId: "t1",
    });
  });
});

describe("403 pela matriz real", () => {
  it.each([
    "SPONSOR",
    "TEAM_LEAD",
    "ADMIN",
  ])("%s não escreve em entregável", async (role) => {
    asUser(role, OWNER);
    h.findFirst.mockResolvedValue(row("NOT_STARTED"));
    const calls = [
      startDeliverable({ deliverableId: DEL }),
      submitDeliverable({ deliverableId: DEL }),
      approveDeliverable({ deliverableId: DEL }),
      requestDeliverableAdjustment({ deliverableId: DEL, comment: "x" }),
      reopenDeliverable({ deliverableId: DEL, comment: "x" }),
      editDeliverableSummary({ deliverableId: DEL, summary: "x" }),
      assignDeliverable({ deliverableId: DEL, ownerId: OWNER }),
      addDeliverable({
        trackId: TRACK,
        phase: "PILOT",
        title: "Extra",
        description: "d",
        kind: "DOCUMENT",
        producer: "OWNER",
        required: false,
      }),
    ];
    for (const r of await Promise.all(calls)) {
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error).toContain("Requer papel");
      }
    }
    expect(h.updateMany).not.toHaveBeenCalled();
    expect(h.create).not.toHaveBeenCalled();
  });

  it.each(["SPONSOR", "TEAM_LEAD", "ADMIN"])("%s lê", async (role) => {
    asUser(role, OWNER);
    h.findMany.mockResolvedValue([]);
    expect((await listDeliverables({ trackId: TRACK })).ok).toBe(true);
  });

  it("membro do time só trabalha no que é responsável", async () => {
    asUser("TEAM_MEMBER", h.userId);
    const r = await startDeliverable({ deliverableId: DEL });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/responsável/i);
    }
    asUser("TEAM_MEMBER", OWNER);
    expect((await startDeliverable({ deliverableId: DEL })).ok).toBe(true);
  });

  it("ninguém aprova o que é seu", async () => {
    asUser("CONSULTANT", OWNER);
    h.findFirst.mockResolvedValue(row("IN_REVIEW"));
    const r = await approveDeliverable({ deliverableId: DEL });
    expect(r.ok).toBe(false);
    expect(h.updateMany).not.toHaveBeenCalled();
  });

  it("só o aprovador designado aprova", async () => {
    asUser("CONSULTANT", "clx0000000000000000other001");
    h.findFirst.mockResolvedValue(row("IN_REVIEW"));
    expect((await approveDeliverable({ deliverableId: DEL })).ok).toBe(false);
  });
});

describe("listDeliverables e getDeliverable", () => {
  it("lista escopada por tenant e trilha", async () => {
    h.findMany.mockResolvedValue([]);
    await listDeliverables({ trackId: TRACK });
    expect(h.findMany.mock.calls[0]?.[0].where).toEqual({
      tenantId: "t1",
      trackId: TRACK,
    });
  });

  it("detalhe traz histórico, comentários e links do próprio tenant", async () => {
    h.findFirst.mockResolvedValue({ ...row("IN_REVIEW"), summary: "s" });
    h.eventFindMany.mockResolvedValue([]);
    h.commentFindMany.mockResolvedValue([]);
    h.linkFindMany.mockResolvedValue([]);
    const r = await getDeliverable({ deliverableId: DEL });
    expect(r.ok).toBe(true);
    for (const m of [h.eventFindMany, h.commentFindMany, h.linkFindMany]) {
      expect(m.mock.calls[0]?.[0].where).toMatchObject({
        tenantId: "t1",
        deliverableId: DEL,
      });
    }
  });
});

describe("assignDeliverable", () => {
  it("atribui responsável e aprovador do mesmo tenant", async () => {
    h.memberFindFirst.mockResolvedValue({ userId: OWNER });
    const r = await assignDeliverable({
      deliverableId: DEL,
      ownerId: OWNER,
      approverId: APPROVER,
    });
    expect(r.ok).toBe(true);
    expect(h.update.mock.calls[0]?.[0].data).toEqual({
      ownerId: OWNER,
      approverId: APPROVER,
    });
    expect(h.memberFindFirst.mock.calls[0]?.[0].where).toMatchObject({
      tenantId: "t1",
    });
  });

  it("recusa pessoa de fora do tenant", async () => {
    h.memberFindFirst.mockResolvedValue(null);
    const r = await assignDeliverable({ deliverableId: DEL, ownerId: OWNER });
    expect(r).toMatchObject({ ok: false, code: "MEMBER_NOT_IN_TENANT" });
    expect(h.update).not.toHaveBeenCalled();
  });

  it("recusa responsável igual ao aprovador: ninguém aprova o que é seu", async () => {
    const r = await assignDeliverable({
      deliverableId: DEL,
      ownerId: OWNER,
      approverId: OWNER,
    });
    expect(r).toMatchObject({ ok: false, code: "DELIVERABLE_SELF_REVIEW" });
    expect(h.update).not.toHaveBeenCalled();
  });
});

describe("editDeliverableSummary", () => {
  it("edita o resumo e registra EDIT no histórico", async () => {
    h.findFirst.mockResolvedValue(row("IN_PROGRESS"));
    const r = await editDeliverableSummary({
      deliverableId: DEL,
      summary: "Resumo novo",
    });
    expect(r.ok).toBe(true);
    expect(h.update.mock.calls[0]?.[0].data).toEqual({
      summary: "Resumo novo",
    });
    expect(h.eventCreate.mock.calls[0]?.[0].data.action).toBe("EDIT");
  });

  it("aprovado é imutável: reabra antes de editar", async () => {
    h.findFirst.mockResolvedValue(row("APPROVED"));
    const r = await editDeliverableSummary({
      deliverableId: DEL,
      summary: "x",
    });
    expect(r).toMatchObject({
      ok: false,
      code: "DELIVERABLE_TRANSITION_INVALID",
    });
    expect(h.update).not.toHaveBeenCalled();
  });
});

describe("addDeliverable (extra)", () => {
  const INPUT = {
    trackId: TRACK,
    phase: "PILOT" as const,
    title: "Parecer jurídico",
    description: "Parecer sobre o uso do dado.",
    kind: "DOCUMENT" as const,
    producer: "LEGAL" as const,
    required: true,
  };

  it("cria extra da fase da trilha do próprio tenant, obrigatório se escolhido", async () => {
    const r = await addDeliverable(INPUT);
    expect(r.ok).toBe(true);
    expect(h.phaseFindFirst.mock.calls[0]?.[0].where).toMatchObject({
      trackId: TRACK,
      phase: "PILOT",
      track: { tenantId: "t1" },
    });
    expect(h.create.mock.calls[0]?.[0].data).toMatchObject({
      tenantId: "t1",
      trackId: TRACK,
      phaseInstanceId: "ph1",
      isExtra: true,
      required: true,
      title: "Parecer jurídico",
      code: "X-001",
    });
    expect(h.sequenceUpsert.mock.calls[0]?.[0].where.tenantId_kind.kind).toBe(
      `deliverable:${TRACK}`
    );
  });

  it("fase que não é da trilha do tenant é recusada", async () => {
    h.phaseFindFirst.mockResolvedValue(null);
    const r = await addDeliverable(INPUT);
    expect(r.ok).toBe(false);
    expect(h.create).not.toHaveBeenCalled();
  });
});
