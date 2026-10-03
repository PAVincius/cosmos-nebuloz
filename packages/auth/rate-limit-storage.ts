import { log } from "@repo/observability/log";
import {
  createRateLimiter,
  fixedWindow,
  type RateLimiter,
} from "@repo/rate-limit";
import type { BetterAuthOptions } from "better-auth";

type AuthRateLimitStorage = NonNullable<
  NonNullable<BetterAuthOptions["rateLimit"]>["customStorage"]
>;

// O rateLimit do better-auth sem `storage` conta na memória da instância. Em
// serverless cada instância de função tem a sua, então o teto de login, 2FA e
// cadastro valia "por instância": um atacante distribuído por N instâncias
// tinha N vezes o limite, e cada cold start zerava a conta. Aqui o contador é
// o mesmo de @repo/rate-limit — uma linha por chave e janela no Postgres,
// incrementada atomicamente —, então o limite vale entre instâncias.
//
// O better-auth chama `consume(key, rule)` e decide só pelo `allowed`. `key`
// já vem como `<ip>|<rota>`, e a regra (janela em segundos, máximo) muda por
// rota, então há um limiter por janela/máximo, criado sob demanda. A janela
// entra no prefixo para a mesma chave sob regras diferentes não dividir linha.
export function createAuthRateLimitStorage(): AuthRateLimitStorage {
  const limiters = new Map<string, RateLimiter>();

  const limiterFor = (rule: { window: number; max: number }) => {
    const id = `${rule.window}s:${rule.max}`;
    let limiter = limiters.get(id);
    if (!limiter) {
      limiter = createRateLimiter({
        limiter: fixedWindow(rule.max, `${rule.window} s`),
        prefix: `auth:${rule.window}s`,
      });
      limiters.set(id, limiter);
    }
    return limiter;
  };

  return {
    // Só `consume` é usado: o better-auth prefere o caminho atômico quando ele
    // existe. `get`/`set` fazem parte do contrato do tipo, mas ler e gravar um
    // contador em dois passos é justamente o que não é atômico.
    get: async () => null,
    set: async () => undefined,
    consume: async (key, rule) => {
      try {
        const resultado = await limiterFor(rule).limit(key);
        if (resultado.success) {
          return { allowed: true, retryAfter: null };
        }
        return {
          allowed: false,
          retryAfter: Math.max(
            1,
            Math.ceil((resultado.reset - Date.now()) / 1000)
          ),
        };
      } catch (error: unknown) {
        // Falha do contador não pode derrubar o login: o próprio login precisa
        // do mesmo banco, e quem causa erro de banco não é o atacante. Libera e
        // deixa rastro para alguém ver que o freio ficou sem efeito.
        log.error(
          "[auth] rate limit: contador indisponível, requisição liberada",
          {
            error,
          }
        );
        return { allowed: true, retryAfter: null };
      }
    },
  };
}
