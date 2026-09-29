import { beforeEach, describe, expect, it, vi } from "vitest";

// S-01 — a ligação Meridian → trilha.
//
// Três invariantes desta fatia:
//   1. A trilha nasce com as QUATRO fases e os passos copiados da versão
//      pinada do template — não sob demanda, não por join.
//   2. `MeridianGapPromotion.targetEntityId` deixa de ser nulo. Era esse o
//      buraco: o Meridian já sabia promover para o Scaffold, e a promoção não
//      aterrissava em lugar nenhum.
//   3. A mesma lacuna não aterrissa duas vezes.

const h = vi.hoisted(() => ({
  requirePerm: vi.fn(),
  promotionFindFirst: vi.fn(),
  promotionUpdate: vi.fn(),
  versionFindFirst: vi.fn(),
  sequenceUpsert: vi.fn(),
  trackCreate: vi.fn(),
  bcCreate: vi.fn(),
  delTplFindMany: vi.fn(),
  phaseFindMany: vi.fn(),
  delCreateMany: vi.fn(),
  moduleFindFirst: vi.fn(),
  bcUpdate: vi.fn(),
  trackFindMany: vi.fn(),
  trackFindFirst: vi.fn(),
  trackUpdate: vi.fn(),
  auditCreate: vi.fn(),
  settingsFindUnique: vi.fn(),
  userFindMany: vi.fn(),
  gateResultGroupBy: vi.fn(),
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
      meridianGapPromotion: {
        findFirst: h.promotionFindFirst,
        findMany: vi.fn().mockResolvedValue([]),
        update: h.promotionUpdate,
      },
      scaffoldTemplateVersion: { findFirst: h.versionFindFirst },
      scaffoldSequence: { upsert: h.sequenceUpsert },
      scaffoldTrack: {
        create: h.trackCreate,
        findMany: h.trackFindMany,
        findFirst: h.trackFindFirst,
        update: h.trackUpdate,
      },
      scaffoldDeliverableTemplate: { findMany: h.delTplFindMany },
      scaffoldPhaseInstance: { findMany: h.phaseFindMany },
      scaffoldDeliverableInstance: { createMany: h.delCreateMany },
      tenantModule: { findFirst: h.moduleFindFirst },
      scaffoldBusinessCase: { create: h.bcCreate, update: h.bcUpdate },
      scaffoldGateResult: { groupBy: h.gateResultGroupBy },
      scaffoldSettings: { findUnique: h.settingsFindUnique },
      scaffoldMembership: { findMany: vi.fn().mockResolvedValue([]) },
      user: { findMany: h.userFindMany },
      auditLog: { create: h.auditCreate },
    }),
}));

import {
  cancelTrack,
  createTrack,
  createTrackFromGap,
  listTracks,
} from "@/app/(scaffold)/actions/tracks";

const CTX = {
  tenantId: "t1",
  userId: "u1",
  role: "ADMIN",
  scaffoldRole: "CONSULTANT",
  user: { name: "Marina", email: "m@x.com" },
};

const GAP = "clx000000000000000000g001";
const PROMO = "clx000000000000000000p001";
const TPL = "clx00000000000000000tpl01";
const OWNER = "clx000000000000000000o001";
const VER = "clx00000000000000000ver01";

/** Duas fases bastam para provar a cópia e o particionamento por fase; as
 *  quatro entram no teste de estrutura abaixo. */
const STEPS = [
  {
    phase: "ASSESS",
    seq: 1,
    key: "map-actors",
    statement: "Mapear quem toca o processo hoje",
    expectedArtefact: "Mapa de atores",
    required: true,
  },
  {
    phase: "ASSESS",
    seq: 2,
    key: "measure-baseline",
    statement: "Medir volume, cycle time e taxa de erro",
    expectedArtefact: "Planilha de baseline",
    required: true,
  },
  {
    phase: "PILOT",
    seq: 1,
    key: "rollback-plan",
    statement: "Configurar e documentar o caminho de rollback",
    expectedArtefact: "rollback-plan.md",
    required: true,
  },
];

const INPUT = {
  gapId: GAP,
  promotionId: PROMO,
  templateId: TPL,
  processName: "Triagem de autorizações prévias",
  ownerId: OWNER,
};

beforeEach(() => {
  vi.clearAllMocks();
  h.requirePerm.mockResolvedValue(CTX);
  h.promotionFindFirst.mockResolvedValue({
    id: PROMO,
    targetEntityId: null,
    targetProduct: "SCAFFOLD",
  });
  h.promotionUpdate.mockResolvedValue({});
  h.versionFindFirst.mockResolvedValue({ id: VER, label: "v4", steps: STEPS });
  h.sequenceUpsert.mockResolvedValue({ next: 105 });
  h.trackCreate.mockResolvedValue({ id: "trk1", code: "TR-104" });
  h.bcCreate.mockResolvedValue({ id: "bc1", versions: [{ id: "bcv1" }] });
  h.bcUpdate.mockResolvedValue({});
  h.delTplFindMany.mockResolvedValue([]);
  h.phaseFindMany.mockResolvedValue([
    { id: "ph-a", phase: "ASSESS" },
    { id: "ph-p", phase: "PILOT" },
    { id: "ph-s", phase: "SCALE" },
    { id: "ph-e", phase: "EMBED" },
  ]);
  h.delCreateMany.mockResolvedValue({ count: 0 });
  h.moduleFindFirst.mockResolvedValue(null);
  h.auditCreate.mockResolvedValue({});
  h.settingsFindUnique.mockResolvedValue(null);
  h.userFindMany.mockResolvedValue([]);
  h.gateResultGroupBy.mockResolvedValue([]);
});

describe("createTrackFromGap", () => {
  it("cria a trilha e devolve o código legível do tenant", async () => {
    const res = await createTrackFromGap(INPUT);
    expect(res.ok).toBe(true);
    expect(res).toMatchObject({ data: { trackId: "trk1", code: "TR-104" } });
  });

  it("instancia as quatro fases, com ASSESS aberta e as demais IDLE", async () => {
    await createTrackFromGap(INPUT);
    const phases = h.trackCreate.mock.calls[0][0].data.phases.create;
    expect(phases.map((p: { phase: string }) => p.phase)).toEqual([
      "ASSESS",
      "PILOT",
      "SCALE",
      "EMBED",
    ]);
    expect(phases[0]).toMatchObject({ phase: "ASSESS", state: "OPEN" });
    expect(phases[0].openedAt).toBeInstanceOf(Date);
    for (const p of phases.slice(1)) {
      expect(p).toMatchObject({ state: "IDLE", openedAt: null });
    }
  });

  it("copia enunciado e artefato do template, particionados por fase", async () => {
    await createTrackFromGap(INPUT);
    const phases = h.trackCreate.mock.calls[0][0].data.phases.create;
    const assess = phases[0].steps.create;
    const pilot = phases[1].steps.create;

    expect(assess).toHaveLength(2);
    expect(pilot).toHaveLength(1);
    expect(assess[0]).toMatchObject({
      stepTemplateKey: "map-actors",
      statement: "Mapear quem toca o processo hoje",
      expectedArtefact: "Mapa de atores",
    });
    // SCALE e EMBED não têm passo neste template de teste — e nascem vazias em
    // vez de herdarem os da fase anterior.
    expect(phases[2].steps.create).toHaveLength(0);
  });

  it("pina a versão do template na trilha", async () => {
    await createTrackFromGap(INPUT);
    expect(h.trackCreate.mock.calls[0][0].data.templateVersionId).toBe(VER);
  });

  it("preenche targetEntityId da promoção — é a ligação que faltava", async () => {
    await createTrackFromGap(INPUT);
    expect(h.promotionUpdate).toHaveBeenCalledWith({
      where: { id: PROMO },
      data: { targetEntityId: "trk1" },
    });
  });

  it("grava auditoria da criação", async () => {
    await createTrackFromGap(INPUT);
    expect(h.auditCreate).toHaveBeenCalledTimes(1);
    expect(h.auditCreate.mock.calls[0][0].data).toMatchObject({
      action: "scaffold.track.create-from-gap",
      entityType: "scaffold.track",
      entityId: "trk1",
    });
  });

  it("recusa quando a promoção já aterrissou numa trilha", async () => {
    h.promotionFindFirst.mockResolvedValue({
      id: PROMO,
      targetEntityId: "trk-existente",
      targetProduct: "SCAFFOLD",
    });
    const res = await createTrackFromGap(INPUT);
    expect(res.ok).toBe(false);
    expect(h.trackCreate).not.toHaveBeenCalled();
  });

  it("recusa quando a promoção não existe ou foi revogada", async () => {
    h.promotionFindFirst.mockResolvedValue(null);
    const res = await createTrackFromGap(INPUT);
    expect(res.ok).toBe(false);
    expect(h.trackCreate).not.toHaveBeenCalled();
  });

  it("recusa template sem versão publicada, sem criar trilha vazia", async () => {
    h.versionFindFirst.mockResolvedValue(null);
    const res = await createTrackFromGap(INPUT);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toMatch(/versão publicada/i);
    }
    expect(h.trackCreate).not.toHaveBeenCalled();
    expect(h.promotionUpdate).not.toHaveBeenCalled();
  });

  it("consome o código dentro da mesma escrita — número não vaza em falha", async () => {
    h.versionFindFirst.mockResolvedValue(null);
    await createTrackFromGap(INPUT);
    // A sequência só é tocada depois da versão resolver. Sem isso, cada
    // tentativa contra um template sem versão queimaria um número de trilha.
    expect(h.sequenceUpsert).not.toHaveBeenCalled();
  });
});

// SB-01 — o caso de negócio nasce com a trilha, no fluxo do Scaffold.
//
// Antes, nenhuma action criava `ScaffoldBusinessCase`: `saveDraft`, o envio e a
// assinatura exigem um caso com versão em rascunho, então toda trilha parava na
// Fase 1 (SG-04) sem saída pela tela.
describe("caso de negócio nasce com a trilha (SB-01)", () => {
  it.each([
    ["createTrackFromGap", () => createTrackFromGap(INPUT)],
    [
      "createTrack",
      () =>
        createTrack({
          templateId: TPL,
          processName: "Triagem de autorizações prévias",
          ownerId: OWNER,
        }),
    ],
  ])("%s cria o caso vinculado à trilha nova", async (_n, run) => {
    const res = await run();
    expect(res.ok).toBe(true);

    expect(h.bcCreate).toHaveBeenCalledTimes(1);
    const data = h.bcCreate.mock.calls[0][0].data;
    expect(data).toMatchObject({
      tenantId: "t1",
      trackId: "trk1",
      code: "BC-104",
      state: "DRAFT",
      // Quem assina é o dono do processo (matriz: businesscase.sign); quem abre
      // o rascunho é quem criou a trilha.
      sponsorId: OWNER,
      authorId: "u1",
    });
    expect(data.versions.create).toMatchObject({
      tenantId: "t1",
      label: "v1",
      state: "DRAFT",
      authoredById: "u1",
    });
  });

  it("aponta currentVersionId para a v1, e deixa signedVersionId vazio", async () => {
    await createTrackFromGap(INPUT);
    expect(h.bcUpdate).toHaveBeenCalledWith({
      where: { id: "bc1" },
      data: { currentVersionId: "bcv1" },
    });
    // `signedVersionId` só muda em `signBusinessCase` (SG-04).
    expect(h.bcCreate.mock.calls[0][0].data.signedVersionId).toBeUndefined();
    expect(h.bcUpdate.mock.calls[0][0].data.signedVersionId).toBeUndefined();
  });

  it("consome a sequência 'businesscase' do tenant, separada da de trilha", async () => {
    await createTrackFromGap(INPUT);
    const kinds = h.sequenceUpsert.mock.calls.map(
      (c) => c[0].where.tenantId_kind.kind
    );
    expect(kinds).toEqual(["track", "businesscase"]);
  });

  it("não cria caso quando a trilha é recusada", async () => {
    h.versionFindFirst.mockResolvedValue(null);
    await createTrackFromGap(INPUT);
    expect(h.bcCreate).not.toHaveBeenCalled();
  });

  it("registra o caso na auditoria da criação da trilha", async () => {
    await createTrack({
      templateId: TPL,
      processName: "Triagem de autorizações prévias",
      ownerId: OWNER,
    });
    expect(h.auditCreate).toHaveBeenCalledTimes(1);
    expect(h.auditCreate.mock.calls[0][0].data.metadata.note).toContain(
      "BC-104"
    );
  });
});

// SC-DEV-02 — os entregáveis nascem com a trilha, copiados do template pinado.
describe("entregáveis nascem com a trilha (SC-DEV-02)", () => {
  const TPLS = [
    {
      phase: "ASSESS",
      stepCode: "A1",
      code: "A1.1",
      seq: 1,
      title: "Mapa do processo atual e volume",
      description: "Quem toca o processo e quanto volume passa.",
      kind: "SPREADSHEET",
      producer: "OWNER",
      required: true,
      requiresModule: null,
    },
    {
      phase: "SCALE",
      stepCode: "C1",
      code: "C1.1",
      seq: 1,
      title: "Política do Charter vinculada ao fluxo",
      description: "Aceite da política aplicável.",
      kind: "SIGNATURE",
      producer: "LEGAL",
      required: true,
      requiresModule: "CHARTER",
    },
  ];

  it("copia texto, tipo e produtor do template na fase certa", async () => {
    h.delTplFindMany.mockResolvedValue([TPLS[0]]);
    await createTrackFromGap(INPUT);
    const data = h.delCreateMany.mock.calls[0]?.[0].data;
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({
      tenantId: "t1",
      trackId: "trk1",
      phaseInstanceId: "ph-a",
      stepCode: "A1",
      code: "A1.1",
      templateKey: "A1.1",
      title: "Mapa do processo atual e volume",
      description: "Quem toca o processo e quanto volume passa.",
      kind: "SPREADSHEET",
      producer: "OWNER",
      required: true,
      isExtra: false,
      status: "NOT_STARTED",
      dispensedReason: null,
    });
    // Só do tenant e da versão pinada.
    expect(h.delTplFindMany.mock.calls[0]?.[0].where).toEqual({
      versionId: VER,
    });
  });

  it("sem entregável no template, não grava nada (versões antigas)", async () => {
    await createTrackFromGap(INPUT);
    expect(h.delCreateMany).not.toHaveBeenCalled();
  });

  it("entregável de módulo não contratado nasce dispensado, com o motivo", async () => {
    h.delTplFindMany.mockResolvedValue(TPLS);
    h.moduleFindFirst.mockResolvedValue(null);
    await createTrackFromGap(INPUT);
    const c11 = h.delCreateMany.mock.calls[0]?.[0].data.find(
      (d: { code: string }) => d.code === "C1.1"
    );
    expect(c11).toMatchObject({ required: false });
    expect(c11.dispensedReason).toContain("Charter");
  });

  it("com o módulo contratado, segue obrigatório", async () => {
    h.delTplFindMany.mockResolvedValue(TPLS);
    h.moduleFindFirst.mockResolvedValue({ module: "CHARTER" });
    await createTrackFromGap(INPUT);
    const c11 = h.delCreateMany.mock.calls[0]?.[0].data.find(
      (d: { code: string }) => d.code === "C1.1"
    );
    expect(c11).toMatchObject({ required: true, dispensedReason: null });
    expect(h.moduleFindFirst.mock.calls[0]?.[0].where).toMatchObject({
      tenantId: "t1",
      module: "CHARTER",
    });
  });
});

describe("listTracks", () => {
  it("deriva stalledDays do último gate, não de coluna", async () => {
    const ONZE_DIAS = new Date(Date.now() - 11 * 86_400_000);
    h.trackFindMany.mockResolvedValue([
      {
        id: "trk1",
        code: "TR-104",
        processName: "Triagem",
        archetype: "TRIAGE",
        currentPhase: "PILOT",
        status: "ACTIVE",
        ownerId: OWNER,
        consultantId: null,
        sourceGapId: GAP,
        startedAt: new Date(Date.now() - 60 * 86_400_000),
        lastGateAt: ONZE_DIAS,
        templateVersion: { label: "v4" },
        phases: [{ phase: "PILOT", state: "GATE_READY" }],
      },
    ]);
    const res = await listTracks({});
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.tracks[0]?.stalledDays).toBe(11);
      expect(res.data.tracks[0]?.phaseState).toBe("GATE_READY");
    }
  });

  it("conta a estagnação a partir do início quando nunca houve gate", async () => {
    h.trackFindMany.mockResolvedValue([
      {
        id: "trk2",
        code: "TR-105",
        processName: "Resumo de prontuário",
        archetype: "DOC_REVIEW",
        currentPhase: "ASSESS",
        status: "ACTIVE",
        ownerId: OWNER,
        consultantId: null,
        sourceGapId: null,
        startedAt: new Date(Date.now() - 18 * 86_400_000),
        lastGateAt: null,
        templateVersion: { label: "v2" },
        phases: [{ phase: "ASSESS", state: "BLOCKED" }],
      },
    ]);
    const res = await listTracks({});
    if (res.ok) {
      expect(res.data.tracks[0]?.stalledDays).toBe(18);
    }
  });

  it("filtra sempre por tenantId da sessão", async () => {
    h.trackFindMany.mockResolvedValue([]);
    await listTracks({ status: "ACTIVE" });
    expect(h.trackFindMany.mock.calls[0][0].where).toMatchObject({
      tenantId: "t1",
      status: "ACTIVE",
    });
  });
});

describe("cancelTrack", () => {
  it("marca CANCELLED sem apagar, e registra a justificativa", async () => {
    h.trackFindFirst.mockResolvedValue({
      id: "trk1",
      code: "TR-104",
      processName: "Triagem",
      status: "ACTIVE",
      businessCase: null,
    });
    h.trackUpdate.mockResolvedValue({});
    const res = await cancelTrack({
      trackId: "clx000000000000000000t001",
      rationale: "Cliente encerrou o contrato antes do piloto começar.",
    });
    expect(res.ok).toBe(true);
    expect(h.trackUpdate.mock.calls[0][0].data).toMatchObject({
      status: "CANCELLED",
    });
    expect(h.auditCreate.mock.calls[0][0].data.metadata.note).toMatch(
      /encerrou o contrato/
    );
  });

  it("recusa cancelar trilha com promessa assinada sem decisão sobre o Signal", async () => {
    // O artefato continua existindo e o Signal continua apurando contra ele.
    // Cancelar sem dizer o que fazer com essa apuração deixaria uma promessa
    // viva sem ninguém para cumpri-la.
    h.trackFindFirst.mockResolvedValue({
      id: "trk1",
      code: "TR-104",
      processName: "Triagem",
      status: "ACTIVE",
      businessCase: { code: "BC-104", signedVersionId: "bcv1" },
    });
    const res = await cancelTrack({
      trackId: "clx000000000000000000t001",
      rationale: "Cliente encerrou o contrato antes do piloto começar.",
    });
    expect(res).toMatchObject({
      ok: false,
      code: "TRACK_HAS_SIGNED_BUSINESS_CASE",
    });
    expect(h.trackUpdate).not.toHaveBeenCalled();
  });

  it("aceita o cancelamento com a decisão explícita, e a registra", async () => {
    h.trackFindFirst.mockResolvedValue({
      id: "trk1",
      code: "TR-104",
      processName: "Triagem",
      status: "ACTIVE",
      businessCase: { code: "BC-104", signedVersionId: "bcv1" },
    });
    h.trackUpdate.mockResolvedValue({});
    const res = await cancelTrack({
      trackId: "clx000000000000000000t001",
      rationale: "Cliente encerrou o contrato antes do piloto começar.",
      signalDecision: "stop_reading",
    });
    expect(res.ok).toBe(true);
    expect(h.auditCreate.mock.calls[0][0].data.metadata.note).toMatch(
      /para de apurar BC-104/
    );
  });

  it("trilha sem caso de negócio cancela sem exigir decisão", async () => {
    h.trackFindFirst.mockResolvedValue({
      id: "trk1",
      code: "TR-104",
      processName: "Triagem",
      status: "ACTIVE",
      businessCase: null,
    });
    h.trackUpdate.mockResolvedValue({});
    const res = await cancelTrack({
      trackId: "clx000000000000000000t001",
      rationale:
        "Processo descontinuado pelo cliente antes de qualquer medição.",
    });
    expect(res.ok).toBe(true);
  });

  it("exige justificativa com substância — 'ok' não é decisão registrada", async () => {
    const res = await cancelTrack({
      trackId: "clx000000000000000000t001",
      rationale: "ok",
    });
    expect(res.ok).toBe(false);
    expect(h.trackUpdate).not.toHaveBeenCalled();
  });
});
