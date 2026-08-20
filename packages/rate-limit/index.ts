import { Redis } from "@upstash/redis";
import { keys } from "./keys";

export { buildRateLimitHeaders, type RateLimitResult } from "./headers";
import type { RateLimitResult } from "./headers";

// Teto de requisição no Postgres.
//
// A versão anterior era o @upstash/ratelimit — e o Upstash nunca foi
// provisionado nesta conta. O resultado prático: todo teto que dependia dele
// ou nunca valeu (back-office, webhooks) ou recusaria tudo em produção
// (copiloto, que falha fechado). A troca por Postgres é decisão de operação:
// nenhuma infra nova, nenhuma variável nova — o contador vive no banco que já
// sustenta o resto, e ao tráfego atual (dezenas de operadores) uma escrita por
// requisição limitada é ruído.
//
// Serverless é o motivo de existir contador compartilhado, seja onde for: cada
// instância de função tem a própria memória, então um contador em memória
// zeraria a cada cold start e contaria por instância, não por pessoa. O que o
// Redis dava aqui não era velocidade — era um lugar único. Postgres também é
// um lugar único.

/** Janela fixa: N requisições por janela de tempo.
 *
 *  Fixa, não deslizante — e o nome diz isso de propósito. Na fronteira entre
 *  duas janelas o pior caso admite 2× o teto por instante. Para teto de
 *  navegação (120/min) e de custo de IA (30/min), esse arredondamento é
 *  aceitável; o que ele compra é o incremento atômico numa linha só. */
export function fixedWindow(
  max: number,
  window: `${number} ${"s" | "m" | "h" | "d"}`
): { max: number; windowMs: number } {
  const [n, unit] = window.split(" ") as [string, "s" | "m" | "h" | "d"];
  const ms = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit];
  return { max, windowMs: Number(n) * ms };
}

export type RateLimiter = {
  limit: (identifier: string) => Promise<RateLimitResult>;
};

export function createRateLimiter(props: {
  limiter?: { max: number; windowMs: number };
  prefix?: string;
}): RateLimiter {
  const { max, windowMs } = props.limiter ?? fixedWindow(10, "10 s");
  const prefix = props.prefix ?? "next-forge";

  return {
    async limit(identifier: string): Promise<RateLimitResult> {
      // Import dinâmico pelo mesmo motivo documentado em packages/database:
      // o `next build` importa módulos ao coletar dados de página, e um
      // import estático faria todo importador deste pacote exigir DATABASE_URL
      // em tempo de build.
      const { database } = await import("@repo/database");

      const now = Date.now();
      const bucket = BigInt(Math.floor(now / windowMs));
      const key = `${prefix}:${identifier}`;
      const reset = (Number(bucket) + 1) * windowMs;

      const row = await database.rateLimitBucket.upsert({
        where: { key_bucket: { key, bucket } },
        create: {
          key,
          bucket,
          count: 1,
          // 2× a janela: a linha sobrevive à própria janela inteira mais uma
          // de folga, para o `reset` reportado nunca apontar para linha morta.
          expiresAt: new Date(now + 2 * windowMs),
        },
        update: { count: { increment: 1 } },
        select: { count: true },
      });

      // Varredura oportunista, só no primeiro toque de uma janela nova e só
      // das chaves deste prefixo — mantém a tabela pequena sem cron. Fora do
      // caminho de resposta: falha de limpeza não pode negar requisição.
      if (row.count === 1) {
        database.rateLimitBucket
          .deleteMany({
            where: { key, expiresAt: { lt: new Date(now) } },
          })
          .catch(() => {
            // Fica para a próxima janela. A linha expirada não conta para
            // nenhum limite — só ocupa bytes.
          });
      }

      return {
        success: row.count <= max,
        limit: max,
        remaining: Math.max(0, max - row.count),
        reset,
      };
    },
  };
}

// ── Legado Upstash ────────────────────────────────────────────────────────────
//
// O cache de módulos do @repo/rbac ainda referencia este cliente atrás de
// `UPSTASH_REDIS_REST_URL` — variável que não existe em nenhum ambiente, então
// o caminho nunca roda. O export fica até aquele cache ser removido; apagá-lo
// aqui quebraria o typecheck do rbac por um recurso que já não é usado.

let _redis: Redis | null = null;

function _getredis(): Redis {
  if (!_redis) {
    _redis = new Redis({
      url: keys().UPSTASH_REDIS_REST_URL,
      token: keys().UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return _redis;
}

export const redis = new Proxy({} as Redis, {
  get(_alvo, prop, receptor) {
    const alvoReal = _getredis();
    const valor = Reflect.get(alvoReal, prop, receptor);
    return typeof valor === "function" ? valor.bind(alvoReal) : valor;
  },
});
