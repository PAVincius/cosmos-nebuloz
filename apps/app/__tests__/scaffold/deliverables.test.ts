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
  phaseUpdate: vi.fn(),
  trackUpdate: vi.fn(),
  createSignedUploadUrl: vi.fn(),
  createSignedUrl: vi.fn(),
  exists: vi.fn(),
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
vi.mock("@repo/storage", () => ({
  SCAFFOLD_ARTEFACT_BUCKET: "scaffold-artefacts",
  storageClient: {
    storage: {
      from: () => ({
        createSignedUploadUrl: h.createSignedUploadUrl,
        createSignedUrl: h.createSignedUrl,
        exists: h.exists,
      }),
    },
  },
}));
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
      scaffoldPhaseInstance: {
        findFirst: h.phaseFindFirst,
        update: h.phaseUpdate,
      },
      scaffoldTrack: { update: h.trackUpdate },
      scaffoldSequence: { upsert: h.sequenceUpsert },
      auditLog: { create: h.auditCreate },
    }),
}));

import {
  addDeliverable,
  approveDeliverable,
  assignDeliverable,
  attachDeliverableVersion,
  editDeliverableSummary,
  getDeliverable,
  listDeliverables,
  readDeliverableFile,
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
  fileKey: "t1/trk/deliverables/del/v2/plano.pdf",
  fileName: "plano.pdf",
  track: { code: "TR-104" },
  phaseInstance: { id: "ph1", phase: "PILOT", state: "OPEN" },
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
  h.phaseUpdate.mockResolvedValue({});
  h.trackUpdate.mockResolvedValue({});
  h.createSignedUploadUrl.mockResolvedValue({
    data: { signedUrl: "https://storage.test/put" },
    error: null,
  });
  h.createSignedUrl.mockResolvedValue({
    data: { signedUrl: "https://storage.test/get" },
    error: null,
  });
  h.exists.mockResolvedValue({ data: true, error: null });
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

  it("cada item traz o que o ator pode fazer, com o motivo quando não pode", async () => {
    h.findMany.mockResolvedValue([row("IN_REVIEW")]);
    asUser("SPONSOR", OWNER);
    const r = await listDeliverables({ trackId: TRACK });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const a = r.data[0]?.actions;
      expect(a?.APPROVE.allowed).toBe(false);
      expect(a?.APPROVE.reason).toMatch(/papel/i);
    }
    asUser("PROCESS_OWNER", APPROVER);
    const ok = await listDeliverables({ trackId: TRACK });
    if (ok.ok) {
      expect(ok.data[0]?.actions.APPROVE.allowed).toBe(true);
    }
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

// ── SC-PO-03 (Norte, seção a) ────────────────────────────────────────────────

describe("enviar exige arquivo", () => {
  it("sem arquivo anexado, enviar é recusado com o código próprio", async () => {
    h.findFirst.mockResolvedValue(
      row("IN_PROGRESS", { fileKey: null, fileName: null })
    );
    const r = await submitDeliverable({ deliverableId: DEL });
    expect(r).toMatchObject({ ok: false, code: "DELIVERABLE_FILE_REQUIRED" });
    expect(h.updateMany).not.toHaveBeenCalled();
  });

  it("o registro aponta para arquivo que nunca subiu: enviar é recusado", async () => {
    // A URL de upload é emitida e a versão gravada antes do PUT; se o PUT falhou,
    // o registro existe e o arquivo não. Enviar confere o storage.
    h.findFirst.mockResolvedValue(row("IN_PROGRESS"));
    h.exists.mockResolvedValue({ data: false, error: null });
    const r = await submitDeliverable({ deliverableId: DEL });
    expect(r).toMatchObject({ ok: false, code: "DELIVERABLE_FILE_REQUIRED" });
    expect(h.updateMany).not.toHaveBeenCalled();
    expect(h.exists).toHaveBeenCalledWith(
      "t1/trk/deliverables/del/v2/plano.pdf"
    );
  });

  it("erro ao conferir o storage também não deixa passar", async () => {
    h.findFirst.mockResolvedValue(row("IN_PROGRESS"));
    h.exists.mockResolvedValue({ data: null, error: { message: "boom" } });
    const r = await submitDeliverable({ deliverableId: DEL });
    expect(r.ok).toBe(false);
    expect(h.updateMany).not.toHaveBeenCalled();
  });

  it("só o envio confere o storage", async () => {
    h.findFirst.mockResolvedValue(row("NOT_STARTED"));
    await startDeliverable({ deliverableId: DEL });
    expect(h.exists).not.toHaveBeenCalled();
  });

  it("com arquivo, envia", async () => {
    h.findFirst.mockResolvedValue(row("IN_PROGRESS"));
    expect((await submitDeliverable({ deliverableId: DEL })).ok).toBe(true);
  });
});

describe("fase futura é só leitura", () => {
  const IDLE = { phaseInstance: { id: "ph2", phase: "SCALE", state: "IDLE" } };

  it("nenhuma escrita passa numa fase que ainda não abriu", async () => {
    h.findFirst.mockResolvedValue(row("NOT_STARTED", IDLE));
    for (const r of [
      await startDeliverable({ deliverableId: DEL }),
      await editDeliverableSummary({ deliverableId: DEL, summary: "x" }),
      await attachDeliverableVersion({
        deliverableId: DEL,
        filename: "a.pdf",
        contentType: "application/pdf",
        sizeBytes: 10,
      }),
    ]) {
      expect(r).toMatchObject({
        ok: false,
        code: "DELIVERABLE_PHASE_NOT_OPEN",
      });
    }
    expect(h.updateMany).not.toHaveBeenCalled();
    expect(h.update).not.toHaveBeenCalled();
  });

  it("a lista já diz por quê, desabilitando as ações", async () => {
    h.findMany.mockResolvedValue([row("NOT_STARTED", IDLE)]);
    const r = await listDeliverables({ trackId: TRACK });
    expect(r.ok && r.data[0]?.actions.START).toMatchObject({
      allowed: false,
    });
    expect(r.ok && r.data[0]?.actions.START.reason).toMatch(/ainda não abriu/i);
  });

  it("a lista diz se o ator pode anexar arquivo, com o motivo quando não pode", async () => {
    h.findMany.mockResolvedValue([
      row("IN_PROGRESS"),
      row("IN_REVIEW", { id: "d2" }),
    ]);
    const r = await listDeliverables({ trackId: TRACK });
    expect(r.ok && r.data[0]?.attach).toEqual({ allowed: true, reason: null });
    expect(r.ok && r.data[1]?.attach.allowed).toBe(false);
    expect(r.ok && r.data[1]?.attach.reason).toMatch(/anexa/i);
    asUser("SPONSOR", OWNER);
    const s = await listDeliverables({ trackId: TRACK });
    expect(s.ok && s.data[0]?.attach.allowed).toBe(false);
  });

  it("a lista não expõe a chave do objeto, só se há arquivo", async () => {
    h.findMany.mockResolvedValue([row("IN_PROGRESS")]);
    const r = await listDeliverables({ trackId: TRACK });
    expect(r.ok && r.data[0]).toMatchObject({
      hasFile: true,
      fileName: "plano.pdf",
    });
    expect(r.ok && "fileKey" in (r.data[0] as object)).toBe(false);
  });
});

describe("reabrir aprovado mexe na fase", () => {
  const reopen = () =>
    reopenDeliverable({ deliverableId: DEL, comment: "Baseline mudou." });

  it("fase OPEN: só o entregável volta, a fase não muda", async () => {
    h.findFirst.mockResolvedValue(row("APPROVED"));
    expect((await reopen()).ok).toBe(true);
    expect(h.phaseUpdate).not.toHaveBeenCalled();
    expect(h.trackUpdate).not.toHaveBeenCalled();
  });

  it.each([
    "GATE_READY",
    "BLOCKED",
  ])("fase %s volta para OPEN, sem contar reabertura", async (state) => {
    h.findFirst.mockResolvedValue(
      row("APPROVED", { phaseInstance: { id: "ph1", phase: "PILOT", state } })
    );
    expect((await reopen()).ok).toBe(true);
    expect(h.phaseUpdate).toHaveBeenCalledTimes(1);
    const data = h.phaseUpdate.mock.calls[0]?.[0].data;
    expect(data).toEqual({ state: "OPEN" });
    expect(h.phaseUpdate.mock.calls[0]?.[0].where).toEqual({ id: "ph1" });
  });

  it.each([
    "CLOSED",
    "OBSERVING",
  ])("fase %s é reaberta: OPEN, reopenCount + 1, janela zerada, trilha volta para ela", async (state) => {
    h.findFirst.mockResolvedValue(
      row("APPROVED", { phaseInstance: { id: "ph1", phase: "PILOT", state } })
    );
    expect((await reopen()).ok).toBe(true);
    const data = h.phaseUpdate.mock.calls[0]?.[0].data;
    expect(data).toMatchObject({
      state: "OPEN",
      reopenCount: { increment: 1 },
      closedAt: null,
      observationEndsAt: null,
    });
    expect(data.reopenedAt).toBeInstanceOf(Date);
    expect(h.trackUpdate).toHaveBeenCalledWith({
      where: { id: TRACK },
      data: { currentPhase: "PILOT" },
    });
    const actions = h.auditCreate.mock.calls.map((c) => c[0].data.action);
    expect(actions).toEqual([
      "scaffold.deliverable.reopen",
      "scaffold.deliverable.reopen-phase",
    ]);
  });

  it("reaberto sem comentário não mexe em nada, nem na fase", async () => {
    h.findFirst.mockResolvedValue(
      row("APPROVED", {
        phaseInstance: { id: "ph1", phase: "PILOT", state: "CLOSED" },
      })
    );
    const r = await reopenDeliverable({ deliverableId: DEL, comment: " " });
    expect(r.ok).toBe(false);
    expect(h.phaseUpdate).not.toHaveBeenCalled();
  });

  it("quem só revisa não reabre fase por aqui: precisa de deliverable.reopen", async () => {
    asUser("TEAM_MEMBER", OWNER);
    h.findFirst.mockResolvedValue(
      row("APPROVED", {
        phaseInstance: { id: "ph1", phase: "PILOT", state: "CLOSED" },
      })
    );
    expect((await reopen()).ok).toBe(false);
    expect(h.phaseUpdate).not.toHaveBeenCalled();
  });
});

describe("attachDeliverableVersion", () => {
  const INPUT = {
    deliverableId: DEL,
    filename: "plano.pdf",
    contentType: "application/pdf",
    sizeBytes: 1024,
  };

  it("sobe a versão, grava evento e devolve URL assinada de upload", async () => {
    h.findFirst.mockResolvedValue(row("IN_PROGRESS"));
    const r = await attachDeliverableVersion(INPUT);

    expect(r).toMatchObject({
      ok: true,
      data: { uploadUrl: "https://storage.test/put", version: 3 },
    });
    expect(h.updateMany).toHaveBeenCalledWith({
      where: { id: DEL, tenantId: "t1", version: 2 },
      data: {
        version: 3,
        fileKey: `t1/${TRACK}/deliverables/${DEL}/v3/plano.pdf`,
        fileName: "plano.pdf",
      },
    });
    expect(h.eventCreate.mock.calls[0]?.[0].data).toMatchObject({
      action: "ATTACH_VERSION",
      version: 3,
      comment: "plano.pdf",
      actorId: h.userId,
    });
    expect(h.auditCreate.mock.calls[0]?.[0].data.action).toBe(
      "scaffold.deliverable.attach"
    );
  });

  it("a chave é sempre do tenant e nunca sai do prefixo, com ou sem ../", async () => {
    h.findFirst.mockResolvedValue(row("IN_PROGRESS"));
    await attachDeliverableVersion({
      ...INPUT,
      filename: "../../outro-tenant/segredo.pdf",
    });
    const key = h.updateMany.mock.calls[0]?.[0].data.fileKey as string;
    expect(key.startsWith(`t1/${TRACK}/deliverables/${DEL}/v3/`)).toBe(true);
    expect(key).not.toContain("..");
    expect(key.split("/")).toHaveLength(6);
  });

  it("acima de 10 MB é recusado antes de tocar em qualquer coisa", async () => {
    h.findFirst.mockResolvedValue(row("IN_PROGRESS"));
    const r = await attachDeliverableVersion({
      ...INPUT,
      sizeBytes: 10 * 1024 * 1024 + 1,
    });
    expect(r).toMatchObject({ ok: false, code: "ARTEFACT_TOO_LARGE" });
    expect(h.updateMany).not.toHaveBeenCalled();
    expect(h.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("corrida: outra versão subiu no meio, e esta não sobrescreve", async () => {
    h.findFirst.mockResolvedValue(row("IN_PROGRESS"));
    h.updateMany.mockResolvedValue({ count: 0 });
    const r = await attachDeliverableVersion(INPUT);
    expect(r).toMatchObject({
      ok: false,
      code: "DELIVERABLE_TRANSITION_INVALID",
    });
    expect(h.eventCreate).not.toHaveBeenCalled();
  });

  it("estado que não admite anexo é recusado (em revisão)", async () => {
    h.findFirst.mockResolvedValue(row("IN_REVIEW"));
    const r = await attachDeliverableVersion(INPUT);
    expect(r).toMatchObject({
      ok: false,
      code: "DELIVERABLE_TRANSITION_INVALID",
    });
    expect(h.updateMany).not.toHaveBeenCalled();
  });

  it("membro do time só anexa no que é dele; sponsor recebe 403", async () => {
    h.findFirst.mockResolvedValue(row("IN_PROGRESS"));
    asUser("TEAM_MEMBER", "clx0000000000000000other001");
    expect((await attachDeliverableVersion(INPUT)).ok).toBe(false);
    asUser("SPONSOR", OWNER);
    const r = await attachDeliverableVersion(INPUT);
    expect(r.ok).toBe(false);
    expect(h.updateMany).not.toHaveBeenCalled();
  });

  it("falha do storage devolve erro e não deixa a versão gravada", async () => {
    h.findFirst.mockResolvedValue(row("IN_PROGRESS"));
    h.createSignedUploadUrl.mockResolvedValue({
      data: null,
      error: { message: "boom" },
    });
    const r = await attachDeliverableVersion(INPUT);
    expect(r.ok).toBe(false);
    expect(h.updateMany).not.toHaveBeenCalled();
  });

  it("entregável de outro tenant não existe", async () => {
    h.findFirst.mockResolvedValue(null);
    expect(await attachDeliverableVersion(INPUT)).toMatchObject({
      ok: false,
      code: "DELIVERABLE_NOT_FOUND",
    });
  });
});

describe("readDeliverableFile (download logado)", () => {
  it("audita antes de emitir a URL, e a URL é curta", async () => {
    h.findFirst.mockResolvedValue(row("IN_REVIEW"));
    const r = await readDeliverableFile({ deliverableId: DEL });
    expect(r).toMatchObject({
      ok: true,
      data: {
        url: "https://storage.test/get",
        expiresIn: 300,
        fileName: "plano.pdf",
      },
    });
    expect(h.auditCreate.mock.calls[0]?.[0].data).toMatchObject({
      action: "scaffold.deliverable.read",
      entityType: "scaffold.deliverable",
      entityId: DEL,
      tenantId: "t1",
    });
    expect(h.createSignedUrl.mock.calls[0]?.[0]).toBe(
      "t1/trk/deliverables/del/v2/plano.pdf"
    );
    expect(h.createSignedUrl.mock.calls[0]?.[1]).toBe(300);
  });

  it.each([
    "SPONSOR",
    "TEAM_LEAD",
    "ADMIN",
    "TEAM_MEMBER",
  ])("%s lê, como a matriz manda", async (role) => {
    asUser(role, OWNER);
    h.findFirst.mockResolvedValue(row("IN_REVIEW"));
    expect((await readDeliverableFile({ deliverableId: DEL })).ok).toBe(true);
  });

  it("sem arquivo, não há o que baixar", async () => {
    h.findFirst.mockResolvedValue(
      row("NOT_STARTED", { fileKey: null, fileName: null })
    );
    const r = await readDeliverableFile({ deliverableId: DEL });
    expect(r).toMatchObject({ ok: false, code: "DELIVERABLE_NO_FILE" });
    expect(h.auditCreate).not.toHaveBeenCalled();
  });

  it("versão anterior: a chave é a do prefixo da versão pedida", async () => {
    h.findFirst.mockResolvedValue(row("IN_REVIEW", { version: 3 }));
    h.eventFindMany.mockResolvedValue([
      { version: 1, comment: "primeira.pdf" },
    ]);
    const r = await readDeliverableFile({ deliverableId: DEL, version: 1 });
    expect(r.ok).toBe(true);
    expect(h.createSignedUrl.mock.calls[0]?.[0]).toBe(
      `t1/${TRACK}/deliverables/${DEL}/v1/primeira.pdf`
    );
    expect(h.eventFindMany.mock.calls[0]?.[0].where).toMatchObject({
      tenantId: "t1",
      deliverableId: DEL,
      action: "ATTACH_VERSION",
      version: 1,
    });
  });

  it("versão que não existe", async () => {
    h.findFirst.mockResolvedValue(row("IN_REVIEW", { version: 2 }));
    h.eventFindMany.mockResolvedValue([]);
    const r = await readDeliverableFile({ deliverableId: DEL, version: 9 });
    expect(r).toMatchObject({ ok: false, code: "DELIVERABLE_NO_FILE" });
  });

  it("entregável de outro tenant não existe", async () => {
    h.findFirst.mockResolvedValue(null);
    expect(await readDeliverableFile({ deliverableId: DEL })).toMatchObject({
      ok: false,
      code: "DELIVERABLE_NOT_FOUND",
    });
  });
});
