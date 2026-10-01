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
  h.assessmentFindFirst.mockResolvedValue({ id: ASSESSMENT });
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
