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

/** Linhas da trilha de acesso (lib/registro-de-acesso.ts). Aqui a chave é a
 *  pessoa quando o login cria sessão, e o IP quando é recusado — a tentativa
 *  recusada não tem outra. Folgado para quem erra a senha, curto para quem
 *  martela o formulário e encheria a tabela. */
export const LIMITE_ACESSO_POR_HORA = 30;

export type EscopoDeLimite = "staff" | "provisionamento" | "acesso";

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
  acesso: {
    prefixo: "bo:acesso",
    quantidade: LIMITE_ACESSO_POR_HORA,
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
 * O contador vive no Postgres (@repo/rate-limit) — não existe mais o estado
 * "sem Redis" que deixou este teto desligado por meses sem ninguém ler o
 * aviso (NEB-144).
 *
 * **Degrada aberto** no erro, e só nele: falha transitória do caminho do
 * limite não pode derrubar requisição legítima do painel — se o banco caiu de
 * verdade, a própria requisição morre logo adiante, no dado. O log no catch
 * continua sendo o que separa "controle funcionando" de "controle ausente".
 */
export async function assertDentroDoLimite(
  escopo: EscopoDeLimite,
  chave: string
): Promise<void> {
  const { prefixo, quantidade, janela } = ESCOPOS[escopo];

  let resultado: { success: boolean; reset: number };
  try {
    const { createRateLimiter, fixedWindow } = await import("@repo/rate-limit");
    const limiter = createRateLimiter({
      limiter: fixedWindow(quantidade, janela),
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
