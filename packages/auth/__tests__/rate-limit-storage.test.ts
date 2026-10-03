import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// O ponto do módulo: o contador do better-auth vive no Postgres de
// @repo/rate-limit, não na memória da instância. Aqui o "Postgres" é um Map
// compartilhado e cada `createAuthRateLimitStorage()` é uma instância de
// função serverless com o próprio estado local — se o limite valer entre as
// duas, o contador está mesmo fora da memória delas.

const mocks = vi.hoisted(() => ({
  logError: vi.fn(),
  upsert: vi.fn(),
  deleteMany: vi.fn(),
}));

type Linha = { count: number; expiresAt: Date };
const tabela = new Map<string, Linha>();

function chave(key: string, bucket: bigint) {
  return `${key}#${bucket}`;
}

vi.mock("@repo/database", () => ({
  database: {
    rateLimitBucket: {
      upsert: mocks.upsert,
      deleteMany: mocks.deleteMany,
      findUnique: vi.fn(),
    },
  },
}));
vi.mock("@repo/observability/log", () => ({ log: { error: mocks.logError } }));

import { createAuthRateLimitStorage } from "../rate-limit-storage";

const REGRA = { window: 60, max: 3 };
const T0 = new Date("2026-10-03T12:00:10.000Z");

beforeEach(() => {
  tabela.clear();
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  mocks.deleteMany.mockResolvedValue({ count: 0 });
  mocks.upsert.mockImplementation(
    async (args: {
      where: { key_bucket: { key: string; bucket: bigint } };
      create: Linha;
    }) => {
      const { key, bucket } = args.where.key_bucket;
      const atual = tabela.get(chave(key, bucket));
      if (atual) {
        atual.count += 1;
        return { count: atual.count };
      }
      tabela.set(chave(key, bucket), {
        count: args.create.count,
        expiresAt: args.create.expiresAt,
      });
      return { count: args.create.count };
    }
  );
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createAuthRateLimitStorage — limite compartilhado", () => {
  it("libera até `max` e recusa a seguinte", async () => {
    const storage = createAuthRateLimitStorage();
    const key = "203.0.113.7|/sign-in/email";

    for (let i = 0; i < REGRA.max; i++) {
      expect(await storage.consume?.(key, REGRA)).toMatchObject({
        allowed: true,
      });
    }
    expect(await storage.consume?.(key, REGRA)).toMatchObject({
      allowed: false,
    });
  });

  it("vale entre instâncias: o que uma gastou, a outra já não tem", async () => {
    const instanciaA = createAuthRateLimitStorage();
    const instanciaB = createAuthRateLimitStorage();
    const key = "203.0.113.7|/sign-in/email";

    expect((await instanciaA.consume?.(key, REGRA))?.allowed).toBe(true);
    expect((await instanciaA.consume?.(key, REGRA))?.allowed).toBe(true);
    expect((await instanciaB.consume?.(key, REGRA))?.allowed).toBe(true);
    // 4ª tentativa, agora na A: o total (3) já foi gasto somando as duas.
    expect((await instanciaA.consume?.(key, REGRA))?.allowed).toBe(false);
    expect((await instanciaB.consume?.(key, REGRA))?.allowed).toBe(false);
  });

  it("chaves diferentes (IP ou rota) não dividem contador", async () => {
    const storage = createAuthRateLimitStorage();

    for (let i = 0; i < REGRA.max; i++) {
      await storage.consume?.("203.0.113.7|/sign-in/email", REGRA);
    }
    expect(
      (await storage.consume?.("203.0.113.7|/sign-in/email", REGRA))?.allowed
    ).toBe(false);
    expect(
      (await storage.consume?.("198.51.100.9|/sign-in/email", REGRA))?.allowed
    ).toBe(true);
    expect(
      (await storage.consume?.("203.0.113.7|/two-factor/verify-totp", REGRA))
        ?.allowed
    ).toBe(true);
  });

  it("recusa informa quanto falta para a janela virar (em segundos, > 0 e ≤ janela)", async () => {
    const storage = createAuthRateLimitStorage();
    const key = "203.0.113.7|/sign-in/email";
    for (let i = 0; i < REGRA.max; i++) {
      await storage.consume?.(key, REGRA);
    }

    const recusa = await storage.consume?.(key, REGRA);

    expect(recusa?.allowed).toBe(false);
    expect(recusa?.retryAfter).toBeGreaterThan(0);
    expect(recusa?.retryAfter).toBeLessThanOrEqual(REGRA.window);
  });

  it("libera de novo quando a janela vira", async () => {
    const storage = createAuthRateLimitStorage();
    const key = "203.0.113.7|/sign-in/email";
    for (let i = 0; i < REGRA.max + 1; i++) {
      await storage.consume?.(key, REGRA);
    }

    vi.setSystemTime(new Date(T0.getTime() + REGRA.window * 1000));

    expect((await storage.consume?.(key, REGRA))?.allowed).toBe(true);
  });

  it("janelas diferentes na mesma chave não se atropelam", async () => {
    const storage = createAuthRateLimitStorage();
    const key = "203.0.113.7|/sign-in/email";

    for (let i = 0; i < 3; i++) {
      await storage.consume?.(key, { window: 60, max: 3 });
    }

    expect(
      (await storage.consume?.(key, { window: 900, max: 3 }))?.allowed
    ).toBe(true);
  });
});

describe("createAuthRateLimitStorage — falha de infraestrutura", () => {
  it("se o Postgres falhar, libera e registra o erro (o login não depende do freio)", async () => {
    const falha = new Error("connection refused");
    mocks.upsert.mockRejectedValueOnce(falha);
    const storage = createAuthRateLimitStorage();

    const resultado = await storage.consume?.(
      "203.0.113.7|/sign-in/email",
      REGRA
    );

    expect(resultado).toEqual({ allowed: true, retryAfter: null });
    expect(mocks.logError).toHaveBeenCalledWith(
      expect.stringContaining("rate limit"),
      expect.objectContaining({ error: falha })
    );
  });
});
