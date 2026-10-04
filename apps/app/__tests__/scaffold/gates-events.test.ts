import { beforeEach, describe, expect, it, vi } from "vitest";

// X-04 — o Scaffold anuncia o gate: fechar (por critérios ou override) emite
// `scaffold/gate.closed`, reabrir emite `scaffold/gate.reopened`. O cliente
// Inngest não entra: o emissor é mockado e o teste confere o que sai, quando
// sai, e que NADA sai se o gate não fechou.
const h = vi.hoisted(() => ({
  requirePerm: vi.fn(),
  phaseFindFirst: vi.fn(),
  phaseUpdate: vi.fn(),
  phaseUpdateMany: vi.fn(),
  criterionFindMany: vi.fn(),
  gateResultCreate: vi.fn(),
  overrideCreate: vi.fn(),
  trackUpdate: vi.fn(),
  moduleFindFirst: vi.fn(),
  auditCreate: vi.fn(),
  emit: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/inngest/emit-product-event", () => ({
  emitProductEvent: h.emit,
}));
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
        updateMany: h.phaseUpdateMany,
      },
      // O aprovador informado só vale se for do tenant com gate.close.
      scaffoldMembership: {
        findFirst: async () => ({ role: "PROCESS_OWNER" }),
      },
      scaffoldGateCriterion: { findMany: h.criterionFindMany },
      // Trilha sem entregável: só a regra de passos (merge com o Andaime, SC-DEV-06).
      scaffoldDeliverableInstance: { findMany: vi.fn().mockResolvedValue([]) },
      scaffoldGateResult: { create: h.gateResultCreate },
      scaffoldGateOverride: { create: h.overrideCreate },
      scaffoldTrack: { update: h.trackUpdate },
      tenantModule: { findFirst: h.moduleFindFirst },
      auditLog: { create: h.auditCreate },
    }),
}));

import {
  closePhase,
  overridePhase,
  reopenPhase,
} from "@/app/(scaffold)/actions/gates";

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

function readyPhase(over: Record<string, unknown> = {}) {
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
      processName: "Triagem de autorizações prévias",
      tenantId: "t1",
      templateVersionId: "ver1",
      businessCase: null,
    },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.requirePerm.mockResolvedValue(CTX);
  h.phaseFindFirst.mockResolvedValue(readyPhase());
  h.criterionFindMany.mockResolvedValue(CRITERIA);
  h.gateResultCreate.mockResolvedValue({ id: "gr1" });
  h.overrideCreate.mockResolvedValue({ id: "ov1" });
  h.phaseUpdate.mockResolvedValue({});
  h.phaseUpdateMany.mockResolvedValue({ count: 1 });
  h.trackUpdate.mockResolvedValue({});
  h.auditCreate.mockResolvedValue({});
  h.moduleFindFirst.mockResolvedValue(null);
  h.emit.mockResolvedValue(undefined);
});

describe("scaffold/gate.closed", () => {
  it("fechar a PILOT anuncia a fase que abriu (SCALE), com trilha e resultado", async () => {
    const res = await closePhase({
      phaseInstanceId: PI,
      approverId: APPROVER,
      criteriaFacts: { "beats-baseline": { met: true } },
    });

    expect(res.ok).toBe(true);
    expect(h.emit).toHaveBeenCalledTimes(1);
    const [key, data] = h.emit.mock.calls[0];
    expect(key).toBe("scaffoldGateClosed");
    expect(data).toMatchObject({
      tenantId: "t1",
      trackId: "trk1",
      trackCode: "TR-104",
      processName: "Triagem de autorizações prévias",
      closedPhase: "PILOT",
      openedPhase: "SCALE",
      outcome: "PASSED",
      gateResultId: "gr1",
    });
    expect(Number.isNaN(Date.parse(data.at))).toBe(false);
  });

  it("fechar a EMBED não abre fase nenhuma", async () => {
    h.phaseFindFirst.mockResolvedValue(readyPhase({ phase: "EMBED" }));
    h.criterionFindMany.mockResolvedValue([]);

    await closePhase({
      phaseInstanceId: PI,
      approverId: APPROVER,
      criteriaFacts: {},
    });

    expect(h.emit.mock.calls[0][1]).toMatchObject({
      closedPhase: "EMBED",
      openedPhase: null,
    });
  });

  it("gate que NÃO fecha (critério pendente) não emite nada", async () => {
    const res = await closePhase({
      phaseInstanceId: PI,
      approverId: APPROVER,
      criteriaFacts: { "beats-baseline": { met: false } },
    });

    expect(res.ok).toBe(false);
    expect(h.emit).not.toHaveBeenCalled();
  });

  it("override emite com outcome OVERRIDDEN", async () => {
    h.phaseFindFirst.mockResolvedValue(readyPhase({ state: "BLOCKED" }));

    const res = await overridePhase({
      phaseInstanceId: PI,
      unmetCriteria: ["beats-baseline"],
      rationale:
        "O critério depende de dado que o cliente só entrega no próximo mês; risco aceito pela sponsor.",
    });

    expect(res.ok).toBe(true);
    expect(h.emit).toHaveBeenCalledWith(
      "scaffoldGateClosed",
      expect.objectContaining({ outcome: "OVERRIDDEN", gateResultId: "gr1" })
    );
  });
});

describe("scaffold/gate.reopened", () => {
  it("reabrir emite a fase e o novo ciclo", async () => {
    h.phaseFindFirst.mockResolvedValue(
      readyPhase({ state: "CLOSED", reopenCount: 1 })
    );

    const res = await reopenPhase({
      phaseInstanceId: PI,
      rationale: "O piloto não sustentou o ganho no segundo mês de operação.",
    });

    expect(res.ok).toBe(true);
    expect(h.emit).toHaveBeenCalledTimes(1);
    const [key, data] = h.emit.mock.calls[0];
    expect(key).toBe("scaffoldGateReopened");
    expect(data).toMatchObject({
      tenantId: "t1",
      trackId: "trk1",
      trackCode: "TR-104",
      phase: "PILOT",
      phaseInstanceId: PI,
      reopenCount: 2,
    });
  });

  it("fase que não pode reabrir não emite", async () => {
    h.phaseFindFirst.mockResolvedValue(readyPhase({ state: "OPEN" }));

    const res = await reopenPhase({
      phaseInstanceId: PI,
      rationale: "O piloto não sustentou o ganho no segundo mês de operação.",
    });

    expect(res.ok).toBe(false);
    expect(h.emit).not.toHaveBeenCalled();
  });
});
