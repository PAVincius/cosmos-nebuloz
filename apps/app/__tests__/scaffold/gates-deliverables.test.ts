import { beforeEach, describe, expect, it, vi } from "vitest";

// Entregável no gate — SG-01 (SC-DEV-06): "Revisar e assinar" não fecha a fase
// enquanto houver entregável OBRIGATÓRIO fora de Aprovado, e override não passa
// por cima disso (é condição de haver trabalho feito, não critério).

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
  deliverableFindMany: vi.fn(),
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
        updateMany: h.phaseUpdateMany,
      },
      // O aprovador informado só vale se for do tenant com gate.close.
      scaffoldMembership: {
        findFirst: async () => ({ role: "PROCESS_OWNER" }),
      },
      scaffoldGateCriterion: { findMany: h.criterionFindMany },
      scaffoldGateResult: { create: h.gateResultCreate },
      scaffoldGateOverride: { create: h.overrideCreate },
      scaffoldTrack: { update: h.trackUpdate },
      scaffoldDeliverableInstance: { findMany: h.deliverableFindMany },
      tenantModule: { findFirst: h.moduleFindFirst },
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

const phase = (over: Record<string, unknown> = {}) => ({
  id: PI,
  phase: "PILOT",
  state: "GATE_READY",
  reopenCount: 0,
  observationEndsAt: null,
  charterPolicyAckAt: null,
  trackId: "trk1",
  steps: [{ id: "s1", required: true, state: "DONE", statement: "Rodar" }],
  track: {
    id: "trk1",
    code: "TR-104",
    processName: "Triagem",
    tenantId: "t1",
    templateVersionId: "ver1",
    businessCase: null,
  },
  ...over,
});

const d = (
  code: string,
  status: string,
  over: Record<string, unknown> = {}
) => ({
  code,
  title: `Entregável ${code}`,
  status,
  required: true,
  phaseInstanceId: PI,
  ...over,
});

const CLOSE = {
  phaseInstanceId: PI,
  approverId: APPROVER,
  criteriaFacts: {},
};

beforeEach(() => {
  vi.clearAllMocks();
  h.requirePerm.mockResolvedValue(CTX);
  h.phaseFindFirst.mockResolvedValue(phase());
  h.criterionFindMany.mockResolvedValue([]);
  h.gateResultCreate.mockResolvedValue({ id: "gr1" });
  h.overrideCreate.mockResolvedValue({ id: "ov1" });
  h.phaseUpdate.mockResolvedValue({});
  h.phaseUpdateMany.mockResolvedValue({ count: 1 });
  h.trackUpdate.mockResolvedValue({});
  h.auditCreate.mockResolvedValue({});
  h.moduleFindFirst.mockResolvedValue(null);
  h.deliverableFindMany.mockResolvedValue([]);
});

describe("closePhase com entregáveis", () => {
  it("bloqueia com obrigatório pendente e lista os códigos", async () => {
    h.deliverableFindMany.mockResolvedValue([
      d("B1.1", "APPROVED"),
      d("B1.2", "IN_REVIEW"),
      d("B2.1", "NOT_STARTED"),
    ]);
    const r = await closePhase(CLOSE);
    expect(r).toMatchObject({
      ok: false,
      code: "DELIVERABLES_PENDING",
      blockers: ["B1.2", "B2.1"],
    });
    expect(h.gateResultCreate).not.toHaveBeenCalled();
  });

  it("reaberto volta a bloquear", async () => {
    h.deliverableFindMany.mockResolvedValue([d("B1.1", "REOPENED")]);
    expect(await closePhase(CLOSE)).toMatchObject({
      ok: false,
      code: "DELIVERABLES_PENDING",
    });
  });

  it("fecha quando todo obrigatório está aprovado", async () => {
    h.deliverableFindMany.mockResolvedValue([
      d("B1.1", "APPROVED"),
      d("B1.2", "APPROVED"),
      d("X.1", "NOT_STARTED", { required: false }),
    ]);
    expect((await closePhase(CLOSE)).ok).toBe(true);
    expect(h.gateResultCreate).toHaveBeenCalledTimes(1);
  });

  it("trilha legada, sem nenhum entregável, segue a regra de passos", async () => {
    h.deliverableFindMany.mockResolvedValue([]);
    expect((await closePhase(CLOSE)).ok).toBe(true);
  });

  it("a trilha tem entregáveis mas a fase não tem obrigatório: bloqueia", async () => {
    h.deliverableFindMany.mockResolvedValue([
      d("A1.1", "APPROVED", { phaseInstanceId: "outra-fase" }),
    ]);
    expect(await closePhase(CLOSE)).toMatchObject({
      ok: false,
      code: "DELIVERABLES_PENDING",
    });
  });

  it("A3.2 (caso de negócio) conta como aprovado quando o caso está assinado", async () => {
    h.phaseFindFirst.mockResolvedValue(
      phase({
        phase: "ASSESS",
        track: {
          id: "trk1",
          code: "TR-104",
          processName: "Triagem",
          tenantId: "t1",
          templateVersionId: "ver1",
          businessCase: { state: "SIGNED", signedVersionId: "v1" },
        },
      })
    );
    h.deliverableFindMany.mockResolvedValue([
      d("A3.1", "APPROVED"),
      d("A3.2", "NOT_STARTED"),
    ]);
    expect((await closePhase(CLOSE)).ok).toBe(true);
  });

  it("A3.2 pendente enquanto o caso não está assinado", async () => {
    h.phaseFindFirst.mockResolvedValue(phase({ phase: "ASSESS" }));
    h.deliverableFindMany.mockResolvedValue([
      d("A3.1", "APPROVED"),
      d("A3.2", "NOT_STARTED"),
    ]);
    expect(await closePhase(CLOSE)).toMatchObject({
      ok: false,
      code: "DELIVERABLES_PENDING",
      blockers: ["A3.2"],
    });
  });

  it("filtra por tenant e trilha", async () => {
    await closePhase(CLOSE);
    expect(h.deliverableFindMany.mock.calls[0]?.[0].where).toEqual({
      tenantId: "t1",
      trackId: "trk1",
    });
  });
});

describe("overridePhase com entregáveis", () => {
  it("override não dispensa entregável obrigatório pendente", async () => {
    h.phaseFindFirst.mockResolvedValue(phase({ state: "BLOCKED" }));
    h.deliverableFindMany.mockResolvedValue([d("B1.1", "IN_REVIEW")]);
    const r = await overridePhase({
      phaseInstanceId: PI,
      unmetCriteria: ["beats-baseline"],
      rationale: "O time precisa avançar por prazo do contrato.",
    });
    expect(r).toMatchObject({ ok: false, code: "DELIVERABLES_PENDING" });
    expect(h.gateResultCreate).not.toHaveBeenCalled();
  });
});

describe("evaluateGate com entregáveis", () => {
  it("expõe o motivo e os pendentes para desabilitar o botão", async () => {
    h.deliverableFindMany.mockResolvedValue([
      d("B1.1", "APPROVED"),
      d("B1.2", "IN_REVIEW"),
    ]);
    const r = await evaluateGate({ phaseInstanceId: PI });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.canClose).toBe(false);
      expect(r.data.pendingDeliverables).toEqual(["B1.2"]);
      expect(r.data.deliverablesReason).toBe(
        "1 entregável obrigatório pendente: B1.2."
      );
    }
  });

  it("sem pendência, motivo nulo", async () => {
    h.deliverableFindMany.mockResolvedValue([d("B1.1", "APPROVED")]);
    const r = await evaluateGate({ phaseInstanceId: PI });
    if (r.ok) {
      expect(r.data.pendingDeliverables).toEqual([]);
      expect(r.data.deliverablesReason).toBeNull();
      expect(r.data.canClose).toBe(true);
    }
  });
});
