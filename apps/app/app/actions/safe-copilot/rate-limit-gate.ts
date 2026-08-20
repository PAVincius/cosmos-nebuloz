import { log } from "@repo/observability/log";

/**
 * Portão de rate limiting do copiloto.
 *
 * Existe separado da rota por dois motivos: um módulo de rota do App Router só
 * exporta handlers, e a decisão de **como falhar** merece teste próprio — é ela
 * que decide se um erro de configuração vira um limite desligado em silêncio.
 *
 * A regra: em produção, um controle de segurança que não consegue funcionar
 * **fecha**. A versão anterior devolvia "pode passar" quando o Redis não estava
 * configurado, então mexer numa variável de ambiente desligava o limite sem
 * nada falhar e sem nada alertar.
 */

export type VeredictoDeLimite =
  /** Dentro do limite. */
  | "ok"
  /** O cliente excedeu o limite. Ele deve esperar. */
  | "excedido"
  /** Não foi possível avaliar o limite. Não é culpa do cliente — é
   *  configuração ou infraestrutura, e a resposta precisa dizer isso. */
  | "indisponivel";

type Dependencias = {
  producao: boolean;
  /** Devolve `true` se ainda está dentro do limite. */
  limitar: (identificador: string) => Promise<boolean>;
};

export async function avaliarLimite(
  identificador: string,
  deps: Dependencias
): Promise<VeredictoDeLimite> {
  const { producao, limitar } = deps;

  // Não há mais ramo de "não configurado": o contador vive no Postgres
  // (@repo/rate-limit), e banco ausente não é estado que este portão alcance —
  // sem DATABASE_URL o app não sobe. O que sobra é falha em tempo de execução.
  try {
    return (await limitar(identificador)) ? "ok" : "excedido";
  } catch (erro) {
    // Contador inacessível é o mesmo risco de segurança de sempre: se isto
    // devolvesse "ok", derrubar o banco do limite passaria a ser a maneira de
    // remover o teto de custo de IA.
    if (producao) {
      log.error("[copilot/chat] rate limiting indisponível", {
        error: String(erro),
      });
      return "indisponivel";
    }
    return "ok";
  }
}

/** Janela de 30 requisições por minuto por IP, preservada da versão anterior. */
export async function limitarPorIp(identificador: string): Promise<boolean> {
  const { createRateLimiter, fixedWindow } = await import("@repo/rate-limit");
  const limiter = createRateLimiter({
    limiter: fixedWindow(30, "1 m"),
    prefix: "copilot",
  });
  const { success } = await limiter.limit(identificador);
  return success;
}
