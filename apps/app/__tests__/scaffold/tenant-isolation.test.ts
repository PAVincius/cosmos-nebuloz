import { beforeEach, describe, expect, it, vi } from "vitest";

// SC-005 — um tenant não lê dado de outro por nenhum caminho de action.
//
// Este arquivo cresce a cada fatia. Hoje cobre trilhas (US1) e gates (US2);
// passos e artefatos entram com US3, casos de negócio com US4.
//
// O que se testa não é a RLS — ela é a segunda linha de defesa e vive no banco.
// O que se testa é que a action NUNCA aceita `tenantId` do payload e sempre o
// impõe no `where`. Um `findFirst({ where: { id } })` sem `tenantId` passa pela
// RLS em desenvolvimento (conexão dona da tabela, FORCE desligado — ADR-0012) e
// vaza em silêncio.

const h = vi.hoisted(() => ({
  requirePerm: vi.fn(),
  promotionFindFirst: vi.fn(),
  promotionUpdate: vi.fn(),
  versionFindFirst: vi.fn(),
  sequenceUpsert: vi.fn(),
  trackCreate: vi.fn(),
  bcCreate: vi.fn(),
  trackFindMany: vi.fn(),
  trackFindFirst: vi.fn(),
  trackUpdate: vi.fn(),
  auditCreate: vi.fn(),
  settingsFindUnique: vi.fn(),
  userFindMany: vi.fn(),
  gateResultGroupBy: vi.fn(),
  tenantsSeen: [] as string[],
  phaseFindFirst: vi.fn(),
  phaseUpdate: vi.fn(),
  phaseUpdateMany: vi.fn(),
  templateFindMany: vi.fn(),
  overlayUpsert: vi.fn(),
  conflictDeleteMany: vi.fn(),
  versionFindUnique: vi.fn(),
  trackGroupBy: vi.fn(),
  bcFindFirst: vi.fn(),
  criterionFindMany: vi.fn(),
  gateResultCreate: vi.fn(),
  overrideCreate: vi.fn(),
  moduleFindFirst: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/scaffold/guards", () => ({
  requireScaffoldPermissionContext: h.requirePerm,
  requireScaffoldContext: h.requirePerm,
}));
vi.mock("@repo/storage", () => ({
  SCAFFOLD_ARTEFACT_BUCKET: "scaffold-artefacts",
  storageClient: {
    storage: {
      from: () => ({
        download: async () => ({ data: null, error: null }),
        upload: async () => ({ data: { path: "x" }, error: null }),
        createSignedUrl: async () => ({
          data: { signedUrl: "https://blob.example/zip" },
          error: null,
        }),
      }),
    },
  },
}));
vi.mock("@repo/database", () => ({
  withTenantDb: (tenantId: string, fn: (db: unknown) => unknown) => {
    // Registra com qual tenant a conexão foi aberta: `withTenantDb` seta
    // `app.tenant_id` na sessão, e abrir com o tenant errado é o vazamento.
    h.tenantsSeen.push(tenantId);
    return fn({
      meridianGapPromotion: {
        findFirst: h.promotionFindFirst,
        update: h.promotionUpdate,
      },
      scaffoldTemplateVersion: {
        findFirst: h.versionFindFirst,
        findUnique: h.versionFindUnique,
      },
      scaffoldSequence: { upsert: h.sequenceUpsert },
      scaffoldTrack: {
        create: h.trackCreate,
        findMany: h.trackFindMany,
        findFirst: h.trackFindFirst,
        update: h.trackUpdate,
        groupBy: h.trackGroupBy,
      },
      scaffoldPhaseInstance: {
        findFirst: h.phaseFindFirst,
        update: h.phaseUpdate,
        updateMany: h.phaseUpdateMany,
      },
      scaffoldGateCriterion: { findMany: h.criterionFindMany },
      scaffoldTemplate: { findMany: h.templateFindMany },
      scaffoldBusinessCase: {
        findFirst: h.bcFindFirst,
        create: h.bcCreate,
        update: async () => ({}),
      },
      scaffoldTemplateOverlay: { upsert: h.overlayUpsert },
      scaffoldOverlayConflict: { deleteMany: h.conflictDeleteMany },
      scaffoldGateResult: {
        create: h.gateResultCreate,
        groupBy: h.gateResultGroupBy,
      },
      scaffoldGateOverride: { create: h.overrideCreate },
      tenantModule: { findFirst: h.moduleFindFirst },
      scaffoldSettings: { findUnique: h.settingsFindUnique },
      user: { findMany: h.userFindMany },
      auditLog: { create: h.auditCreate },
    });
  },
}));

import {
  exportBusinessCase,
  exportHandoverPack,
} from "@/app/(scaffold)/actions/export";
import {
  closePhase,
  evaluateGate,
  overridePhase,
} from "@/app/(scaffold)/actions/gates";
import { listTemplates, saveOverlay } from "@/app/(scaffold)/actions/templates";
import {
  cancelTrack,
  createTrackFromGap,
  getTrack,
  listTracks,
} from "@/app/(scaffold)/actions/tracks";

const CTX = {
  tenantId: "tenant-A",
  userId: "u1",
  role: "ADMIN",
  scaffoldRole: "CONSULTANT",
  user: { name: "Marina", email: "m@x.com" },
};

const TRACK_ID = "clx000000000000000000t001";
const PHASE_ID = "clx00000000000000000pi001";

/** Fase pronta para fechar, no tenant-A. Cada teste ajusta o que precisa. */
function basePhase(over: Record<string, unknown> = {}) {
  return {
    id: PHASE_ID,
    phase: "PILOT",
    state: "GATE_READY",
    reopenCount: 0,
    observationEndsAt: null,
    charterPolicyAckAt: null,
    trackId: TRACK_ID,
    steps: [
      { id: "s1", required: true, state: "DONE", statement: "Rodar piloto" },
    ],
    track: {
      id: TRACK_ID,
      code: "TR-001",
      processName: "Triagem",
      tenantId: "tenant-A",
      templateVersionId: "ver1",
      businessCase: null,
    },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.tenantsSeen.length = 0;
  h.requirePerm.mockResolvedValue(CTX);
  h.promotionFindFirst.mockResolvedValue({
    id: "clx000000000000000000p001",
    targetEntityId: null,
    targetProduct: "SCAFFOLD",
  });
  h.versionFindFirst.mockResolvedValue({
    id: "clx00000000000000000ver01",
    label: "v4",
    steps: [],
  });
  h.sequenceUpsert.mockResolvedValue({ next: 2 });
  h.trackCreate.mockResolvedValue({ id: "trk1", code: "TR-001" });
  h.bcCreate.mockResolvedValue({ id: "bc1", versions: [{ id: "bcv1" }] });
  h.trackFindMany.mockResolvedValue([]);
  h.trackFindFirst.mockResolvedValue({
    id: TRACK_ID,
    code: "TR-001",
    processName: "Triagem",
    status: "ACTIVE",
  });
  h.trackUpdate.mockResolvedValue({});
  h.promotionUpdate.mockResolvedValue({});
  h.auditCreate.mockResolvedValue({});
  h.settingsFindUnique.mockResolvedValue(null);
  h.userFindMany.mockResolvedValue([]);
  h.gateResultGroupBy.mockResolvedValue([]);
  h.phaseFindFirst.mockResolvedValue(basePhase());
  h.criterionFindMany.mockResolvedValue([
    {
      key: "beats-baseline",
      statement: "Piloto vence o baseline",
      phase: "PILOT",
      seq: 1,
      evaluationType: "MANUAL",
    },
  ]);
  h.phaseUpdate.mockResolvedValue({});
  h.phaseUpdateMany.mockResolvedValue({ count: 1 });
  h.gateResultCreate.mockResolvedValue({ id: "gr1" });
  h.overrideCreate.mockResolvedValue({ id: "ov1" });
  h.moduleFindFirst.mockResolvedValue(null);
  h.templateFindMany.mockResolvedValue([]);
  h.overlayUpsert.mockResolvedValue({ id: "ovl1" });
  h.conflictDeleteMany.mockResolvedValue({ count: 0 });
  h.versionFindUnique.mockResolvedValue({
    id: "clx000000000000000000v01",
    // Precisa bater com o templateId passado em saveOverlay: a action recusa
    // overlay cuja base pertence a outro template, e é o guard correto.
    templateId: "clx00000000000000000tpl1",
    label: "v3",
    steps: [],
    criteria: [],
  });
  h.trackGroupBy.mockResolvedValue([]);
  h.bcFindFirst.mockResolvedValue(null);
});

describe("isolamento de tenant nas actions de trilha", () => {
  it("abre a conexão sempre com o tenant da sessão", async () => {
    await listTracks({});
    await getTrack({ trackId: TRACK_ID });
    await cancelTrack({
      trackId: TRACK_ID,
      rationale: "Encerrado a pedido do cliente, sem piloto iniciado.",
    });
    expect(new Set(h.tenantsSeen)).toEqual(new Set(["tenant-A"]));
  });

  it("listTracks filtra por tenantId no where", async () => {
    await listTracks({});
    expect(h.trackFindMany.mock.calls[0][0].where.tenantId).toBe("tenant-A");
  });

  it("getTrack filtra por tenantId além do id — id sozinho é adivinhável", async () => {
    await getTrack({ trackId: TRACK_ID });
    expect(h.trackFindFirst.mock.calls[0][0].where).toMatchObject({
      id: TRACK_ID,
      tenantId: "tenant-A",
    });
  });

  it("cancelTrack filtra por tenantId antes de escrever", async () => {
    await cancelTrack({
      trackId: TRACK_ID,
      rationale: "Encerrado a pedido do cliente, sem piloto iniciado.",
    });
    expect(h.trackFindFirst.mock.calls[0][0].where.tenantId).toBe("tenant-A");
  });

  it("createTrackFromGap resolve a promoção dentro do tenant da sessão", async () => {
    await createTrackFromGap({
      gapId: "clx000000000000000000g001",
      promotionId: "clx000000000000000000p001",
      templateId: "clx00000000000000000tpl01",
      processName: "Triagem de autorizações prévias",
      ownerId: "clx000000000000000000o001",
    });
    expect(h.promotionFindFirst.mock.calls[0][0].where.tenantId).toBe(
      "tenant-A"
    );
    expect(h.trackCreate.mock.calls[0][0].data.tenantId).toBe("tenant-A");
    // O caso de negócio nasce no mesmo tenant da sessão.
    expect(h.bcCreate.mock.calls[0][0].data.tenantId).toBe("tenant-A");
    expect(h.bcCreate.mock.calls[0][0].data.versions.create.tenantId).toBe(
      "tenant-A"
    );
  });

  it("ignora tenantId vindo do payload — a sessão é a única fonte", async () => {
    await listTracks({
      // @ts-expect-error — o campo não existe no schema, e é isso que se afirma:
      // Zod remove o que não está declarado, então nem chega ao where.
      tenantId: "tenant-B",
    });
    expect(h.trackFindMany.mock.calls[0][0].where.tenantId).toBe("tenant-A");
    expect(h.tenantsSeen).not.toContain("tenant-B");
  });
});

describe("isolamento de tenant nas actions de gate — US2", () => {
  const MET = { "beats-baseline": { met: true } };
  const APPROVER = "clx000000000000000000a001";
  const RATIONALE =
    "Risco aceito por escrito pelo sponsor: janela regulatória impede o teste antes do trimestre.";

  it("a fase é resolvida pelo tenant da trilha, não pelo id sozinho", async () => {
    // `where: { id, track: { tenantId } }` — sem o segundo termo, o id de uma
    // fase de outro tenant seria aceito e o gate fecharia lá.
    await evaluateGate({ phaseInstanceId: PHASE_ID });
    expect(h.phaseFindFirst.mock.calls[0][0].where).toMatchObject({
      id: PHASE_ID,
      track: { tenantId: "tenant-A" },
    });
  });

  it("closePhase resolve a fase dentro do tenant da sessão", async () => {
    await closePhase({
      phaseInstanceId: PHASE_ID,
      approverId: APPROVER,
      criteriaFacts: MET,
    });
    expect(h.phaseFindFirst.mock.calls[0][0].where.track.tenantId).toBe(
      "tenant-A"
    );
  });

  it("o resultado do gate nasce carimbado com o tenant da sessão", async () => {
    await closePhase({
      phaseInstanceId: PHASE_ID,
      approverId: APPROVER,
      criteriaFacts: MET,
    });
    expect(h.gateResultCreate.mock.calls[0][0].data.tenantId).toBe("tenant-A");
  });

  it("o override nasce carimbado com o tenant e o ator da sessão", async () => {
    h.phaseFindFirst.mockResolvedValue(basePhase({ state: "BLOCKED" }));
    await overridePhase({
      phaseInstanceId: PHASE_ID,
      unmetCriteria: ["beats-baseline"],
      rationale: RATIONALE,
    });
    expect(h.overrideCreate.mock.calls[0][0].data).toMatchObject({
      tenantId: "tenant-A",
      actorId: "u1",
    });
  });

  it("o guard do Charter consulta o módulo do tenant da sessão", async () => {
    // SG-05 lê `TenantModule` — se lesse o de outro tenant, um cliente sem
    // Charter herdaria a trava de quem tem.
    h.phaseFindFirst.mockResolvedValue(basePhase({ phase: "SCALE" }));
    await closePhase({
      phaseInstanceId: PHASE_ID,
      approverId: APPROVER,
      criteriaFacts: MET,
    });
    expect(h.moduleFindFirst.mock.calls[0][0].where.tenantId).toBe("tenant-A");
  });

  it("abre a conexão sempre com o tenant da sessão", async () => {
    await evaluateGate({ phaseInstanceId: PHASE_ID });
    await closePhase({
      phaseInstanceId: PHASE_ID,
      approverId: APPROVER,
      criteriaFacts: MET,
    });
    expect(new Set(h.tenantsSeen)).toEqual(new Set(["tenant-A"]));
  });
});

describe("isolamento de tenant nos templates — US5", () => {
  it("overlay é filtrado pelo tenant da sessão; o template base é global", async () => {
    // O template é o método da Nebuloz e vale para todo cliente. O overlay é a
    // customização de UM cliente — vazá-lo entregaria a outro a decisão
    // comercial de quem o escreveu.
    await listTemplates();
    const include = h.templateFindMany.mock.calls[0][0].include;
    expect(include.overlays.where.tenantId).toBe("tenant-A");
    expect(h.templateFindMany.mock.calls[0][0].where).toBeUndefined();
  });

  it("a contagem de trilhas por versão é do tenant da sessão", async () => {
    await listTemplates();
    expect(h.trackGroupBy.mock.calls[0][0].where.tenantId).toBe("tenant-A");
  });

  it("o overlay nasce carimbado com o tenant da sessão", async () => {
    await saveOverlay({
      templateId: "clx00000000000000000tpl1",
      baseVersionId: "clx000000000000000000v01",
      name: "Overlay Vanta",
      ops: [],
    });
    const args = h.overlayUpsert.mock.calls[0][0];
    expect(args.create.tenantId).toBe("tenant-A");
    expect(args.where.tenantId_templateId_name.tenantId).toBe("tenant-A");
  });
});

describe("isolamento de tenant no export — US7/US8", () => {
  it("exportBusinessCase resolve o caso dentro do tenant da sessão", async () => {
    await exportBusinessCase({ businessCaseId: "clx00000000000000000bc01" });
    expect(h.bcFindFirst.mock.calls[0][0].where.tenantId).toBe("tenant-A");
  });

  it("exportHandoverPack resolve a trilha dentro do tenant da sessão", async () => {
    // O pacote sai do perímetro da plataforma. Resolver a trilha pelo id
    // sozinho deixaria alguém exportar o handover de outro cliente.
    await exportHandoverPack({ trackId: TRACK_ID });
    expect(h.trackFindFirst.mock.calls[0][0].where).toMatchObject({
      id: TRACK_ID,
      tenantId: "tenant-A",
    });
  });

  it("o handover é recusado antes de qualquer leitura de storage", async () => {
    // Trilha sem Fase 4 fechada não gera pacote — e a recusa vem antes de
    // baixar byte nenhum.
    h.trackFindFirst.mockResolvedValue({
      id: TRACK_ID,
      code: "TR-001",
      processName: "Triagem",
      status: "ACTIVE",
      tenant: { name: "Cliente A" },
      templateVersion: { label: "v3" },
      businessCase: null,
      phases: [],
      ownerId: "u2",
      consultantId: null,
      archetype: null,
      startedAt: new Date(),
      embeddedAt: null,
    });
    const res = await exportHandoverPack({ trackId: TRACK_ID });
    expect(res).toMatchObject({ ok: false, code: "HANDOVER_NOT_READY" });
  });
});
