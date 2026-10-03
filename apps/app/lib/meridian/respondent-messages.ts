// Mensagens dos erros que a superfície do respondente devolve. Definidas aqui,
// sem dependência de servidor: nem em respondent.ts ("use server" só permite
// exportar função async), nem em respondent-token.ts (que importa `node:crypto`
// e não pode ir para o cliente). Assim a página, a server action e o componente
// do cliente traduzem `res.error` em copy de tela sem duplicar o texto exato.

export const TOKEN_INVALID_MESSAGE = "Link inválido ou expirado.";

/** A coleta fechou (assessment em revisão ou finalizado): o link vira só
 *  leitura, mesmo com o token ainda válido (FR-029c). Texto seguro para a
 *  superfície sem sessão: não diz nada interno. */
export const COLLECTION_CLOSED_MESSAGE =
  "A coleta deste diagnóstico já foi encerrada.";

export const TOKEN_RATE_LIMITED_MESSAGE =
  "Muitas tentativas. Aguarde um minuto.";
