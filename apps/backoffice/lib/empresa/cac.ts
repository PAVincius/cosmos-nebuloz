/**
 * CAC totalmente carregado (cac-modelo.md §1), como função pura.
 *
 * O resultado só existe com as oito parcelas preenchidas — a tela diz "sem
 * número, sem chute", e a função é onde isso vale. Nulo é "não preenchido";
 * zero é zero.
 */
import { CONTAS_DO_CAC, type ContaDoCac } from "./plano-de-contas";

export type ParcelasCac = Record<ContaDoCac, number | null> & {
  entregaDiagnosticoCentavos: number | null;
  clientesGanhos: number | null;
};

export type AlocacaoCac = { produto: string; pesoPercent: number };

export const PARCELAS_TOTAL = 8;

export type ResultadoCac = {
  preenchidas: number;
  total: typeof PARCELAS_TOTAL;
  cacCentavos: number | null;
  porProduto: {
    produto: string;
    pesoPercent: number;
    cacCentavos: number | null;
  }[];
  paybackMeses: number | null;
};

export function calcularCac(
  p: ParcelasCac,
  alocacoes: AlocacaoCac[],
  mensalidadeReferenciaCentavos: number | null
): ResultadoCac {
  const contas = CONTAS_DO_CAC.map((c) => p[c]);
  const valores = [...contas, p.entregaDiagnosticoCentavos, p.clientesGanhos];
  const preenchidas = valores.filter((v) => v !== null).length;

  let cacCentavos: number | null = null;
  if (preenchidas === PARCELAS_TOTAL && (p.clientesGanhos ?? 0) > 0) {
    const numerador =
      contas.reduce<number>((a, b) => a + (b ?? 0), 0) +
      (p.entregaDiagnosticoCentavos ?? 0);
    cacCentavos = Math.round(numerador / (p.clientesGanhos as number));
  }

  const porProduto = alocacoes.map((a) => ({
    produto: a.produto,
    pesoPercent: a.pesoPercent,
    cacCentavos:
      cacCentavos === null
        ? null
        : Math.round((cacCentavos * a.pesoPercent) / 100),
  }));

  const paybackMeses =
    cacCentavos === null ||
    mensalidadeReferenciaCentavos === null ||
    mensalidadeReferenciaCentavos <= 0
      ? null
      : Math.round((cacCentavos / mensalidadeReferenciaCentavos) * 10) / 10;

  return {
    preenchidas,
    total: PARCELAS_TOTAL,
    cacCentavos,
    porProduto,
    paybackMeses,
  };
}

export function pesosSomam100(alocacoes: AlocacaoCac[]): boolean {
  return (
    alocacoes.length > 0 &&
    alocacoes.reduce((a, b) => a + b.pesoPercent, 0) === 100
  );
}
