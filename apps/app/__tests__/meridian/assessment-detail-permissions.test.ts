import { beforeEach, describe, expect, it, vi } from "vitest";

// Detalhe do assessment: o servidor diz ao cliente o que o papel pode fazer
// (finalizar/reabrir = assessment.manage; confirmar o computado = override.write)
// e quando o assessment foi reaberto (FR-029e). A tela esconde o controle sem
// a permissão (decisão do Crivo no #334); o servidor segue recusando.

const h = vi.hoisted(() => ({
  requireCtx: vi.fn(),
  assessmentFindFirst: vi.fn(),
  responseCount: vi.fn(),
  auditFindFirst: vi.fn(),
}));

vi.mock("@/lib/meridian/guards", () => ({
  requireMeridianContext: h.requireCtx,
  requireMeridianPermissionContext: h.requireCtx,
  MeridianRuleError: class extends Error {
    rule: string;
    constructor(rule: string, message: string) {
      super(message);
      this.rule = rule;
    }
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@repo/database", () => ({
  withTenantDb: (_t: string, fn: (db: unknown) => unknown) =>
    fn({
      meridianAssessment: { findFirst: h.assessmentFindFirst },
      meridianResponse: { count: h.responseCount },
      auditLog: { findFirst: h.auditFindFirst },
    }),
}));

import { getAssessment } from "@/app/(meridian)/actions/assessments";

const AS_ID = "clx0000000000000000000as1";
const ctxOf = (meridianRole: string) => ({
  tenantId: "t1",
  userId: "u1",
  role: "ADMIN",
  meridianRole,
  user: { name: "Marina", email: "m@x.com" },
});

const ROW = {
  id: AS_ID,
  code: "AS-104",
  orgName: "Vanta Saúde",
  sector: "Saúde",
  sizeBand: "200–1.000",
  status: "REVIEW",
  deadline: new Date("2026-08-01"),
  openedAt: new Date("2026-07-14"),
  closedAt: null,
  consultantId: "u1",
  benchmarkOptIn: false,
  reassessmentOfId: null,
  template: {
    version: "v3.2",
    contestedSpread: 25,
    gapThreshold: 60,
    questions: [{ axis: "DATA" }],
  },
  reassessmentOf: null,
  respondents: [],
  scores: [],
  overrides: [],
  planItems: [],
  _count: { evidence: 0 },
};

beforeEach(() => {
  vi.clearAllMocks();
  h.assessmentFindFirst.mockResolvedValue(ROW);
  h.responseCount.mockResolvedValue(0);
  h.auditFindFirst.mockResolvedValue(null);
});

describe("getAssessment — permissões do papel", () => {
  it.each([
    ["CONSULTANT", { manage: true, override: true }],
    ["REVIEWER", { manage: false, override: true }],
    ["VIEWER", { manage: false, override: false }],
  ])("%s", async (role, expected) => {
    h.requireCtx.mockResolvedValue(ctxOf(role));
    const res = await getAssessment({ id: AS_ID });
    expect(res.ok && res.data.permissions).toEqual(expected);
  });
});

describe("getAssessment — reaberto (FR-029e)", () => {
  it("expõe quando foi reaberto, pela última reabertura auditada", async () => {
    h.requireCtx.mockResolvedValue(ctxOf("CONSULTANT"));
    h.auditFindFirst.mockResolvedValue({
      createdAt: new Date("2026-09-30T12:00:00.000Z"),
    });
    const res = await getAssessment({ id: AS_ID });
    expect(res.ok && res.data.reopenedAt).toBe("2026-09-30T12:00:00.000Z");
    const args = h.auditFindFirst.mock.calls[0][0];
    expect(args.where).toEqual({
      tenantId: "t1",
      entityType: "meridian.assessment",
      entityId: AS_ID,
      action: "meridian.assessment.reopen",
    });
    expect(args.orderBy).toEqual({ createdAt: "desc" });
  });

  it("nunca reaberto: reopenedAt é nulo", async () => {
    h.requireCtx.mockResolvedValue(ctxOf("CONSULTANT"));
    const res = await getAssessment({ id: AS_ID });
    expect(res.ok && res.data.reopenedAt).toBeNull();
  });
});

// Confirmar o computado (D-29): o detalhe diz quais eixos foram confirmados
// pelo revisor — a linha tem kind = CONFIRMATION e o eixo não foi sobrescrito
// depois — e entrega o kind de cada linha do histórico.
describe("getAssessment — eixo confirmado pelo revisor", () => {
  const score = (axis: string, status: string) => ({
    axis,
    computed: 61,
    final: null,
    confidence: 0.8,
    respondentCount: 2,
    spread: 30,
    status,
    note: null,
  });
  const row = (
    axis: string,
    kind: string,
    over: Record<string, unknown> = {}
  ) => ({
    id: `ov-${axis}-${kind}`,
    code: "OV-1",
    axis,
    kind,
    fromScore: 61,
    toScore: kind === "CONFIRMATION" ? 61 : 70,
    rationale: "Justificativa com mais de vinte caracteres.",
    reviewerId: "u2",
    createdAt: new Date("2026-09-30T10:00:00.000Z"),
    ...over,
  });

  beforeEach(() => h.requireCtx.mockResolvedValue(ctxOf("CONSULTANT")));

  it("eixo com linha CONFIRMATION e sem override depois: confirmed = true", async () => {
    h.assessmentFindFirst.mockResolvedValue({
      ...ROW,
      scores: [score("DATA", "COMPUTED"), score("PEOPLE", "COMPUTED")],
      overrides: [row("DATA", "CONFIRMATION")],
    });
    const res = await getAssessment({ id: AS_ID });
    const byAxis = res.ok
      ? Object.fromEntries(
          (res.data.scores ?? []).map((s) => [s.axis, s.confirmed])
        )
      : {};
    expect(byAxis).toEqual({ DATA: true, PEOPLE: false });
  });

  it("eixo confirmado e depois sobrescrito: vale o override (confirmed = false)", async () => {
    h.assessmentFindFirst.mockResolvedValue({
      ...ROW,
      scores: [score("DATA", "OVERRIDDEN")],
      overrides: [row("DATA", "CONFIRMATION"), row("DATA", "OVERRIDE")],
    });
    const res = await getAssessment({ id: AS_ID });
    expect(res.ok && res.data.scores?.[0]?.confirmed).toBe(false);
  });

  it("uma linha OVERRIDE nunca conta como confirmação", async () => {
    h.assessmentFindFirst.mockResolvedValue({
      ...ROW,
      scores: [score("DATA", "OVERRIDDEN")],
      overrides: [row("DATA", "OVERRIDE")],
    });
    const res = await getAssessment({ id: AS_ID });
    expect(res.ok && res.data.scores?.[0]?.confirmed).toBe(false);
  });

  it("o histórico traz o kind de cada linha", async () => {
    h.assessmentFindFirst.mockResolvedValue({
      ...ROW,
      scores: [score("DATA", "OVERRIDDEN")],
      overrides: [row("DATA", "CONFIRMATION"), row("DATA", "OVERRIDE")],
    });
    const res = await getAssessment({ id: AS_ID });
    expect(res.ok && res.data.overrides.map((o) => o.kind)).toEqual([
      "CONFIRMATION",
      "OVERRIDE",
    ]);
  });
});
