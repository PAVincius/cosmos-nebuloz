import { beforeEach, describe, expect, it, vi } from "vitest";

// Carteira e criação de assessment — FR-001/FR-006.
//
// Duas coisas que este arquivo trava: o filtro de tenant vem da sessão e nunca
// do input, e criar um assessment congela a versão do template.

const h = vi.hoisted(() => ({
  requireCtx: vi.fn(),
  requirePerm: vi.fn(),
  assessmentFindMany: vi.fn(),
  assessmentFindFirst: vi.fn(),
  assessmentCreate: vi.fn(),
  responseGroupBy: vi.fn(),
  responseCount: vi.fn(),
  respondentFindMany: vi.fn(),
  templateFindFirst: vi.fn(),
  templateFindMany: vi.fn(),
  templateUpdate: vi.fn(),
  sequenceUpsert: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("@/lib/meridian/guards", () => ({
  requireMeridianContext: h.requireCtx,
  requireMeridianPermissionContext: h.requirePerm,
  MeridianRuleError: class extends Error {
    rule: string;
    status = 422;
    constructor(rule: string, message: string) {
      super(message);
      this.rule = rule;
    }
  },
  StateConflictError: class extends Error {
    rule: string;
    status = 409;
    blockers: string[];
    constructor(rule: string, message: string, blockers: string[] = []) {
      super(message);
      this.rule = rule;
      this.blockers = blockers;
    }
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@repo/database", () => ({
  withTenantDb: (_t: string, fn: (db: unknown) => unknown) =>
    fn({
      meridianAssessment: {
        findMany: h.assessmentFindMany,
        findFirst: h.assessmentFindFirst,
        create: h.assessmentCreate,
      },
      meridianResponse: {
        groupBy: h.responseGroupBy,
        count: h.responseCount,
      },
      meridianRespondent: { findMany: h.respondentFindMany },
      meridianTemplate: {
        findFirst: h.templateFindFirst,
        findMany: h.templateFindMany,
        update: h.templateUpdate,
      },
      meridianSequence: { upsert: h.sequenceUpsert },
      auditLog: { create: h.auditCreate },
    }),
}));

import {
  createAssessment,
  listAssessments,
  listTemplates,
} from "@/app/(meridian)/actions/assessments";

const CTX = {
  tenantId: "t1",
  userId: "u1",
  role: "ADMIN",
  meridianRole: "CONSULTANT",
  user: { name: "Marina", email: "m@x.com" },
};
const TPL_ID = "clx000000000000000000tpl1";

const ROW = {
  id: "a1",
  code: "AS-104",
  orgName: "Vanta Saúde",
  sector: "Saúde",
  sizeBand: "200–1.000",
  status: "REVIEW",
  deadline: new Date("2026-08-01"),
  openedAt: new Date("2026-07-14"),
  consultantId: "u1",
  benchmarkOptIn: true,
  reassessmentOfId: null,
  template: { version: "v3.2", questions: [{ axis: "DATA" }] },
  reassessmentOf: null,
  respondents: [{ axis: "DATA" }],
  scores: [
    {
      axis: "DATA",
      computed: 46,
      final: null,
      confidence: 0.58,
      respondentCount: 2,
      spread: 31,
      status: "CONTESTED",
      note: "Discordância alta",
    },
  ],
  _count: { evidence: 31 },
};

beforeEach(() => {
  vi.clearAllMocks();
  h.requireCtx.mockResolvedValue(CTX);
  h.requirePerm.mockResolvedValue(CTX);
  h.assessmentFindMany.mockResolvedValue([ROW]);
  h.responseGroupBy.mockResolvedValue([
    { respondentId: "r1", _count: { _all: 5 } },
  ]);
  h.respondentFindMany.mockResolvedValue([{ id: "r1", assessmentId: "a1" }]);
  h.sequenceUpsert.mockResolvedValue({ next: 105 });
  h.assessmentCreate.mockResolvedValue({ id: "a2", code: "AS-104" });
  h.templateUpdate.mockResolvedValue({});
  h.auditCreate.mockResolvedValue({});
  h.templateFindMany.mockResolvedValue([
    { id: TPL_ID, name: "Diagnose padrão", version: "v3.2" },
  ]);
});

describe("listTemplates", () => {
  it("filtra pelo tenant da sessão", async () => {
    await listTemplates();
    const args = h.templateFindMany.mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
    };
    expect(args.where.tenantId).toBe("t1");
  });

  it("devolve id, nome e versão", async () => {
    const res = await listTemplates();
    expect(res.ok).toBe(true);
    expect(res.ok && res.data[0]).toEqual({
      id: TPL_ID,
      name: "Diagnose padrão",
      version: "v3.2",
    });
  });

  it("exige a permissão de conduzir assessment", async () => {
    h.requirePerm.mockRejectedValue(new Error("Requer papel Consultor"));
    const res = await listTemplates();
    expect(res.ok).toBe(false);
    expect(h.templateFindMany).not.toHaveBeenCalled();
  });
});

describe("listAssessments", () => {
  it("filtra pelo tenant da sessão, nunca por um vindo do input", async () => {
    await listAssessments({});
    const args = h.assessmentFindMany.mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
    };
    expect(args.where.tenantId).toBe("t1");
  });

  it("aplica o filtro de status quando informado", async () => {
    await listAssessments({ status: "COLLECTING" });
    const args = h.assessmentFindMany.mock.calls[0]?.[0] as {
      where: { status?: string };
    };
    expect(args.where.status).toBe("COLLECTING");
  });

  it("não passa status quando o filtro é 'todos'", async () => {
    await listAssessments({});
    const args = h.assessmentFindMany.mock.calls[0]?.[0] as {
      where: { status?: string };
    };
    expect(args.where.status).toBeUndefined();
  });

  it("agrega as respostas por assessment, sem N+1", async () => {
    const res = await listAssessments({});
    expect(res.ok).toBe(true);
    expect(res.ok && res.data[0]?.responses.done).toBe(5);
    expect(h.responseGroupBy).toHaveBeenCalledTimes(1);
  });

  it("devolve composite nulo quando faltam eixos", async () => {
    const res = await listAssessments({});
    // ROW tem só um eixo pontuado — composite exige os cinco.
    expect(res.ok && res.data[0]?.composite).toBeNull();
  });

  it("devolve scores nulos quando o scoring ainda não rodou", async () => {
    h.assessmentFindMany.mockResolvedValue([{ ...ROW, scores: [] }]);
    const res = await listAssessments({});
    expect(res.ok && res.data[0]?.scores).toBeNull();
  });
});

describe("createAssessment", () => {
  const input = {
    orgName: "Helix Agro",
    sector: "Agronegócio",
    sizeBand: "200–1.000",
    templateId: TPL_ID,
    deadline: "2026-09-15T00:00:00.000Z",
    benchmarkOptIn: true,
  };

  it("congela a versão do template no primeiro uso", async () => {
    h.templateFindFirst.mockResolvedValue({
      id: TPL_ID,
      version: "v3.2",
      lockedAt: null,
    });
    const res = await createAssessment(input);
    expect(res.ok).toBe(true);
    expect(h.templateUpdate).toHaveBeenCalledTimes(1);
    const update = h.templateUpdate.mock.calls[0]?.[0] as {
      data: { lockedAt: Date };
    };
    expect(update.data.lockedAt).toBeInstanceOf(Date);
  });

  it("não recongela um template já em uso", async () => {
    h.templateFindFirst.mockResolvedValue({
      id: TPL_ID,
      version: "v3.2",
      lockedAt: new Date("2026-01-01"),
    });
    await createAssessment(input);
    expect(h.templateUpdate).not.toHaveBeenCalled();
  });

  it("recusa template de outra organização", async () => {
    h.templateFindFirst.mockResolvedValue(null);
    const res = await createAssessment(input);
    expect(res.ok).toBe(false);
    expect(h.assessmentCreate).not.toHaveBeenCalled();
  });

  it("nasce em DRAFT e grava a trilha", async () => {
    h.templateFindFirst.mockResolvedValue({
      id: TPL_ID,
      version: "v3.2",
      lockedAt: null,
    });
    await createAssessment(input);
    expect(h.auditCreate).toHaveBeenCalledTimes(1);
    const audit = h.auditCreate.mock.calls[0]?.[0] as {
      data: { action: string; diff: unknown };
    };
    expect(audit.data.action).toBe("meridian.assessment.create");
    expect(audit.data.diff).toEqual([["Status", "—", "DRAFT"]]);
  });

  it("exige a permissão de conduzir assessment", async () => {
    h.requirePerm.mockRejectedValue(new Error("Requer papel Consultor"));
    const res = await createAssessment(input);
    expect(res.ok).toBe(false);
    expect(h.assessmentCreate).not.toHaveBeenCalled();
  });
});
