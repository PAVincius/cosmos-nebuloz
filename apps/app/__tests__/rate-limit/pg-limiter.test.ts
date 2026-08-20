// pg-limiter.test.ts — o teto de requisição que vive no Postgres.
//
// A troca do Upstash pelo banco foi decisão de operação (NEB-143/144): a infra
// nunca existiu, e o contador passou para onde o dado já mora. O que se prova
// aqui é a aritmética da janela e as duas regras que não podem regredir: o
// incremento é um upsert só, e a limpeza nunca nega requisição.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  upsert: vi.fn(),
  deleteMany: vi.fn(),
}));

vi.mock("@repo/database", () => ({
  database: {
    rateLimitBucket: { upsert: h.upsert, deleteMany: h.deleteMany },
  },
}));

import { createRateLimiter, fixedWindow } from "@repo/rate-limit";

const AGORA = new Date("2026-08-20T12:00:30.000Z").getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(AGORA);
  h.upsert.mockReset();
  h.deleteMany.mockReset();
  h.upsert.mockResolvedValue({ count: 1 });
  h.deleteMany.mockResolvedValue({ count: 0 });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("fixedWindow", () => {
  it("traduz a janela para milissegundos", () => {
    expect(fixedWindow(30, "1 m")).toEqual({ max: 30, windowMs: 60_000 });
    expect(fixedWindow(10, "1 h")).toEqual({ max: 10, windowMs: 3_600_000 });
    expect(fixedWindow(5, "10 s")).toEqual({ max: 5, windowMs: 10_000 });
  });
});

describe("createRateLimiter", () => {
  const limiter = () =>
    createRateLimiter({ limiter: fixedWindow(3, "1 m"), prefix: "teste" });

  it("primeiro toque passa e desconta do teto", async () => {
    const r = await limiter().limit("u-1");

    expect(r.success).toBe(true);
    expect(r.limit).toBe(3);
    expect(r.remaining).toBe(2);
  });

  it("a chave carrega o prefixo — escopos não dividem cota", async () => {
    await limiter().limit("u-1");

    expect(h.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          key_bucket: expect.objectContaining({ key: "teste:u-1" }),
        }),
      })
    );
  });

  it("acima do teto recusa, com remaining zero e não negativo", async () => {
    h.upsert.mockResolvedValue({ count: 5 });

    const r = await limiter().limit("u-1");

    expect(r.success).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it("no teto exato ainda passa — o limite é inclusivo", async () => {
    h.upsert.mockResolvedValue({ count: 3 });

    const r = await limiter().limit("u-1");

    expect(r.success).toBe(true);
    expect(r.remaining).toBe(0);
  });

  it("reset aponta o começo da PRÓXIMA janela", async () => {
    const r = await limiter().limit("u-1");

    // AGORA está 30s dentro de uma janela de 1 min: o reset é dali a 30s,
    // nunca no passado — é o que o Retry-After dos headers consome.
    const inicioDaProxima = (Math.floor(AGORA / 60_000) + 1) * 60_000;
    expect(r.reset).toBe(inicioDaProxima);
    expect(r.reset).toBeGreaterThan(AGORA);
  });

  it("varre linhas expiradas só no primeiro toque da janela", async () => {
    h.upsert.mockResolvedValueOnce({ count: 1 });
    await limiter().limit("u-1");
    expect(h.deleteMany).toHaveBeenCalledTimes(1);

    h.upsert.mockResolvedValueOnce({ count: 2 });
    await limiter().limit("u-1");
    // Segundo toque: sem varredura. Uma limpeza por janela por chave basta, e
    // varrer a cada requisição pagaria um delete no caminho quente.
    expect(h.deleteMany).toHaveBeenCalledTimes(1);
  });

  it("falha da varredura NUNCA nega a requisição", async () => {
    h.deleteMany.mockRejectedValue(new Error("timeout"));

    const r = await limiter().limit("u-1");

    // A limpeza é higiene, não controle: linha expirada só ocupa bytes.
    expect(r.success).toBe(true);
  });
});
