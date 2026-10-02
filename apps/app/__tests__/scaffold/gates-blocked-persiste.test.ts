import { beforeEach, describe, expect, it, vi } from "vitest";

// O BLOCKED do SG-02 tem de PERSISTIR (Crivo, QA do PR 1, P1 pré-existente do #286).
//
// `closePhase` gravava a fase como BLOCKED e em seguida lançava CRITERIA_UNMET
// DENTRO do mesmo `withTenantDb`. Como `withTenantDb` é uma transação interativa,
// o throw desfazia o update: o BLOCKED nunca ia ao banco, a tela do gate (que só
// oferece override em BLOCKED) e o `overridePhase` (que só age em BLOCKED) ficavam
// sem caminho.
//
// Os testes de `gates-negative` não pegavam isto porque o mock de `withTenantDb`
// só chama a função: "o update foi chamado" passa mesmo com a transação desfeita.
// Aqui o `withTenantDb` TEM a semântica da transação — escritas só valem se a
// função resolve; se rejeita, são descartadas — e a asserção é sobre o que foi
// COMMITADO.

const store = vi.hoisted(() => ({
  /** Estado da fase como o banco o guarda (o que sobreviveu a commit). */
  committedState: "GATE_READY",
  /** Escritas da transação em curso, descartadas se ela rejeitar. */
  pendingState: null as string | null,
  audits: [] as Record<string, unknown>[],
  pendingAudits: [] as Record<string, unknown>[],
}));

const h = vi.hoisted(() => ({
  requirePerm: vi.fn(),
  phaseFindFirst: vi.fn(),
  criterionFindMany: vi.fn(),
  gateResultCreate: vi.fn(),
  overrideCreate: vi.fn(),
  trackUpdate: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/scaffold/guards", () => ({
  requireScaffoldPermissionContext: h.requirePerm,
  requireScaffoldContext: h.requirePerm,
}));
vi.mock("@repo/database", () => ({
  // Transação de verdade: commit só se `fn` resolve.
  withTenantDb: async <T>(_t: string, fn: (db: unknown) => Promise<T>) => {
    store.pendingState = null;
    store.pendingAudits = [];
    const db = {
      scaffoldPhaseInstance: {
        findFirst: h.phaseFindFirst,
        update: async ({ data }: { data: { state?: string } }) => {
          if (data.state) {
            store.pendingState = data.state;
          }
          return {};
        },
        updateMany: async ({ data }: { data: { state?: string } }) => {
          if (data.state) {
            store.pendingState = data.state;
          }
          return { count: 1 };
        },
      },
      scaffoldGateCriterion: { findMany: h.criterionFindMany },
      scaffoldGateResult: {
        create: h.gateResultCreate,
        findFirst: vi.fn().mockResolvedValue(null),
      },
      scaffoldGateOverride: { create: h.overrideCreate },
      scaffoldDeliverableInstance: { findMany: async () => [] },
      scaffoldTrack: { update: h.trackUpdate },
      tenantModule: { findFirst: async () => null },
      processRegistry: { findFirst: async () => null },
      auditLog: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          store.pendingAudits.push(data);
          return {};
        },
      },
    };
    const result = await fn(db); // se lançar, nada abaixo roda: rollback
    if (store.pendingState) {
      store.committedState = store.pendingState;
    }
    store.audits.push(...store.pendingAudits);
    return result;
  },
}));

import { closePhase, overridePhase } from "@/app/(scaffold)/actions/gates";

const PI = "clx00000000000000000pi001";
const APPROVER = "clx000000000000000000a001";
const CTX = {
  tenantId: "t1",
  userId: "u1",
  role: "ADMIN",
  scaffoldRole: "CONSULTANT",
  user: { name: "Marina", email: "m@x.com" },
};
const CRITERIA = [
  {
    key: "beats-baseline",
    statement: "Piloto vence",
    phase: "PILOT",
    seq: 1,
    evaluationType: "MANUAL",
  },
  {
    key: "no-new-risk",
    statement: "Nenhum risco novo",
    phase: "PILOT",
    seq: 2,
    evaluationType: "MANUAL",
  },
];

/** A fase como o banco a devolve AGORA: o estado é o commitado. */
const fase = () => ({
  id: PI,
  phase: "PILOT",
  state: store.committedState,
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
});

beforeEach(() => {
  vi.clearAllMocks();
  store.committedState = "GATE_READY";
  store.audits = [];
  h.requirePerm.mockResolvedValue(CTX);
  h.phaseFindFirst.mockImplementation(async () => fase());
  h.criterionFindMany.mockResolvedValue(CRITERIA);
  h.gateResultCreate.mockResolvedValue({ id: "gr1" });
  h.overrideCreate.mockResolvedValue({ id: "ov1" });
  h.trackUpdate.mockResolvedValue({});
});

const FALHA = {
  "beats-baseline": { met: true },
  "no-new-risk": { met: false },
};

describe("closePhase com critério não atendido", () => {
  it("devolve a recusa E o BLOCKED fica gravado (commit antes do erro)", async () => {
    const res = await closePhase({
      phaseInstanceId: PI,
      approverId: APPROVER,
      criteriaFacts: FALHA,
    });
    expect(res).toMatchObject({
      ok: false,
      code: "CRITERIA_UNMET",
      blockers: ["no-new-risk"],
    });
    // O que o banco guarda depois da chamada:
    expect(store.committedState).toBe("BLOCKED");
    // Nenhum resultado de gate: gate que não passa não é resultado.
    expect(h.gateResultCreate).not.toHaveBeenCalled();
  });

  it("a recusa deixa rastro de auditoria, também commitado", async () => {
    await closePhase({
      phaseInstanceId: PI,
      approverId: APPROVER,
      criteriaFacts: FALHA,
    });
    expect(store.audits).toHaveLength(1);
    expect(store.audits[0]).toMatchObject({
      action: "scaffold.gate.close-refused",
      entityType: "scaffold.phase",
      entityId: PI,
    });
  });

  it("e então o override alcança a fase: BLOCKED é o que ele exige", async () => {
    await closePhase({
      phaseInstanceId: PI,
      approverId: APPROVER,
      criteriaFacts: FALHA,
    });
    expect(store.committedState).toBe("BLOCKED");

    const res = await overridePhase({
      phaseInstanceId: PI,
      unmetCriteria: ["no-new-risk"],
      rationale:
        "Risco coberto pelo rollback manual acordado com o dono do processo.",
    });
    expect(res).toMatchObject({ ok: true });
    expect(h.overrideCreate).toHaveBeenCalledTimes(1);
  });

  it("fase que já estava BLOCKED continua BLOCKED, sem auditar de novo uma transição que não houve", async () => {
    store.committedState = "BLOCKED";
    const res = await closePhase({
      phaseInstanceId: PI,
      approverId: APPROVER,
      criteriaFacts: FALHA,
    });
    expect(res).toMatchObject({ ok: false, code: "CRITERIA_UNMET" });
    expect(store.committedState).toBe("BLOCKED");
    expect(store.audits).toHaveLength(0);
  });

  it("recusa de pré-condição (passo pendente) não grava nada: não há o que persistir", async () => {
    h.phaseFindFirst.mockImplementation(async () => ({
      ...fase(),
      steps: [
        { id: "s1", required: true, state: "TODO", statement: "Rodar piloto" },
      ],
    }));
    const res = await closePhase({
      phaseInstanceId: PI,
      approverId: APPROVER,
      criteriaFacts: FALHA,
    });
    expect(res).toMatchObject({ ok: false, code: "STEPS_INCOMPLETE" });
    expect(store.committedState).toBe("GATE_READY");
    expect(store.audits).toHaveLength(0);
  });
});
