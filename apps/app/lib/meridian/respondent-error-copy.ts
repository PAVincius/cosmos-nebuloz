import {
  COLLECTION_CLOSED_MESSAGE,
  TOKEN_INVALID_MESSAGE,
  TOKEN_RATE_LIMITED_MESSAGE,
} from "./respondent-messages";

export type RespondentErrorCopy = { title: string; body: string };

const GENERIC_INVALID_COPY: RespondentErrorCopy = {
  title: "Link inválido ou expirado",
  body: "Este link não está mais válido. Peça um novo à pessoa que conduz o diagnóstico na sua organização.",
};

const KNOWN_COPY: Record<string, RespondentErrorCopy> = {
  [TOKEN_INVALID_MESSAGE]: GENERIC_INVALID_COPY,
  [COLLECTION_CLOSED_MESSAGE]: {
    title: "Coleta encerrada",
    body: "Este diagnóstico não aceita mais respostas. Fale com a pessoa que conduz o diagnóstico na sua organização.",
  },
  [TOKEN_RATE_LIMITED_MESSAGE]: {
    title: "Muitas tentativas",
    body: "Aguarde um minuto e tente abrir o link de novo.",
  },
};

/** Traduz `res.error` (de `getBattery`, superfície sem sessão) em copy de
 *  tela. Só as duas mensagens conhecidas de `TOKEN_ERROR`/`RATE_LIMIT_ERROR`
 *  têm texto próprio — qualquer outra string cai no genérico de link
 *  inválido, pra nunca mostrar detalhe interno numa tela sem sessão. */
export function respondentErrorCopy(error: string): RespondentErrorCopy {
  return KNOWN_COPY[error] ?? GENERIC_INVALID_COPY;
}
