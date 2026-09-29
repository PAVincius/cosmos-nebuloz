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
  userFindMany: vi.fn(),
  emitReopened: vi.fn(),
  ensureBucket: vi.fn(),
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
vi.mock("@/lib/scaffold/gate-events", () => ({
  emitGateReopened: h.emitReopened,
}));
vi.mock("@repo/storage", () => ({
  SCAFFOLD_ARTEFACT_BUCKET: "scaffold-artefacts",
  ensureBucket: h.ensureBucket,
  scaffoldFileMimeType: (name: string) =>
    ({
      pdf: "application/pdf",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      png: "image/png",
      csv: "text/csv",
      txt: "text/plain",
    })[name.split(".").pop()?.toLowerCase() ?? ""] ?? null,
  SCAFFOLD_ALLOWED_MIME_TYPES: [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "image/png",
    "text/csv",
    "text/plain",
  ],
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
      user: { findMany: h.userFindMany },
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
  h.eventFindMany.mockResolvedValue([]);
  h.userFindMany.mockResolvedValue([]);
  h.emitReopened.mockResolvedValue(undefined);
  h.ensureBucket.mockResolvedValue(undefined);
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
      where: { id: DEL, tenantId: "t1", status: "IN_PROGRESS", version: 2 },
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
    // Baixar, nunca abrir inline: o navegador não renderiza o que o cliente subiu.
    expect(h.createSignedUrl.mock.calls[0]?.[2]).toEqual({
      download: "plano.pdf",
    });
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

// Crivo F1: o comentário do pedido de ajuste era gravado e nunca mostrado a quem
// produz o entregável.
describe("último pedido de ajuste na lista", () => {
  const REVIEWER = "clx0000000000000000review01";
  const ev = (
    action: string,
    comment: string,
    at: string,
    actorId = REVIEWER
  ) => ({
    deliverableId: DEL,
    action,
    comment,
    actorId,
    createdAt: new Date(at),
  });

  it("mostra o comentário, quem pediu e quando, no entregável com ajuste pedido", async () => {
    h.findMany.mockResolvedValue([row("ADJUSTMENT_REQUESTED")]);
    h.eventFindMany.mockResolvedValue([
      ev(
        "REQUEST_ADJUSTMENT",
        "Falta o volume por canal.",
        "2026-09-10T12:00:00Z"
      ),
    ]);
    h.userFindMany.mockResolvedValue([
      { id: REVIEWER, name: "Paula Oliveira", email: "p@x.com" },
    ]);

    const r = await listDeliverables({ trackId: TRACK });
    expect(r.ok && r.data[0]?.lastReview).toMatchObject({
      action: "REQUEST_ADJUSTMENT",
      comment: "Falta o volume por canal.",
      byName: "Paula Oliveira",
    });
    expect(r.ok && r.data[0]?.lastReview?.at).toBeInstanceOf(Date);
  });

  it("vale o pedido MAIS RECENTE, não o primeiro", async () => {
    h.findMany.mockResolvedValue([row("ADJUSTMENT_REQUESTED")]);
    h.eventFindMany.mockResolvedValue([
      ev(
        "REQUEST_ADJUSTMENT",
        "Segundo pedido, mais novo.",
        "2026-09-12T12:00:00Z"
      ),
      ev("REQUEST_ADJUSTMENT", "Primeiro pedido.", "2026-09-10T12:00:00Z"),
    ]);
    const r = await listDeliverables({ trackId: TRACK });
    expect(r.ok && r.data[0]?.lastReview?.comment).toBe(
      "Segundo pedido, mais novo."
    );
  });

  it("reaberto mostra o motivo da reabertura", async () => {
    h.findMany.mockResolvedValue([row("REOPENED")]);
    h.eventFindMany.mockResolvedValue([
      ev("REOPEN", "O baseline mudou em setembro.", "2026-09-11T12:00:00Z"),
    ]);
    const r = await listDeliverables({ trackId: TRACK });
    expect(r.ok && r.data[0]?.lastReview).toMatchObject({
      action: "REOPEN",
      comment: "O baseline mudou em setembro.",
    });
  });

  it("só enquanto o pedido está de pé: em revisão ou aprovado não sobra comentário velho", async () => {
    h.findMany.mockResolvedValue([
      row("IN_REVIEW"),
      row("APPROVED", { id: "d2" }),
    ]);
    h.eventFindMany.mockResolvedValue([
      ev("REQUEST_ADJUSTMENT", "Antigo.", "2026-09-10T12:00:00Z"),
    ]);
    const r = await listDeliverables({ trackId: TRACK });
    expect(r.ok && r.data.map((d) => d.lastReview)).toEqual([null, null]);
  });

  it("sem evento, sem comentário; e a consulta é do tenant e só desses entregáveis", async () => {
    h.findMany.mockResolvedValue([row("ADJUSTMENT_REQUESTED")]);
    h.eventFindMany.mockResolvedValue([]);
    const r = await listDeliverables({ trackId: TRACK });
    expect(r.ok && r.data[0]?.lastReview).toBeNull();
    const where = h.eventFindMany.mock.calls[0]?.[0].where;
    expect(where).toMatchObject({
      tenantId: "t1",
      deliverableId: { in: [DEL] },
      action: { in: ["REQUEST_ADJUSTMENT", "REOPEN"] },
    });
  });

  it("sem nome cadastrado, cai no e-mail", async () => {
    h.findMany.mockResolvedValue([row("ADJUSTMENT_REQUESTED")]);
    h.eventFindMany.mockResolvedValue([
      ev("REQUEST_ADJUSTMENT", "Ajuste.", "2026-09-10T12:00:00Z"),
    ]);
    h.userFindMany.mockResolvedValue([
      { id: REVIEWER, name: null, email: "p@x.com" },
    ]);
    const r = await listDeliverables({ trackId: TRACK });
    expect(r.ok && r.data[0]?.lastReview?.byName).toBe("p@x.com");
  });

  it("nenhum evento consultado quando não há entregável pendente de ajuste", async () => {
    h.findMany.mockResolvedValue([row("IN_PROGRESS")]);
    await listDeliverables({ trackId: TRACK });
    expect(h.eventFindMany).not.toHaveBeenCalled();
  });
});

describe("comentário com o mínimo de uma frase (Crivo F6)", () => {
  it.each([
    ["pedir ajuste", "IN_REVIEW"],
    ["reabrir", "APPROVED"],
  ])("%s com comentário de 2 caracteres é recusado, e nada é gravado", async (what, status) => {
    h.findFirst.mockResolvedValue(row(status));
    asUser(
      what === "reabrir" ? "CONSULTANT" : "PROCESS_OWNER",
      what === "reabrir" ? h.userId : APPROVER
    );
    const r =
      what === "reabrir"
        ? await reopenDeliverable({ deliverableId: DEL, comment: "ok" })
        : await requestDeliverableAdjustment({
            deliverableId: DEL,
            comment: "ok",
          });
    expect(r).toMatchObject({
      ok: false,
      code: "DELIVERABLE_COMMENT_REQUIRED",
    });
    expect(h.updateMany).not.toHaveBeenCalled();
    expect(h.eventCreate).not.toHaveBeenCalled();
    expect(h.phaseUpdate).not.toHaveBeenCalled();
  });

  it("dez caracteres passam e ficam no evento", async () => {
    h.findFirst.mockResolvedValue(row("IN_REVIEW"));
    asUser("PROCESS_OWNER", APPROVER);
    const r = await requestDeliverableAdjustment({
      deliverableId: DEL,
      comment: "1234567890",
    });
    expect(r.ok).toBe(true);
    expect(h.eventCreate.mock.calls[0]?.[0].data.comment).toBe("1234567890");
  });
});

// ── Vigia: concorrência e tipo de arquivo ────────────────────────────────────

describe("escrita condicional à versão e ao estado que se viu", () => {
  it("aprovar só vale para a versão do arquivo que o revisor viu", async () => {
    asUser("PROCESS_OWNER", APPROVER);
    h.findFirst.mockResolvedValue(row("IN_REVIEW", { version: 4 }));
    await approveDeliverable({ deliverableId: DEL });
    expect(h.updateMany.mock.calls[0]?.[0].where).toEqual({
      id: DEL,
      tenantId: "t1",
      status: "IN_REVIEW",
      version: 4,
    });
  });

  it("pedir ajuste também", async () => {
    asUser("PROCESS_OWNER", APPROVER);
    h.findFirst.mockResolvedValue(row("IN_REVIEW", { version: 4 }));
    await requestDeliverableAdjustment({
      deliverableId: DEL,
      comment: "Falta o volume por canal.",
    });
    expect(h.updateMany.mock.calls[0]?.[0].where).toMatchObject({ version: 4 });
  });

  it("versão nova subiu entre a leitura e a aprovação: nada é aprovado", async () => {
    asUser("PROCESS_OWNER", APPROVER);
    h.findFirst.mockResolvedValue(row("IN_REVIEW"));
    h.updateMany.mockResolvedValue({ count: 0 });
    const r = await approveDeliverable({ deliverableId: DEL });
    expect(r).toMatchObject({
      ok: false,
      code: "DELIVERABLE_TRANSITION_INVALID",
    });
    expect(h.eventCreate).not.toHaveBeenCalled();
    expect(h.auditCreate).not.toHaveBeenCalled();
  });

  it("as demais transições não amarram a versão", async () => {
    h.findFirst.mockResolvedValue(row("NOT_STARTED"));
    await startDeliverable({ deliverableId: DEL });
    expect(h.updateMany.mock.calls[0]?.[0].where).not.toHaveProperty("version");
  });

  it("anexar amarra estado E versão: um envio concorrente não deixa trocar o arquivo em revisão", async () => {
    h.findFirst.mockResolvedValue(row("IN_PROGRESS"));
    h.updateMany.mockResolvedValue({ count: 0 });
    const r = await attachDeliverableVersion({
      deliverableId: DEL,
      filename: "plano.pdf",
      contentType: "application/pdf",
      sizeBytes: 10,
    });
    expect(r).toMatchObject({
      ok: false,
      code: "DELIVERABLE_TRANSITION_INVALID",
    });
    expect(h.updateMany.mock.calls[0]?.[0].where).toEqual({
      id: DEL,
      tenantId: "t1",
      status: "IN_PROGRESS",
      version: 2,
    });
    expect(h.eventCreate).not.toHaveBeenCalled();
  });
});

describe("tipo de arquivo do entregável", () => {
  const attach = (filename: string, contentType: string) =>
    attachDeliverableVersion({
      deliverableId: DEL,
      filename,
      contentType,
      sizeBytes: 1024,
    });

  beforeEach(() => {
    h.findFirst.mockResolvedValue(row("IN_PROGRESS"));
  });

  it.each([
    ["plano.pdf", "application/pdf"],
    ["dados.csv", "text/csv"],
    ["notas.txt", "text/plain"],
    ["foto.png", "image/png"],
    ["PLANO.PDF", "application/pdf"],
  ])("aceita %s", async (name, type) => {
    expect((await attach(name, type)).ok).toBe(true);
  });

  it.each([
    "malware.exe",
    "pagina.html",
    "imagem.svg",
    "script.js",
    "arquivo.pdf.exe",
    "sem-extensao",
    ".pdf.",
  ])("recusa %s, sem gravar nem emitir URL", async (name) => {
    const r = await attach(name, "application/pdf");
    expect(r).toMatchObject({
      ok: false,
      code: "DELIVERABLE_FILE_TYPE_NOT_ALLOWED",
    });
    expect(h.createSignedUploadUrl).not.toHaveBeenCalled();
    expect(h.updateMany).not.toHaveBeenCalled();
  });

  it("o tipo declarado não pode contradizer a extensão: .pdf com text/html é recusado", async () => {
    const r = await attach("plano.pdf", "text/html");
    expect(r).toMatchObject({
      ok: false,
      code: "DELIVERABLE_FILE_TYPE_NOT_ALLOWED",
    });
    expect(h.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("devolve o tipo canônico para o PUT, e não o que o navegador disse", async () => {
    const r = await attach("dados.csv", "text/plain");
    // text/plain está na lista, então passa por contentType; o PUT usa o da extensão.
    expect(r.ok && r.data.contentType).toBe("text/csv");
  });

  it("a mensagem diz quais tipos valem", async () => {
    const r = await attach("x.exe", "application/octet-stream");
    expect(!r.ok && r.error).toMatch(/pdf/i);
  });
});

describe("reabrir fase avisa o resto do produto (X-04, ponto de emissão)", () => {
  const reopen = () =>
    reopenDeliverable({
      deliverableId: DEL,
      comment: "Baseline mudou em setembro.",
    });

  it.each([
    "CLOSED",
    "OBSERVING",
  ])("fase %s reaberta emite gate.reopened uma vez, depois da transação", async (state) => {
    h.findFirst.mockResolvedValue(
      row("APPROVED", { phaseInstance: { id: "ph1", phase: "PILOT", state } })
    );
    const order: string[] = [];
    h.auditCreate.mockImplementation(async () => {
      order.push("audit");
    });
    h.emitReopened.mockImplementation(async () => {
      order.push("emit");
    });
    expect((await reopen()).ok).toBe(true);

    expect(h.emitReopened).toHaveBeenCalledTimes(1);
    expect(h.emitReopened.mock.calls[0]?.[0]).toEqual({
      tenantId: "t1",
      trackId: TRACK,
      phaseInstanceId: "ph1",
      phase: "PILOT",
      actorId: h.userId,
    });
    // Nunca dentro da transação: evento de fase que ainda pode desfazer.
    expect(order.at(-1)).toBe("emit");
  });

  it.each([
    "OPEN",
    "GATE_READY",
    "BLOCKED",
  ])("fase %s não estava fechada: nada a avisar", async (state) => {
    h.findFirst.mockResolvedValue(
      row("APPROVED", { phaseInstance: { id: "ph1", phase: "PILOT", state } })
    );
    await reopen();
    expect(h.emitReopened).not.toHaveBeenCalled();
  });

  it("transação que falha não emite", async () => {
    h.findFirst.mockResolvedValue(
      row("APPROVED", {
        phaseInstance: { id: "ph1", phase: "PILOT", state: "CLOSED" },
      })
    );
    h.updateMany.mockResolvedValue({ count: 0 });
    await reopen();
    expect(h.emitReopened).not.toHaveBeenCalled();
  });

  it("falha do emissor não desfaz a reabertura já commitada", async () => {
    h.findFirst.mockResolvedValue(
      row("APPROVED", {
        phaseInstance: { id: "ph1", phase: "PILOT", state: "CLOSED" },
      })
    );
    h.emitReopened.mockRejectedValue(new Error("Inngest fora do ar"));
    const r = await reopen();
    expect(r.ok).toBe(true);
  });
});

describe("o bucket do Scaffold leva as regras de tipo e tamanho", () => {
  const INPUT = {
    deliverableId: DEL,
    filename: "plano.pdf",
    contentType: "application/pdf",
    sizeBytes: 1024,
  };

  it("garante o bucket antes de emitir a URL de upload", async () => {
    vi.resetModules();
    h.findFirst.mockResolvedValue(row("IN_PROGRESS"));
    const order: string[] = [];
    h.ensureBucket.mockImplementation(async () => {
      order.push("bucket");
    });
    h.createSignedUploadUrl.mockImplementation(async () => {
      order.push("url");
      return { data: { signedUrl: "https://storage.test/put" }, error: null };
    });
    const mod = await import("@/app/(scaffold)/actions/deliverables");
    await mod.attachDeliverableVersion(INPUT);
    expect(order).toEqual(["bucket", "url"]);
    expect(h.ensureBucket).toHaveBeenCalledWith("scaffold-artefacts");
  });

  it("confere uma vez por processo, não a cada anexo", async () => {
    vi.resetModules();
    h.findFirst.mockResolvedValue(row("IN_PROGRESS"));
    const mod = await import("@/app/(scaffold)/actions/deliverables");
    await mod.attachDeliverableVersion(INPUT);
    await mod.attachDeliverableVersion(INPUT);
    expect(h.ensureBucket).toHaveBeenCalledTimes(1);
  });

  it("falha ao configurar o bucket não impede o anexo, e tenta de novo na próxima", async () => {
    vi.resetModules();
    h.findFirst.mockResolvedValue(row("IN_PROGRESS"));
    h.ensureBucket.mockRejectedValueOnce(new Error("supabase fora"));
    const mod = await import("@/app/(scaffold)/actions/deliverables");
    expect((await mod.attachDeliverableVersion(INPUT)).ok).toBe(true);
    await mod.attachDeliverableVersion(INPUT);
    expect(h.ensureBucket).toHaveBeenCalledTimes(2);
  });
});
