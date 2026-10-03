import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Achado 28a do Lacre (ALTO): o token do respondente (64 hex) ia no caminho
// /meridian-responder/<token> em TODA requisição — GET, cada server action — e
// aparecia em claro nos runtime logs da Vercel. A primeira carga agora valida o
// token, grava um cookie de sessão curta (httpOnly, Secure, SameSite=Lax, path
// /meridian-responder, expirando com o token) e redireciona para a URL sem token.
// Links já emitidos continuam valendo: é a primeira carga que converte.

const h = vi.hoisted(() => ({
  findUnique: vi.fn(),
  headersGet: vi.fn(),
  limit: vi.fn(),
  peek: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue({ get: h.headersGet }),
  cookies: vi.fn(),
}));
vi.mock("@repo/rate-limit", () => ({
  createRateLimiter: vi.fn(() => ({ limit: h.limit, peek: h.peek })),
  fixedWindow: vi.fn(() => ({})),
}));
vi.mock("@/lib/meridian/guards", () => ({
  MeridianRuleError: class extends Error {
    rule: string;
    constructor(rule: string, message: string) {
      super(message);
      this.rule = rule;
    }
  },
}));
vi.mock("@repo/database", () => ({
  database: { meridianRespondent: { findUnique: h.findUnique } },
}));

import { GET } from "@/app/meridian-responder/[token]/route";

const TOKEN = "ab".repeat(32);
const EXPIRES = new Date("2026-11-20T12:00:00.000Z");
const ORIGIN = "https://app.nebuloz.ai";

const call = (token: string) =>
  GET(new Request(`${ORIGIN}/meridian-responder/${token}`) as never, {
    params: Promise.resolve({ token }),
  });

const respondent = (over: Record<string, unknown> = {}) => ({
  id: "r1",
  tenantId: "t1",
  status: "PENDING",
  tokenExpiresAt: EXPIRES,
  assessment: { id: "a1", status: "COLLECTING" },
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.headersGet.mockReturnValue(null);
  h.peek.mockResolvedValue({ success: true });
  h.limit.mockResolvedValue({ success: true });
  h.findUnique.mockResolvedValue(respondent());
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /meridian-responder/<token>", () => {
  it("redireciona para a URL sem token: o token não fica no endereço final", async () => {
    const res = await call(TOKEN);
    expect(res.status).toBe(303);
    const location = res.headers.get("location") ?? "";
    expect(location).toBe(`${ORIGIN}/meridian-responder`);
    expect(location).not.toContain(TOKEN);
  });

  it("grava o token num cookie httpOnly, SameSite=Lax, no path da bateria, expirando com o token", async () => {
    const res = await call(TOKEN);
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`meridian_resp=${TOKEN}`);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toContain("Path=/meridian-responder");
    expect(cookie).toContain(`Expires=${EXPIRES.toUTCString()}`);
  });

  it("em produção o cookie é Secure", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = await call(TOKEN);
    expect(res.headers.get("set-cookie") ?? "").toMatch(/Secure/i);
  });

  it("a resposta não é cacheada nem vaza o endereço como referrer", async () => {
    const res = await call(TOKEN);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
  });

  it("consulta pelo hash, nunca pelo token em claro", async () => {
    await call(TOKEN);
    const args = h.findUnique.mock.calls[0]?.[0] as {
      where: { tokenHash: string };
    };
    expect(args.where.tokenHash).not.toBe(TOKEN);
    expect(args.where.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("token que não vale", () => {
  // O desfecho observável, igual para todo token que não vale.
  const desfecho = (res: Response) => ({
    status: res.status,
    location: res.headers.get("location"),
    cookie: res.headers.get("set-cookie"),
  });
  const SEM_COOKIE = {
    status: 303,
    location: `${ORIGIN}/meridian-responder`,
    cookie: null,
  };

  it("inexistente: mesmo redirecionamento, sem cookie", async () => {
    h.findUnique.mockResolvedValue(null);
    expect(desfecho(await call(TOKEN))).toEqual(SEM_COOKIE);
  });

  it("expirado ou revogado: mesmo redirecionamento, sem cookie", async () => {
    h.findUnique.mockResolvedValue(
      respondent({ tokenExpiresAt: new Date(Date.now() - 1000) })
    );
    expect(desfecho(await call(TOKEN))).toEqual(SEM_COOKIE);
    h.findUnique.mockResolvedValue(respondent({ status: "REVOKED" }));
    expect(desfecho(await call(TOKEN))).toEqual(SEM_COOKIE);
  });

  it("acima do teto de consultas por IP: não consulta o banco e não grava cookie", async () => {
    h.peek.mockResolvedValue({ success: false });
    expect(desfecho(await call(TOKEN))).toEqual(SEM_COOKIE);
    expect(h.findUnique).not.toHaveBeenCalled();
  });

  it("segmento que não parece token nem chega ao banco", async () => {
    expect(desfecho(await call("nao-e-um-token"))).toEqual(SEM_COOKIE);
    expect(h.findUnique).not.toHaveBeenCalled();
  });
});
