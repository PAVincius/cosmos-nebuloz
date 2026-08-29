import { beforeEach, describe, expect, it, vi } from "vitest";

// Scoring como efeito e export do plano — FR-014/FR-024/FR-025.
//
// O determinismo do cálculo já é testado em `lib/meridian-scoring`. O que falta
// travar aqui é o efeito colateral: rodar duas vezes não duplica gap nem
// reescreve o computado, e o export bate campo a campo com o contrato.

const h = vi.hoisted(() => ({
  requireCtx: vi.fn(),
  requirePerm: vi.fn(),
  assessmentFindFirst: vi.fn(),
  responseFindMany: vi.fn(),
  scoreFindUnique: vi.fn(),
  scoreCreate: vi.fn(),
  scoreUpdate: vi.fn(),
  scoreFindMany: vi.fn(),
  gapFindFirst: vi.fn(),
  gapCreate: vi.fn(),
  sequenceUpsert: vi.fn(),
  auditCreate: vi.fn(),
  contributeInTx: vi.fn(),
}));

vi.mock("@/lib/meridian/guards", () => ({
  requireMeridianContext: h.requireCtx,
  requireMeridianPermissionContext: h.requirePerm,
  MeridianRuleError: class extends Error {
    rule: string;
    constructor(rule: string, message: string) {
      super(message);
      this.rule = rule;
    }
  },
  StateConflictError: class extends Error {
    rule: string;
    blockers: string[];
    constructor(rule: string, message: string, blockers: string[] = []) {
      super(message);
      this.rule = rule;
      this.blockers = blockers;
    }
  },
}));
vi.mock("@/app/(meridian)/actions/benchmark", () => ({
  contributeInTx: h.contributeInTx,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@repo/database", () => ({
  withTenantDb: (_t: string, fn: (db: unknown) => unknown) =>
    fn({
      meridianAssessment: { findFirst: h.assessmentFindFirst },
      meridianResponse: { findMany: h.responseFindMany },
      meridianAxisScore: {
        findUnique: h.scoreFindUnique,
        create: h.scoreCreate,
        update: h.scoreUpdate,
        findMany: h.scoreFindMany,
      },
      meridianGap: { findFirst: h.gapFindFirst, create: h.gapCreate },
      meridianSequence: { upsert: h.sequenceUpsert },
      auditLog: { create: h.auditCreate },
    }),
}));

import { exportPlan } from "@/app/(meridian)/actions/plan";
import { runScoring } from "@/app/(meridian)/actions/scoring";

const CTX = {
  tenantId: "t1",
  userId: "u1",
  role: "ADMIN",
  meridianRole: "CONSULTANT",
  user: { name: "Marina", email: "m@x.com" },
};
const AS_ID = "clx0000000000000000000as1";

const AXES = [
  "DATA",
  "PROCESS",
  "PEOPLE",
  "GOVERNANCE",
  "INFRASTRUCTURE",
] as const;

const assessment = (over: Record<string, unknown> = {}) => ({
  id: AS_ID,
  code: "AS-104",
  orgName: "Vanta Saúde",
  benchmarkOptIn: false,
  template: {
    contestedSpread: 25,
    gapThreshold: 60,
    questions: AXES.map((axis, i) => ({
      id: `q${i}`,
      code: `Q-${axis}`,
      axis,
      ordinal: 1,
      type: "LIKERT",
      weight: 1,
      inverted: false,
      scaleLabels: [],
    })),
  },
  respondents: [{ id: "r1", axis: "DATA" }],
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.requireCtx.mockResolvedValue(CTX);
  h.requirePerm.mockResolvedValue(CTX);
  h.assessmentFindFirst.mockResolvedValue(assessment());
  h.responseFindMany.mockResolvedValue([
    { respondentId: "r1", questionId: "q0", rawValue: 1 },
  ]);
  h.scoreFindUnique.mockResolvedValue(null);
  h.scoreCreate.mockResolvedValue({});
  h.scoreUpdate.mockResolvedValue({});
  h.gapFindFirst.mockResolvedValue(null);
  h.gapCreate.mockResolvedValue({ id: "g1" });
  h.sequenceUpsert.mockResolvedValue({ next: 2 });
  h.auditCreate.mockResolvedValue({});
});

describe("runScoring", () => {
  it("grava um score por eixo, na ordem canônica", async () => {
    const res = await runScoring({ assessmentId: AS_ID });
    expect(res.ok).toBe(true);
    expect(res.ok && res.data.map((s) => s.axis)).toEqual([...AXES]);
    expect(h.scoreCreate).toHaveBeenCalledTimes(5);
  });

  it("nunca reescreve o computado ao rodar de novo", async () => {
    h.scoreFindUnique.mockResolvedValue({
      id: "sc1",
      computed: 46,
      final: null,
      status: "COMPUTED",
    });
    await runScoring({ assessmentId: AS_ID });
    expect(h.scoreCreate).not.toHaveBeenCalled();
    for (const call of h.scoreUpdate.mock.calls) {
      const data = (call[0] as { data: Record<string, unknown> }).data;
      expect(data).not.toHaveProperty("computed");
    }
  });

  it("mantém OVERRIDDEN mesmo se a dispersão voltar a passar o limiar", async () => {
    h.scoreFindUnique.mockResolvedValue({
      id: "sc1",
      computed: 74,
      final: 66,
      status: "OVERRIDDEN",
    });
    await runScoring({ assessmentId: AS_ID });
    for (const call of h.scoreUpdate.mock.calls) {
      const data = (call[0] as { data: { status: string } }).data;
      expect(data.status).toBe("OVERRIDDEN");
    }
  });

  it("não duplica gap derivado numa segunda execução", async () => {
    h.gapFindFirst.mockResolvedValue({ id: "g-existente" });
    await runScoring({ assessmentId: AS_ID });
    expect(h.gapCreate).not.toHaveBeenCalled();
  });

  it("deriva gap para eixo abaixo do limiar do template", async () => {
    // Sem resposta em quatro eixos, o score é 0 — todos abaixo de 60.
    await runScoring({ assessmentId: AS_ID });
    expect(h.gapCreate).toHaveBeenCalled();
    const created = h.gapCreate.mock.calls[0]?.[0] as {
      data: { derived: boolean; state: string };
    };
    expect(created.data.derived).toBe(true);
    expect(created.data.state).toBe("OPEN");
  });

  it("só contribui ao benchmark com opt-in", async () => {
    await runScoring({ assessmentId: AS_ID });
    expect(h.contributeInTx).not.toHaveBeenCalled();

    h.assessmentFindFirst.mockResolvedValue(
      assessment({ benchmarkOptIn: true })
    );
    await runScoring({ assessmentId: AS_ID });
    expect(h.contributeInTx).toHaveBeenCalledTimes(1);
  });

  it("exige a permissão de rodar scoring", async () => {
    h.requirePerm.mockRejectedValue(new Error("Requer papel Consultor"));
    const res = await runScoring({ assessmentId: AS_ID });
    expect(res.ok).toBe(false);
    expect(h.scoreCreate).not.toHaveBeenCalled();
  });
});

describe("exportPlan", () => {
  const withPlan = {
    id: AS_ID,
    code: "AS-104",
    template: { version: "v3.2" },
    scores: [
      {
        axis: "GOVERNANCE",
        computed: 74,
        final: 66,
        status: "OVERRIDDEN",
        confidence: 0.91,
      },
    ],
    planItems: [{ gapId: "g1", quarter: 1, seq: 1, capacityNote: "1 squad" }],
    gaps: [
      {
        id: "g1",
        code: "G-01",
        axis: "DATA",
        severity: "HIGH",
        effort: "L",
        costOfDelay: 88,
        confidence: "MEASURED",
        state: "PROMOTED",
        dependencies: [],
        promotions: [{ targetProduct: "COSMOS", targetEntityId: "EP-2140" }],
      },
      {
        id: "g2",
        code: "G-02",
        axis: "DATA",
        severity: "MEDIUM",
        effort: "M",
        costOfDelay: 40,
        confidence: "ESTIMATED",
        state: "OPEN",
        dependencies: [],
        promotions: [],
      },
    ],
  };

  it("segue o contrato campo a campo", async () => {
    h.assessmentFindFirst.mockResolvedValue(withPlan);
    const res = await exportPlan({ assessmentId: AS_ID });
    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    expect(res.data.assessment).toBe("AS-104");
    expect(res.data.template_version).toBe("v3.2");
    expect(res.data.axes[0]).toEqual({
      axis: "governance",
      score: 66,
      status: "overridden",
      confidence: 0.91,
    });
    expect(res.data.gaps[0]).toMatchObject({
      id: "G-01",
      axis: "data",
      severity: "high",
      effort: "L",
      cost_of_delay: 88,
      finding_confidence: "measured",
      target_quarter: "Q1",
      promoted_to: { product: "cosmos", entity_id: "EP-2140" },
    });
    expect(res.data.plan).toEqual({
      capacity_assumption: "1 squad",
      items: 1,
    });
  });

  it("omite gap sem item de plano — o consumidor sequencia trabalho", async () => {
    h.assessmentFindFirst.mockResolvedValue(withPlan);
    const res = await exportPlan({ assessmentId: AS_ID });
    expect(res.ok && res.data.gaps.map((g) => g.id)).toEqual(["G-01"]);
  });

  it("não expõe pessoa em campo nenhum", async () => {
    h.assessmentFindFirst.mockResolvedValue(withPlan);
    const res = await exportPlan({ assessmentId: AS_ID });
    const json = JSON.stringify(res.ok ? res.data : {});
    expect(json).not.toMatch(/reviewer|promotedBy|consultant/i);
  });

  it("recusa assessment de outra organização", async () => {
    h.assessmentFindFirst.mockResolvedValue(null);
    const res = await exportPlan({ assessmentId: AS_ID });
    expect(res.ok).toBe(false);
  });
});
