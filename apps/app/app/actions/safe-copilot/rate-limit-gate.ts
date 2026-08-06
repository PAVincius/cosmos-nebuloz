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
  env: { UPSTASH_REDIS_REST_URL?: string };
  producao: boolean;
  /** Devolve `true` se ainda está dentro do limite. */
  limitar: (identificador: string) => Promise<boolean>;
};

export async function avaliarLimite(
  identificador: string,
  deps: Dependencias
): Promise<VeredictoDeLimite> {
  const { env, producao, limitar } = deps;

  if (!env.UPSTASH_REDIS_REST_URL) {
    if (producao) {
      log.error(
        "[copilot/chat] UPSTASH_REDIS_REST_URL ausente em produção — o rate limiting não pode ser aplicado e as requisições estão sendo recusadas."
      );
      return "indisponivel";
    }
    return "ok";
  }

  try {
    return (await limitar(identificador)) ? "ok" : "excedido";
  } catch (erro) {
    // Redis configurado mas inacessível é o mesmo risco de segurança: se isto
    // devolvesse "ok", derrubar o Redis passaria a ser a maneira de remover o
    // limite.
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
  const { createRateLimiter, slidingWindow } = await import("@repo/rate-limit");
  const limiter = createRateLimiter({
    limiter: slidingWindow(30, "1 m"),
    prefix: "copilot",
  });
  const { success } = await limiter.limit(identificador);
  return success;
}
