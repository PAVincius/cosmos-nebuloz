// empresa-financeiro.test.ts — as linhas calculadas fecham sozinhas, e uma
// linha agregada só existe quando todas as contas dela existem no mês.
import { describe, expect, it } from "vitest";
import {
  calcularCaixa,
  calcularDre,
  competenciaValida,
  referenciaPipeline,
  segundaFeira,
  semanaVazia,
  somarMeses,
} from "../lib/empresa/financeiro";
import type { Conta } from "../lib/empresa/plano-de-contas";

const conta = (
  c: string,
  nome: string,
  grupo: Conta["grupo"],
  centro: Conta["centroDeCusto"]
): Conta => ({ conta: c, nome, grupo, centroDeCusto: centro, ativa: true });
const CONTAS: Conta[] = [
  conta("1.1", "Assinatura A", 1, null),
  conta("1.2", "Assinatura B", 1, null),
  conta("2.1", "Impostos", 2, null),
  conta("3.1", "Entrega A", 3, "entrega"),
  conta("4.1", "Vendas", 4, "comercial"),
  conta("4.7", "Eventos", 4, "comercial"),
  conta("5.1", "Engenharia", 5, "produto-engenharia"),
  conta("6.1", "Admin", 6, "ga"),
];
const MES: Record<string, number> = {
  "1.1": 1000,
  "1.2": 500,
  "2.1": 100,
  "3.1": 300,
  "4.1": 100,
  "4.7": 50,
  "5.1": 200,
  "6.1": 100,
};

function linha(dre: ReturnType<typeof calcularDre>, id: string) {
  const l = dre.find((x) => x.id === id);
  if (!l) throw new Error(`linha ${id} ausente`);
  return l;
}

describe("calcularDre com contas dinâmicas", () => {
  it("uma linha por conta de receita e de custo; uma por centro nas despesas", () => {
    const dre = calcularDre(CONTAS, MES);
    expect(dre.map((l) => l.id)).toEqual([
      "c-1.1",
      "c-1.2",
      "receita-bruta",
      "deducoes",
      "receita-liquida",
      "c-3.1",
      "custo-total",
      "margem-bruta",
      "margem-bruta-pct",
      "comercial",
      "produto",
      "ga",
      "despesas-total",
      "ebitda",
      "ebitda-pct",
    ]);
    expect(linha(dre, "receita-bruta").valorCentavos).toBe(1500);
    expect(linha(dre, "receita-liquida").valorCentavos).toBe(1400);
    expect(linha(dre, "comercial").valorCentavos).toBe(150); // 4.1 + a conta nova 4.7
    expect(linha(dre, "despesas-total").valorCentavos).toBe(450);
    expect(linha(dre, "ebitda").valorCentavos).toBe(650);
    expect(linha(dre, "ebitda-pct").percent).toBe(46);
  });
  it("conta ativa sem lançamento anula a linha agregada; conta inativa sem lançamento é ignorada", () => {
    const { "4.7": _x, ...semEventos } = MES;
    expect(
      linha(calcularDre(CONTAS, semEventos), "comercial").valorCentavos
    ).toBeNull();
    const inativa = CONTAS.map((c) =>
      c.conta === "4.7" ? { ...c, ativa: false } : c
    );
    expect(
      linha(calcularDre(inativa, semEventos), "comercial").valorCentavos
    ).toBe(100);
  });
  it("conta inativa com lançamento entra, marcada", () => {
    const inativa = CONTAS.map((c) =>
      c.conta === "1.2" ? { ...c, ativa: false } : c
    );
    const dre = calcularDre(inativa, MES);
    expect(linha(dre, "c-1.2").rotulo).toBe("Assinatura B (desativada)");
    expect(linha(dre, "receita-bruta").valorCentavos).toBe(1500);
  });
  it("centro sem conta não gera linha; percentual nulo com receita zero", () => {
    const semGa = CONTAS.filter((c) => c.grupo !== 6);
    expect(calcularDre(semGa, MES).some((l) => l.id === "ga")).toBe(false);
    const zero = Object.fromEntries(Object.keys(MES).map((k) => [k, 0]));
    expect(linha(calcularDre(CONTAS, zero), "ebitda-pct").percent).toBeNull();
  });
});

describe("somarMeses", () => {
  it("soma linha a linha e propaga nulo", () => {
    const a = calcularDre(CONTAS, MES);
    expect(linha(somarMeses([a, a, a]), "ebitda").valorCentavos).toBe(1950);
    expect(
      linha(somarMeses([a, calcularDre(CONTAS, {})]), "ebitda").valorCentavos
    ).toBeNull();
  });
});

describe("competências", () => {
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
