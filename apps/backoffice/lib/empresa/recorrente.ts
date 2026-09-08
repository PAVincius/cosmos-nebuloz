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
 *
 * `deCentavos`/`paraCentavos` gravados em cada `MudancaRow` são a auditoria
 * de quanto valia antes e depois, junto com `motivo` — o que a pessoa
 * digitou, não a fonte do gráfico. Uma correção retroativa gravada depois de
 * uma mudança futura já existente deixa esse par desatualizado (append-only
 * proíbe reescrever a linha futura), então `movimento` não lê essas colunas:
 * deriva `antes`/`agora` de `valorNaCompetencia`, a mesma função que `mrr`
 * usa, para que `mrr(c) - mrr(c-1) === movimento(c).liquido` valha sempre.
 */

import type { Tone } from "@repo/design-system/cosmos/kit";
import type { LancamentosDoMes } from "./financeiro";

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
 * plano é a autoridade sobre nome e grupo. Esta lista fixa, dentro do grupo 1
 * (receita), quais contas são de serviço — a distinção que `receitaDeServico`
 * precisa e que o plano de contas não marca sozinho. O seed nomeia cada uma
 * como "Receita de serviço — …" (1.5–1.8); uma conta nova de serviço tem que
 * entrar aqui, senão fica invisível para `receitaDeServico`. */
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
    // Desempate por `criadoEm`: o schema não impede duas mudanças na mesma
    // competência, e duas edições no mesmo mês são caso real. Sem o segundo
    // critério, "a última vence" dependeria da ordem em que o banco devolveu
    // as linhas. O comparador devolve 0 em empate total, como manda o
    // contrato de `sort` — devolver 1 ali é comparador inválido.
    .sort((a, b) => {
      if (a.competencia !== b.competencia) {
        return a.competencia < b.competencia ? -1 : 1;
      }
      if (a.criadoEm !== b.criadoEm) {
        return a.criadoEm < b.criadoEm ? -1 : 1;
      }
      return 0;
    });
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

/** Abre o MRR do mês nos cinco tipos de mudança da competência, comparando
 * `valorNaCompetencia` da assinatura no mês anterior (`antes`) com o desta
 * (`agora`) — nunca as colunas `deCentavos`/`paraCentavos` gravadas, que uma
 * correção retroativa pode ter deixado desatualizadas. `novo`/`reativacao`
 * somam o valor final; `expansao`/`contracao` somam a diferença (sempre
 * positiva, cada uma no seu sentido); `churn` soma o valor perdido.
 * `liquido` fecha a conta: entradas menos saídas — por construção, sempre
 * igual a `mrr(c) - mrr(c-1)`, porque os dois leem o mesmo valor pelo mesmo
 * portão de `ativaNaCompetencia`. */
export function movimento(
  assinaturas: AssinaturaRow[],
  mudancas: MudancaRow[],
  competencia: string
): Movimento {
  const anterior = competenciaAnterior(competencia);
  const contribuicoes = assinaturas
    .map((a) => {
      // O mesmo portão que o `mrr` usa. Sem ele as duas contas divergem:
      // `alterarValor` aceita competência futura e `encerrarAssinatura` aceita
      // data anterior a ela, então o histórico pode ter valor num mês em que a
      // assinatura já não está ativa. O `mrr` ignora esse valor; sem o portão,
      // o movimento o veria como reativação de um cliente que saiu.
      const valores = {
        antes: ativaNaCompetencia(a, anterior)
          ? valorNaCompetencia(a.id, mudancas, anterior)
          : 0,
        agora: ativaNaCompetencia(a, competencia)
          ? valorNaCompetencia(a.id, mudancas, competencia)
          : 0,
      };
      return contribuicaoDoMes(a.id, mudancas, competencia, valores);
    })
    .filter((c): c is ContribuicaoDoMes => c !== null);

  const somaTipo = (tipo: TipoDeMudanca) =>
    contribuicoes
      .filter((c) => c.tipo === tipo)
      .reduce((soma, c) => soma + c.valor, 0);

  const novo = somaTipo("NOVO");
  const expansao = somaTipo("EXPANSAO");
  const contracao = somaTipo("CONTRACAO");
  const churn = somaTipo("CHURN");
  const reativacao = somaTipo("REATIVACAO");

  return {
    novo,
    expansao,
    contracao,
    churn,
    reativacao,
    liquido: novo + expansao + reativacao - contracao - churn,
  };
}

/** "AAAA-MM" do mês anterior a `competencia` — a base de comparação de
 * `movimento` contra `valorNaCompetencia`. */
function competenciaAnterior(competencia: string): string {
  const [ano, mes] = competencia.split("-").map(Number);
  const d = new Date(Date.UTC(ano, mes - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

type ContribuicaoDoMes = {
  tipo: TipoDeMudanca;
  valor: number;
};

/** Classifica a mudança de uma assinatura entre o mês anterior e este.
 * `null` quando o valor não mudou — a maioria das assinaturas, na maioria
 * dos meses. Sem valor antes: `NOVO`, a menos que a assinatura já tenha um
 * `CHURN` registrado antes desta competência, aí é `REATIVACAO`. Some com
 * valor antes e nenhum agora: `CHURN`. Os dois positivos: `EXPANSAO` quando
 * sobe, `CONTRACAO` quando desce. */
function contribuicaoDoMes(
  assinaturaId: string,
  mudancas: MudancaRow[],
  competencia: string,
  { antes, agora }: { antes: number; agora: number }
): ContribuicaoDoMes | null {
  if (antes === agora) {
    return null;
  }
  if (antes === 0) {
    const jaTeveChurn = mudancas.some(
      (m) =>
        m.assinaturaId === assinaturaId &&
        m.tipo === "CHURN" &&
        m.competencia < competencia
    );
    return { tipo: jaTeveChurn ? "REATIVACAO" : "NOVO", valor: agora };
  }
  if (agora === 0) {
    return { tipo: "CHURN", valor: antes };
  }
  return agora > antes
    ? { tipo: "EXPANSAO", valor: agora - antes }
    : { tipo: "CONTRACAO", valor: antes - agora };
}

/** Percentual do MRR de entrada do mês perdido para churn. Sem MRR de
 * entrada não há denominador, então não há percentual — `null`, não zero. */
export function churnDeReceita(
  assinaturas: AssinaturaRow[],
  mudancas: MudancaRow[],
  competencia: string,
  mrrInicialCentavos: number
): number | null {
  if (mrrInicialCentavos === 0) {
    return null;
  }
  const { churn } = movimento(assinaturas, mudancas, competencia);
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
export function receitaDeServico(lancamentosDoMes: LancamentosDoMes): number {
  return CONTAS_DE_SERVICO.reduce(
    (soma, conta) => soma + (lancamentosDoMes[conta] ?? 0),
    0
  );
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
