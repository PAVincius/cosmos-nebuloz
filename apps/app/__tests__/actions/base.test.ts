import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  buildPage,
  err,
  ok,
  PaginationSchema,
  paginationArgs,
  safeAction,
  toActionError,
} from "../../app/actions/_base";

describe("ok / err", () => {
  it("ok wraps data with ok:true", () => {
    expect(ok("hello")).toEqual({ ok: true, data: "hello" });
    expect(ok(42)).toEqual({ ok: true, data: 42 });
    expect(ok(null)).toEqual({ ok: true, data: null });
  });

  it("err wraps message with ok:false", () => {
    expect(err("bad input")).toEqual({ ok: false, error: "bad input" });
  });

  // `code: undefined` vira "$undefined" na serialização das server actions e
  // chega ao cliente como lixo: sem code, a chave não existe.
  it("err sem code não carrega a chave code", () => {
    expect(Object.keys(err("bad input"))).toEqual(["ok", "error"]);
  });

  it("err includes optional code", () => {
    expect(err("not found", "NOT_FOUND")).toEqual({
      ok: false,
      error: "not found",
      code: "NOT_FOUND",
    });
  });
});

describe("PaginationSchema", () => {
  it("defaults page=1 limit=20", () => {
    expect(PaginationSchema.parse({})).toEqual({ page: 1, limit: 20 });
  });

  it("coerces string numbers", () => {
    expect(PaginationSchema.parse({ page: "3", limit: "10" })).toEqual({
      page: 3,
      limit: 10,
    });
  });

  it("rejects limit above 100", () => {
    expect(() => PaginationSchema.parse({ limit: 101 })).toThrow();
  });

  it("rejects negative page", () => {
    expect(() => PaginationSchema.parse({ page: -1 })).toThrow();
  });
});

describe("paginationArgs", () => {
  it("returns skip and take for page 1", () => {
    expect(paginationArgs(1, 20)).toEqual({ skip: 0, take: 20 });
  });

  it("calculates skip for page 3", () => {
    expect(paginationArgs(3, 10)).toEqual({ skip: 20, take: 10 });
  });

  it("defaults to page 1 limit 20", () => {
    expect(paginationArgs()).toEqual({ skip: 0, take: 20 });
  });
});

describe("buildPage", () => {
  it("builds meta with hasNext and hasPrev false on single page", () => {
    const result = buildPage([1, 2], 2, 1, 20);
    expect(result.meta).toMatchObject({
      total: 2,
      page: 1,
      limit: 20,
      pageCount: 1,
      hasNext: false,
      hasPrev: false,
    });
    expect(result.items).toEqual([1, 2]);
  });

  it("hasNext true when more pages exist", () => {
    const result = buildPage(["a"], 50, 1, 10);
    expect(result.meta.hasNext).toBe(true);
    expect(result.meta.pageCount).toBe(5);
  });

  it("hasPrev true on page 2+", () => {
    const result = buildPage([], 50, 2, 10);
    expect(result.meta.hasPrev).toBe(true);
    expect(result.meta.hasNext).toBe(true);
  });

  it("last page has hasNext false", () => {
    const result = buildPage([], 20, 2, 10);
    expect(result.meta.hasNext).toBe(false);
  });
});

describe("toActionError", () => {
  it("formats ZodError with path and message", () => {
    let zodErr: z.ZodError | undefined;
    try {
      z.object({ name: z.string().min(1) }).parse({ name: "" });
    } catch (e) {
      zodErr = e as z.ZodError;
    }
    const msg = toActionError(zodErr);
    expect(msg).toContain("name");
  });

  it("returns Error.message for Error instances", () => {
    expect(toActionError(new Error("oops"))).toBe("oops");
  });

  it("returns fallback for unknown values", () => {
    expect(toActionError("string error")).toBe("Erro inesperado");
    expect(toActionError(42)).toBe("Erro inesperado");
    expect(toActionError(null)).toBe("Erro inesperado");
  });
});

describe("safeAction", () => {
  it("returns ok result on success", async () => {
    const result = await safeAction(() => Promise.resolve(99));
    expect(result).toEqual({ ok: true, data: 99 });
  });

  it("returns err result on thrown Error", async () => {
    const result = await safeAction(() =>
      Promise.reject(new Error("db failure"))
    );
    expect(result).toEqual({ ok: false, error: "db failure" });
  });

  it("passa a regra nomeada do erro de domínio como code", async () => {
    class RuleError extends Error {
      readonly rule = "benchmark.not-enabled";
    }
    const result = await safeAction(() =>
      Promise.reject(new RuleError("O benchmark não está habilitado."))
    );
    expect(result).toEqual({
      ok: false,
      error: "O benchmark não está habilitado.",
      code: "benchmark.not-enabled",
    });
  });

  // Defesa em profundidade (Vigia): só um identificador `dominio.motivo` vira
  // code. Texto livre, e-mail, id ou valor longo numa `rule` não sai do servidor.
  it("rule que não é identificador não vira code", async () => {
    for (const rule of [
      "texto livre com espaço",
      "ana@empresa.com.br",
      "a".repeat(81),
      "",
      "1inicia-com-digito",
    ]) {
      class RuleError extends Error {
        readonly rule = rule;
      }
      const result = await safeAction(() =>
        Promise.reject(new RuleError("mensagem"))
      );
      expect(Object.keys(result), rule).toEqual(["ok", "error"]);
    }
  });

  it("rule que não é string não vira code", async () => {
    const result = await safeAction(() =>
      Promise.reject(Object.assign(new Error("m"), { rule: { x: 1 } }))
    );
    expect(Object.keys(result)).toEqual(["ok", "error"]);
  });

  it("aceita os formatos reais de regra (ponto, hífen, camelCase)", async () => {
    for (const rule of [
      "benchmark.not-enabled",
      "ack.justificationRequired",
      "control.file.too-large",
    ]) {
      class RuleError extends Error {
        readonly rule = rule;
      }
      const result = await safeAction(() => Promise.reject(new RuleError("m")));
      expect(!result.ok && result.code).toBe(rule);
    }
  });

  it("erro sem regra nomeada não ganha chave code", async () => {
    const result = await safeAction(() => Promise.reject(new Error("boom")));
    expect(Object.keys(result)).toEqual(["ok", "error"]);
  });

  it("returns err result on thrown ZodError", async () => {
    const result = await safeAction(async () => {
      z.string().parse(123);
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("string");
    }
  });
});
