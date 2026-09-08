/**
 * Janela de capacidade: de quando até quando uma pessoa conta no plano.
 *
 * Sem `saiEm` a capacidade é permanente. Com `saiEm` ela é temporária — o que
 * a tela chama de terceiro. Não existe coluna dizendo "é terceiro": a data de
 * saída É a distinção, e uma segunda fonte para o mesmo fato divergiria da
 * primeira na primeira edição.
 *
 * ponytail: um CLT que pediu demissão também ganha `saiEm` e aparece com o
 * badge de terceiro. Se a distinção passar a importar, aí vira coluna.
 */

import { formatarDataBr } from "@/lib/empresa/periodo";

const MS_POR_DIA = 86_400_000;
const DIAS_POR_SEMANA = 7;

export type Janela = {
  entraEm: Date | null;
  saiEm: Date | null;
};

/** Dia em pt-BR, para as mensagens daqui. */
function dia(d: Date | null): string {
  return d ? formatarDataBr(d.toISOString().slice(0, 10)) : "—";
}

/**
 * O que está errado na janela, ou `null` se ela fecha. Devolve a frase pronta
 * porque quem chama é uma server action, e repetir a redação em cada chamador
 * faria duas mensagens divergirem para o mesmo erro.
 */
export function erroDaJanela(janela: Janela): string | null {
  if (janela.saiEm && !janela.entraEm) {
    return "Quem tem data de saída precisa de data de entrada — sem as duas pontas não há janela.";
  }
  if (janela.entraEm && janela.saiEm && janela.saiEm < janela.entraEm) {
    return "A saída não pode ser antes da entrada.";
  }
  return null;
}

/**
 * Semanas cobertas pela janela, contando as pontas. Uma janela de segunda a
 * sexta é uma semana, não zero: o que interessa é quantas semanas de trabalho
 * a pessoa cobre, e trabalho não vem em frações de semana no planejamento.
 *
 * `null` quando a janela é aberta de algum lado — sem as duas pontas não há
 * quantas semanas, e devolver zero faria a tela afirmar o contrário.
 */
export function semanasDaJanela(janela: Janela): number | null {
  if (!(janela.entraEm && janela.saiEm)) {
    return null;
  }
  const dias =
    Math.floor(
      (janela.saiEm.getTime() - janela.entraEm.getTime()) / MS_POR_DIA
    ) + 1;
  if (dias <= 0) {
    return null;
  }
  return Math.ceil(dias / DIAS_POR_SEMANA);
}

/** Horas que a pessoa cobre na janela inteira. `null` quando a janela é aberta. */
export function horasNaJanela(
  horasSemana: number,
  janela: Janela
): number | null {
  const semanas = semanasDaJanela(janela);
  return semanas === null ? null : horasSemana * semanas;
}

/**
 * Onde a alocação escapa da janela da pessoa, ou `null` se cabe.
 *
 * Alocação sem fim em pessoa com data de saída conta como "depois": prometer
 * alguém indefinidamente quando o contrato dela termina em setembro é
 * exatamente o erro que a janela existe para pegar.
 */
export function foraDaJanela(
  alocacao: { inicioEm: Date; fimEm: Date | null },
  janela: Janela
): "antes" | "depois" | null {
  if (janela.entraEm && alocacao.inicioEm < janela.entraEm) {
    return "antes";
  }
  if (
    janela.saiEm &&
    (alocacao.fimEm === null || alocacao.fimEm > janela.saiEm)
  ) {
    return "depois";
  }
  return null;
}

/**
 * A recusa pronta quando a alocação escapa da janela, ou `null` se cabe.
 * Mesma razão de `erroDaJanela`: a frase mora junto da regra que a motiva.
 */
export function erroDaAlocacao(
  nome: string,
  alocacao: { inicioEm: Date; fimEm: Date | null },
  janela: Janela
): string | null {
  const fora = foraDaJanela(alocacao, janela);
  if (fora === "antes") {
    return `${nome} só entra no plano em ${dia(janela.entraEm)}; a alocação começa antes disso.`;
  }
  if (fora === "depois" && alocacao.fimEm === null) {
    return `${nome} sai em ${dia(janela.saiEm)}, então a alocação precisa de data de fim dentro da janela.`;
  }
  if (fora === "depois") {
    return `${nome} sai em ${dia(janela.saiEm)}; a alocação termina depois disso.`;
  }
  return null;
}
