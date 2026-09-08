/**
 * DRE por competência e caixa de 13 semanas (dre-modelo.md,
 * caixa-13-semanas.md), como funções puras.
 *
 * A regra que vale em todas: nulo é "não preenchido" e contamina o que
 * depende dele. Um total que some "o que tem" mentiria com cara de número.
 */
import {
  type CentroDeCusto,
  type Conta,
  ROTULO_CENTRO,
} from "./plano-de-contas";

export type LancamentosDoMes = Record<string, number>;

export type LinhaCalculada = {
  id: string;
  rotulo: string;
  valorCentavos: number | null;
  calculada: boolean;
  /** Só nas linhas de percentual. */
  percent?: number | null;
};

function soma(valores: (number | null)[]): number | null {
  let total = 0;
  for (const v of valores) {
    if (v === null) {
      return null;
    }
    total += v;
  }
  return total;
}

function somaContas(l: LancamentosDoMes, contas: string[]): number | null {
  return soma(contas.map((c) => l[c] ?? null));
}

function sub(a: number | null, b: number | null): number | null {
  return a === null || b === null ? null : a - b;
}

function pct(parte: number | null, todo: number | null): number | null {
  if (parte === null || todo === null || todo === 0) {
    return null;
  }
  return Math.round((parte / todo) * 100);
}

/** Contas que entram no mês: ativas sempre; inativas só quando têm lançamento. */
function contasDoMes(
  contas: Conta[],
  l: LancamentosDoMes,
  grupo: Conta["grupo"]
): Conta[] {
  return contas.filter(
    (c) => c.grupo === grupo && (c.ativa || l[c.conta] !== undefined)
  );
}

function rotuloConta(c: Conta): string {
  return c.ativa ? c.nome : `${c.nome} (desativada)`;
}

function linhasPorConta(
  contas: Conta[],
  l: LancamentosDoMes,
  grupo: Conta["grupo"]
): LinhaCalculada[] {
  return contasDoMes(contas, l, grupo).map((c) => ({
    id: `c-${c.conta}`,
    rotulo: rotuloConta(c),
    valorCentavos: l[c.conta] ?? null,
    calculada: false,
  }));
}

const CENTROS: { id: string; centro: CentroDeCusto; grupo: Conta["grupo"] }[] =
  [
    { id: "comercial", centro: "comercial", grupo: 4 },
    { id: "produto", centro: "produto-engenharia", grupo: 5 },
    { id: "ga", centro: "ga", grupo: 6 },
  ];

function linhasPorCentro(
  contas: Conta[],
  l: LancamentosDoMes
): LinhaCalculada[] {
  return CENTROS.flatMap(({ id, centro, grupo }) => {
    const doCentro = contasDoMes(contas, l, grupo);
    if (doCentro.length === 0) {
      return [];
    }
    return [
      {
        id,
        rotulo: ROTULO_CENTRO[centro],
        valorCentavos: somaContas(
          l,
          doCentro.map((c) => c.conta)
        ),
        calculada: false,
      },
    ];
  });
}

/** As linhas do DRE, derivadas das contas do plano (spec 2026-09-06 §4.3). */
export function calcularDre(
  contas: Conta[],
  l: LancamentosDoMes
): LinhaCalculada[] {
  const receita = linhasPorConta(contas, l, 1);
  const receitaBruta = soma(receita.map((x) => x.valorCentavos));
  const deducoes = somaContas(
    l,
    contasDoMes(contas, l, 2).map((c) => c.conta)
  );
  const receitaLiquida = sub(receitaBruta, deducoes);

  const custo = linhasPorConta(contas, l, 3);
  const custoTotal = soma(custo.map((x) => x.valorCentavos));
  const margemBruta = sub(receitaLiquida, custoTotal);

  const despesa = linhasPorCentro(contas, l);
  const despesasTotal = soma(despesa.map((x) => x.valorCentavos));
  const ebitda = sub(margemBruta, despesasTotal);

  const calc = (
    id: string,
    rotulo: string,
    valorCentavos: number | null
  ): LinhaCalculada => ({ id, rotulo, valorCentavos, calculada: true });
  const pctLinha = (
    id: string,
    rotulo: string,
    p: number | null
  ): LinhaCalculada => ({
    id,
    rotulo,
    valorCentavos: null,
    calculada: true,
    percent: p,
  });

  return [
    ...receita,
    calc("receita-bruta", "Receita bruta total", receitaBruta),
    calc("deducoes", "Deduções", deducoes),
    calc("receita-liquida", "Receita líquida", receitaLiquida),
    ...custo,
    calc("custo-total", "Custo de entrega total", custoTotal),
    calc("margem-bruta", "Margem bruta", margemBruta),
    pctLinha(
      "margem-bruta-pct",
      "Margem bruta %",
      pct(margemBruta, receitaLiquida)
    ),
    ...despesa,
    calc("despesas-total", "Despesas totais", despesasTotal),
    calc("ebitda", "EBITDA", ebitda),
    pctLinha("ebitda-pct", "EBITDA %", pct(ebitda, receitaLiquida)),
  ];
}

/** Trimestre: soma linha a linha; percentuais recalculados sobre as somas. */
export function somarMeses(meses: LinhaCalculada[][]): LinhaCalculada[] {
  const [primeiro] = meses;
  if (!primeiro) {
    return [];
  }
  const somado: LinhaCalculada[] = primeiro.map((linha, i) => ({
    ...linha,
    valorCentavos: soma(meses.map((m) => m[i]?.valorCentavos ?? null)),
    percent: linha.percent === undefined ? undefined : null,
  }));
  const valor = (id: string) =>
    somado.find((x) => x.id === id)?.valorCentavos ?? null;
  for (const l of somado) {
    if (l.id === "margem-bruta-pct") {
      l.percent = pct(valor("margem-bruta"), valor("receita-liquida"));
    }
    if (l.id === "ebitda-pct") {
      l.percent = pct(valor("ebitda"), valor("receita-liquida"));
    }
  }
  return somado;
}

const COMPETENCIA = /^\d{4}-(0[1-9]|1[0-2])$/;

export function competenciaValida(s: string): boolean {
  return COMPETENCIA.test(s);
}

// ── Caixa ──────────────────────────────────────────────────────────────────

export type SemanaEntrada = {
  semanaInicio: string;
  saldoInicialCentavos: number | null;
  recebiveisCentavos: number | null;
  contratosAssinadosCentavos: number | null;
  pipelinePonderadoCentavos: number | null;
  saidasPessoalCentavos: number | null;
  saidasFornecedoresCentavos: number | null;
  saidasComercialCentavos: number | null;
  saidasImpostosCentavos: number | null;
  saidasOutrasCentavos: number | null;
};

export type SemanaCalculada = SemanaEntrada & {
  saldoInicialEfetivoCentavos: number | null;
  totalEntradasCentavos: number | null;
  totalSaidasCentavos: number | null;
  saldoFinalCentavos: number | null;
};

export function semanaVazia(semanaInicio: string): SemanaEntrada {
  return {
    semanaInicio,
    saldoInicialCentavos: null,
    recebiveisCentavos: null,
    contratosAssinadosCentavos: null,
    pipelinePonderadoCentavos: null,
    saidasPessoalCentavos: null,
    saidasFornecedoresCentavos: null,
    saidasComercialCentavos: null,
    saidasImpostosCentavos: null,
    saidasOutrasCentavos: null,
  };
}

const DIA_MS = 86_400_000;

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function segundaFeira(d: Date): string {
  const dia = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
  const recuo = (dia.getUTCDay() + 6) % 7; // segunda = 0
  return iso(new Date(dia.getTime() - recuo * DIA_MS));
}

/** `semanas` já ordenadas por `semanaInicio`. O saldo inicial de cada semana
 *  é o de extrato quando lançado; senão, o final calculado da anterior. */
export function calcularCaixa(semanas: SemanaEntrada[]): SemanaCalculada[] {
  let anterior: number | null = null;
  return semanas.map((s) => {
    const saldoInicialEfetivoCentavos = s.saldoInicialCentavos ?? anterior;
    const totalEntradasCentavos = soma([
      s.recebiveisCentavos,
      s.contratosAssinadosCentavos,
      s.pipelinePonderadoCentavos,
    ]);
    const totalSaidasCentavos = soma([
      s.saidasPessoalCentavos,
      s.saidasFornecedoresCentavos,
      s.saidasComercialCentavos,
      s.saidasImpostosCentavos,
      s.saidasOutrasCentavos,
    ]);
    const saldoFinalCentavos =
      saldoInicialEfetivoCentavos === null ||
      totalEntradasCentavos === null ||
      totalSaidasCentavos === null
        ? null
        : saldoInicialEfetivoCentavos +
          totalEntradasCentavos -
          totalSaidasCentavos;
    anterior = saldoFinalCentavos;
    return {
      ...s,
      saldoInicialEfetivoCentavos,
      totalEntradasCentavos,
      totalSaidasCentavos,
      saldoFinalCentavos,
    };
  });
}

export function referenciaPipeline(
  totalPropostasCentavos: number,
  convPercent: number | null
): number | null {
  return convPercent === null
    ? null
    : Math.round((totalPropostasCentavos * convPercent) / 100);
}
