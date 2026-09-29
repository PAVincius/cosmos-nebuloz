import { beforeEach, describe, expect, it, vi } from "vitest";

// Leituras do plano de controles (CH-DEV-04): perfis, aba do caso e modal.
// O que protege: tenant do contexto em toda query, "N não se aplicam à classe
// X" vindo do perfil pinado, o que bloqueia a decisão, e o card "mesmo
// processo" lido do ProcessRegistry sem o Charter tocar nas outras entidades.

const h = vi.hoisted(() => ({
  requireContext: vi.fn(),
  db: {} as Record<string, Record<string, ReturnType<typeof vi.fn>>>,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/charter/guards", () => ({
  requireCharterContext: h.requireContext,
}));
vi.mock("@repo/database", () => ({
  withTenantDb: (_t: string, fn: (db: unknown) => unknown) => fn(h.db),
}));

import {
  getCaseControls,
  listControlProfiles,
} from "../../app/(charter)/actions/controls-read";

const CTX = { tenantId: "t-1", userId: "u-1", charterRole: "COMPLIANCE" };

const profileControl = (code: string, minClass: string, over = {}) => ({
  code,
  name: `Controle ${code}`,
  category: "PRIVACY",
  evidence: "Relatório assinado",
  acceptanceCriteria: "Sem achado crítico",
  role: "LEGAL",
  cadence: "QUARTERLY",
  minClass,
  dispensable: true,
  seq: 0,
  ...over,
});

const version = (over = {}) => ({
  id: "pv-1",
  label: "v1",
  dominantRisks: ["PRIVACY", "BIAS"],
  decisionRole: "SECURITY",
  note: null,
  legalSignedAt: new Date("2026-09-01"),
  securitySignedAt: new Date("2026-09-02"),
  controls: [
    profileControl("TR-1", "INTERNAL"),
    profileControl("TR-2", "RESTRICTED"),
    profileControl("TR-3", "CONFIDENTIAL"),
  ],
  profile: { name: "Triagem", workForm: "TRIAGE" },
  ...over,
});

const caseControl = (code: string, state: string, over = {}) => ({
  id: `cc-${code}`,
  code,
  profileControlCode: code,
  name: `Controle ${code}`,
  category: "PRIVACY",
  evidence: "Relatório assinado",
  acceptanceCriteria: "Sem achado crítico",
  role: "LEGAL",
  cadence: "QUARTERLY",
  minClass: "INTERNAL",
  dispensable: true,
  isExtra: false,
  state,
  ownerId: "u-1",
  ownerName: null,
  summary: null,
  fileName: null,
  evidenceProducedAt: null,
  acceptedAt: null,
  expiresAt: null,
  dispensedUntil: null,
  dispensedReason: null,
  mitigation: null,
  events: [],
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.requireContext.mockResolvedValue(CTX);
  h.db = {
    charterUseCase: {
      findUnique: vi.fn().mockResolvedValue({
        id: "uc-1",
        code: "UC-118",
        title: "Triagem de autorizações prévias",
        dataClass: "INTERNAL",
        workForm: "TRIAGE",
        controlProfileVersionId: "pv-1",
      }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    charterControlProfileVersion: {
      findUnique: vi.fn().mockResolvedValue(version()),
      findMany: vi.fn().mockResolvedValue([version()]),
    },
    charterCaseControl: {
      findMany: vi
        .fn()
        .mockResolvedValue([
          caseControl("TR-1", "ACCEPTED"),
          caseControl("TR-4", "NO_EVIDENCE", { isExtra: true }),
        ]),
    },
    charterControlProfile: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "p-1",
          name: "Triagem",
          workForm: "TRIAGE",
          versions: [version()],
        },
      ]),
    },
    processRegistry: { findFirst: vi.fn().mockResolvedValue(null) },
    user: {
      findMany: vi
        .fn()
        .mockResolvedValue([{ id: "u-1", name: "Ana", email: "a@x" }]),
    },
    scaffoldTrack: { findFirst: vi.fn().mockResolvedValue(null) },
    signalInitiative: { findFirst: vi.fn().mockResolvedValue(null) },
    meridianGap: { findFirst: vi.fn().mockResolvedValue(null) },
  };
});

describe("getCaseControls", () => {
  it("consulta caso e controles pelo tenant do contexto", async () => {
    await getCaseControls({ code: "UC-118" });
    expect(h.db.charterUseCase.findUnique.mock.calls[0][0].where).toEqual({
      tenantId_code: { tenantId: "t-1", code: "UC-118" },
    });
    expect(
      h.db.charterCaseControl.findMany.mock.calls[0][0].where
    ).toMatchObject({
      tenantId: "t-1",
      useCaseId: "uc-1",
    });
  });

  it("progresso, bloqueios e o que bloqueia por controle", async () => {
    const res = await getCaseControls({ code: "UC-118" });
    if (!res.ok) throw new Error(res.error);
    expect(res.data.progress).toMatchObject({ accepted: 1, total: 2 });
    expect(res.data.blockers.map((b) => b.code)).toEqual(["TR-4"]);
    expect(
      res.data.controls.find((c) => c.code === "TR-4")?.blocksDecision
    ).toBe(true);
    expect(
      res.data.controls.find((c) => c.code === "TR-1")?.blocksDecision
    ).toBe(false);
  });

  it("conta os controles do perfil que não se aplicam à classe do caso", async () => {
    const res = await getCaseControls({ code: "UC-118" });
    if (!res.ok) throw new Error(res.error);
    // classe INTERNAL: TR-2 (RESTRICTED) e TR-3 (CONFIDENTIAL) ficam de fora.
    expect(res.data.notApplicable.codes.sort()).toEqual(["TR-2", "TR-3"]);
    expect(res.data.notApplicable.label).toBe(
      "2 controles não se aplicam à classe Interno"
    );
  });

  it("permissões da sessão viram can.submit e can.decide", async () => {
    h.requireContext.mockResolvedValue({ ...CTX, charterRole: "AUDITOR" });
    const res = await getCaseControls({ code: "UC-118" });
    if (!res.ok) throw new Error(res.error);
    expect(res.data.can).toEqual({ submit: false, decide: false });
  });

  it("responsável vem do usuário; controle extra vem marcado", async () => {
    const res = await getCaseControls({ code: "UC-118" });
    if (!res.ok) throw new Error(res.error);
    expect(res.data.controls[0].ownerName).toBe("Ana");
    expect(res.data.controls.find((c) => c.code === "TR-4")?.isExtra).toBe(
      true
    );
  });

  it("card mesmo processo: só os códigos que existem, lidos do ProcessRegistry", async () => {
    h.db.processRegistry.findFirst.mockResolvedValue({
      scaffoldTrackId: "tr-1",
      signalInitiativeId: "in-1",
      meridianGapId: null,
    });
    h.db.scaffoldTrack.findFirst.mockResolvedValue({ code: "TR-104" });
    h.db.signalInitiative.findFirst.mockResolvedValue({ code: "IN-014" });
    const res = await getCaseControls({ code: "UC-118" });
    if (!res.ok) throw new Error(res.error);
    expect(res.data.process).toEqual({
      scaffold: "TR-104",
      signal: "IN-014",
      meridian: null,
    });
    expect(h.db.processRegistry.findFirst.mock.calls[0][0].where).toEqual({
      tenantId: "t-1",
      charterUseCaseId: "uc-1",
    });
  });

  it("sem registro do processo, nenhum vínculo (não inventa)", async () => {
    const res = await getCaseControls({ code: "UC-118" });
    if (!res.ok) throw new Error(res.error);
    expect(res.data.process).toEqual({
      scaffold: null,
      signal: null,
      meridian: null,
    });
  });

  it("caso inexistente neste tenant vira erro nomeado", async () => {
    h.db.charterUseCase.findUnique.mockResolvedValue(null);
    const res = await getCaseControls({ code: "UC-999" });
    expect(res.ok).toBe(false);
  });

  it("controles de outros perfis para adicionar excluem os que o caso já tem", async () => {
    h.db.charterControlProfile.findMany.mockResolvedValue([
      {
        id: "p-2",
        name: "Conversacional",
        workForm: "CONVERSATIONAL",
        versions: [
          version({
            profile: { name: "Conversacional", workForm: "CONVERSATIONAL" },
            controls: [
              profileControl("CV-1", "INTERNAL"),
              profileControl("TR-1", "INTERNAL"),
            ],
          }),
        ],
      },
    ]);
    const res = await getCaseControls({ code: "UC-118" });
    if (!res.ok) throw new Error(res.error);
    const codes = res.data.addable.flatMap((p) =>
      p.controls.map((c) => c.code)
    );
    expect(codes).toEqual(["CV-1"]);
  });
});

describe("listControlProfiles", () => {
  it("entrega riscos dominantes, papel que decide, controles e assinatura", async () => {
    h.db.charterUseCase.findMany.mockResolvedValue([
      {
        code: "UC-118",
        title: "Triagem de autorizações prévias",
        workForm: "TRIAGE",
      },
    ]);
    const res = await listControlProfiles();
    if (!res.ok) throw new Error(res.error);
    const p = res.data[0];
    expect(p.name).toBe("Triagem");
    expect(p.dominantRisks.map((r) => r.id)).toEqual(["PRIVACY", "BIAS"]);
    expect(p.decisionRoleLabel).toBe("Segurança");
    expect(p.signed).toBe(true);
    expect(p.controls).toHaveLength(3);
    expect(p.controls[0]).toMatchObject({
      code: "TR-1",
      cadenceLabel: "Trimestral",
      roleLabel: "Jurídico",
    });
    expect(p.casesInUse).toEqual([
      { code: "UC-118", title: "Triagem de autorizações prévias" },
    ]);
  });

  it("perfil sem as duas assinaturas aparece como rascunho", async () => {
    h.db.charterControlProfile.findMany.mockResolvedValue([
      {
        id: "p-1",
        name: "Triagem",
        workForm: "TRIAGE",
        versions: [version({ securitySignedAt: null })],
      },
    ]);
    const res = await listControlProfiles();
    if (!res.ok) throw new Error(res.error);
    expect(res.data[0].signed).toBe(false);
  });

  it("casos em uso são só do tenant do contexto", async () => {
    await listControlProfiles();
    expect(h.db.charterUseCase.findMany.mock.calls[0][0].where).toMatchObject({
      tenantId: "t-1",
    });
  });
});
