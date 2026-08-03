// measure.test.ts — Measure & Grow (/cosmos/measure). FR-013 + story-032
// AC-006/AC-008: caminho de escrita da avaliação de competência, ações de
// melhoria ligadas à avaliação, e a regra de que ciclo anterior só existe
// dentro do mesmo escopo.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthError, tenantCtx } from "../helpers/action-mocks";

const h = vi.hoisted(() => ({
  requireTenantSession: vi.fn(),
  requireRole: vi.fn(),
  revalidatePath: vi.fn(),
  assessmentFindMany: vi.fn(),
  assessmentFindFirst: vi.fn(),
  assessmentCreate: vi.fn(),
  actionFindMany: vi.fn(),
  actionCreate: vi.fn(),
  logAudit: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));
vi.mock("next/cache", () => ({ revalidatePath: h.revalidatePath }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: h.requireTenantSession,
  requireRole: h.requireRole,
  AuthError: MockAuthError,
}));
vi.mock("@repo/database", () => ({
  database: {
    competencyAssessment: {
      findMany: h.assessmentFindMany,
      findFirst: h.assessmentFindFirst,
      create: h.assessmentCreate,
    },
    improvementAction: {
      findMany: h.actionFindMany,
      create: h.actionCreate,
    },
  },
}));
vi.mock("../../app/actions/audit/log-audit", () => ({ logAudit: h.logAudit }));

import {
  createImprovementAction,
  listCompetencyScores,
  listImprovementActions,
  recordCompetencyAssessment,
} from "../../app/(cosmos)/actions/measure";

const assessment = (over: Record<string, unknown>) => ({
  competency: "TEAM_TECHNICAL_AGILITY",
  score: 4.1,
  scope: "art",
  scopeId: "art-1",
  assessedAt: new Date("2026-02-01"),
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.requireTenantSession.mockResolvedValue(tenantCtx);
  h.requireRole.mockReturnValue(undefined);
  h.assessmentFindMany.mockResolvedValue([]);
  h.actionFindMany.mockResolvedValue([]);
});

describe("listCompetencyScores", () => {
  it("returns the 7 SAFe competencies, tenant-scoped, with the latest score per competency", async () => {
    h.assessmentFindMany.mockResolvedValue([
      assessment({}),
      assessment({ score: 3.8, assessedAt: new Date("2026-01-01") }),
      assessment({ competency: "AGILE_PRODUCT_DELIVERY", score: 3.5 }),
    ]);

    const r = await listCompetencyScores();
    expect(r.ok).toBe(true);
    expect(h.assessmentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: tenantCtx.tenantId } })
    );
    if (r.ok) {
      expect(r.data).toHaveLength(7);
      const tta = r.data.find((c) => c.competency === "TEAM_TECHNICAL_AGILITY");
      expect(tta?.score).toBe(4.1);
      const apd = r.data.find((c) => c.competency === "AGILE_PRODUCT_DELIVERY");
      expect(apd?.score).toBe(3.5);
      const noData = r.data.find(
        (c) => c.competency === "LEAN_AGILE_LEADERSHIP"
      );
      expect(noData?.score).toBeNull();
    }
  });

  it("computes the prev-cycle delta from the second-most-recent assessment", async () => {
    h.assessmentFindMany.mockResolvedValue([
      assessment({}),
      assessment({ score: 3.8, assessedAt: new Date("2026-01-01") }),
    ]);

    const r = await listCompetencyScores();
    expect(r.ok).toBe(true);
    if (r.ok) {
      const tta = r.data.find((c) => c.competency === "TEAM_TECHNICAL_AGILITY");
      expect(tta?.prevScore).toBe(3.8);
      expect(tta?.delta).toBe(0.3);
    }
  });

  it("não chama de 'ciclo anterior' uma avaliação de outro escopo", async () => {
    h.assessmentFindMany.mockResolvedValue([
      assessment({ scope: "team", scopeId: "team-atlas" }),
      // mesma competência, outro time: comparar os dois produz um delta que
      // não descreve evolução de ninguém
      assessment({
        score: 2.0,
        scope: "team",
        scopeId: "team-orion",
        assessedAt: new Date("2026-01-01"),
      }),
    ]);

    const r = await listCompetencyScores();
    expect(r.ok).toBe(true);
    if (r.ok) {
      const tta = r.data.find((c) => c.competency === "TEAM_TECHNICAL_AGILITY");
      expect(tta?.score).toBe(4.1);
      expect(tta?.prevScore).toBeNull();
      expect(tta?.delta).toBeNull();
    }
  });
});

describe("recordCompetencyAssessment", () => {
  const validInput = {
    competency: "TEAM_TECHNICAL_AGILITY",
    score: 4,
    scope: "art" as const,
    scopeId: "art-1",
  };

  it("é recusada quando o papel não conduz Measure & Grow (RBAC)", async () => {
    h.requireRole.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "nope");
    });
    const res = await recordCompetencyAssessment(validInput);
    expect(res.ok).toBe(false);
    expect(h.requireRole).toHaveBeenCalledWith(
      ["ADMIN", "RTE", "SM"],
      tenantCtx
    );
    expect(h.assessmentCreate).not.toHaveBeenCalled();
  });

  it("recusa competência fora das 7 do SAFe", async () => {
    const res = await recordCompetencyAssessment({
      ...validInput,
      competency: "VIBES",
    } as unknown as typeof validInput);
    expect(res.ok).toBe(false);
    expect(h.assessmentCreate).not.toHaveBeenCalled();
  });

  it("recusa nota fora da escala 1–5", async () => {
    const tooHigh = await recordCompetencyAssessment({
      ...validInput,
      score: 6,
    });
    expect(tooHigh.ok).toBe(false);
    const tooLow = await recordCompetencyAssessment({
      ...validInput,
      score: 0,
    });
    expect(tooLow.ok).toBe(false);
    expect(h.assessmentCreate).not.toHaveBeenCalled();
  });

  it("grava com o tenant da sessão, o avaliador da sessão, e audita", async () => {
    h.assessmentCreate.mockResolvedValue({ id: "ca-1" });

    const res = await recordCompetencyAssessment(validInput);
    expect(res.ok).toBe(true);

    const createArgs = h.assessmentCreate.mock.calls[0][0];
    expect(createArgs.data.tenantId).toBe(tenantCtx.tenantId);
    expect(createArgs.data.assessedById).toBe(tenantCtx.userId);
    expect(createArgs.data.competency).toBe("TEAM_TECHNICAL_AGILITY");
    expect(createArgs.data.score).toBe(4);

    const [tenantId, payload] = h.logAudit.mock.calls[0];
    expect(tenantId).toBe(tenantCtx.tenantId);
    expect(payload).toMatchObject({
      action: "created",
      entityType: "competency_assessment",
      entityId: "ca-1",
    });
    expect(h.revalidatePath).toHaveBeenCalledWith("/cosmos/measure");
  });
});

describe("listImprovementActions", () => {
  it("é tenant-scoped e devolve a taxa de conclusão com o denominador", async () => {
    h.actionFindMany.mockResolvedValue([
      {
        id: "a1",
        title: "Dojo de testes",
        status: "DONE",
        relatedMetric: null,
        dueDate: null,
        assessment: { competency: "TEAM_TECHNICAL_AGILITY" },
      },
      {
        id: "a2",
        title: "Revisar hipótese de valor",
        status: "OPEN",
        relatedMetric: null,
        dueDate: null,
        assessment: null,
      },
      {
        id: "a3",
        title: "Guia de aprendizagem",
        status: "CANCELLED",
        relatedMetric: null,
        dueDate: null,
        assessment: null,
      },
    ]);

    const r = await listImprovementActions();
    expect(r.ok).toBe(true);
    expect(h.actionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: tenantCtx.tenantId },
      })
    );
    if (r.ok) {
      expect(r.data.total).toBe(3);
      expect(r.data.done).toBe(1);
      // cancelada sai do denominador: ação abandonada não é ação pendente nem
      // ação concluída
      expect(r.data.completionPct).toBe(50);
      expect(r.data.items[0].competencyLabel).toBe("Team & Technical Agility");
    }
  });

  it("devolve taxa nula (não 0%) quando não há ação viva", async () => {
    h.actionFindMany.mockResolvedValue([]);

    const r = await listImprovementActions();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.completionPct).toBeNull();
    }
  });
});

describe("createImprovementAction", () => {
  const validInput = {
    title: "Rodar dojo de testes de contrato",
    scope: "art" as const,
    scopeId: "art-1",
  };

  it("é recusada quando o papel não conduz Measure & Grow (RBAC)", async () => {
    h.requireRole.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "nope");
    });
    const res = await createImprovementAction(validInput);
    expect(res.ok).toBe(false);
    expect(h.actionCreate).not.toHaveBeenCalled();
  });

  it("recusa avaliação de outro tenant sem gravar (guarda IDOR)", async () => {
    h.assessmentFindFirst.mockResolvedValue(null);
    const res = await createImprovementAction({
      ...validInput,
      assessmentId: "alheia",
    });
    expect(res.ok).toBe(false);
    expect(h.assessmentFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "alheia", tenantId: tenantCtx.tenantId },
      })
    );
    expect(h.actionCreate).not.toHaveBeenCalled();
  });

  it("grava com o tenant da sessão e audita", async () => {
    h.assessmentFindFirst.mockResolvedValue({ id: "ca-1" });
    h.actionCreate.mockResolvedValue({ id: "ia-1" });

    const res = await createImprovementAction({
      ...validInput,
      assessmentId: "ca-1",
    });
    expect(res.ok).toBe(true);

    const createArgs = h.actionCreate.mock.calls[0][0];
    expect(createArgs.data.tenantId).toBe(tenantCtx.tenantId);
    expect(createArgs.data.assessmentId).toBe("ca-1");
    expect(createArgs.data.status).toBe("OPEN");

    expect(h.logAudit).toHaveBeenCalled();
    expect(h.revalidatePath).toHaveBeenCalledWith("/cosmos/measure");
  });
});
