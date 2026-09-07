/**
 * Regras puras da receita recorrente (assinatura, franquia de créditos e
 * excedente). Sem Prisma, sem I/O: `AssinaturaRow`, `MudancaRow` e
 * `CreditoRow` são a forma ISO-string dos models `AssinaturaDoTenant`,
 * `MudancaDeAssinatura` e `CreditoDoMes` (packages/database).
 *
 * A ideia que sustenta o módulo: um mês passado de MRR não pode mudar quando
 * alguém edita um contrato hoje. `MudancaDeAssinatura` é append-only — cada
 * mudança de valor grava uma linha nova, nunca sobrescreve — e é por isso que
 * `valorNaCompetencia` lê esse histórico em vez do valor atual da assinatura,
 * e que `mrr` recebe o histórico como parâmetro em vez de só a lista de
 * assinaturas. Editar `valorMensalCentavos` de uma assinatura hoje não move
 * uma barra do gráfico de MRR de março.
 */

import type { Tone } from "@repo/design-system/cosmos/kit";
import type { LancamentosDoMes } from "./financeiro";
import type { Conta } from "./plano-de-contas";

export type AssinaturaRow = {
  id: string;
  clienteSlug: string;
  clienteNome: string;
  planoSlug: string;
  valorMensalCentavos: number;
  creditosMesIncluidos: number;
  precoCreditoExtraCentavos: number;
  tetoExcedenteCentavos: number | null;
  /** ISO "AAAA-MM-DD". */
  iniciouEm: string;
  /** ISO "AAAA-MM-DD". Nulo = ativa. */
  encerradaEm: string | null;
  motivoEncerramento: string | null;
  propostaId: string | null;
};

export type TipoDeMudanca =
  | "NOVO"
  | "EXPANSAO"
  | "CONTRACAO"
  | "CHURN"
  | "REATIVACAO";

export type MudancaRow = {
  id: string;
  assinaturaId: string;
  /** "AAAA-MM". Competência em que a mudança passa a valer. */
  competencia: string;
  tipo: TipoDeMudanca;
  deCentavos: number;
  paraCentavos: number;
  motivo: string;
  autorNome: string | null;
  /** ISO datetime. */
  criadoEm: string;
};

export type CreditoRow = {
  id: string;
  clienteSlug: string;
  /** "AAAA-MM". */
  competencia: string;
  franquia: number;
  consumidos: number;
  precoCreditoExtraCentavos: number;
  excedenteCentavos: number;
  excedenteReprimidoCentavos: number;
};

export const ROTULO_TIPO_MUDANCA: Record<TipoDeMudanca, string> = {
  NOVO: "Novo",
  EXPANSAO: "Expansão",
  CONTRACAO: "Contração",
  CHURN: "Churn",
  REATIVACAO: "Reativação",
};

export const TOM_TIPO_MUDANCA: Record<TipoDeMudanca, Tone> = {
  NOVO: "green",
  EXPANSAO: "blue",
  CONTRACAO: "amber",
  CHURN: "red",
  REATIVACAO: "purple",
};

/** As 27 contas do plano moram no banco (lib/empresa/plano-de-contas.ts); o
 * plano é a autoridade sobre nome e grupo. Estas duas listas fixam, dentro do
 * grupo 1 (receita), quais contas são assinatura e quais são serviço — a
 * distinção que o modelo de receita recorrente precisa e que o plano de
 * contas não marca sozinho. O seed nomeia cada uma como "Receita de
 * assinatura — …" (1.1–1.4) ou "Receita de serviço — …" (1.5–1.8); uma conta
 * nova no grupo 1 (ex.: 1.9) tem que entrar numa destas duas listas, senão
 * fica invisível tanto para MRR quanto para `receitaDeServico`. */
export const CONTAS_DE_ASSINATURA = ["1.1", "1.2", "1.3", "1.4"] as const;
export const CONTAS_DE_SERVICO = ["1.5", "1.6", "1.7", "1.8"] as const;

/** Valor vigente de uma assinatura numa competência, lido do histórico
 * append-only — nunca do valor atual da assinatura. Filtra as mudanças da
 * assinatura até a competência alvo (inclusive), ordena por competência e
 * devolve o `paraCentavos` da última; sem nenhuma mudança até ali, zero (o
 * contrato ainda não existia). Competência é "AAAA-MM": comparação de string
 * já é comparação cronológica, sem precisar parsear para `Date`. */
export function valorNaCompetencia(
  assinaturaId: string,
  mudancas: MudancaRow[],
  competencia: string
): number {
  const daAssinatura = mudancas
    .filter(
      (m) => m.assinaturaId === assinaturaId && m.competencia <= competencia
    )
    .sort((a, b) => (a.competencia < b.competencia ? -1 : 1));
  const ultima = daAssinatura.at(-1);
  return ultima ? ultima.paraCentavos : 0;
}

/** Ativa numa competência é uma foto de fim de mês: já começou até o último
 * dia da competência e, se encerrada, o encerramento só vale a partir do mês
 * seguinte — encerrar no último dia do mês já tira a assinatura desse mês. */
export function ativaNaCompetencia(
  assinatura: AssinaturaRow,
  competencia: string
): boolean {
  const iniciou = assinatura.iniciouEm.slice(0, 7) <= competencia;
  const naoEncerrou =
    assinatura.encerradaEm === null ||
    assinatura.encerradaEm.slice(0, 7) > competencia;
  return iniciou && naoEncerrou;
}

/** MRR da competência: soma de `valorNaCompetencia` das assinaturas ativas
 * naquele mês. Recebe o histórico como parâmetro (não lê o valor atual) para
 * que o MRR de um mês passado nunca mude quando um contrato é editado hoje. */
export function mrr(
  assinaturas: AssinaturaRow[],
  mudancas: MudancaRow[],
  competencia: string
): number {
  return assinaturas
    .filter((a) => ativaNaCompetencia(a, competencia))
    .reduce(
      (soma, a) => soma + valorNaCompetencia(a.id, mudancas, competencia),
      0
    );
}

export function arr(mrrCentavos: number): number {
  return mrrCentavos * 12;
}

export type Movimento = {
  novo: number;
  expansao: number;
  contracao: number;
  churn: number;
  reativacao: number;
  liquido: number;
};

/** Abre o MRR do mês nos cinco tipos de mudança da competência: `novo` e
 * `reativacao` somam o valor final; `expansao` e `contracao` somam a
 * diferença (sempre positiva, cada uma no seu sentido); `churn` soma o valor
 * perdido. `liquido` fecha a conta: entradas menos saídas. */
export function movimento(
  mudancas: MudancaRow[],
  competencia: string
): Movimento {
  const doMes = mudancas.filter((m) => m.competencia === competencia);

  const somaTipo = (tipo: TipoDeMudanca, valor: (m: MudancaRow) => number) =>
    doMes
      .filter((m) => m.tipo === tipo)
      .reduce((soma, m) => soma + valor(m), 0);

  const novo = somaTipo("NOVO", (m) => m.paraCentavos);
  const expansao = somaTipo("EXPANSAO", (m) => m.paraCentavos - m.deCentavos);
  const contracao = somaTipo("CONTRACAO", (m) => m.deCentavos - m.paraCentavos);
  const churn = somaTipo("CHURN", (m) => m.deCentavos);
  const reativacao = somaTipo("REATIVACAO", (m) => m.paraCentavos);

  return {
    novo,
    expansao,
    contracao,
    churn,
    reativacao,
    liquido: novo + expansao + reativacao - contracao - churn,
  };
}

/** Percentual do MRR de entrada do mês perdido para churn. Sem MRR de
 * entrada não há denominador, então não há percentual — `null`, não zero. */
export function churnDeReceita(
  mudancas: MudancaRow[],
  competencia: string,
  mrrInicialCentavos: number
): number | null {
  if (mrrInicialCentavos === 0) {
    return null;
  }
  const { churn } = movimento(mudancas, competencia);
  return Math.round((churn / mrrInicialCentavos) * 100);
}

export type ChurnDeClientes = {
  sairam: number;
  base: number;
  percent: number | null;
};

/** `sairam` são as assinaturas cujo `encerradaEm` cai na competência.
 * `base` é a contagem no início do mês: quem segue ativo ao fim do mês
 * (`ativaNaCompetencia`, que já tira quem encerrou neste mesmo mês) mais quem
 * saiu nele — os dois juntos reconstroem quem existia no início, sem precisar
 * calcular a competência anterior. `percent` arredondado, `null` com base
 * zero. */
export function churnDeClientes(
  assinaturas: AssinaturaRow[],
  competencia: string
): ChurnDeClientes {
  const sairam = assinaturas.filter(
    (a) => a.encerradaEm !== null && a.encerradaEm.slice(0, 7) === competencia
  ).length;
  const ativasAoFim = assinaturas.filter((a) =>
    ativaNaCompetencia(a, competencia)
  ).length;
  const base = ativasAoFim + sairam;
  return {
    sairam,
    base,
    percent: base === 0 ? null : Math.round((sairam / base) * 100),
  };
}

/** Soma das contas de serviço (1.5–1.8) lançadas no mês. Ausência de conta
 * conta como zero, deliberadamente — diferente do DRE (`lib/empresa/
 * financeiro.ts`), onde ausência é `null` porque a pergunta lá é "o mês está
 * completo". Aqui a pergunta é "quanto de serviço vendemos": não vender é
 * zero, não é "não sei". */
export function receitaDeServico(
  contas: Pick<Conta, "conta">[],
  lancamentosDoMes: LancamentosDoMes
): number {
  const codigosDeServico = new Set<string>(CONTAS_DE_SERVICO);
  return contas
    .filter((c) => codigosDeServico.has(c.conta))
    .reduce((soma, c) => soma + (lancamentosDoMes[c.conta] ?? 0), 0);
}

export type UsoDaFranquia = {
  percent: number | null;
  leitura: "SEM_FRANQUIA" | "OCIOSO" | "SAUDAVEL" | "UPGRADE";
};

/** Leitura do consumo de crédito contra a franquia. Franquia zero não divide
 * por zero: `SEM_FRANQUIA` com percentual nulo. Abaixo de 30%, `OCIOSO`;
 * acima de 100%, `UPGRADE`; entre os dois — incluindo os dois limites —
 * `SAUDAVEL`. */
export function usoDaFranquia(credito: CreditoRow): UsoDaFranquia {
  if (credito.franquia === 0) {
    return { percent: null, leitura: "SEM_FRANQUIA" };
  }
  const percent = Math.round((credito.consumidos / credito.franquia) * 100);
  return { percent, leitura: leituraDoUso(percent) };
}

function leituraDoUso(percent: number): "OCIOSO" | "SAUDAVEL" | "UPGRADE" {
  if (percent < 30) {
    return "OCIOSO";
  }
  if (percent > 100) {
    return "UPGRADE";
  }
  return "SAUDAVEL";
}

export type Excedente = {
  cobrado: number;
  reprimido: number;
};

/** Excedente do mês: `bruto` é o consumo acima da franquia vezes a taxa por
 * crédito. Sem teto (`null`), nada é cobrado e o bruto inteiro fica
 * reprimido — é o padrão do contrato (GitHub Copilot: orçamento zero até o
 * cliente definir um). Com teto, `cobrado` é o bruto até o teto, e o que
 * passar do teto vira `reprimido` — o sinal de que o cliente precisa de um
 * degrau acima. */
export function excedenteDoMes(
  franquia: number,
  consumidos: number,
  taxaPorCreditoCentavos: number,
  tetoCentavos: number | null
): Excedente {
  const bruto = Math.max(0, consumidos - franquia) * taxaPorCreditoCentavos;
  const cobrado = tetoCentavos === null ? 0 : Math.min(bruto, tetoCentavos);
  return { cobrado, reprimido: bruto - cobrado };
}
