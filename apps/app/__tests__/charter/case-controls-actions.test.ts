import { beforeEach, describe, expect, it, vi } from "vitest";

// CH-DEV-02/03/05: plano de controles do caso e as ações do fluxo, com a
// permissão checada no backend (case.submit / case.decide). O banco é mockado;
// o comportamento de trigger, CHECK e concorrência é provado à parte contra o
// Postgres.
const h = vi.hoisted(() => ({
  requirePerm: vi.fn(),
  requireCtx: vi.fn(),
  emit: vi.fn(),
  ucFindUnique: vi.fn(),
  ucUpdate: vi.fn(),
  versionFindFirst: vi.fn(),
  versionFindUnique: vi.fn(),
  mitigationFindMany: vi.fn(),
  ccCreateMany: vi.fn(),
  ccFindMany: vi.fn(),
  ccFindUnique: vi.fn(),
  ccUpdateMany: vi.fn(),
  ccCreate: vi.fn(),
  ccCount: vi.fn(),
  evCreate: vi.fn(),
  evCreateMany: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/inngest/emit-product-event", () => ({
  emitProductEvent: h.emit,
}));
vi.mock("@/lib/charter/guards", () => ({
  requireCharterPermissionContext: h.requirePerm,
  requireCharterContext: h.requireCtx,
}));
vi.mock("@repo/database", () => ({
  withTenantDb: (_t: string, fn: (db: unknown) => unknown) =>
    fn({
      charterUseCase: { findUnique: h.ucFindUnique, update: h.ucUpdate },
      charterControlProfileVersion: {
        findFirst: h.versionFindFirst,
        findUnique: h.versionFindUnique,
      },
      charterMitigation: { findMany: h.mitigationFindMany },
      charterCaseControl: {
        createMany: h.ccCreateMany,
        findMany: h.ccFindMany,
        findUnique: h.ccFindUnique,
        updateMany: h.ccUpdateMany,
        create: h.ccCreate,
        count: h.ccCount,
      },
      charterCaseControlEvent: {
        create: h.evCreate,
        createMany: h.evCreateMany,
      },
      auditLog: { create: h.auditCreate },
    }),
}));

import {
  acceptControl,
  addExtraControl,
  attachControlEvidence,
  dispenseControl,
  editControl,
  generateCaseControlPlan,
  getCaseControlPlan,
  reopenControl,
  requestControlAdjustment,
  submitControl,
} from "@/app/(charter)/actions/case-controls";

const CTX = {
  tenantId: "t1",
  userId: "u-comp",
  charterRole: "COMPLIANCE",
  user: { name: "Ana", email: "ana@x.test" },
};

const UC = {
  id: "uc1",
  code: "UC-118",
  title: "Triagem de autorizações prévias",
  status: "REVIEW",
  dataClass: "INTERNAL",
  ownerId: "u-owner",
  workForm: null,
  controlProfileVersionId: null,
};

const control = (over: Record<string, unknown> = {}) => ({
  id: "cc1",
  code: "TR-2",
  name: "Rollback testado",
  state: "IN_REVIEW",
  cadence: "SEMIANNUAL",
  dispensable: true,
  fileKey: "t1/evidencias/rollback.pdf",
  summary: null,
  ...over,
});

const REF = { code: "UC-118", controlCode: "TR-2" };

beforeEach(() => {
  vi.clearAllMocks();
  h.requirePerm.mockResolvedValue(CTX);
  h.requireCtx.mockResolvedValue(CTX);
  h.emit.mockResolvedValue(undefined);
  h.ucFindUnique.mockResolvedValue(UC);
  h.ucUpdate.mockResolvedValue({});
  h.ccFindUnique.mockResolvedValue(control());
  h.ccUpdateMany.mockResolvedValue({ count: 1 });
  h.ccCreate.mockResolvedValue({ id: "cc9" });
  h.ccCount.mockResolvedValue(0);
  h.evCreate.mockResolvedValue({});
  h.evCreateMany.mockResolvedValue({ count: 0 });
  h.auditCreate.mockResolvedValue({});
  h.mitigationFindMany.mockResolvedValue([]);
});

// ── Plano (CH-DEV-02) ─────────────────────────────────────────────────────────

describe("generateCaseControlPlan", () => {
  const VERSION = {
    id: "pv1",
    controls: [
      {
        code: "TR-1",
        name: "Nenhum urgente rebaixado",
        category: "OPERATIONAL",
        evidence: "e",
        acceptanceCriteria: "a",
        role: "COMPLIANCE",
        cadence: "MONTHLY",
        minClass: "PUBLIC",
        dispensable: true,
      },
      {
        code: "TR-3",
        name: "Sempre-humano",
        category: "BIAS",
        evidence: "e",
        acceptanceCriteria: "a",
        role: "COMPLIANCE",
        cadence: "MONTHLY",
        minClass: "INTERNAL",
        dispensable: true,
      },
      {
        code: "TR-9",
        name: "Só confidencial",
        category: "PRIVACY",
        evidence: "e",
        acceptanceCriteria: "a",
        role: "LEGAL",
        cadence: "ANNUAL",
        minClass: "CONFIDENTIAL",
        dispensable: true,
      },
    ],
  };

  beforeEach(() => {
    h.versionFindFirst.mockResolvedValue(VERSION);
    h.ccCreateMany.mockResolvedValue({ count: 2 });
    h.ccFindMany.mockResolvedValue([{ id: "a" }, { id: "b" }]);
  });

  it("exige case.submit", async () => {
    await generateCaseControlPlan({ code: "UC-118", workForm: "TRIAGE" });

    expect(h.requirePerm).toHaveBeenCalledWith("case.submit");
  });

  it("gera só os controles aplicáveis à classe e CONTA os que não se aplicam", async () => {
    const r = await generateCaseControlPlan({
      code: "UC-118",
      workForm: "TRIAGE",
    });

    expect(r).toEqual({
      ok: true,
      data: {
        dataClass: "INTERNAL",
        applicable: 2,
        notApplicable: 1,
        notApplicableCodes: ["TR-9"],
        created: 2,
      },
    });
    const rows = h.ccCreateMany.mock.calls[0][0].data;
    expect(rows.map((x: { code: string }) => x.code)).toEqual(["TR-1", "TR-3"]);
    expect(h.ccCreateMany.mock.calls[0][0].skipDuplicates).toBe(true);
  });

  it("só usa perfil com as DUAS assinaturas", async () => {
    await generateCaseControlPlan({ code: "UC-118", workForm: "TRIAGE" });

    expect(h.versionFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          profile: { workForm: "TRIAGE" },
          legalSignedBy: { not: null },
          securitySignedBy: { not: null },
        }),
      })
    );
  });

  it("perfil sem assinatura: 422 com a regra nomeada", async () => {
    h.versionFindFirst.mockResolvedValue(null);

    const r = await generateCaseControlPlan({
      code: "UC-118",
      workForm: "TRIAGE",
    });

    expect(r.ok).toBe(false);
    expect(h.ccCreateMany).not.toHaveBeenCalled();
  });

  it("pina forma e versão do perfil no caso", async () => {
    await generateCaseControlPlan({ code: "UC-118", workForm: "TRIAGE" });

    expect(h.ucUpdate).toHaveBeenCalledWith({
      where: { id: "uc1" },
      data: { workForm: "TRIAGE", controlProfileVersionId: "pv1" },
    });
  });

  it("liga a mitigação existente da mesma categoria ao controle, sem repetir", async () => {
    h.mitigationFindMany.mockResolvedValue([
      { id: "mit-1", category: "OPERATIONAL" },
      { id: "mit-2", category: "OPERATIONAL" },
    ]);

    await generateCaseControlPlan({ code: "UC-118", workForm: "TRIAGE" });

    const rows = h.ccCreateMany.mock.calls[0][0].data;
    expect(rows[0].mitigationId).toBe("mit-1"); // OPERATIONAL
    expect(rows[1].mitigationId).toBeNull(); // BIAS: nenhuma
  });

  it("registra o evento inicial de cada controle e audita", async () => {
    await generateCaseControlPlan({ code: "UC-118", workForm: "TRIAGE" });

    const events = h.evCreateMany.mock.calls[0][0].data;
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      action: "START",
      toState: "NO_EVIDENCE",
      actorId: "u-comp",
    });
    expect(h.auditCreate).toHaveBeenCalled();
  });

  it("idempotente: caso que já tem plano da mesma forma não recria nada", async () => {
    h.ucFindUnique.mockResolvedValue({
      ...UC,
      workForm: "TRIAGE",
      controlProfileVersionId: "pv1",
    });
    h.versionFindUnique.mockResolvedValue(VERSION);

    const r = await generateCaseControlPlan({
      code: "UC-118",
      workForm: "TRIAGE",
    });

    expect(r).toMatchObject({ ok: true, data: { created: 0, applicable: 2 } });
    expect(h.ccCreateMany).not.toHaveBeenCalled();
    expect(h.ucUpdate).not.toHaveBeenCalled();
  });

  it("recusa trocar a forma de um caso que já tem plano", async () => {
    h.ucFindUnique.mockResolvedValue({
      ...UC,
      workForm: "TRIAGE",
      controlProfileVersionId: "pv1",
    });

    const r = await generateCaseControlPlan({
      code: "UC-118",
      workForm: "REPORTING",
    });

    expect(r.ok).toBe(false);
    expect(h.ccCreateMany).not.toHaveBeenCalled();
  });

  it("caso arquivado não recebe plano", async () => {
    h.ucFindUnique.mockResolvedValue({ ...UC, status: "ARCHIVED" });

    const r = await generateCaseControlPlan({
      code: "UC-118",
      workForm: "TRIAGE",
    });

    expect(r.ok).toBe(false);
  });
});

// ── Permissões ────────────────────────────────────────────────────────────────

describe("permissão no backend", () => {
  it.each([
    [
      "attachControlEvidence",
      () =>
        attachControlEvidence({
          ...REF,
          fileKey: "t1/a.pdf",
          fileName: "a.pdf",
        }),
      "case.submit",
    ],
    ["submitControl", () => submitControl(REF), "case.submit"],
    ["editControl", () => editControl({ ...REF, summary: "x" }), "case.submit"],
    [
      "addExtraControl",
      () =>
        addExtraControl({
          code: "UC-118",
          name: "n",
          category: "SECURITY",
          evidence: "e",
          role: "SECURITY",
          cadence: "MONTHLY",
        }),
      "case.submit",
    ],
    ["acceptControl", () => acceptControl(REF), "case.decide"],
    [
      "requestControlAdjustment",
      () => requestControlAdjustment({ ...REF, comment: "c" }),
      "case.decide",
    ],
    [
      "dispenseControl",
      () =>
        dispenseControl({
          ...REF,
          comment: "c",
          dispensedUntil: new Date(Date.now() + 86_400_000),
        }),
      "case.decide",
    ],
    [
      "reopenControl",
      () => reopenControl({ ...REF, comment: "c" }),
      "case.decide",
    ],
  ] as const)("%s exige %s", async (_name, call, permission) => {
    await call();

    expect(h.requirePerm).toHaveBeenCalledWith(permission);
  });

  it("sem a permissão, nada é lido nem escrito", async () => {
    h.requirePerm.mockRejectedValue(new Error("FORBIDDEN"));

    const r = await acceptControl(REF);

    expect(r.ok).toBe(false);
    expect(h.ucFindUnique).not.toHaveBeenCalled();
    expect(h.ccUpdateMany).not.toHaveBeenCalled();
    expect(h.emit).not.toHaveBeenCalled();
  });
});

// ── Fluxo ─────────────────────────────────────────────────────────────────────

describe("anexar e enviar", () => {
  it("anexar leva a Em elaboração e zera a aceitação anterior", async () => {
    h.ccFindUnique.mockResolvedValue(
      control({ state: "NO_EVIDENCE", fileKey: null })
    );

    const r = await attachControlEvidence({
      ...REF,
      fileKey: "t1/evidencias/rollback.pdf",
      fileName: "rollback.pdf",
      summary: "Rollback executado em produção",
    });

    expect(r).toEqual({ ok: true, data: { state: "IN_PROGRESS" } });
    const call = h.ccUpdateMany.mock.calls[0][0];
    expect(call.where).toMatchObject({
      id: "cc1",
      tenantId: "t1",
      state: "NO_EVIDENCE",
    });
    expect(call.data).toMatchObject({
      state: "IN_PROGRESS",
      fileKey: "t1/evidencias/rollback.pdf",
      acceptedAt: null,
      expiresAt: null,
    });
  });

  it("recusa arquivo de outro tenant", async () => {
    const r = await attachControlEvidence({
      ...REF,
      fileKey: "t2/evidencias/rollback.pdf",
      fileName: "rollback.pdf",
    });

    expect(r.ok).toBe(false);
    expect(h.ccUpdateMany).not.toHaveBeenCalled();
  });

  it("enviar exige arquivo", async () => {
    h.ccFindUnique.mockResolvedValue(
      control({ state: "IN_PROGRESS", fileKey: null })
    );

    const r = await submitControl(REF);

    expect(r.ok).toBe(false);
    expect(h.ccUpdateMany).not.toHaveBeenCalled();
  });

  it("enviar com arquivo leva a Em revisão", async () => {
    h.ccFindUnique.mockResolvedValue(control({ state: "IN_PROGRESS" }));

    const r = await submitControl(REF);

    expect(r).toEqual({ ok: true, data: { state: "IN_REVIEW" } });
  });

  it("enviar de estado errado é recusado", async () => {
    h.ccFindUnique.mockResolvedValue(control({ state: "NO_EVIDENCE" }));

    const r = await submitControl(REF);

    expect(r.ok).toBe(false);
    expect(h.ccUpdateMany).not.toHaveBeenCalled();
  });
});

describe("toda transição grava evento, auditoria e protege contra corrida", () => {
  it("evento com ator, de/para e comentário", async () => {
    await requestControlAdjustment({
      ...REF,
      comment: "Falta a data do teste.",
    });

    expect(h.evCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "t1",
        caseControlId: "cc1",
        action: "REQUEST_ADJUSTMENT",
        actorId: "u-comp",
        fromState: "IN_REVIEW",
        toState: "ADJUSTMENT_REQUESTED",
        comment: "Falta a data do teste.",
      }),
    });
    expect(h.auditCreate).toHaveBeenCalledTimes(1);
  });

  it("se o controle mudou de estado no meio (count 0), falha sem gravar evento", async () => {
    h.ccUpdateMany.mockResolvedValue({ count: 0 });

    const r = await acceptControl(REF);

    expect(r.ok).toBe(false);
    expect(h.evCreate).not.toHaveBeenCalled();
    expect(h.auditCreate).not.toHaveBeenCalled();
    expect(h.emit).not.toHaveBeenCalled();
  });
});

describe("aceitar", () => {
  it("aceita Em revisão, fixa a validade pela cadência e anuncia o fato", async () => {
    const r = await acceptControl(REF);

    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("x");
    expect(r.data.state).toBe("ACCEPTED");
    // SEMIANNUAL => ~6 meses à frente
    const days = (r.data.expiresAt!.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(178);
    expect(days).toBeLessThan(186);

    expect(h.emit).toHaveBeenCalledTimes(1);
    expect(h.emit.mock.calls[0][0]).toBe("charterControlAccepted");
    expect(h.emit.mock.calls[0][1]).toMatchObject({
      tenantId: "t1",
      useCaseId: "uc1",
      caseControlId: "cc1",
      controlCode: "TR-2",
    });
  });

  it("cadência por ciclo aceita sem validade de calendário", async () => {
    h.ccFindUnique.mockResolvedValue(control({ cadence: "PER_CYCLE" }));

    const r = await acceptControl(REF);

    expect(r).toMatchObject({ ok: true, data: { expiresAt: null } });
    expect(h.emit.mock.calls[0][1].expiresAt).toBeNull();
  });

  it("controle que não está Em revisão não é aceito (nem anuncia)", async () => {
    h.ccFindUnique.mockResolvedValue(control({ state: "IN_PROGRESS" }));

    const r = await acceptControl(REF);

    expect(r.ok).toBe(false);
    expect(h.emit).not.toHaveBeenCalled();
  });
});

describe("comentário obrigatório", () => {
  it.each([
    [
      "pedir ajuste",
      () => requestControlAdjustment({ ...REF, comment: "   " }),
    ],
    ["reabrir", () => reopenControl({ ...REF, comment: "" })],
    [
      "dispensar",
      () =>
        dispenseControl({
          ...REF,
          comment: " ",
          dispensedUntil: new Date(Date.now() + 86_400_000),
        }),
    ],
  ])("%s sem comentário é recusado antes de qualquer escrita", async (_n, call) => {
    const r = await call();

    expect(r.ok).toBe(false);
    expect(h.ccUpdateMany).not.toHaveBeenCalled();
    expect(h.ucFindUnique).not.toHaveBeenCalled();
  });
});

describe("dispensar (CH-PO-04)", () => {
  const amanha = () => new Date(Date.now() + 86_400_000);

  beforeEach(() => {
    h.ccFindUnique.mockResolvedValue(
      control({ state: "NO_EVIDENCE", fileKey: null })
    );
  });

  it("dispensa com motivo e prazo, gravando os dois no controle", async () => {
    const until = amanha();

    const r = await dispenseControl({
      ...REF,
      comment: "Fora do escopo do piloto.",
      dispensedUntil: until,
    });

    expect(r).toEqual({ ok: true, data: { state: "DISPENSED" } });
    expect(h.ccUpdateMany.mock.calls[0][0].data).toMatchObject({
      state: "DISPENSED",
      dispensedUntil: until,
      dispensedReason: "Fora do escopo do piloto.",
    });
  });

  it("prazo no passado é recusado", async () => {
    const r = await dispenseControl({
      ...REF,
      comment: "c",
      dispensedUntil: new Date(Date.now() - 1000),
    });

    expect(r.ok).toBe(false);
    expect(h.ccUpdateMany).not.toHaveBeenCalled();
  });

  it("prazo acima de 6 meses é recusado", async () => {
    const r = await dispenseControl({
      ...REF,
      comment: "c",
      dispensedUntil: new Date(Date.now() + 200 * 86_400_000),
    });

    expect(r.ok).toBe(false);
  });

  it("controle não dispensável (RIPD) é recusado", async () => {
    h.ccFindUnique.mockResolvedValue(
      control({ code: "CV-4", state: "NO_EVIDENCE", dispensable: false })
    );

    const r = await dispenseControl({
      ...REF,
      controlCode: "CV-4",
      comment: "c",
      dispensedUntil: amanha(),
    });

    expect(r.ok).toBe(false);
    expect(h.ccUpdateMany).not.toHaveBeenCalled();
  });

  it("o dono do próprio caso não dispensa controle dele", async () => {
    h.requirePerm.mockResolvedValue({ ...CTX, userId: "u-owner" });

    const r = await dispenseControl({
      ...REF,
      comment: "c",
      dispensedUntil: amanha(),
    });

    expect(r.ok).toBe(false);
    expect(h.ccUpdateMany).not.toHaveBeenCalled();
  });

  it("só dispensa de Sem evidência ou Ajuste pedido", async () => {
    h.ccFindUnique.mockResolvedValue(control({ state: "ACCEPTED" }));

    const r = await dispenseControl({
      ...REF,
      comment: "c",
      dispensedUntil: amanha(),
    });

    expect(r.ok).toBe(false);
  });
});

describe("reabrir", () => {
  it("reabre aceito e limpa aceitação e validade; o histórico fica no evento", async () => {
    h.ccFindUnique.mockResolvedValue(control({ state: "ACCEPTED" }));

    const r = await reopenControl({ ...REF, comment: "A evidência mudou." });

    expect(r).toEqual({ ok: true, data: { state: "REOPENED" } });
    expect(h.ccUpdateMany.mock.calls[0][0].data).toMatchObject({
      state: "REOPENED",
      acceptedAt: null,
      expiresAt: null,
      dispensedUntil: null,
      dispensedReason: null,
    });
  });

  it("reabre dispensado", async () => {
    h.ccFindUnique.mockResolvedValue(control({ state: "DISPENSED" }));

    const r = await reopenControl({
      ...REF,
      comment: "O prazo da dispensa acabou.",
    });

    expect(r.ok).toBe(true);
  });

  it("controle em revisão não reabre", async () => {
    const r = await reopenControl({ ...REF, comment: "c" });

    expect(r.ok).toBe(false);
  });
});

describe("editar", () => {
  it("edita resumo e responsável sem mudar de estado e registra EDIT", async () => {
    h.ccFindUnique.mockResolvedValue(control({ state: "IN_PROGRESS" }));

    const r = await editControl({
      ...REF,
      summary: "Novo resumo",
      ownerName: "Rafael",
    });

    expect(r).toEqual({ ok: true, data: { state: "IN_PROGRESS" } });
    expect(h.evCreate.mock.calls[0][0].data).toMatchObject({
      action: "EDIT",
      fromState: "IN_PROGRESS",
      toState: "IN_PROGRESS",
    });
  });

  it("controle aceito não se edita: reabra antes", async () => {
    h.ccFindUnique.mockResolvedValue(control({ state: "ACCEPTED" }));

    const r = await editControl({ ...REF, summary: "x" });

    expect(r.ok).toBe(false);
    expect(h.ccUpdateMany).not.toHaveBeenCalled();
  });

  it("edição vazia é recusada", async () => {
    const r = await editControl({ ...REF });

    expect(r.ok).toBe(false);
  });
});

describe("adicionar controle extra", () => {
  it("nasce SEM evidência (bloqueia a decisão), com código X-n e marcado extra", async () => {
    h.ccCount.mockResolvedValue(1);

    const r = await addExtraControl({
      code: "UC-118",
      name: "Teste de carga no rollback",
      category: "OPERATIONAL",
      evidence: "Relatório do teste",
      role: "SECURITY",
      cadence: "QUARTERLY",
    });

    expect(r).toEqual({ ok: true, data: { controlCode: "X-2" } });
    const data = h.ccCreate.mock.calls[0][0].data;
    expect(data).toMatchObject({
      isExtra: true,
      code: "X-2",
      profileControlCode: null,
      tenantId: "t1",
    });
    expect(data.state).toBeUndefined(); // default do banco: NO_EVIDENCE
    expect(h.evCreate.mock.calls[0][0].data).toMatchObject({
      action: "START",
      toState: "NO_EVIDENCE",
    });
  });
});

describe("getCaseControlPlan", () => {
  it("devolve progresso X/Y e o que bloqueia a decisão, com o motivo", async () => {
    h.ccFindMany.mockResolvedValue([
      {
        code: "TR-1",
        name: "A",
        category: "OPERATIONAL",
        state: "ACCEPTED",
        isExtra: false,
        dispensable: true,
        summary: null,
        fileName: null,
        expiresAt: null,
        dispensedUntil: null,
      },
      {
        code: "TR-2",
        name: "B",
        category: "OPERATIONAL",
        state: "NO_EVIDENCE",
        isExtra: false,
        dispensable: true,
        summary: null,
        fileName: null,
        expiresAt: null,
        dispensedUntil: null,
      },
    ]);
    h.ucFindUnique.mockResolvedValue({ id: "uc1" });

    const r = await getCaseControlPlan({ code: "UC-118" });

    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("x");
    expect(r.data.progress).toEqual({ accepted: 1, total: 2, dispensed: 0 });
    expect(r.data.blockers).toHaveLength(1);
    expect(r.data.controls.find((c) => c.code === "TR-2")?.blocksDecision).toBe(
      true
    );
    expect(r.data.controls.find((c) => c.code === "TR-1")?.blocksDecision).toBe(
      false
    );
  });
});
