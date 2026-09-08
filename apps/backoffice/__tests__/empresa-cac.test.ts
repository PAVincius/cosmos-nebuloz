// empresa-cac.test.ts — "sem número, sem chute": com 7 de 8 o CAC é nulo.
import { describe, expect, it } from "vitest";
import {
  calcularCac,
  type ParcelasCac,
  pesosSomam100,
} from "../lib/empresa/cac";

// O exemplo de cac-modelo.md §3, marcado lá como hipótese: 40.500 ÷ 2.
const CHEIO: ParcelasCac = {
  "4.1": 1_500_000,
  "4.2": 1_000_000,
  "4.3": 0,
  "4.4": 150_000,
  "4.5": 200_000,
  "4.6": 600_000,
  entregaDiagnosticoCentavos: 600_000,
  clientesGanhos: 2,
};

describe("calcularCac", () => {
  it("com todas as parcelas, divide o total pelos clientes ganhos", () => {
    const r = calcularCac(CHEIO, [], null);
    expect(r.preenchidas).toBe(8);
    expect(r.cacCentavos).toBe(2_025_000);
  });

  it("zero é preenchido; nulo não", () => {
    const r = calcularCac({ ...CHEIO, "4.5": null }, [], null);
    expect(r.preenchidas).toBe(7);
    expect(r.cacCentavos).toBeNull();
    expect(r.paybackMeses).toBeNull();
  });

  it("zero clientes ganhos não divide", () => {
    const r = calcularCac({ ...CHEIO, clientesGanhos: 0 }, [], null);
    expect(r.preenchidas).toBe(8);
    expect(r.cacCentavos).toBeNull();
  });

  it("rateia por produto pelo peso", () => {
    const r = calcularCac(
      CHEIO,
      [
        { produto: "MERIDIAN", pesoPercent: 41 },
        { produto: "CHARTER", pesoPercent: 59 },
      ],
      null
    );
    expect(r.porProduto).toEqual([
      { produto: "MERIDIAN", pesoPercent: 41, cacCentavos: 830_250 },
      { produto: "CHARTER", pesoPercent: 59, cacCentavos: 1_194_750 },
    ]);
  });

  it("payback = CAC ÷ mensalidade de referência, com uma casa", () => {
    // 3.278 é a mensalidade líquida do Scale anual pela fórmula testada em
    // precificar.test.ts — aqui entra como parâmetro, não como constante.
    const r = calcularCac(CHEIO, [], 327_800);
    expect(r.paybackMeses).toBe(6.2);
  });

  it("sem mensalidade de referência, sem payback", () => {
    expect(calcularCac(CHEIO, [], null).paybackMeses).toBeNull();
  });
});

describe("pesosSomam100", () => {
  it("aceita 100, recusa o resto e a lista vazia", () => {
    expect(
      pesosSomam100([
        { produto: "A", pesoPercent: 60 },
        { produto: "B", pesoPercent: 40 },
      ])
    ).toBe(true);
    expect(pesosSomam100([{ produto: "A", pesoPercent: 60 }])).toBe(false);
    expect(pesosSomam100([])).toBe(false);
  });
});
