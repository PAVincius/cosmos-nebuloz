/**
 * Regras de saúde de conta.
 *
 * Saúde é DERIVADA de sinal que já é gravado, não um campo que alguém marca à
 * mão. Campo manual envelhece no dia em que a pessoa esquece de atualizar, e
 * um painel de renovação que mostra "saudável" sobre dado velho é pior que um
 * painel vazio — ele dá confiança onde não há informação.
 *
 * Mora em `lib/` porque a tela também precisa dos limiares para explicar cada
 * veredito, e módulo `"use server"` só exporta função async.
 */

/** Sem atividade por mais tempo que isto, o cliente vira sinal de risco. */
export const DIAS_SEM_ATIVIDADE = 30;

/** Renovação dentro desta janela já aparece como coisa a fazer. */
export const DIAS_PARA_RENOVACAO = 60;

export type Saude = "SEM_SINAL" | "OK" | "ATENCAO" | "RISCO";

export type SinalDeSaude = {
  /** Peso do problema. RISCO puxa a conta inteira para RISCO. */
  nivel: "ATENCAO" | "RISCO";
  /** O que aconteceu, em linguagem de operação — nunca "score 42". */
  texto: string;
};

export const ROTULO_SAUDE: Record<Saude, string> = {
  SEM_SINAL: "Sem sinal",
  OK: "OK",
  ATENCAO: "Atenção",
  RISCO: "Risco",
};

/**
 * Resume os sinais num veredito.
 *
 * "Sem sinal" existe e não é sinônimo de OK: um cliente sobre o qual não há
 * dado nenhum não é um cliente saudável, é um cliente que ninguém está
 * olhando. Colapsar os dois esconderia exatamente a conta que mais precisa de
 * um telefonema.
 */
export function resumir(sinais: SinalDeSaude[], temDado: boolean): Saude {
  if (!temDado) {
    return "SEM_SINAL";
  }
  if (sinais.some((s) => s.nivel === "RISCO")) {
    return "RISCO";
  }
  if (sinais.length > 0) {
    return "ATENCAO";
  }
  return "OK";
}

/** Dias até uma data. Negativo quando já passou. */
export function diasAte(quando: Date, hoje: Date): number {
  const MS_POR_DIA = 86_400_000;
  return Math.ceil((quando.getTime() - hoje.getTime()) / MS_POR_DIA);
}
