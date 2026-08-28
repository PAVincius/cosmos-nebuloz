// precificar.test.ts — a fórmula comercial (DATA-MODEL §3.1).
//
// Esta conta aparece em três lugares que não podem discordar: o preview que o
// cliente lê na call, o ACV do pipeline e a validação do servidor no envio.
// Por isso ela é uma função pura, e por isso os casos abaixo fixam o resultado
// em número, não em "algo maior que zero".
import { describe, expect, it } from "vitest";
import {
  type CatalogoParaPreco,
  precificarProposta,
} from "../lib/comercial/precificar";

const base: CatalogoParaPreco = {
  plano: { precoAssentoCentavos: 14_900, minimoAssentos: 25 },
  modulos: [],
  termo: { meses: 12, descontoPercent: 12 },
  addOns: [],
  servicos: [],
};

describe("precificarProposta", () => {
  it("cobra o mínimo do plano e sinaliza que aplicou", () => {
    const p = precificarProposta(base, { assentos: 15, descontoPercent: 0 });

    expect(p.assentosFaturados).toBe(25);
    expect(p.minimoAplicado).toBe(true);
    expect(p.assentosCentavos).toBe(25 * 14_900);
  });

  it("acima do mínimo, fatura o que foi pedido", () => {
    const p = precificarProposta(base, { assentos: 40, descontoPercent: 0 });

    expect(p.assentosFaturados).toBe(40);
    expect(p.minimoAplicado).toBe(false);
  });

  // A ordem é normativa. Invertida — comercial primeiro, prazo depois — este
  // mesmo caso fecha em outro número, e a comissão sai errada junto.
  it("aplica o desconto de prazo antes do comercial", () => {
    const p = precificarProposta(base, { assentos: 40, descontoPercent: 10 });

    const bruto = 40 * 14_900;
    expect(p.brutoMensalCentavos).toBe(bruto);
    expect(p.liquidoMensalCentavos).toBe(
      Math.round(Math.round(bruto * 0.88) * 0.9)
    );
  });

  it("soma o adicional mensal dos módulos ao bruto", () => {
    const p = precificarProposta(
      {
        ...base,
        modulos: [
          { moduloId: "CHARTER", precoMensalCentavos: 180_000 },
          { moduloId: "COSMOS", precoMensalCentavos: 0 },
        ],
      },
      { assentos: 25, descontoPercent: 0 }
    );

    expect(p.modulosCentavos).toBe(180_000);
    expect(p.brutoMensalCentavos).toBe(25 * 14_900 + 180_000);
  });

  it("separa add-on recorrente de setup de uma vez", () => {
    const p = precificarProposta(
      {
        ...base,
        addOns: [
          { precoCentavos: 90_000, recorrente: true },
          { precoCentavos: 650_000, recorrente: false },
        ],
      },
      { assentos: 25, descontoPercent: 0 }
    );

    expect(p.addOnsRecorrentesCentavos).toBe(90_000);
    expect(p.umaVezCentavos).toBe(650_000);
  });

  // Retainer é mensalidade; todo o resto do catálogo de serviço é projeto.
  it("retainer entra no recorrente; projeto entra no uma-vez", () => {
    const p = precificarProposta(
      {
        ...base,
        servicos: [
          { precoCentavos: 2_600_000, unidade: "RETAINER" },
          { precoCentavos: 4_800_000, unidade: "PROJETO" },
          { precoCentavos: 78_000, unidade: "HORA" },
        ],
      },
      { assentos: 25, descontoPercent: 0 }
    );

    expect(p.servicosRecorrentesCentavos).toBe(2_600_000);
    expect(p.umaVezCentavos).toBe(4_800_000 + 78_000);
  });

  // O desconto incide sobre a mensalidade, nunca sobre o setup: negociar
  // desconto no serviço de projeto é outra conversa, e outra linha.
  it("o setup de uma vez não recebe desconto", () => {
    const p = precificarProposta(
      { ...base, addOns: [{ precoCentavos: 650_000, recorrente: false }] },
      { assentos: 25, descontoPercent: 30 }
    );

    expect(p.umaVezCentavos).toBe(650_000);
  });

  it("ACV é doze meses do líquido; TCV segue o prazo e soma o uma-vez", () => {
    const p = precificarProposta(
      { ...base, addOns: [{ precoCentavos: 650_000, recorrente: false }] },
      { assentos: 40, descontoPercent: 0 }
    );

    expect(p.acvCentavos).toBe(p.liquidoMensalCentavos * 12);
    expect(p.tcvCentavos).toBe(p.liquidoMensalCentavos * 12 + 650_000);
  });

  it("no mensal, TCV é um mês mais o setup", () => {
    const p = precificarProposta(
      { ...base, termo: { meses: 1, descontoPercent: 0 } },
      { assentos: 25, descontoPercent: 0 }
    );

    expect(p.tcvCentavos).toBe(p.liquidoMensalCentavos);
    expect(p.descontoDePrazoCentavos).toBe(0);
  });

  // As linhas de desconto são o que o cliente lê no documento. Se elas não
  // fecham com o total, a conversa vira disputa.
  it("as linhas de desconto reconstroem o líquido", () => {
    const p = precificarProposta(base, { assentos: 37, descontoPercent: 8 });

    expect(
      p.brutoMensalCentavos -
        p.descontoDePrazoCentavos -
        p.descontoComercialCentavos
    ).toBe(p.liquidoMensalCentavos);
  });

  it("devolve inteiro em todo campo de dinheiro", () => {
    const p = precificarProposta(base, { assentos: 33, descontoPercent: 7 });

    for (const valor of [
      p.brutoMensalCentavos,
      p.descontoDePrazoCentavos,
      p.descontoComercialCentavos,
      p.liquidoMensalCentavos,
      p.acvCentavos,
      p.tcvCentavos,
    ]) {
      expect(Number.isInteger(valor)).toBe(true);
    }
  });
});
