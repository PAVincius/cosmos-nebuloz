import { describe, expect, it } from "vitest";
import {
  computePortfolioRoi,
  computeRoi,
  fmtBRL,
  fmtMultiple,
  round1,
} from "@/lib/signal/roi";
import { byCode, INITIATIVES } from "../fixtures";

// As oito iniciativas do handoff, com os totais DERIVADOS das entradas.
// Divergência conhecida do mock (IN-031, desconto de atribuição em dobro) está
// documentada em `fixtures.ts` e verificada explicitamente no fim.

describe("computeRoi contra as fixtures do handoff", () => {
  it.each(
    INITIATIVES.map((i) => [i.code, i] as const)
  )("%s soma retorno e custo e devolve o múltiplo do handoff", (_code, fixture) => {
    const roi = computeRoi(fixture.roiEntries);
    expect(roi.returned).toBe(fixture.expected.returned);
    expect(roi.invested).toBe(fixture.expected.invested);
    expect(round1(roi.multiple as number)).toBe(fixture.expected.multiple);
  });

  it("devolve retorno líquido, negativo inclusive", () => {
    expect(computeRoi(byCode("IN-014").roiEntries).net).toBe(582_400);
    // Investiu R$ 240 mil e trouxe R$ 216 mil: prejuízo é informação.
    expect(computeRoi(byCode("IN-021").roiEntries).net).toBe(-24_020);
  });

  it("dá a cada passo a sua fatia do próprio lado, para a tela explicar a conta", () => {
    const roi = computeRoi(byCode("IN-014").roiEntries);
    const capacity = roi.steps.find((s) => s.label === "Capacidade liberada");
    expect(capacity?.share).toBeCloseTo(362_320 / 764_400, 6);
    const licenses = roi.steps.find((s) => s.label === "Licenças de IA");
    expect(licenses?.share).toBeCloseTo(96_000 / 182_000, 6);
  });

  it("carrega a fonte em cada passo — número sem origem não é rastreável", () => {
    const roi = computeRoi(byCode("IN-014").roiEntries);
    expect(roi.steps.every((s) => s.sourceLabel.length > 0)).toBe(true);
  });
});

describe("computeRoi nos limites", () => {
  it("iniciativa em rascunho: sem entradas, tudo zero e múltiplo 0", () => {
    const roi = computeRoi([]);
    expect(roi).toMatchObject({
      invested: 0,
      returned: 0,
      multiple: 0,
      net: 0,
    });
    expect(roi.steps).toEqual([]);
  });

  it("retorno sem custo devolve múltiplo NULO, não infinito", () => {
    // Infinito na tela quer dizer "esqueceram de lançar o custo", não "retorno
    // ilimitado". Nulo obriga a UI a dizer que falta dado.
    const roi = computeRoi([
      {
        kind: "RETURN",
        label: "Horas economizadas",
        total: 50_000,
        sourceLabel: "Jira",
      },
    ]);
    expect(roi.multiple).toBeNull();
    expect(Number.isFinite(roi.multiple as number)).toBe(false);
  });

  it("componente de valor zero não quebra a fatia nem o total", () => {
    const roi = computeRoi([
      { kind: "RETURN", label: "Nada ainda", total: 0, sourceLabel: "Jira" },
      { kind: "COST", label: "Licenças", total: 10_000, sourceLabel: "Sheets" },
    ]);
    expect(roi.returned).toBe(0);
    expect(roi.multiple).toBe(0);
    expect(roi.steps[0]?.share).toBe(0);
  });

  it("só custo, sem retorno: múltiplo 0 — investiu e não voltou nada", () => {
    const roi = computeRoi([
      { kind: "COST", label: "Licenças", total: 10_000, sourceLabel: "Sheets" },
    ]);
    expect(roi.multiple).toBe(0);
    expect(roi.net).toBe(-10_000);
  });
});

describe("agregado de portfólio", () => {
  it("soma os dois lados antes de dividir, em vez de tirar média de múltiplos", () => {
    // Média dos múltiplos daria (4,0 + 0,5) / 2 = 2,25 e faria uma iniciativa
    // de R$ 10 mil pesar igual a uma de R$ 1 mi.
    const agg = computePortfolioRoi([
      { invested: 10_000, returned: 40_000 },
      { invested: 1_000_000, returned: 500_000 },
    ]);
    expect(agg.invested).toBe(1_010_000);
    expect(agg.returned).toBe(540_000);
    expect(agg.multiple).toBeCloseTo(540_000 / 1_010_000, 6);
    expect(agg.multiple).toBeLessThan(1);
  });

  it("portfólio vazio não divide por zero", () => {
    expect(computePortfolioRoi([])).toEqual({
      invested: 0,
      returned: 0,
      multiple: 0,
    });
  });
});

describe("formatação", () => {
  it("abrevia BRL como o handoff", () => {
    expect(fmtBRL(764_400)).toBe("R$ 764 mil");
    expect(fmtBRL(1_204_000)).toBe("R$ 1,20 mi");
    expect(fmtBRL(840)).toBe("R$ 840");
    // Líquido negativo: o sinal antes do símbolo, e é o menos de verdade.
    expect(fmtBRL(-24_000)).toBe("−R$ 24 mil");
    expect(fmtBRL(-1_204_000)).toBe("−R$ 1,20 mi");
  });

  it("usa vírgula decimal no múltiplo", () => {
    expect(fmtMultiple(4.2)).toBe("4,2×");
  });

  it("mostra travessão para múltiplo nulo, nunca 0,0×", () => {
    // "0,0×" afirmaria ausência de retorno; o que falta é o custo.
    expect(fmtMultiple(null)).toBe("—");
  });
});

describe("divergência conhecida do mock", () => {
  it("IN-031: o derivado é 2,7× e o headline do handoff dizia 2,4×", () => {
    const fixture = byCode("IN-031");
    const roi = computeRoi(fixture.roiEntries);
    expect(round1(roi.multiple as number)).toBe(2.7);
    // O mock aplicava a atribuição de 70% no total, além do ×0,70 que já estava
    // dentro do mapeamento MP-04 — desconto em dobro.
    expect(fixture.mockHeadline?.multiple).toBe(2.4);
  });
});
