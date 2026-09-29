import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// limit() é quem incrementa de verdade — o contrato que os handlers usam para
// recusar requisição. A cobertura do pacote estava em 45% porque só peek()
// tinha teste; o piso de 80% do vitest.config barrava o job de testes.

const h = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
  deleteMany: vi.fn(),
  redisCtor: vi.fn(),
}));

vi.mock("@repo/database", () => ({
  database: {
    rateLimitBucket: {
      findUnique: h.findUnique,
      upsert: h.upsert,
      deleteMany: h.deleteMany,
    },
  },
}));

vi.mock("@upstash/redis", () => ({
  Redis: class {
    readonly url: string | undefined;
    readonly label = "cliente-legado";
    constructor(opts: { url?: string; token?: string }) {
      h.redisCtor(opts);
      this.url = opts.url;
    }
    get(chave: string) {
      return `valor:${chave}:${this.url}`;
    }
  },
}));

import {
  buildRateLimitHeaders,
  createRateLimiter,
  fixedWindow,
  redis,
} from "../index";

const AGORA = 1_700_000_000_000;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(AGORA);
  h.deleteMany.mockResolvedValue({ count: 0 });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("fixedWindow", () => {
  it("converte cada unidade para milissegundos", () => {
    expect(fixedWindow(5, "30 s")).toEqual({ max: 5, windowMs: 30_000 });
    expect(fixedWindow(5, "2 m")).toEqual({ max: 5, windowMs: 120_000 });
    expect(fixedWindow(5, "1 h")).toEqual({ max: 5, windowMs: 3_600_000 });
    expect(fixedWindow(5, "1 d")).toEqual({ max: 5, windowMs: 86_400_000 });
  });
});

describe("limit", () => {
  it("primeiro toque da janela: passa, grava a linha e varre as expiradas", async () => {
    h.upsert.mockResolvedValue({ count: 1 });
    const limiter = createRateLimiter({
      limiter: fixedWindow(3, "1 m"),
      prefix: "t",
    });

    const r = await limiter.limit("1.2.3.4");

    expect(r).toEqual({
      success: true,
      limit: 3,
      remaining: 2,
      reset: (Math.floor(AGORA / 60_000) + 1) * 60_000,
    });
    const args = h.upsert.mock.calls[0][0];
    expect(args.where.key_bucket).toEqual({
      key: "t:1.2.3.4",
      bucket: BigInt(Math.floor(AGORA / 60_000)),
    });
    expect(args.create.expiresAt).toEqual(new Date(AGORA + 120_000));
    expect(h.deleteMany).toHaveBeenCalledWith({
      where: { key: "t:1.2.3.4", expiresAt: { lt: new Date(AGORA) } },
    });
  });

  it("toques seguintes não varrem a tabela de novo", async () => {
    h.upsert.mockResolvedValue({ count: 2 });
    const limiter = createRateLimiter({
      limiter: fixedWindow(3, "1 m"),
      prefix: "t",
    });

    await limiter.limit("1.2.3.4");

    expect(h.deleteMany).not.toHaveBeenCalled();
  });

  it("acima do teto: recusa com restante zero", async () => {
    h.upsert.mockResolvedValue({ count: 4 });
    const limiter = createRateLimiter({
      limiter: fixedWindow(3, "1 m"),
      prefix: "t",
    });

    const r = await limiter.limit("1.2.3.4");

    expect(r.success).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it("falha na varredura não nega a requisição", async () => {
    h.upsert.mockResolvedValue({ count: 1 });
    h.deleteMany.mockRejectedValue(new Error("banco fora"));
    const limiter = createRateLimiter({
      limiter: fixedWindow(3, "1 m"),
      prefix: "t",
    });

    await expect(limiter.limit("1.2.3.4")).resolves.toMatchObject({
      success: true,
    });
  });

  it("sem opções, usa 10 por 10 s e o prefixo padrão", async () => {
    h.upsert.mockResolvedValue({ count: 10 });
    const limiter = createRateLimiter({});

    const r = await limiter.limit("x");

    expect(r.limit).toBe(10);
    expect(r.success).toBe(true);
    expect(h.upsert.mock.calls[0][0].where.key_bucket.key).toBe("next-forge:x");
  });
});

describe("buildRateLimitHeaders", () => {
  it("dentro do teto, não manda Retry-After", () => {
    const headers = buildRateLimitHeaders({
      success: true,
      limit: 10,
      remaining: 4,
      reset: AGORA + 30_000,
    }) as Record<string, string>;

    expect(headers).toEqual({
      "X-RateLimit-Limit": "10",
      "X-RateLimit-Remaining": "4",
      "X-RateLimit-Reset": String(Math.ceil((AGORA + 30_000) / 1000)),
    });
  });

  it("recusado, manda Retry-After em segundos e nunca restante negativo", () => {
    const headers = buildRateLimitHeaders({
      success: false,
      limit: 10,
      remaining: -2,
      reset: AGORA + 12_500,
    }) as Record<string, string>;

    expect(headers["X-RateLimit-Remaining"]).toBe("0");
    expect(headers["Retry-After"]).toBe("13");
  });

  it("janela já virando: Retry-After nunca fica abaixo de 1", () => {
    const headers = buildRateLimitHeaders({
      success: false,
      limit: 10,
      remaining: 0,
      reset: AGORA - 500,
    }) as Record<string, string>;

    expect(headers["Retry-After"]).toBe("1");
  });
});

describe("redis (legado)", () => {
  it("constrói o cliente uma vez, na primeira leitura, e liga os métodos a ele", () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.exemplo.invalid");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token-de-teste");

    expect(h.redisCtor).not.toHaveBeenCalled();
    expect(redis.get("k")).toBe("valor:k:https://redis.exemplo.invalid");
    expect((redis as unknown as { label: string }).label).toBe(
      "cliente-legado"
    );
    expect(h.redisCtor).toHaveBeenCalledTimes(1);

    vi.unstubAllEnvs();
  });
});
