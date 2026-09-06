// empresa-financeiro.test.ts — as linhas calculadas fecham sozinhas, e uma
// linha agregada só existe quando todas as contas dela existem no mês.
import { describe, expect, it } from "vitest";
import {
  calcularCaixa,
  calcularDre,
  competenciasAte,
  competenciaValida,
  janelaDe13,
  referenciaPipeline,
  segundaFeira,
  semanaVazia,
  somarMeses,
} from "../lib/empresa/financeiro";

function linha(dre: ReturnType<typeof calcularDre>, id: string) {
  const l = dre.find((x) => x.id === id);
  if (!l) throw new Error(`linha ${id} ausente`);
  return l;
}

const MES_CHEIO: Record<string, number> = {
  "1.1": 100,
  "1.2": 200,
  "1.3": 300,
  "1.4": 0,
  "1.5": 400,
  "1.6": 500,
  "1.7": 50,
  "1.8": 50,
  "2.1": 100,
  "2.2": 0,
  "3.1": 100,
  "3.2": 100,
  "3.3": 50,
  "3.4": 0,
  "3.5": 50,
  "4.1": 100,
  "4.2": 100,
  "4.3": 0,
  "4.4": 10,
  "4.5": 10,
  "4.6": 30,
  "5.1": 200,
  "5.2": 150,
  "5.3": 50,
  "6.1": 100,
  "6.2": 20,
  "6.3": 30,
};

describe("calcularDre", () => {
  it("fecha receita bruta, líquida, margem e EBITDA", () => {
    const dre = calcularDre(MES_CHEIO);
    expect(linha(dre, "receita-bruta").valorCentavos).toBe(1600);
    expect(linha(dre, "deducoes").valorCentavos).toBe(100);
    expect(linha(dre, "receita-liquida").valorCentavos).toBe(1500);
    expect(linha(dre, "custo-total").valorCentavos).toBe(300);
    expect(linha(dre, "margem-bruta").valorCentavos).toBe(1200);
    expect(linha(dre, "margem-bruta-pct").percent).toBe(80);
    expect(linha(dre, "comercial").valorCentavos).toBe(250);
    expect(linha(dre, "despesas-total").valorCentavos).toBe(800);
    expect(linha(dre, "ebitda").valorCentavos).toBe(400);
    expect(linha(dre, "ebitda-pct").percent).toBe(27);
  });

  it("linha agregada com conta faltando fica nula, e puxa os totais junto", () => {
    const { "1.8": _omitida, ...semUmaConta } = MES_CHEIO;
    const dre = calcularDre(semUmaConta);
    expect(linha(dre, "serv-outros").valorCentavos).toBeNull();
    expect(linha(dre, "receita-bruta").valorCentavos).toBeNull();
    expect(linha(dre, "ebitda").valorCentavos).toBeNull();
    // As linhas que não dependem dela seguem calculadas.
    expect(linha(dre, "custo-total").valorCentavos).toBe(300);
  });

  it("mês vazio é tudo nulo, sem lançar", () => {
    const dre = calcularDre({});
    expect(dre.every((l) => l.valorCentavos === null)).toBe(true);
  });

  it("percentual é nulo quando a receita líquida é zero", () => {
    const zero = Object.fromEntries(Object.keys(MES_CHEIO).map((k) => [k, 0]));
    const dre = calcularDre(zero);
    expect(linha(dre, "ebitda-pct").percent).toBeNull();
  });
});

describe("somarMeses", () => {
  it("soma linha a linha e propaga nulo", () => {
    const a = calcularDre(MES_CHEIO);
    const b = calcularDre({});
    const tri = somarMeses([a, a, a]);
    expect(linha(tri, "ebitda").valorCentavos).toBe(1200);
    expect(linha(somarMeses([a, b]), "ebitda").valorCentavos).toBeNull();
  });
});

describe("competências", () => {
  it("lista as n competências até a final", () => {
    expect(competenciasAte("2026-09", 3)).toEqual([
      "2026-07",
      "2026-08",
      "2026-09",
    ]);
    expect(competenciasAte("2026-01", 2)).toEqual(["2025-12", "2026-01"]);
  });
  it("valida o formato", () => {
    expect(competenciaValida("2026-09")).toBe(true);
    expect(competenciaValida("2026-13")).toBe(false);
    expect(competenciaValida("2026-9")).toBe(false);
  });
});

describe("caixa", () => {
  it("segunda-feira da semana, em UTC", () => {
    expect(segundaFeira(new Date("2026-09-05T10:00:00Z"))).toBe("2026-08-31"); // sábado
    expect(segundaFeira(new Date("2026-09-06T10:00:00Z"))).toBe("2026-08-31"); // domingo
    expect(segundaFeira(new Date("2026-09-07T10:00:00Z"))).toBe("2026-09-07"); // segunda
  });

  it("janela de 13 começa na segunda corrente", () => {
    const j = janelaDe13(new Date("2026-09-05T10:00:00Z"));
    expect(j).toHaveLength(13);
    expect(j[0]).toBe("2026-08-31");
    expect(j[12]).toBe("2026-11-23");
  });

  it("encadeia o saldo e respeita o saldo de extrato da semana 1", () => {
    const s1 = {
      ...semanaVazia("2026-08-31"),
      saldoInicialCentavos: 1000,
      recebiveisCentavos: 500,
      contratosAssinadosCentavos: 0,
      pipelinePonderadoCentavos: 0,
      saidasPessoalCentavos: 300,
      saidasFornecedoresCentavos: 0,
      saidasComercialCentavos: 0,
      saidasImpostosCentavos: 0,
      saidasOutrasCentavos: 0,
    };
    const s2 = {
      ...s1,
      semanaInicio: "2026-09-07",
      saldoInicialCentavos: null,
      recebiveisCentavos: 100,
    };
    const [c1, c2] = calcularCaixa([s1, s2]);
    expect(c1.saldoFinalCentavos).toBe(1200);
    expect(c2.saldoInicialEfetivoCentavos).toBe(1200);
    expect(c2.saldoFinalCentavos).toBe(1000);
  });

  it("semana 1 sem saldo de extrato deixa tudo pendente", () => {
    const [c1] = calcularCaixa([semanaVazia("2026-08-31")]);
    expect(c1.saldoInicialEfetivoCentavos).toBeNull();
    expect(c1.saldoFinalCentavos).toBeNull();
  });

  it("uma parcela nula anula o total daquela semana e das seguintes", () => {
    const s1 = { ...semanaVazia("2026-08-31"), saldoInicialCentavos: 0 };
    const [c1, c2] = calcularCaixa([s1, semanaVazia("2026-09-07")]);
    expect(c1.totalEntradasCentavos).toBeNull();
    expect(c2.saldoInicialEfetivoCentavos).toBeNull();
  });

  it("referência do pipeline pondera pela conversão", () => {
    expect(referenciaPipeline(100_000, 25)).toBe(25_000);
    expect(referenciaPipeline(100_000, null)).toBeNull();
  });
});
