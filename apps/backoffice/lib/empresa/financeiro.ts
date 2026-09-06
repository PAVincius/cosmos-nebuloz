/**
 * DRE por competência e caixa de 13 semanas (dre-modelo.md,
 * caixa-13-semanas.md), como funções puras.
 *
 * A regra que vale em todas: nulo é "não preenchido" e contamina o que
 * depende dele. Um total que some "o que tem" mentiria com cara de número.
 */
import {
  contasDoGrupo,
  LINHAS_CUSTO,
  LINHAS_DESPESA,
  LINHAS_RECEITA,
  type LinhaDre,
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

function agregadas(
  l: LancamentosDoMes,
  linhas: readonly LinhaDre[]
): LinhaCalculada[] {
  return linhas.map((x) => ({
    id: x.id,
    rotulo: x.rotulo,
    valorCentavos: somaContas(l, x.contas),
    calculada: false,
  }));
}

/** As 20 linhas do DRE da tela, na ordem. */
export function calcularDre(l: LancamentosDoMes): LinhaCalculada[] {
  const receita = agregadas(l, LINHAS_RECEITA);
  const receitaBruta = soma(receita.map((x) => x.valorCentavos));
  const deducoes = somaContas(l, contasDoGrupo(2));
  const receitaLiquida = sub(receitaBruta, deducoes);

  const custo = agregadas(l, LINHAS_CUSTO);
  const custoTotal = soma(custo.map((x) => x.valorCentavos));
  const margemBruta = sub(receitaLiquida, custoTotal);

  const despesa = agregadas(l, LINHAS_DESPESA);
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

export function competenciasAte(final: string, n: number): string[] {
  const [ano, mes] = final.split("-").map(Number);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(ano, mes - 1 - i, 1));
    out.push(
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
    );
  }
  return out;
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

export function janelaDe13(hoje: Date): string[] {
  const inicio = new Date(`${segundaFeira(hoje)}T00:00:00Z`);
  return Array.from({ length: 13 }, (_, i) =>
    iso(new Date(inicio.getTime() + i * 7 * DIA_MS))
  );
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
