import { beforeEach, describe, expect, it, vi } from "vitest";

// getDivergence — FR-017 (divergência lado a lado). Sem cobertura até aqui.
// O que este arquivo trava: cada resposta divergente carrega a evidência que
// o próprio respondente anexou (id + nome do arquivo), não só uma contagem —
// é o que permite "Ver evidência" na revisão sem uma segunda ida ao banco.

const h = vi.hoisted(() => ({
  requirePerm: vi.fn(),
  responseFindMany: vi.fn(),
}));

vi.mock("@/lib/meridian/guards", () => ({
  requireMeridianContext: vi.fn(),
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
vi.mock("@repo/database", () => ({
  withTenantDb: (_t: string, fn: (db: unknown) => unknown) =>
    fn({ meridianResponse: { findMany: h.responseFindMany } }),
}));

import { getDivergence } from "@/app/(meridian)/actions/scoring";

const CTX = { tenantId: "t1", userId: "u1", role: "ADMIN" };

beforeEach(() => {
  vi.clearAllMocks();
  h.requirePerm.mockResolvedValue(CTX);
});

describe("getDivergence — evidência por resposta", () => {
  it("carrega id e fileName da evidência anexada a cada resposta divergente", async () => {
    h.responseFindMany.mockResolvedValue([
      {
        rawValue: 3,
        normalized: "0.750",
        respondent: { name: "Jonas Reis", role: "Eng. de Dados" },
        question: {
          code: "Q-D01",
          text: "Qual a cobertura de linhagem?",
          type: "LIKERT",
          scaleLabels: null,
          ordinal: 1,
        },
        evidence: [{ id: "ev1", fileName: "catalogo.xlsx" }],
      },
      {
        rawValue: 0,
        normalized: "0.000",
        respondent: { name: "Ana Kim", role: "Analista de BI" },
        question: {
          code: "Q-D01",
          text: "Qual a cobertura de linhagem?",
          type: "LIKERT",
          scaleLabels: null,
          ordinal: 1,
        },
        evidence: [],
      },
    ]);

    const res = await getDivergence({
      assessmentId: "clx0000000000000000000as1",
      axis: "DATA",
    });
    expect(res.ok).toBe(true);
    const row = res.ok ? res.data[0] : undefined;
    expect(row?.evidenceCount).toBe(1);
    expect(row?.answers[0]?.evidence).toEqual([
      { id: "ev1", fileName: "catalogo.xlsx" },
    ]);
    expect(row?.answers[1]?.evidence).toEqual([]);
  });

  it("evidenceCount soma a evidência de todos os respondentes da pergunta", async () => {
    h.responseFindMany.mockResolvedValue([
      {
        rawValue: 3,
        normalized: "0.750",
        respondent: { name: "Jonas Reis", role: "Eng. de Dados" },
        question: {
          code: "Q-D01",
          text: "Q",
          type: "LIKERT",
          scaleLabels: null,
          ordinal: 1,
        },
        evidence: [
          { id: "ev1", fileName: "a.pdf" },
          { id: "ev2", fileName: "b.pdf" },
        ],
      },
      {
        rawValue: 0,
        normalized: "0.000",
        respondent: { name: "Ana Kim", role: "Analista de BI" },
        question: {
          code: "Q-D01",
          text: "Q",
          type: "LIKERT",
          scaleLabels: null,
          ordinal: 1,
        },
        evidence: [{ id: "ev3", fileName: "c.pdf" }],
      },
    ]);

    const res = await getDivergence({
      assessmentId: "clx0000000000000000000as1",
      axis: "DATA",
    });
    expect(res.ok && res.data[0]?.evidenceCount).toBe(3);
  });
});
