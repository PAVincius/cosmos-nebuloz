import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  computeDeclaredAxisScore,
  NEBULOZ_ASSESSMENT,
  NEBULOZ_ASSESSMENT_CODE,
  NEBULOZ_AXIS_SCORE_CONFIDENCE,
  NEBULOZ_AXIS_SCORE_NOTE,
  NEBULOZ_GAPS,
  NEBULOZ_PLAN,
  type NebulozAxis,
  type NebulozGap,
} from "../meridian-nebuloz";

// Dataset puro do Meridian da própria Nebuloz — sem banco, sem mock. Prova a
// regra de score declarada no cabeçalho do módulo e as invariantes que o
// script `apps/app/scripts/seed-meridian-nebuloz.ts` assume antes de gravar.

const EIXOS: NebulozAxis[] = [
  "DATA",
  "PROCESS",
  "PEOPLE",
  "GOVERNANCE",
  "INFRASTRUCTURE",
];

// __tests__ → src → provisioning → packages → raiz do monorepo.
const REPO_ROOT = path.resolve(__dirname, "../../../../");

function gap(overrides: Partial<NebulozGap>): NebulozGap {
  return {
    code: "N-XX",
    axis: "DATA",
    statement: "lacuna de teste (fonte §0).",
    severity: "LOW",
    effort: "S",
    costOfDelay: 10,
    confidence: "DECLARED",
    ownerLabel: "Ninguém",
    fonte: "docs/inexistente.md",
    ...overrides,
  };
}

describe("computeDeclaredAxisScore", () => {
  it("aplica a penalidade da severidade: HIGH 30, MEDIUM 15, LOW 5", () => {
    expect(computeDeclaredAxisScore("DATA", [gap({ severity: "HIGH" })])).toBe(
      70
    );
    expect(
      computeDeclaredAxisScore("DATA", [gap({ severity: "MEDIUM" })])
    ).toBe(85);
    expect(computeDeclaredAxisScore("DATA", [gap({ severity: "LOW" })])).toBe(
      95
    );
  });

  it("usa a média aritmética das lacunas do eixo, arredondada", () => {
    // (30 + 5) / 2 = 17,5 → 82,5 → 83 (Math.round arredonda .5 para cima).
    expect(
      computeDeclaredAxisScore("DATA", [
        gap({ severity: "HIGH" }),
        gap({ severity: "LOW" }),
      ])
    ).toBe(83);
    // (30 + 15 + 5) / 3 = 16,67 → 83,33 → 83.
    expect(
      computeDeclaredAxisScore("DATA", [
        gap({ severity: "HIGH" }),
        gap({ severity: "MEDIUM" }),
        gap({ severity: "LOW" }),
      ])
    ).toBe(83);
  });

  it("ignora lacunas de outros eixos", () => {
    const gaps = [
      gap({ axis: "DATA", severity: "HIGH" }),
      gap({ axis: "PROCESS", severity: "LOW" }),
      gap({ axis: "PROCESS", severity: "LOW" }),
    ];
    expect(computeDeclaredAxisScore("DATA", gaps)).toBe(70);
    expect(computeDeclaredAxisScore("PROCESS", gaps)).toBe(95);
  });

  it("devolve null quando o eixo não tem lacuna — o seed não grava score inventado", () => {
    expect(computeDeclaredAxisScore("PEOPLE", [])).toBeNull();
    expect(
      computeDeclaredAxisScore("PEOPLE", [gap({ axis: "DATA" })])
    ).toBeNull();
  });

  it("nunca sai de [0, 100] mesmo com severidade máxima em toda lacuna", () => {
    const soHigh = Array.from({ length: 50 }, () => gap({ severity: "HIGH" }));
    const score = computeDeclaredAxisScore("DATA", soHigh);
    expect(score).toBe(70);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("sem segundo argumento lê NEBULOZ_GAPS — mesmo resultado de passar o dataset", () => {
    for (const eixo of EIXOS) {
      expect(computeDeclaredAxisScore(eixo)).toBe(
        computeDeclaredAxisScore(eixo, NEBULOZ_GAPS)
      );
    }
  });

  it("no dataset real, cada eixo tem score e ele bate com a conta de cabeça", () => {
    // DATA: HIGH, MEDIUM, MEDIUM, HIGH, LOW → (30+15+15+30+5)/5 = 19 → 81.
    expect(computeDeclaredAxisScore("DATA")).toBe(81);
    // PEOPLE: HIGH, MEDIUM → 22,5 → 77,5 → 78.
    expect(computeDeclaredAxisScore("PEOPLE")).toBe(78);
    for (const eixo of EIXOS) {
      const score = computeDeclaredAxisScore(eixo);
      expect(score).not.toBeNull();
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});

describe("NEBULOZ_GAPS", () => {
  it("tem 29 lacunas com código único no padrão N-NN", () => {
    expect(NEBULOZ_GAPS).toHaveLength(29);
    const codes = NEBULOZ_GAPS.map((g) => g.code);
    expect(new Set(codes).size).toBe(29);
    for (const code of codes) {
      expect(code).toMatch(/^N-\d{2}$/);
    }
  });

  it("distribui por eixo como o cabeçalho documenta: 5 / 10 / 2 / 8 / 4", () => {
    const porEixo = (axis: NebulozAxis) =>
      NEBULOZ_GAPS.filter((g) => g.axis === axis).length;
    expect(porEixo("DATA")).toBe(5);
    expect(porEixo("PROCESS")).toBe(10);
    expect(porEixo("PEOPLE")).toBe(2);
    expect(porEixo("GOVERNANCE")).toBe(8);
    expect(porEixo("INFRASTRUCTURE")).toBe(4);
  });

  it("toda lacuna é DECLARED, com costOfDelay em [0, 100] e esforço S/M/L", () => {
    for (const g of NEBULOZ_GAPS) {
      expect(g.confidence).toBe("DECLARED");
      expect(g.costOfDelay).toBeGreaterThanOrEqual(0);
      expect(g.costOfDelay).toBeLessThanOrEqual(100);
      expect(["S", "M", "L"]).toContain(g.effort);
      expect(["HIGH", "MEDIUM", "LOW"]).toContain(g.severity);
    }
  });

  it("todo statement termina com a citação curta do documento entre parênteses", () => {
    for (const g of NEBULOZ_GAPS) {
      expect(g.statement, g.code).toMatch(/\([^()]+\)\.$/);
      expect(g.ownerLabel.trim().length, g.code).toBeGreaterThan(0);
    }
  });

  it("aponta `fonte` para um arquivo que existe no repositório", () => {
    for (const g of NEBULOZ_GAPS) {
      expect(
        existsSync(path.join(REPO_ROOT, g.fonte)),
        `fonte ausente: ${g.fonte} (${g.code})`
      ).toBe(true);
    }
  });
});

describe("NEBULOZ_PLAN", () => {
  it("são as doze lacunas de maior costOfDelay, em ordem decrescente", () => {
    const top12 = [...NEBULOZ_GAPS]
      .sort((a, b) => b.costOfDelay - a.costOfDelay)
      .slice(0, 12)
      .map((g) => g.code);

    expect(NEBULOZ_PLAN.map((p) => p.gapCode)).toEqual(top12);
  });

  it("três por trimestre, quatro trimestres, seq contínuo 1..12", () => {
    expect(NEBULOZ_PLAN.map((p) => p.seq)).toEqual(
      Array.from({ length: 12 }, (_, i) => i + 1)
    );
    for (const quarter of [1, 2, 3, 4]) {
      expect(NEBULOZ_PLAN.filter((p) => p.quarter === quarter)).toHaveLength(3);
    }
  });

  it("quarterLabel acompanha o quarter: Q4 de 2026 e Q1–Q3 de 2027", () => {
    const labelPorQuarter: Record<number, string> = {
      1: "2026-Q4",
      2: "2027-Q1",
      3: "2027-Q2",
      4: "2027-Q3",
    };
    for (const p of NEBULOZ_PLAN) {
      expect(p.quarterLabel).toBe(labelPorQuarter[p.quarter]);
      expect(p.capacityNote.startsWith(`${p.quarterLabel} — `)).toBe(true);
    }
  });

  it("toda capacityNote carrega a ressalva de RACI ainda aberta", () => {
    for (const p of NEBULOZ_PLAN) {
      expect(p.capacityNote).toContain(
        "sem função de entrega dedicada nem separação entre dono do SLA e quem executa"
      );
      expect(p.capacityNote).not.toContain("[[");
    }
  });
});

describe("NEBULOZ_ASSESSMENT e constantes de score", () => {
  it("o código do assessment é o mesmo exportado separadamente", () => {
    expect(NEBULOZ_ASSESSMENT.code).toBe(NEBULOZ_ASSESSMENT_CODE);
    expect(NEBULOZ_ASSESSMENT_CODE).toBe("AS-NEBULOZ-01");
  });

  it("abertura vem antes do prazo, ambos em ISO", () => {
    const openedAt = new Date(NEBULOZ_ASSESSMENT.openedAt);
    const deadline = new Date(NEBULOZ_ASSESSMENT.deadline);
    expect(Number.isNaN(openedAt.getTime())).toBe(false);
    expect(Number.isNaN(deadline.getTime())).toBe(false);
    expect(openedAt.getTime()).toBeLessThan(deadline.getTime());
  });

  it("confiança fixa fica na escala 0–1, perto do piso", () => {
    expect(NEBULOZ_AXIS_SCORE_CONFIDENCE).toBeGreaterThan(0);
    expect(NEBULOZ_AXIS_SCORE_CONFIDENCE).toBeLessThan(0.5);
  });

  it("a nota diz por extenso a tabela de penalidade e que não houve bateria", () => {
    expect(NEBULOZ_AXIS_SCORE_NOTE).toContain("HIGH 30");
    expect(NEBULOZ_AXIS_SCORE_NOTE).toContain("MEDIUM 15");
    expect(NEBULOZ_AXIS_SCORE_NOTE).toContain("LOW 5");
    expect(NEBULOZ_AXIS_SCORE_NOTE).toContain("Nenhuma resposta à bateria");
  });
});
