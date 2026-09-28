import { beforeEach, describe, expect, it, vi } from "vitest";

// peek() é a leitura sem incremento que faltava — pra quem precisa recusar
// ANTES de fazer trabalho caro (ex. consulta ao banco por hash de token no
// Meridian) sem gastar uma tentativa só pra saber se o teto já estourou.
// Não pode mudar o comportamento de limit(), que continua sendo quem
// incrementa de verdade.

const h = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
  deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
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

import { createRateLimiter, fixedWindow } from "../index";

beforeEach(() => {
  vi.clearAllMocks();
  h.deleteMany.mockResolvedValue({ count: 0 });
});

describe("peek", () => {
  it("sem linha nenhuma ainda, devolve sucesso sem consultar upsert", async () => {
    h.findUnique.mockResolvedValue(null);
    const limiter = createRateLimiter({
      limiter: fixedWindow(3, "1 m"),
      prefix: "t",
    });

    const r = await limiter.peek("1.2.3.4");

    expect(r.success).toBe(true);
    expect(r.remaining).toBe(3);
    expect(h.upsert).not.toHaveBeenCalled();
  });

  it("abaixo do teto, devolve sucesso e o restante correto", async () => {
    h.findUnique.mockResolvedValue({ count: 2 });
    const limiter = createRateLimiter({
      limiter: fixedWindow(3, "1 m"),
      prefix: "t",
    });

    const r = await limiter.peek("1.2.3.4");

    expect(r.success).toBe(true);
    expect(r.remaining).toBe(1);
  });

  it("já no teto (count === max), devolve falha — prevê que o próximo limit() estouraria", async () => {
    h.findUnique.mockResolvedValue({ count: 3 });
    const limiter = createRateLimiter({
      limiter: fixedWindow(3, "1 m"),
      prefix: "t",
    });

    const r = await limiter.peek("1.2.3.4");

    expect(r.success).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it("nunca incrementa — chamar peek várias vezes não muda o resultado", async () => {
    h.findUnique.mockResolvedValue({ count: 1 });
    const limiter = createRateLimiter({
      limiter: fixedWindow(3, "1 m"),
      prefix: "t",
    });

    await limiter.peek("1.2.3.4");
    await limiter.peek("1.2.3.4");
    const r = await limiter.peek("1.2.3.4");

    expect(r.remaining).toBe(2);
    expect(h.upsert).not.toHaveBeenCalled();
  });

  it("usa a mesma key/bucket de limit() para o mesmo identificador", async () => {
    h.findUnique.mockResolvedValue(null);
    const limiter = createRateLimiter({
      limiter: fixedWindow(3, "1 m"),
      prefix: "meridian-token-lookup",
    });

    await limiter.peek("9.9.9.9");

    const args = h.findUnique.mock.calls[0]?.[0] as {
      where: { key_bucket: { key: string } };
    };
    expect(args.where.key_bucket.key).toBe("meridian-token-lookup:9.9.9.9");
  });
});
