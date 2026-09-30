import { beforeEach, describe, expect, it, vi } from "vitest";

// ST-02 na criação da trilha: o overlay do cliente vale na instância.
//
// Até aqui `seedTrack` guardava o `overlayId` e copiava a versão base como se o
// overlay não existisse — a customização era salva, detectava conflito e nunca
// chegava à trilha. D-24 §7.7 exige o contrário para o entregável: REMOVE não
// apaga, a instância nasce DISPENSADA, com o motivo, e deixa de travar o gate.

const h = vi.hoisted(() => ({
  versionFindFirst: vi.fn(),
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
  // biome-ignore lint/suspicious/noExplicitAny: mock do cliente do Prisma
} as any;

const OVERLAY = "clx0000000000000000ovl001";
const INPUT = {
  tenantId: "t1",
  authorId: "u1",
  processName: "Fundação de prontidão do Atlas",
  templateId: "clx00000000000000000tpl01",
  ownerId: "clx000000000000000000o001",
  overlayId: OVERLAY,
};

const STEPS = [
  {
    phase: "PILOT",
    seq: 1,
    key: "P1",
    statement: "Fundação mínima de Dados e Infra",
    expectedArtefact: "Catálogo",
    required: true,
  },
  {
    phase: "PILOT",
    seq: 2,
    key: "P2",
    statement: "AI Adopt: personas e papéis",
    expectedArtefact: "Trilhas",
    required: true,
  },
];

const tpl = (code: string, stepCode: string, required = true) => ({
  phase: "PILOT",
  stepCode,
  code,
  seq: 1,
  title: `Título ${code}`,
  description: "d",
  kind: "DOCUMENT",
  producer: "OWNER",
  required,
  requiresModule: null,
});

const created = () =>
  h.delCreateMany.mock.calls[0]?.[0].data as {
    code: string;
    title: string;
    required: boolean;
    dispensedReason: string | null;
  }[];

beforeEach(() => {
  vi.clearAllMocks();
  h.versionFindFirst.mockResolvedValue({
    id: "ver1",
    label: "v1.0",
    steps: STEPS,
    template: { archetype: null },
  });
  h.conflictCount.mockResolvedValue(0);
  h.sequenceUpsert.mockResolvedValue({ next: 2 });
  h.trackCreate.mockResolvedValue({ id: "trk1", code: "TR-001" });
  h.bcCreate.mockResolvedValue({ id: "bc1", versions: [{ id: "bcv1" }] });
  h.bcUpdate.mockResolvedValue({});
  h.membershipFindFirst.mockResolvedValue({ userId: "x" });
  h.phaseFindMany.mockResolvedValue([{ id: "ph-p", phase: "PILOT" }]);
  h.delTplFindMany.mockResolvedValue([
    tpl("P1.1", "P1"),
    tpl("P2.1", "P2"),
    tpl("P2.2", "P2", false),
  ]);
  h.delCreateMany.mockResolvedValue({ count: 3 });
  h.moduleFindFirst.mockResolvedValue(null);
  h.overlayFindFirst.mockResolvedValue({ ops: [] });
});

describe("seedTrack aplica o overlay", () => {
  it("REMOVE de entregável dispensa a instância com o motivo, e ela deixa de ser obrigatória", async () => {
    h.overlayFindFirst.mockResolvedValue({
      ops: [
        {
          op: "REMOVE",
          target: "deliverable",
          key: "P2.2",
          reason: "Os papéis de dado já existem no Atlas",
        },
      ],
    });
    await seedTrack(db, INPUT);

    const rows = created();
    expect(rows.map((r) => r.code)).toEqual(["P1.1", "P2.1", "P2.2"]);
    const dispensed = rows.find((r) => r.code === "P2.2");
    expect(dispensed?.required).toBe(false);
    expect(dispensed?.dispensedReason).toContain(
      "Os papéis de dado já existem no Atlas"
    );
    expect(rows.find((r) => r.code === "P1.1")?.dispensedReason).toBeNull();
  });

  it("REPLACE de título chega à instância", async () => {
    h.overlayFindFirst.mockResolvedValue({
      ops: [
        {
          op: "REPLACE",
          target: "deliverable",
          key: "P1.1",
          patch: { statement: "Catálogo de dados no DataHub" },
        },
      ],
    });
    await seedTrack(db, INPUT);
    expect(created().find((r) => r.code === "P1.1")?.title).toBe(
      "Catálogo de dados no DataHub"
    );
  });

  it("REPLACE de passo chega ao enunciado do passo da trilha", async () => {
    h.overlayFindFirst.mockResolvedValue({
      ops: [
        {
          op: "REPLACE",
          target: "step",
          key: "P1",
          patch: { statement: "Fundação mínima no Databricks do Atlas" },
        },
      ],
    });
    await seedTrack(db, INPUT);
    const steps = h.trackCreate.mock.calls[0][0].data.phases.create.find(
      (p: { phase: string }) => p.phase === "PILOT"
    ).steps.create;
    expect(steps[0]).toMatchObject({
      stepTemplateKey: "P1",
      statement: "Fundação mínima no Databricks do Atlas",
    });
    expect(steps[1].statement).toBe("AI Adopt: personas e papéis");
  });

  it("REMOVE de passo tira o passo da trilha", async () => {
    h.delTplFindMany.mockResolvedValue([tpl("P1.1", "P1")]);
    h.overlayFindFirst.mockResolvedValue({
      ops: [{ op: "REMOVE", target: "step", key: "P2" }],
    });
    await seedTrack(db, INPUT);
    const steps = h.trackCreate.mock.calls[0][0].data.phases.create.find(
      (p: { phase: string }) => p.phase === "PILOT"
    ).steps.create;
    expect(
      steps.map((s: { stepTemplateKey: string }) => s.stepTemplateKey)
    ).toEqual(["P1"]);
  });

  it("sem overlay, copia a versão como sempre e nem consulta a tabela", async () => {
    await seedTrack(db, { ...INPUT, overlayId: undefined });
    expect(h.overlayFindFirst).not.toHaveBeenCalled();
    expect(created().every((r) => r.dispensedReason === null)).toBe(true);
  });

  it("lê o overlay pelo tenant: id de outro tenant não é aplicado", async () => {
    h.overlayFindFirst.mockResolvedValue(null);
    await expect(seedTrack(db, INPUT)).rejects.toMatchObject({
      code: "OVERLAY_NOT_FOUND",
    });
    expect(h.overlayFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: OVERLAY, tenantId: "t1" }),
      })
    );
    expect(h.trackCreate).not.toHaveBeenCalled();
  });

  it("template sem forma de trabalho cria trilha com archetype nulo", async () => {
    await seedTrack(db, { ...INPUT, overlayId: undefined });
    expect(h.trackCreate.mock.calls[0][0].data.archetype).toBeNull();
  });
});
