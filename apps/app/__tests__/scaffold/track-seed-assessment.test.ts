import { beforeEach, describe, expect, it, vi } from "vitest";

// D-27: o Scaffold depende do diagnóstico do Meridian.
//
// Trilha de prontidão (template SEM forma de trabalho) nasce de um assessment
// inteiro, não de uma lacuna: o A1, o baseline do SG-04 e a reavaliação do S3 e
// do E3 dependem desse vínculo. Sem ele, a primeira trilha já nasce órfã. Trilha
// por forma de trabalho continua podendo nascer sem assessment.
//
// `sourceAssessmentId` não tem FK (como `sourceGapId`): a regra mora aqui.

const h = vi.hoisted(() => ({
  versionFindFirst: vi.fn(),
  assessmentFindFirst: vi.fn(),
  overlayFindFirst: vi.fn(),
  conflictCount: vi.fn(),
  sequenceUpsert: vi.fn(),
  trackCreate: vi.fn(),
  bcCreate: vi.fn(),
  bcUpdate: vi.fn(),
  membershipFindFirst: vi.fn(),
  delTplFindMany: vi.fn(),
  phaseFindMany: vi.fn(),
  delCreateMany: vi.fn(),
  moduleFindFirst: vi.fn(),
}));

vi.mock("server-only", () => ({}));

import { seedTrack } from "@/app/(scaffold)/actions/_seed-track";

const db = {
  scaffoldTemplateVersion: { findFirst: h.versionFindFirst },
  meridianAssessment: { findFirst: h.assessmentFindFirst },
  scaffoldTemplateOverlay: { findFirst: h.overlayFindFirst },
  scaffoldOverlayConflict: { count: h.conflictCount },
  scaffoldSequence: { upsert: h.sequenceUpsert },
  scaffoldTrack: { create: h.trackCreate },
  scaffoldBusinessCase: { create: h.bcCreate, update: h.bcUpdate },
  scaffoldMembership: { findFirst: h.membershipFindFirst },
  scaffoldDeliverableTemplate: { findMany: h.delTplFindMany },
  scaffoldPhaseInstance: { findMany: h.phaseFindMany },
  scaffoldDeliverableInstance: { createMany: h.delCreateMany },
  tenantModule: { findFirst: h.moduleFindFirst },
} as never;

const ASSESSMENT = "clx00000000000000assess01";
const INPUT = {
  tenantId: "t1",
  authorId: "u1",
  processName: "Fundação de prontidão do Atlas",
  templateId: "clx00000000000000000tpl01",
  ownerId: "clx000000000000000000o001",
};

const versao = (archetype: string | null) => ({
  id: "ver1",
  label: "v1.0",
  steps: [],
  template: { archetype },
});

beforeEach(() => {
  vi.clearAllMocks();
  h.versionFindFirst.mockResolvedValue(versao(null));
  h.assessmentFindFirst.mockResolvedValue({
    id: ASSESSMENT,
    code: "AS-001",
    status: "FINALISED",
    scores: [],
  });
  h.conflictCount.mockResolvedValue(0);
  h.sequenceUpsert.mockResolvedValue({ next: 2 });
  h.trackCreate.mockResolvedValue({ id: "trk1", code: "TR-001" });
  h.bcCreate.mockResolvedValue({ id: "bc1", versions: [{ id: "bcv1" }] });
  h.bcUpdate.mockResolvedValue({});
  h.membershipFindFirst.mockResolvedValue({ userId: "x" });
  h.phaseFindMany.mockResolvedValue([]);
  h.delTplFindMany.mockResolvedValue([]);
  h.delCreateMany.mockResolvedValue({ count: 0 });
  h.moduleFindFirst.mockResolvedValue(null);
});

describe("trilha de prontidão (template sem forma de trabalho)", () => {
  it("sem assessment é recusada, e nada é criado nem consome número", async () => {
    await expect(seedTrack(db, INPUT)).rejects.toMatchObject({
      code: "ASSESSMENT_REQUIRED",
    });
    expect(h.trackCreate).not.toHaveBeenCalled();
    expect(h.sequenceUpsert).not.toHaveBeenCalled();
  });

  it("com assessment do próprio tenant, nasce ligada a ele", async () => {
    await seedTrack(db, { ...INPUT, sourceAssessmentId: ASSESSMENT });
    expect(h.trackCreate.mock.calls[0][0].data).toMatchObject({
      sourceAssessmentId: ASSESSMENT,
      archetype: null,
    });
  });

  it("assessment de outro tenant é recusado: a busca vai pelo tenant da sessão", async () => {
    h.assessmentFindFirst.mockResolvedValue(null);
    await expect(
      seedTrack(db, { ...INPUT, sourceAssessmentId: ASSESSMENT })
    ).rejects.toMatchObject({ code: "ASSESSMENT_NOT_FOUND" });
    expect(h.assessmentFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: ASSESSMENT, tenantId: "t1" }),
      })
    );
    expect(h.trackCreate).not.toHaveBeenCalled();
  });
});

describe("o assessment de origem precisa de coleta fechada (Vigia, #331)", () => {
  it.each([
    "DRAFT",
    "COLLECTING",
  ])("%s é recusado, em trilha de prontidão ou de forma de trabalho", async (status) => {
    for (const archetype of [null, "TRIAGE"]) {
      h.versionFindFirst.mockResolvedValue(versao(archetype));
      h.assessmentFindFirst.mockResolvedValue({
        id: ASSESSMENT,
        code: "AS-001",
        status,
        scores: [],
      });
      await expect(
        seedTrack(db, { ...INPUT, sourceAssessmentId: ASSESSMENT })
      ).rejects.toMatchObject({ code: "ASSESSMENT_NOT_READY" });
    }
    expect(h.trackCreate).not.toHaveBeenCalled();
  });

  it.each(["REVIEW", "FINALISED"])("%s é aceito", async (status) => {
    h.assessmentFindFirst.mockResolvedValue({
      id: ASSESSMENT,
      code: "AS-001",
      status,
      scores: [],
    });
    await seedTrack(db, { ...INPUT, sourceAssessmentId: ASSESSMENT });
    expect(h.trackCreate).toHaveBeenCalledTimes(1);
  });
});

describe("trilha por forma de trabalho", () => {
  beforeEach(() => {
    h.versionFindFirst.mockResolvedValue(versao("TRIAGE"));
  });

  it("sem assessment continua sendo criada", async () => {
    const r = await seedTrack(db, INPUT);
    expect(r.id).toBe("trk1");
    expect(h.assessmentFindFirst).not.toHaveBeenCalled();
    expect(h.trackCreate.mock.calls[0][0].data.sourceAssessmentId).toBeNull();
  });

  it("com assessment, liga e confere o tenant do mesmo jeito", async () => {
    await seedTrack(db, { ...INPUT, sourceAssessmentId: ASSESSMENT });
    expect(h.trackCreate.mock.calls[0][0].data.sourceAssessmentId).toBe(
      ASSESSMENT
    );
    h.assessmentFindFirst.mockResolvedValue(null);
    await expect(
      seedTrack(db, { ...INPUT, sourceAssessmentId: ASSESSMENT })
    ).rejects.toMatchObject({ code: "ASSESSMENT_NOT_FOUND" });
  });
});

// ── A2 condicional (D-24 §7.6, confirmado no §7.7) ────────────────────────────
//
// A ata do workshop só existe se algum eixo do diagnóstico tem confiança abaixo
// de 0,6. Com a leitura do assessment de origem, a trilha já nasce certa: sem eixo
// de confiança baixa, o A2.1 nasce DISPENSADO, com motivo que cita o AS-xxx. Na
// dúvida (sem leitura), nasce obrigatório — nunca dispensado por omissão. A
// dispensa manual por instância fica para o PR seguinte.

const tpl = (code: string) => ({
  phase: "ASSESS",
  stepCode: code.split(".")[0],
  code,
  seq: 1,
  title: `Título ${code}`,
  description: "d",
  kind: "DOCUMENT",
  producer: "CONSULTANT",
  required: true,
  requiresModule: null,
});

const scores = (...confidences: number[]) =>
  confidences.map((c) => ({ confidence: c }));
const TODOS_CONFIAVEIS = scores(0.72, 0.65, 0.6, 0.61, 0.8);
const ATLAS = scores(0.72, 0.65, 0.55, 0.61, 0.8);

const instancias = () =>
  h.delCreateMany.mock.calls[0]?.[0].data as {
    code: string;
    required: boolean;
    dispensedReason: string | null;
  }[];

describe("A2.1 conforme a confiança do assessment de origem", () => {
  beforeEach(() => {
    h.delTplFindMany.mockResolvedValue([tpl("A1.1"), tpl("A2.1")]);
    h.phaseFindMany.mockResolvedValue([{ id: "ph-a", phase: "ASSESS" }]);
  });

  it("nenhum eixo abaixo de 0,6 (0,60 inclusive): nasce dispensado, citando o AS-xxx", async () => {
    h.assessmentFindFirst.mockResolvedValue({
      id: ASSESSMENT,
      code: "AS-104",
      status: "FINALISED",
      scores: TODOS_CONFIAVEIS,
    });
    await seedTrack(db, { ...INPUT, sourceAssessmentId: ASSESSMENT });

    const a2 = instancias().find((d) => d.code === "A2.1");
    expect(a2?.required).toBe(false);
    expect(a2?.dispensedReason).toContain("AS-104");
    expect(a2?.dispensedReason).toMatch(/confiança abaixo de 0,6/);
    // Só o A2.1: o resto do molde nasce como sempre.
    const a1 = instancias().find((d) => d.code === "A1.1");
    expect(a1?.required).toBe(true);
    expect(a1?.dispensedReason).toBeNull();
  });

  it("algum eixo abaixo de 0,6 (o Atlas, Pessoas 0,55): nasce obrigatório", async () => {
    h.assessmentFindFirst.mockResolvedValue({
      id: ASSESSMENT,
      code: "AS-120",
      status: "FINALISED",
      scores: ATLAS,
    });
    await seedTrack(db, { ...INPUT, sourceAssessmentId: ASSESSMENT });
    const a2 = instancias().find((d) => d.code === "A2.1");
    expect(a2?.required).toBe(true);
    expect(a2?.dispensedReason).toBeNull();
  });

  it("sem leitura de confiança (assessment sem scores ou incompleto): obrigatório, nunca dispensado por omissão", async () => {
    for (const lidos of [[], scores(0.9, 0.9, 0.9, 0.9)]) {
      h.delCreateMany.mockClear();
      h.assessmentFindFirst.mockResolvedValue({
        id: ASSESSMENT,
        code: "AS-001",
        status: "FINALISED",
        scores: lidos,
      });
      await seedTrack(db, { ...INPUT, sourceAssessmentId: ASSESSMENT });
      const a2 = instancias().find((d) => d.code === "A2.1");
      expect(a2?.required).toBe(true);
      expect(a2?.dispensedReason).toBeNull();
    }
  });

  it("a regra é só da trilha de prontidão: o A2.1 de uma forma de trabalho (mapa da fonte) não é tocado", async () => {
    h.versionFindFirst.mockResolvedValue(versao("TRIAGE"));
    h.assessmentFindFirst.mockResolvedValue({
      id: ASSESSMENT,
      code: "AS-104",
      status: "FINALISED",
      scores: TODOS_CONFIAVEIS,
    });
    await seedTrack(db, { ...INPUT, sourceAssessmentId: ASSESSMENT });
    const a2 = instancias().find((d) => d.code === "A2.1");
    expect(a2?.required).toBe(true);
    expect(a2?.dispensedReason).toBeNull();
  });
});
