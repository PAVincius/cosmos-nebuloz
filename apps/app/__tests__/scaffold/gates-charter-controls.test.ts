import { beforeEach, describe, expect, it, vi } from "vitest";

// CH-PM-03 / G-CHARTER (Norte c.2): a Fase 3 (SCALE) só fecha se o caso de uso
// LIGADO à trilha no Charter não tem controle sem evidência, com ajuste pedido,
// vencido ou reaberto. DERIVED e não dispensável por override, como SG-04/SG-05.
// Só vale com Charter contratado E caso ligado (degradação graciosa).
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
  registryFindFirst: vi.fn(),
  controlFindMany: vi.fn(),
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
      scaffoldGateCriterion: { findMany: h.criterionFindMany },
      scaffoldGateResult: { create: h.gateResultCreate },
      scaffoldGateOverride: { create: h.overrideCreate },
      scaffoldTrack: { update: h.trackUpdate },
      tenantModule: { findFirst: h.moduleFindFirst },
      processRegistry: { findFirst: h.registryFindFirst },
      charterCaseControl: { findMany: h.controlFindMany },
      auditLog: { create: h.auditCreate },
    }),
}));

import {
  closePhase,
  evaluateGate,
  overridePhase,
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

function scalePhase(over: Record<string, unknown> = {}) {
  return {
    id: PI,
    phase: "SCALE",
    state: "GATE_READY",
    reopenCount: 0,
    observationEndsAt: null,
    // Política já aceita: o que está em teste aqui é o guard dos controles.
    charterPolicyAckAt: new Date("2026-09-01T00:00:00Z"),
    trackId: "trk1",
    steps: [{ id: "s1", required: true, state: "DONE", statement: "Migrar" }],
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

const ctl = (code: string, state: string) => ({
  code,
  name: `Controle ${code}`,
  state,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.requirePerm.mockResolvedValue(CTX);
  h.phaseFindFirst.mockResolvedValue(scalePhase());
  h.criterionFindMany.mockResolvedValue([]);
  h.gateResultCreate.mockResolvedValue({ id: "gr1" });
  h.overrideCreate.mockResolvedValue({ id: "ov1" });
  h.phaseUpdate.mockResolvedValue({});
  h.phaseUpdateMany.mockResolvedValue({ count: 1 });
  h.trackUpdate.mockResolvedValue({});
  h.auditCreate.mockResolvedValue({});
  h.emit.mockResolvedValue(undefined);
  h.moduleFindFirst.mockResolvedValue({ module: "CHARTER" });
  h.registryFindFirst.mockResolvedValue({ charterUseCaseId: "uc1" });
  h.controlFindMany.mockResolvedValue([ctl("TR-1", "ACCEPTED")]);
});

const close = () =>
  closePhase({ phaseInstanceId: PI, approverId: APPROVER, criteriaFacts: {} });

describe("closePhase da SCALE com controles do Charter", () => {
  it("fecha quando o caso ligado tem tudo aceito ou dispensado", async () => {
    h.controlFindMany.mockResolvedValue([
      ctl("TR-1", "ACCEPTED"),
      ctl("TR-2", "DISPENSED"),
    ]);

    const r = await close();

    expect(r.ok).toBe(true);
  });

  it.each([
    ["sem evidência", "NO_EVIDENCE"],
    ["com ajuste pedido", "ADJUSTMENT_REQUESTED"],
    ["vencido", "EXPIRED"],
    ["reaberto", "REOPENED"],
  ])("RECUSA fechar com controle %s, nomeando o código e sem gravar nada", async (_n, state) => {
    h.controlFindMany.mockResolvedValue([
      ctl("TR-1", "ACCEPTED"),
      ctl("TR-2", state),
    ]);

    const r = await close();

    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("x");
    expect(r.code).toBe("CHARTER_CONTROLS_NOT_CLEAR");
    expect(JSON.stringify(r)).toContain("TR-2");
    expect(h.gateResultCreate).not.toHaveBeenCalled();
    expect(h.phaseUpdate).not.toHaveBeenCalled();
    expect(h.emit).not.toHaveBeenCalled();
  });

  it("controle em elaboração ou em revisão não bloqueia (trabalho em andamento)", async () => {
    h.controlFindMany.mockResolvedValue([
      ctl("TR-1", "IN_PROGRESS"),
      ctl("TR-2", "IN_REVIEW"),
    ]);

    const r = await close();

    expect(r.ok).toBe(true);
  });

  it("lê os controles do caso LIGADO à trilha, no tenant", async () => {
    await close();

    expect(h.registryFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: "t1",
          scaffoldTrackId: "trk1",
          charterUseCaseId: { not: null },
        },
      })
    );
    expect(h.controlFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "t1", useCaseId: "uc1" },
      })
    );
  });

  it("sem Charter contratado o guard não existe (e nem consulta o registro)", async () => {
    h.moduleFindFirst.mockResolvedValue(null);
    h.controlFindMany.mockResolvedValue([ctl("TR-2", "NO_EVIDENCE")]);

    const r = await close();

    expect(r.ok).toBe(true);
    expect(h.registryFindFirst).not.toHaveBeenCalled();
    expect(h.controlFindMany).not.toHaveBeenCalled();
  });

  it("Charter contratado mas trilha sem caso ligado: passa", async () => {
    h.registryFindFirst.mockResolvedValue(null);

    const r = await close();

    expect(r.ok).toBe(true);
    expect(h.controlFindMany).not.toHaveBeenCalled();
  });

  it("outras fases não consultam o Charter", async () => {
    h.phaseFindFirst.mockResolvedValue(scalePhase({ phase: "PILOT" }));

    const r = await close();

    expect(r.ok).toBe(true);
    expect(h.registryFindFirst).not.toHaveBeenCalled();
  });
});

describe("overridePhase da SCALE: os controles NÃO são dispensáveis por override", () => {
  it("recusa mesmo com override atribuído e justificativa", async () => {
    h.phaseFindFirst.mockResolvedValue(scalePhase({ state: "BLOCKED" }));
    h.criterionFindMany.mockResolvedValue([
      {
        key: "volume-migrated",
        statement: "80% do volume migrado",
        phase: "SCALE",
        seq: 1,
        evaluationType: "MANUAL",
      },
    ]);
    h.controlFindMany.mockResolvedValue([ctl("TR-2", "EXPIRED")]);

    const r = await overridePhase({
      phaseInstanceId: PI,
      unmetCriteria: ["volume-migrated"],
      rationale:
        "Risco aceito pelo sponsor: a renovação do teste sai na próxima semana.",
    });

    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("x");
    expect(r.code).toBe("CHARTER_CONTROLS_NOT_CLEAR");
    expect(h.gateResultCreate).not.toHaveBeenCalled();
    expect(h.overrideCreate).not.toHaveBeenCalled();
  });
});

describe("evaluateGate da SCALE mostra o motivo sem lançar", () => {
  it("lista os controles pendentes em blockers e não deixa fechar", async () => {
    h.controlFindMany.mockResolvedValue([ctl("TR-2", "NO_EVIDENCE")]);

    const r = await evaluateGate({ phaseInstanceId: PI });

    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("x");
    expect(r.data.canClose).toBe(false);
    expect(r.data.blockers.join(" ")).toContain("TR-2");
  });

  it("com tudo resolvido continua podendo fechar", async () => {
    const r = await evaluateGate({ phaseInstanceId: PI });

    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("x");
    expect(r.data.canClose).toBe(true);
  });
});
