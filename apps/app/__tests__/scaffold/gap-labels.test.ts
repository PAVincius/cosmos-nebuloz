import { describe, expect, it } from "vitest";
import { gapEligibility, gapLabels } from "@/lib/scaffold/gap-labels";

// Vocabulário do Meridian na "Nova trilha". Sem tradução do que é escala da
// suíte (a confiança mantém MEASURED/ESTIMATED/DECLARED em pt-BR consistente
// com o resto do Scaffold), e regra clara de quando o gap vira trilha.

const gap = (promotion: unknown) => ({
  rank: 1,
  id: "g1",
  code: "G-01",
  statement: "x",
  axis: "PROCESS",
  severity: "HIGH",
  effort: "S",
  costOfDelay: 80,
  confidence: "MEASURED",
  state: "OPEN",
  assessmentId: "a1",
  assessmentCode: "AS-1",
  promotion,
});

describe("gapLabels", () => {
  it("gravidade, esforço e confiança por extenso", () => {
    expect(gapLabels(gap(null) as never)).toEqual({
      severity: "Gravidade alta",
      effort: "Esforço pequeno",
      confidence: "Confiança medida",
      costOfDelay: "Custo de atraso 80",
    });
  });

  it.each([
    {
      sev: "MEDIUM",
      eff: "M",
      conf: "ESTIMATED",
      expected: ["Gravidade média", "Esforço médio", "Confiança estimada"],
    },
    {
      sev: "LOW",
      eff: "L",
      conf: "DECLARED",
      expected: ["Gravidade baixa", "Esforço grande", "Confiança declarada"],
    },
  ])("$sev/$eff/$conf", ({ sev, eff, conf, expected }) => {
    const l = gapLabels({
      ...gap(null),
      severity: sev,
      effort: eff,
      confidence: conf,
    } as never);
    expect([l.severity, l.effort, l.confidence]).toEqual(expected);
  });
});

describe("gapEligibility", () => {
  it("promovido ao Scaffold e sem trilha: cria", () => {
    expect(
      gapEligibility(
        gap({ id: "p1", product: "SCAFFOLD", landed: false }) as never
      )
    ).toEqual({ eligible: true, promotionId: "p1", reason: null });
  });

  it("já aterrissou: já tem trilha", () => {
    const e = gapEligibility(
      gap({ id: "p1", product: "SCAFFOLD", landed: true }) as never
    );
    expect(e.eligible).toBe(false);
    expect(e.reason).toMatch(/já tem trilha/i);
  });

  it("promovido a outro produto", () => {
    const e = gapEligibility(
      gap({ id: "p1", product: "COSMOS", landed: false }) as never
    );
    expect(e.eligible).toBe(false);
    expect(e.reason).toMatch(/outro produto/i);
  });

  it("sem promoção: a promoção é do Meridian, e a razão diz onde resolver", () => {
    const e = gapEligibility(gap(null) as never);
    expect(e.eligible).toBe(false);
    expect(e.reason).toMatch(/meridian/i);
  });
});
