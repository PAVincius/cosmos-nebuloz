import { beforeEach, describe, expect, it, vi } from "vitest";

// Plano de medição da iniciativa — SG-DEV-04/05.
//
// O que estes testes protegem: a proposta que NÃO entra no veredito, a primária
// única, a meta congelada que não se edita (vira pedido ao Scaffold), o
// comentário obrigatório onde a decisão precisa de justificativa e o fato de o
// ADMIN não transitar estado. Tudo com tenant do contexto e trilha.

const h = vi.hoisted(() => ({
  requireSignalPermissionContext: vi.fn(),
  requireInitiativeOwnership: vi.fn(),
  withTenantDb: vi.fn(),
  logSignalAudit: vi.fn(),
  revalidatePath: vi.fn(),
  emitProductEvent: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: h.revalidatePath }));
vi.mock("@repo/database", () => ({ withTenantDb: h.withTenantDb }));
vi.mock("@/lib/inngest/emit-product-event", () => ({
  emitProductEvent: h.emitProductEvent,
}));
vi.mock("@/lib/signal/guards", async () => {
  const errors = await vi.importActual<typeof import("@/lib/signal/errors")>(
    "../../../lib/signal/errors"
  );
  return {
    ...errors,
    requireSignalPermissionContext: h.requireSignalPermissionContext,
    requireInitiativeOwnership: h.requireInitiativeOwnership,
  };
});
vi.mock("@/app/(signal)/actions/_shared", async () => {
  const actual = await vi.importActual<
    typeof import("@/app/(signal)/actions/_shared")
  >("../../../app/(signal)/actions/_shared");
  return { ...actual, logSignalAudit: h.logSignalAudit };
});

import {
  approveMetric,
  editMetric,
  generatePlan,
  mapMetricSource,
  pauseMetric,
  proposeMetric,
  requestTargetReview,
  resumeMetric,
} from "@/app/(signal)/actions/plan";

const CTX = {
  tenantId: "tnt_1",
  userId: "usr_1",
  signalRole: "OWNER",
  user: { id: "usr_1", name: "Paula", email: "p@vanta.test" },
};

const INITIATIVE = {
  id: "ini_1",
  code: "IN-014",
  name: "Triagem assistida",
  ownerId: "usr_1",
  scaffoldTrackId: "trk_1",
  workForm: "TRIAGE",
  measureModelVersionId: "mmv_1",
};

const metric = (over: Record<string, unknown> = {}) => ({
  id: "pm_1",
  tenantId: "tnt_1",
  initiativeId: "ini_1",
  role: "GUARD",
  name: "Reencaminhados ÷ pedidos",
  formula: "reencaminhados ÷ pedidos",
  direction: "DOWN",
  state: "NO_SOURCE",
  sourceMappingId: null,
  targetValue: null,
  ownerId: null,
  version: 1,
  isCurrentPrimary: null,
  initiative: INITIATIVE,
  ...over,
});

type Fn = ReturnType<typeof vi.fn>;
type Db = Record<string, Record<string, Fn>>;
let db: Db;

beforeEach(() => {
  vi.clearAllMocks();
  h.requireSignalPermissionContext.mockResolvedValue(CTX);
  h.logSignalAudit.mockResolvedValue(undefined);
  h.emitProductEvent.mockResolvedValue(undefined);

  db = {
    signalInitiative: {
      findUnique: vi.fn().mockResolvedValue(INITIATIVE),
    },
    signalPlanMetric: {
      findFirst: vi.fn().mockResolvedValue(metric()),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      create: vi
        .fn()
        .mockImplementation(({ data }) => ({ id: "pm_new", ...data })),
      update: vi.fn().mockResolvedValue({}),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    signalPlanMetricEvent: {
      create: vi.fn().mockResolvedValue({ id: "ev_1" }),
    },
    signalMeasureModel: {
      findUnique: vi.fn().mockResolvedValue({ id: "mm_1" }),
    },
    signalMeasureModelVersion: {
      findFirst: vi.fn().mockResolvedValue({ id: "mmv_1", metrics: [] }),
      findUnique: vi.fn().mockResolvedValue({ id: "mmv_1", metrics: [] }),
    },
    signalMetricMapping: {
      findFirst: vi.fn().mockResolvedValue({
        id: "mp_1",
        code: "MP-01",
        initiativeId: "ini_1",
        connection: { health: "HEALTHY" },
      }),
    },
  };
  h.withTenantDb.mockImplementation((_t: string, fn: (d: unknown) => unknown) =>
    fn(db)
  );
});

describe("gerar plano do modelo (sem métrica órfã)", () => {
  const modelVersion = {
    id: "mmv_1",
    metrics: [
      {
        id: "mmm_1",
        role: "PRIMARY",
        name: "Tempo",
        formula: "f1",
        direction: "DOWN",
        seq: 0,
      },
      {
        id: "mmm_2",
        role: "GUARD",
        name: "Reencaminhados",
        formula: "f2",
        direction: "DOWN",
        seq: 1,
      },
    ],
  };

  it("cria uma métrica por métrica do modelo, ligada a ela, sem fonte", async () => {
    db.signalMeasureModelVersion.findUnique.mockResolvedValue(modelVersion);
    const res = await generatePlan({ initiativeCode: "IN-014" });
    expect(res.ok).toBe(true);
    const rows = db.signalPlanMetric.createMany.mock.calls[0][0].data;
    expect(rows).toHaveLength(2);
    expect(
      rows.every((r: { modelMetricId: string | null }) => r.modelMetricId)
    ).toBe(true);
    expect(rows.every((r: { state: string }) => r.state === "NO_SOURCE")).toBe(
      true
    );
    expect(
      rows.every((r: { tenantId: string }) => r.tenantId === "tnt_1")
    ).toBe(true);
  });

  it("só a primária carrega isCurrentPrimary=true; as demais ficam NULL, nunca false", async () => {
    db.signalMeasureModelVersion.findUnique.mockResolvedValue(modelVersion);
    await generatePlan({ initiativeCode: "IN-014" });
    const rows = db.signalPlanMetric.createMany.mock.calls[0][0].data;
    expect(rows[0].isCurrentPrimary).toBe(true);
    expect(rows[1].isCurrentPrimary).toBeNull();
  });

  it("recusa quando o plano já existe", async () => {
    db.signalPlanMetric.count.mockResolvedValue(3);
    const res = await generatePlan({ initiativeCode: "IN-014" });
    expect(res).toMatchObject({ ok: false, rule: "plan.exists" });
    expect(db.signalPlanMetric.createMany).not.toHaveBeenCalled();
  });

  it("recusa iniciativa sem forma de trabalho classificada", async () => {
    db.signalInitiative.findUnique.mockResolvedValue({
      ...INITIATIVE,
      workForm: null,
      measureModelVersionId: null,
    });
    const res = await generatePlan({ initiativeCode: "IN-014" });
    expect(res).toMatchObject({ ok: false, rule: "plan.no-model" });
  });
});

describe("propor métrica (SG-PO-05)", () => {
  const INPUT = {
    initiativeCode: "IN-014",
    role: "GUARD" as const,
    name: "Urgentes rebaixados",
    formula: "urgentes rebaixados ÷ urgentes",
    direction: "DOWN" as const,
  };

  it("entra como Proposta, sem modelo de origem", async () => {
    const res = await proposeMetric(INPUT);
    expect(res.ok).toBe(true);
    const data = db.signalPlanMetric.create.mock.calls[0][0].data;
    expect(data.state).toBe("PROPOSED");
    expect(data.modelMetricId).toBeNull();
    expect(data.tenantId).toBe("tnt_1");
  });

  it("não pode ser primária: a troca de primária tem regra própria", async () => {
    const res = await proposeMetric({ ...INPUT, role: "PRIMARY" });
    expect(res).toMatchObject({ ok: false, rule: "plan.proposal.primary" });
    expect(db.signalPlanMetric.create).not.toHaveBeenCalled();
  });

  it("grava histórico e trilha", async () => {
    await proposeMetric(INPUT);
    expect(db.signalPlanMetricEvent.create.mock.calls[0][0].data).toMatchObject(
      {
        action: "PROPOSE",
        toState: "PROPOSED",
        tenantId: "tnt_1",
      }
    );
    expect(h.logSignalAudit).toHaveBeenCalledTimes(1);
  });
});

describe("aprovar (Proposta → Sem fonte)", () => {
  it("OWNER aprova e o estado vira NO_SOURCE", async () => {
    db.signalPlanMetric.findFirst.mockResolvedValue(
      metric({ state: "PROPOSED" })
    );
    const res = await approveMetric({ id: "pm_1" });
    expect(res).toMatchObject({ ok: true, data: { state: "NO_SOURCE" } });
    expect(db.signalPlanMetric.update.mock.calls[0][0].data.state).toBe(
      "NO_SOURCE"
    );
  });

  it("aprovar o que já foi aprovado é conflito de estado (409)", async () => {
    const res = await approveMetric({ id: "pm_1" });
    expect(res).toMatchObject({ ok: false, status: 409 });
  });

  it("ADMIN não transita estado (SG-PO-03)", async () => {
    h.requireSignalPermissionContext.mockResolvedValue({
      ...CTX,
      signalRole: "ADMIN",
    });
    db.signalPlanMetric.findFirst.mockResolvedValue(
      metric({ state: "PROPOSED" })
    );
    const res = await approveMetric({ id: "pm_1" });
    expect(res).toMatchObject({ ok: false, rule: "plan.role.denied" });
    expect(db.signalPlanMetric.update).not.toHaveBeenCalled();
  });

  it("consulta a métrica pelo tenant do contexto, nunca por id solto", async () => {
    db.signalPlanMetric.findFirst.mockResolvedValue(
      metric({ state: "PROPOSED" })
    );
    await approveMetric({ id: "pm_1" });
    expect(db.signalPlanMetric.findFirst.mock.calls[0][0].where).toMatchObject({
      id: "pm_1",
      tenantId: "tnt_1",
    });
  });

  it("métrica inexistente neste tenant é 422 com regra nomeada", async () => {
    db.signalPlanMetric.findFirst.mockResolvedValue(null);
    const res = await approveMetric({ id: "pm_x" });
    expect(res).toMatchObject({ ok: false, rule: "plan.not-found" });
  });

  it("passa pela posse da iniciativa", async () => {
    db.signalPlanMetric.findFirst.mockResolvedValue(
      metric({ state: "PROPOSED" })
    );
    await approveMetric({ id: "pm_1" });
    expect(h.requireInitiativeOwnership).toHaveBeenCalledWith(CTX, INITIATIVE);
  });
});

describe("mapear fonte (SG-PM-03)", () => {
  it("conexão saudável leva Sem fonte a Medindo", async () => {
    const res = await mapMetricSource({ id: "pm_1", mappingId: "mp_1" });
    expect(res).toMatchObject({ ok: true, data: { state: "MEASURING" } });
    const actions = db.signalPlanMetricEvent.create.mock.calls.map(
      (c) => c[0].data.action
    );
    expect(actions).toEqual(["MAP_SOURCE", "START_MEASURING"]);
  });

  it("conexão não saudável guarda a fonte mas NÃO vira Medindo", async () => {
    db.signalMetricMapping.findFirst.mockResolvedValue({
      id: "mp_1",
      code: "MP-01",
      initiativeId: "ini_1",
      connection: { health: "DOWN" },
    });
    const res = await mapMetricSource({ id: "pm_1", mappingId: "mp_1" });
    expect(res).toMatchObject({ ok: true, data: { state: "NO_SOURCE" } });
    expect(
      db.signalPlanMetric.update.mock.calls[0][0].data.sourceMappingId
    ).toBe("mp_1");
    expect(db.signalPlanMetric.update.mock.calls[0][0].data.state).toBe(
      "NO_SOURCE"
    );
  });

  it("proposta não recebe fonte antes de ser aprovada", async () => {
    db.signalPlanMetric.findFirst.mockResolvedValue(
      metric({ state: "PROPOSED" })
    );
    const res = await mapMetricSource({ id: "pm_1", mappingId: "mp_1" });
    expect(res).toMatchObject({ ok: false, rule: "plan.source.not-approved" });
  });

  it("mapeamento de outra iniciativa é recusado", async () => {
    db.signalMetricMapping.findFirst.mockResolvedValue({
      id: "mp_1",
      code: "MP-01",
      initiativeId: "ini_OUTRA",
      connection: { health: "HEALTHY" },
    });
    const res = await mapMetricSource({ id: "pm_1", mappingId: "mp_1" });
    expect(res).toMatchObject({ ok: false, rule: "plan.source.foreign" });
  });

  it("exige a permissão de mapeamento, não a de iniciativa", async () => {
    await mapMetricSource({ id: "pm_1", mappingId: "mp_1" });
    expect(h.requireSignalPermissionContext).toHaveBeenCalledWith(
      "signal.mapping.write"
    );
  });
});

describe("pausar e retomar (comentário obrigatório)", () => {
  it("pausar sem comentário é recusado", async () => {
    db.signalPlanMetric.findFirst.mockResolvedValue(
      metric({ state: "MEASURING" })
    );
    const res = await pauseMetric({ id: "pm_1", comment: "  " });
    expect(res.ok).toBe(false);
    expect(db.signalPlanMetric.update).not.toHaveBeenCalled();
  });

  it("pausa Medindo → Pausada e guarda o comentário no histórico", async () => {
    db.signalPlanMetric.findFirst.mockResolvedValue(
      metric({ state: "MEASURING" })
    );
    const res = await pauseMetric({
      id: "pm_1",
      comment: "Fonte em manutenção",
    });
    expect(res).toMatchObject({ ok: true, data: { state: "PAUSED" } });
    expect(db.signalPlanMetricEvent.create.mock.calls[0][0].data).toMatchObject(
      {
        action: "PAUSE",
        comment: "Fonte em manutenção",
      }
    );
  });

  it("retoma Pausada → Medindo com comentário", async () => {
    db.signalPlanMetric.findFirst.mockResolvedValue(
      metric({ state: "PAUSED" })
    );
    const res = await resumeMetric({ id: "pm_1", comment: "Fonte voltou" });
    expect(res).toMatchObject({ ok: true, data: { state: "MEASURING" } });
  });

  it("não pausa métrica que não está medindo", async () => {
    const res = await pauseMetric({ id: "pm_1", comment: "motivo válido" });
    expect(res).toMatchObject({ ok: false, status: 409 });
  });
});

describe("pedir revisão de meta (métrica congelada)", () => {
  const frozen = () => metric({ state: "FROZEN", targetValue: "0.8" });

  it("vira evento ao Scaffold depois da transação, com o id do histórico", async () => {
    db.signalPlanMetric.findFirst.mockResolvedValue(frozen());
    const res = await requestTargetReview({
      id: "pm_1",
      comment: "Meta acordada antes do piloto; baseline mudou.",
    });
    expect(res.ok).toBe(true);
    expect(h.emitProductEvent).toHaveBeenCalledWith(
      "signalTargetReviewRequested",
      expect.objectContaining({
        tenantId: "tnt_1",
        initiativeCode: "IN-014",
        scaffoldTrackId: "trk_1",
        planMetricId: "pm_1",
        eventId: "ev_1",
      })
    );
  });

  it("não altera a meta localmente", async () => {
    db.signalPlanMetric.findFirst.mockResolvedValue(frozen());
    await requestTargetReview({ id: "pm_1", comment: "revisar" });
    for (const call of db.signalPlanMetric.update.mock.calls) {
      expect(call[0].data).not.toHaveProperty("targetValue");
    }
  });

  it("exige comentário", async () => {
    db.signalPlanMetric.findFirst.mockResolvedValue(frozen());
    const res = await requestTargetReview({ id: "pm_1", comment: "" });
    expect(res.ok).toBe(false);
    expect(h.emitProductEvent).not.toHaveBeenCalled();
  });

  it("só métrica congelada pede revisão", async () => {
    const res = await requestTargetReview({
      id: "pm_1",
      comment: "motivo válido",
    });
    expect(res).toMatchObject({ ok: false, status: 409 });
    expect(h.emitProductEvent).not.toHaveBeenCalled();
  });
});

describe("editar cria versão nova", () => {
  it("sobe a versão e registra antes/depois", async () => {
    db.signalPlanMetric.findFirst.mockResolvedValue(
      metric({ state: "MEASURING", version: 2 })
    );
    const res = await editMetric({ id: "pm_1", formula: "nova fórmula" });
    expect(res).toMatchObject({ ok: true, data: { version: 3 } });
    expect(db.signalPlanMetric.update.mock.calls[0][0].data.version).toBe(3);
    const ev = db.signalPlanMetricEvent.create.mock.calls[0][0].data;
    expect(ev.action).toBe("EDIT");
    expect(ev.version).toBe(3);
    expect(ev.changes).toContainEqual([
      "Fórmula",
      "reencaminhados ÷ pedidos",
      "nova fórmula",
    ]);
  });

  it("congelada NÃO edita meta (aceite SG-DEV-05)", async () => {
    db.signalPlanMetric.findFirst.mockResolvedValue(
      metric({ state: "FROZEN", targetValue: "0.8" })
    );
    const res = await editMetric({ id: "pm_1", targetValue: 0.5 });
    expect(res).toMatchObject({ ok: false, rule: "plan.target.frozen" });
    expect(db.signalPlanMetric.update).not.toHaveBeenCalled();
  });

  it("congelada edita o que não é meta", async () => {
    db.signalPlanMetric.findFirst.mockResolvedValue(
      metric({ state: "FROZEN", targetValue: "0.8" })
    );
    const res = await editMetric({ id: "pm_1", name: "Reencaminhamento" });
    expect(res.ok).toBe(true);
  });

  it("edição sem mudança real não gera versão", async () => {
    const res = await editMetric({
      id: "pm_1",
      formula: "reencaminhados ÷ pedidos",
    });
    expect(res).toMatchObject({ ok: false, rule: "plan.edit.empty" });
    expect(db.signalPlanMetric.update).not.toHaveBeenCalled();
  });

  it("a meta em Sem fonte é editável", async () => {
    const res = await editMetric({ id: "pm_1", targetValue: 0.1 });
    expect(res.ok).toBe(true);
    expect(db.signalPlanMetric.update.mock.calls[0][0].data.targetValue).toBe(
      0.1
    );
  });
});
