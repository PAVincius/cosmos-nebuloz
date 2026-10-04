import { beforeEach, describe, expect, it, vi } from "vitest";

// SG-07 — resultado de gate e override são append-only.
//
// `gates-architecture.test.ts` prova estaticamente que ninguém CHAMA update ou
// delete nessas tabelas. Este prova o comportamento: reabrir e fechar de novo
// produz um SEGUNDO registro, com `cycle` novo, e o primeiro fica intacto.
//
// A distinção importa. Um teste estático passa numa base onde ninguém escreveu
// a chamada ainda; este falha se o ciclo não for incrementado, que é o jeito
// sutil de a segunda decisão sobrescrever a primeira sem nenhum `update`
// aparecer no código: com `@@unique([phaseInstanceId])`, o segundo `create`
// colidiria e alguém "consertaria" com upsert.

const h = vi.hoisted(() => ({
  requirePerm: vi.fn(),
  phaseFindFirst: vi.fn(),
  phaseUpdate: vi.fn(),
  criterionFindMany: vi.fn(),
  gateResultCreate: vi.fn(),
  overrideCreate: vi.fn(),
  trackUpdate: vi.fn(),
  moduleFindFirst: vi.fn(),
  auditCreate: vi.fn(),
  /** Tudo que foi gravado, na ordem — o "banco" deste teste. */
  results: [] as Record<string, unknown>[],
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
      scaffoldPhaseInstance: {
        findFirst: h.phaseFindFirst,
        update: h.phaseUpdate,
      },
      // O aprovador informado só vale se for do tenant com gate.close.
      scaffoldMembership: {
        findFirst: async () => ({ role: "PROCESS_OWNER" }),
      },
      scaffoldGateCriterion: { findMany: h.criterionFindMany },
      scaffoldGateResult: { create: h.gateResultCreate },
      scaffoldGateOverride: { create: h.overrideCreate },
      // Trilha legada, sem entregável: a regra de passos vale sozinha.
      scaffoldDeliverableInstance: { findMany: async () => [] },
      scaffoldTrack: { update: h.trackUpdate },
      tenantModule: { findFirst: h.moduleFindFirst },
      auditLog: { create: h.auditCreate },
    }),
}));

import { closePhase, reopenPhase } from "@/app/(scaffold)/actions/gates";

const CTX = {
  tenantId: "t1",
  userId: "u1",
  role: "ADMIN",
  scaffoldRole: "CONSULTANT",
  user: { name: "Marina", email: "m@x.com" },
};

const PI = "clx00000000000000000pi001";
const APPROVER = "clx000000000000000000a001";

const CRITERIA = [
  {
    key: "beats-baseline",
    statement: "Piloto vence o baseline",
    phase: "PILOT",
    seq: 1,
    evaluationType: "MANUAL",
  },
];
const MET = { "beats-baseline": { met: true } };

function phase(over: Record<string, unknown> = {}) {
  return {
    id: PI,
    phase: "PILOT",
    state: "GATE_READY",
    reopenCount: 0,
    observationEndsAt: null,
    charterPolicyAckAt: null,
    trackId: "trk1",
    steps: [
      { id: "s1", required: true, state: "DONE", statement: "Rodar piloto" },
    ],
    track: {
      id: "trk1",
      code: "TR-104",
      processName: "Triagem",
      tenantId: "t1",
      templateVersionId: "ver1",
      businessCase: null,
    },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.results.length = 0;
  h.requirePerm.mockResolvedValue(CTX);
  h.criterionFindMany.mockResolvedValue(CRITERIA);
  h.gateResultCreate.mockImplementation(
    (args: { data: Record<string, unknown> }) => {
      h.results.push(args.data);
      return Promise.resolve({ id: `gr${h.results.length}` });
    }
  );
  h.phaseUpdate.mockResolvedValue({});
  h.trackUpdate.mockResolvedValue({});
  h.overrideCreate.mockResolvedValue({ id: "ov1" });
  h.auditCreate.mockResolvedValue({});
  h.moduleFindFirst.mockResolvedValue(null);
  h.phaseFindFirst.mockResolvedValue(phase());
});

describe("SG-07 — append-only na prática", () => {
  it("o primeiro fechamento grava cycle 0", async () => {
    await closePhase({
      phaseInstanceId: PI,
      approverId: APPROVER,
      criteriaFacts: MET,
    });
    expect(h.results).toHaveLength(1);
    expect(h.results[0]).toMatchObject({ cycle: 0, outcome: "PASSED" });
  });

  it("reabrir incrementa o ciclo sem tocar no resultado anterior", async () => {
    h.phaseFindFirst.mockResolvedValue(phase({ state: "CLOSED" }));
    await reopenPhase({
      phaseInstanceId: PI,
      rationale:
        "Cliente pediu reavaliação do piloto: o volume medido não representou o pico sazonal.",
    });
    // A escrita de reabertura mexe na FASE, não no resultado.
    expect(h.phaseUpdate.mock.calls[0][0].data.reopenCount).toEqual({
      increment: 1,
    });
    expect(h.results).toHaveLength(0);
  });

  it("fechar depois de reabrir grava um SEGUNDO resultado, não sobrescreve o primeiro", async () => {
    await closePhase({
      phaseInstanceId: PI,
      approverId: APPROVER,
      criteriaFacts: MET,
    });

    // Segundo ciclo: a fase voltou para GATE_READY com reopenCount 1.
    h.phaseFindFirst.mockResolvedValue(phase({ reopenCount: 1 }));
    await closePhase({
      phaseInstanceId: PI,
      approverId: APPROVER,
      criteriaFacts: MET,
    });

    expect(h.results).toHaveLength(2);
    expect(h.results[0]).toMatchObject({ cycle: 0 });
    expect(h.results[1]).toMatchObject({ cycle: 1 });
    // Mesma fase, dois registros: a unicidade é [phaseInstanceId, cycle].
    expect(h.results[0]?.phaseInstanceId).toBe(h.results[1]?.phaseInstanceId);
  });

  it("a história de um gate reaberto três vezes são três linhas", async () => {
    for (let cycle = 0; cycle < 3; cycle++) {
      h.phaseFindFirst.mockResolvedValue(phase({ reopenCount: cycle }));
      await closePhase({
        phaseInstanceId: PI,
        approverId: APPROVER,
        criteriaFacts: MET,
      });
    }
    expect(h.results.map((r) => r.cycle)).toEqual([0, 1, 2]);
  });

  it("reabrir limpa closedAt e a janela de observação, mas não o histórico", async () => {
    h.phaseFindFirst.mockResolvedValue(
      phase({ state: "OBSERVING", observationEndsAt: new Date() })
    );
    await reopenPhase({
      phaseInstanceId: PI,
      rationale:
        "Processo voltou ao caminho antigo na segunda semana de observação; a posse não transferiu.",
    });
    const data = h.phaseUpdate.mock.calls[0][0].data;
    expect(data).toMatchObject({
      state: "OPEN",
      closedAt: null,
      observationEndsAt: null,
    });
  });

  it("não reabre fase que nunca fechou", async () => {
    h.phaseFindFirst.mockResolvedValue(phase({ state: "OPEN" }));
    const res = await reopenPhase({
      phaseInstanceId: PI,
      rationale:
        "Tentativa de reabrir fase que ainda está em andamento — deve falhar.",
    });
    expect(res.ok).toBe(false);
    expect(h.phaseUpdate).not.toHaveBeenCalled();
  });

  it("reabrir exige justificativa com substância", async () => {
    h.phaseFindFirst.mockResolvedValue(phase({ state: "CLOSED" }));
    const res = await reopenPhase({ phaseInstanceId: PI, rationale: "erro" });
    expect(res.ok).toBe(false);
    expect(h.phaseUpdate).not.toHaveBeenCalled();
  });
});
