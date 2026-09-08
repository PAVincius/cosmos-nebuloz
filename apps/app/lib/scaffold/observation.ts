// SG-06 — a janela de observação de 30 dias.
//
// Fechar o gate da Fase 4 NÃO entrega a trilha: abre a janela. A trilha só é
// `EMBEDDED` depois de 30 dias sem reabertura — e é essa distinção que separa
// "o time aprovou" de "o processo sobrevive sem a Nebuloz", que é a definição
// de sucesso do PRD inteiro.
//
// Lógica pura: a varredura agendada e a tela mostram o MESMO número, e duas
// implementações divergiriam no primeiro arredondamento.

const DAY_MS = 86_400_000;

export const OBSERVATION_WINDOW_DAYS = 30;

export type ObservationStatus =
  /** Sem janela aberta — a fase não fechou, ou não é a EMBED. */
  | "not-observing"
  /** Janela correndo. */
  | "observing"
  /** Reaberta depois que a contagem começou: o processo não sobreviveu. */
  | "reopened"
  /** 30 dias sem reabertura. A trilha pode ser entregue. */
  | "embedded";

export type ObservationVerdict = {
  status: ObservationStatus;
  elapsedDays: number;
  remainingDays: number;
};

/**
 * O veredito da janela.
 *
 * `reopenCountAtClose` é o contador de reaberturas no momento em que a janela
 * abriu. A comparação com o contador atual é o que distingue "esta fase já foi
 * reaberta no passado" — o que é normal e não invalida nada — de "alguém
 * reabriu DEPOIS que a contagem começou", que é o que desqualifica a entrega.
 *
 * Sem esse par, uma trilha que tropeçou uma vez em janeiro jamais poderia ser
 * entregue, e o critério viraria punição por histórico.
 */
export function observationVerdict(input: {
  observationEndsAt: Date | null;
  reopenCount: number;
  reopenCountAtClose: number;
}): ObservationVerdict {
  if (!input.observationEndsAt) {
    return { status: "not-observing", elapsedDays: 0, remainingDays: 0 };
  }

  const remainingMs = input.observationEndsAt.getTime() - Date.now();
  const remainingDays = Math.max(0, Math.ceil(remainingMs / DAY_MS));
  const elapsedDays = Math.min(
    OBSERVATION_WINDOW_DAYS,
    OBSERVATION_WINDOW_DAYS - remainingDays
  );

  if (input.reopenCount > input.reopenCountAtClose) {
    return { status: "reopened", elapsedDays, remainingDays };
  }

  // `<= 0`, não `< 0`: a janela de 30 dias termina NO 30º dia. Exigir o 31º
  // cobraria um dia a mais do cliente por causa de arredondamento.
  if (remainingMs <= 0) {
    return { status: "embedded", elapsedDays, remainingDays: 0 };
  }

  return { status: "observing", elapsedDays, remainingDays };
}
