import { beforeEach, describe, expect, it, vi } from "vitest";

// O caso de negócio — S-06, SG-04.
//
// O Scaffold é a fonte da verdade: emite o artefato assinado, imutável e
// versionado, e o Signal apura contra ele por meses. Duas invariantes carregam
// o resto:
//
//   1. ASSINADO É IMUTÁVEL. Editar cria versão nova; a assinada permanece
//      intacta e legível.
//   2. QUEM REDIGE NÃO ASSINA. A separação vive na matriz RBAC; aqui se testa
//      que a action respeita a máquina de estado que a torna significativa.

const h = vi.hoisted(() => ({
  requirePerm: vi.fn(),
  bcFindFirst: vi.fn(),
  bcUpdate: vi.fn(),
  bcFindMany: vi.fn(),
  versionFindFirst: vi.fn(),
  versionCreate: vi.fn(),
  versionUpdate: vi.fn(),
  versionUpdateMany: vi.fn(),
  metricDeleteMany: vi.fn(),
  metricCreateMany: vi.fn(),
  metricFindMany: vi.fn(),
  contestCreate: vi.fn(),
  sequenceUpsert: vi.fn(),
  auditCreate: vi.fn(),
  trackFindFirst: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/scaffold/guards", () => ({
  requireScaffoldPermissionContext: h.requirePerm,
  requireScaffoldContext: h.requirePerm,
}));
vi.mock("@repo/database", () => ({
  withTenantDb: (_t: string, fn: (db: unknown) => unknown) =>
    fn({
      scaffoldBusinessCase: {
        findFirst: h.bcFindFirst,
        findMany: h.bcFindMany,
        update: h.bcUpdate,
      },
      scaffoldBusinessCaseVersion: {
        findFirst: h.versionFindFirst,
        create: h.versionCreate,
        update: h.versionUpdate,
        updateMany: h.versionUpdateMany,
      },
      scaffoldBusinessCaseMetric: {
        deleteMany: h.metricDeleteMany,
        createMany: h.metricCreateMany,
        findMany: h.metricFindMany,
      },
      scaffoldBusinessCaseContest: { create: h.contestCreate },
      scaffoldSequence: { upsert: h.sequenceUpsert },
      scaffoldTrack: { findFirst: h.trackFindFirst },
      auditLog: { create: h.auditCreate },
    }),
}));

import {
  contestBusinessCase,
  newVersionFromSigned,
  saveDraft,
  signBusinessCase,
  submitForSignature,
} from "@/app/(scaffold)/actions/business-case";

const CTX = {
  tenantId: "t1",
  userId: "u1",
  role: "ADMIN",
  scaffoldRole: "CONSULTANT",
  user: { name: "Marina", email: "m@x.com" },
};

const BC = "clx00000000000000000bc001";
const V1 = "clx000000000000000000v001";
const V2 = "clx000000000000000000v002";

const METRICS = [
  {
    key: "cycle",
    label: "Cycle time da triagem",
    unit: "min",
    baseValue: "46",
    targetValue: "34",
    direction: "DOWN" as const,
    confidence: "MEASURED" as const,
    sourceLabel: "Vanta Core · export semanal",
    sampleLabel: "4 semanas · 1.360 casos",
  },
];

function bc(over: Record<string, unknown> = {}) {
  return {
    id: BC,
    code: "BC-104",
    tenantId: "t1",
    trackId: "trk1",
    state: "DRAFT",
    currentVersionId: V1,
    signedVersionId: null,
    sponsorId: "sponsor1",
    windowStart: null,
    windowMonths: 12,
    cadence: "monthly",
    benefitKind: "COST_AVOIDED",
    benefitHard: true,
    benefitAnnualCents: BigInt(140_000_000),
    benefitBasis: "6 FTE × custo hora",
    track: { code: "TR-104", processName: "Triagem" },
    versions: [{ id: V1, label: "v1", state: "DRAFT", contentHash: null }],
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.requirePerm.mockResolvedValue(CTX);
  h.bcFindFirst.mockResolvedValue(bc());
  h.versionFindFirst.mockResolvedValue({
    id: V1,
    label: "v1",
    state: "DRAFT",
    businessCaseId: BC,
    metrics: METRICS,
  });
  h.versionCreate.mockResolvedValue({ id: V2, label: "v2" });
  h.versionUpdate.mockResolvedValue({});
  h.versionUpdateMany.mockResolvedValue({ count: 1 });
  h.bcUpdate.mockResolvedValue({});
  h.metricDeleteMany.mockResolvedValue({ count: 1 });
  h.metricCreateMany.mockResolvedValue({ count: 1 });
  h.metricFindMany.mockResolvedValue(METRICS);
  h.contestCreate.mockResolvedValue({ id: "ct1" });
  h.sequenceUpsert.mockResolvedValue({ next: 105 });
  h.auditCreate.mockResolvedValue({});
});

// ── Imutabilidade ────────────────────────────────────────────────────────────

describe("saveDraft — só rascunho é editável", () => {
  it("edita a versão em rascunho", async () => {
    const res = await saveDraft({
      businessCaseId: BC,
      metrics: METRICS,
      windowMonths: 12,
      cadence: "monthly",
      benefitKind: "COST_AVOIDED",
      benefitHard: true,
      benefitBasis: "6 FTE × custo hora",
    });
    expect(res.ok).toBe(true);
    // Métricas são substituídas em bloco: editar uma a uma abriria janela em
    // que a versão tem metade das métricas velhas e metade das novas.
    expect(h.metricDeleteMany).toHaveBeenCalledTimes(1);
    expect(h.metricCreateMany).toHaveBeenCalledTimes(1);
  });

  for (const state of ["AWAITING", "CONTESTED", "SIGNED", "SUPERSEDED"]) {
    it(`recusa com VERSION_IMMUTABLE quando a versão está ${state}`, async () => {
      h.versionFindFirst.mockResolvedValue({
        id: V1,
        label: "v1",
        state,
        businessCaseId: BC,
        metrics: METRICS,
      });
      const res = await saveDraft({
        businessCaseId: BC,
        metrics: METRICS,
        windowMonths: 12,
        cadence: "monthly",
        benefitKind: "COST_AVOIDED",
        benefitHard: true,
        benefitBasis: "x",
      });
      expect(res).toMatchObject({ ok: false, code: "VERSION_IMMUTABLE" });
      expect(h.metricCreateMany).not.toHaveBeenCalled();
    });
  }
});

// ── Máquina de estado ────────────────────────────────────────────────────────

describe("submitForSignature", () => {
  it("congela em AWAITING", async () => {
    const res = await submitForSignature({ businessCaseId: BC });
    expect(res.ok).toBe(true);
    expect(h.bcUpdate.mock.calls[0][0].data.state).toBe("AWAITING");
    expect(h.versionUpdate.mock.calls[0][0].data.state).toBe("AWAITING");
  });

  it("não envia caso sem métrica — promessa vazia não se assina", async () => {
    h.versionFindFirst.mockResolvedValue({
      id: V1,
      label: "v1",
      state: "DRAFT",
      businessCaseId: BC,
      metrics: [],
    });
    const res = await submitForSignature({ businessCaseId: BC });
    expect(res.ok).toBe(false);
    expect(h.bcUpdate).not.toHaveBeenCalled();
  });

  it("não reenvia o que já está aguardando", async () => {
    h.versionFindFirst.mockResolvedValue({
      id: V1,
      label: "v1",
      state: "AWAITING",
      businessCaseId: BC,
      metrics: METRICS,
    });
    const res = await submitForSignature({ businessCaseId: BC });
    expect(res.ok).toBe(false);
  });
});

describe("signBusinessCase", () => {
  const AWAITING = () =>
    h.versionFindFirst.mockResolvedValue({
      id: V1,
      label: "v1",
      state: "AWAITING",
      businessCaseId: BC,
      metrics: METRICS,
    });

  it("assina e devolve o contentHash", async () => {
    AWAITING();
    h.bcFindFirst.mockResolvedValue(bc({ state: "AWAITING" }));
    const res = await signBusinessCase({
      businessCaseId: BC,
      signedByLabel: "Otto Braga",
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.contentHash).toMatch(/^[0-9a-f]{8}$/);
    }
  });

  it("é a única que escreve signedVersionId", async () => {
    AWAITING();
    h.bcFindFirst.mockResolvedValue(bc({ state: "AWAITING" }));
    await signBusinessCase({
      businessCaseId: BC,
      signedByLabel: "Otto Braga",
    });
    expect(h.bcUpdate.mock.calls[0][0].data).toMatchObject({
      state: "SIGNED",
      signedVersionId: V1,
    });
  });

  it("marca a versão anterior como SUPERSEDED", async () => {
    AWAITING();
    h.bcFindFirst.mockResolvedValue(
      bc({ state: "AWAITING", signedVersionId: "v-antiga" })
    );
    await signBusinessCase({
      businessCaseId: BC,
      signedByLabel: "Otto Braga",
    });
    expect(h.versionUpdateMany).toHaveBeenCalled();
  });

  it("recusa assinar rascunho — a versão precisa ter sido enviada", async () => {
    h.versionFindFirst.mockResolvedValue({
      id: V1,
      label: "v1",
      state: "DRAFT",
      businessCaseId: BC,
      metrics: METRICS,
    });
    const res = await signBusinessCase({
      businessCaseId: BC,
      signedByLabel: "Otto Braga",
    });
    expect(res.ok).toBe(false);
    expect(h.bcUpdate).not.toHaveBeenCalled();
  });

  it("recusa assinar versão contestada — a objeção vem antes da caneta", async () => {
    h.versionFindFirst.mockResolvedValue({
      id: V1,
      label: "v1",
      state: "CONTESTED",
      businessCaseId: BC,
      metrics: METRICS,
    });
    const res = await signBusinessCase({
      businessCaseId: BC,
      signedByLabel: "Otto Braga",
    });
    expect(res.ok).toBe(false);
  });

  it("exige nome com substância na assinatura", async () => {
    AWAITING();
    const res = await signBusinessCase({
      businessCaseId: BC,
      signedByLabel: "ok",
    });
    expect(res.ok).toBe(false);
    expect(h.bcUpdate).not.toHaveBeenCalled();
  });

  it("grava auditoria da assinatura com o hash", async () => {
    AWAITING();
    h.bcFindFirst.mockResolvedValue(bc({ state: "AWAITING" }));
    await signBusinessCase({
      businessCaseId: BC,
      signedByLabel: "Otto Braga",
    });
    const entry = h.auditCreate.mock.calls.at(-1)?.[0].data;
    expect(entry.action).toBe("scaffold.businesscase.sign");
    expect(entry.metadata.note).toMatch(/[0-9a-f]{8}/);
  });
});

describe("contestBusinessCase", () => {
  it("leva a CONTESTED e registra a objeção", async () => {
    h.versionFindFirst.mockResolvedValue({
      id: V1,
      label: "v1",
      state: "AWAITING",
      businessCaseId: BC,
      metrics: METRICS,
    });
    const res = await contestBusinessCase({
      businessCaseId: BC,
      byLabel: "Dra. Lívia Prado",
      roleLabel: "Process owner",
      objection:
        "A taxa de erro de 12% mistura divergência de opinião clínica com erro de transcrição.",
      asks: "Separar em duas métricas antes de reenviar.",
    });
    expect(res.ok).toBe(true);
    expect(h.bcUpdate.mock.calls[0][0].data.state).toBe("CONTESTED");
    expect(h.contestCreate.mock.calls[0][0].data.objection).toMatch(/12%/);
  });

  it("não contesta o que não foi enviado", async () => {
    const res = await contestBusinessCase({
      businessCaseId: BC,
      byLabel: "Dra. Lívia Prado",
      roleLabel: "Process owner",
      objection: "Objeção longa o suficiente para valer como registro escrito.",
      asks: "Separar em duas métricas.",
    });
    expect(res.ok).toBe(false);
  });

  it("exige objeção com substância — devolver sem dizer o quê não é objeção", async () => {
    h.versionFindFirst.mockResolvedValue({
      id: V1,
      label: "v1",
      state: "AWAITING",
      businessCaseId: BC,
      metrics: METRICS,
    });
    const res = await contestBusinessCase({
      businessCaseId: BC,
      byLabel: "Lívia",
      roleLabel: "Process owner",
      objection: "não",
      asks: "x",
    });
    expect(res.ok).toBe(false);
    expect(h.contestCreate).not.toHaveBeenCalled();
  });
});

describe("newVersionFromSigned — a assinada permanece intacta", () => {
  it("cria versão nova em DRAFT, clonando as métricas", async () => {
    h.bcFindFirst.mockResolvedValue(
      bc({
        state: "SIGNED",
        signedVersionId: V1,
        versions: [
          { id: V1, label: "v1", state: "SIGNED", contentHash: "abc12345" },
        ],
      })
    );
    h.versionFindFirst.mockResolvedValue({
      id: V1,
      label: "v1",
      state: "SIGNED",
      businessCaseId: BC,
      metrics: METRICS,
    });
    const res = await newVersionFromSigned({
      businessCaseId: BC,
      note: "Meta de cycle time ajustada após objeção.",
    });
    expect(res.ok).toBe(true);
    expect(h.versionCreate.mock.calls[0][0].data.state).toBe("DRAFT");
    expect(h.metricCreateMany).toHaveBeenCalledTimes(1);
  });

  it("NÃO mexe em signedVersionId — o Signal continua na versão vigente", async () => {
    // É o que faz o painel dizer "v2 vigente · v3 em edição". Se a nova versão
    // já valesse, o Signal passaria a apurar contra um rascunho não assinado.
    h.bcFindFirst.mockResolvedValue(
      bc({
        state: "SIGNED",
        signedVersionId: V1,
        versions: [
          { id: V1, label: "v1", state: "SIGNED", contentHash: "abc12345" },
        ],
      })
    );
    h.versionFindFirst.mockResolvedValue({
      id: V1,
      label: "v1",
      state: "SIGNED",
      businessCaseId: BC,
      metrics: METRICS,
    });
    await newVersionFromSigned({
      businessCaseId: BC,
      note: "Meta de cycle time ajustada após objeção.",
    });
    const data = h.bcUpdate.mock.calls[0][0].data;
    expect(data.signedVersionId).toBeUndefined();
    expect(data.currentVersionId).toBe(V2);
    expect(data.state).toBe("DRAFT");
  });

  it("numera a versão nova a partir da anterior", async () => {
    h.bcFindFirst.mockResolvedValue(
      bc({
        state: "SIGNED",
        signedVersionId: V1,
        versions: [
          { id: V1, label: "v3", state: "SIGNED", contentHash: "abc12345" },
        ],
      })
    );
    h.versionFindFirst.mockResolvedValue({
      id: V1,
      label: "v3",
      state: "SIGNED",
      businessCaseId: BC,
      metrics: METRICS,
    });
    await newVersionFromSigned({
      businessCaseId: BC,
      note: "Janela estendida a 18 meses por exigência regulatória.",
    });
    expect(h.versionCreate.mock.calls[0][0].data.label).toBe("v4");
  });
});

// Sign e contest recebiam `versionId` do cliente, separado de `businessCaseId`:
// assinava-se a versão AWAITING de OUTRO caso e gravava-se essa versão como
// `signedVersionId` deste. A versão agora é derivada do caso (a vigente), e o
// cliente só aponta o caso.
describe("a versão assinada ou contestada é a vigente do caso, nunca a que o cliente aponta", () => {
  const OUTRA = "clx000000000000000000vxx9";
  const AWAITING_V1 = {
    id: V1,
    label: "v1",
    state: "AWAITING",
    businessCaseId: BC,
    metrics: METRICS,
  };

  it("assinar usa bc.currentVersionId e ignora um versionId de fora", async () => {
    h.versionFindFirst.mockResolvedValue(AWAITING_V1);
    h.bcFindFirst.mockResolvedValue(bc({ state: "AWAITING" }));
    const res = await signBusinessCase({
      businessCaseId: BC,
      versionId: OUTRA,
      signedByLabel: "Otto Braga",
    } as never);
    expect(res.ok).toBe(true);
    expect(h.versionFindFirst.mock.calls[0][0].where.id).toBe(V1);
    expect(h.bcUpdate.mock.calls[0][0].data.signedVersionId).toBe(V1);
    expect(h.versionUpdate.mock.calls[0][0].where.id).toBe(V1);
  });

  it("contestar usa bc.currentVersionId e ignora um versionId de fora", async () => {
    h.versionFindFirst.mockResolvedValue(AWAITING_V1);
    h.bcFindFirst.mockResolvedValue(bc({ state: "AWAITING" }));
    const res = await contestBusinessCase({
      businessCaseId: BC,
      versionId: OUTRA,
      byLabel: "Dra. Lívia Prado",
      roleLabel: "Process owner",
      objection: "Objeção longa o suficiente para valer como registro escrito.",
      asks: "Separar em duas métricas.",
    } as never);
    expect(res.ok).toBe(true);
    expect(h.versionFindFirst.mock.calls[0][0].where.id).toBe(V1);
    expect(h.contestCreate.mock.calls[0][0].data.versionId).toBe(V1);
  });

  it("versão que não é deste caso é recusada e nada é gravado (defesa em profundidade)", async () => {
    h.versionFindFirst.mockResolvedValue({
      ...AWAITING_V1,
      businessCaseId: "clx00000000000000000bcxx9",
    });
    h.bcFindFirst.mockResolvedValue(bc({ state: "AWAITING" }));
    const res = await signBusinessCase({
      businessCaseId: BC,
      versionId: V1,
      signedByLabel: "Otto Braga",
    } as never);
    expect(res.ok).toBe(false);
    expect(h.bcUpdate).not.toHaveBeenCalled();
    expect(h.versionUpdate).not.toHaveBeenCalled();
  });

  it("caso sem versão vigente não assina nem contesta", async () => {
    h.bcFindFirst.mockResolvedValue(bc({ currentVersionId: null }));
    const sign = await signBusinessCase({
      businessCaseId: BC,
      versionId: V1,
      signedByLabel: "Otto Braga",
    } as never);
    const contest = await contestBusinessCase({
      businessCaseId: BC,
      versionId: V1,
      byLabel: "Dra. Lívia Prado",
      roleLabel: "Process owner",
      objection: "Objeção longa o suficiente para valer como registro escrito.",
      asks: "Separar em duas métricas.",
    } as never);
    expect(sign.ok).toBe(false);
    expect(contest.ok).toBe(false);
    expect(h.bcUpdate).not.toHaveBeenCalled();
  });
});
