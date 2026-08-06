import "server-only";
import { log } from "@repo/observability/log";

/**
 * Teto de requisição do back-office.
 *
 * Este é o único dos três apps sem middleware de borda, e é o que provisiona
 * tenant, contrata módulo e aprova operação sensível. O teto existe menos
 * contra um atacante externo — a rota inteira é autenticada — e mais contra o
 * que de fato acontece: script de staff em laço, retry sem backoff, integração
 * caseira que alguém escreveu e esqueceu ligada.
 *
 * **A chave é a pessoa, não o IP.** A equipe atrás de um NAT dividiria uma
 * cota só, e o primeiro a trabalhar derrubaria os outros — com sintoma de bug
 * de sessão, que é o pior lugar para procurar.
 */

/** Navegação e leitura. Largo: cada página do painel é dinâmica e uma sessão
 *  de trabalho normal encosta em dezenas de requisições por minuto. */
export const LIMITE_STAFF_POR_MINUTO = 120;

/** Provisionar cria tenant e roda bootstrap. O teto de navegação seria, na
 *  prática, teto nenhum para isto. */
export const LIMITE_PROVISIONAMENTO_POR_HORA = 10;

export type EscopoDeLimite = "staff" | "provisionamento";

const ESCOPOS: Record<
  EscopoDeLimite,
  { prefixo: string; quantidade: number; janela: "1 m" | "1 h" }
> = {
  staff: {
    prefixo: "bo:staff",
    quantidade: LIMITE_STAFF_POR_MINUTO,
    janela: "1 m",
  },
  provisionamento: {
    prefixo: "bo:provisionamento",
    quantidade: LIMITE_PROVISIONAMENTO_POR_HORA,
    janela: "1 h",
  },
};

export class RateLimitError extends Error {
  readonly code = "RATE_LIMITED";

  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

/**
 * Barra a chamada se a pessoa passou do teto do escopo.
 *
 * **Degrada aberto** — sem Redis, ou com Redis fora do ar, a chamada passa.
 * Fechar transformaria indisponibilidade do Upstash em queda total do painel,
 * e faria dev e CI dependerem de infra externa para rodar. O preço dessa
 * escolha é que a ausência do controle se parece com o controle funcionando,
 * e é por isso que os dois casos gravam log: sem o aviso, ninguém descobre que
 * o painel passou um mês sem teto nenhum.
 */
export async function assertDentroDoLimite(
  escopo: EscopoDeLimite,
  chave: string
): Promise<void> {
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    log.warn(
      "[backoffice] rate limit desligado: UPSTASH_REDIS_REST_URL ausente",
      {
        escopo,
      }
    );
    return;
  }

  const { prefixo, quantidade, janela } = ESCOPOS[escopo];

  let resultado: { success: boolean; reset: number };
  try {
    const { createRateLimiter, slidingWindow } = await import(
      "@repo/rate-limit"
    );
    const limiter = createRateLimiter({
      limiter: slidingWindow(quantidade, janela),
      prefix: prefixo,
    });
    resultado = await limiter.limit(chave);
  } catch (e) {
    log.warn("[backoffice] rate limit indisponível, chamada liberada", {
      escopo,
      error: String(e),
    });
    return;
  }

  if (resultado.success) {
    return;
  }

  // O prazo vai na mensagem: "limite excedido" sem quando voltar faz a pessoa
  // tentar de novo em laço, que é exatamente o que o teto quer parar.
  const segundos = Math.max(
    1,
    Math.ceil((resultado.reset - Date.now()) / 1000)
  );
  throw new RateLimitError(
    `Muitas requisições. Tente de novo em ${segundos}s.`
  );
}
