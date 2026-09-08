// github-rate-limit.test.ts — o portão de teto do webhook do GitHub.
//
// Mesmo defeito do webhook do Linear (NEB-144): `checkWebhookRateLimit`
// devolvia `false` sempre que `UPSTASH_REDIS_REST_URL` estava ausente — o que
// é sempre, em todo ambiente —, então a rota respondia 429 para toda
// requisição, sem nunca consultar o limiter real. Este arquivo prova que
// quem decide a resposta agora é o limiter, não a variável morta.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  limit: vi.fn(),
  createRateLimiter: vi.fn(),
  fixedWindow: vi.fn(),
}));

vi.mock("@repo/rate-limit", () => ({
  createRateLimiter: mocks.createRateLimiter,
  fixedWindow: mocks.fixedWindow,
}));
vi.mock("@repo/database", () => ({ database: {} }));
vi.mock("@repo/observability/log", () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));
vi.mock("@/app/actions/integrations/webhooks/verify-signature", () => ({
  // Assinatura válida por padrão: o que este arquivo testa é o teto de
  // requisição, não a verificação de assinatura. Uma assinatura inválida
  // desviaria para logInvalidSignature (grava AuditLog) antes do que importa
  // aqui.
  verifyGitHubSignature: vi.fn().mockReturnValue(true),
}));

import { NextRequest } from "next/server";
import { POST } from "../../../app/api/webhooks/github/route";

function makeRequest() {
  return new NextRequest("http://localhost/api/webhooks/github", {
    method: "POST",
    headers: { "x-forwarded-for": "5.6.7.8" },
    body: "{}",
  });
}

describe("POST /api/webhooks/github — teto de requisição", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.UPSTASH_REDIS_REST_URL = undefined;
    process.env.GITHUB_WEBHOOK_SECRET = undefined;
    mocks.fixedWindow.mockReturnValue({ max: 100, windowMs: 60_000 });
    mocks.createRateLimiter.mockReturnValue({ limit: mocks.limit });
  });

  it("nega com 429 quando o limiter real diz que estourou", async () => {
    mocks.limit.mockResolvedValue({
      success: false,
      limit: 100,
      remaining: 0,
      reset: Date.now() + 60_000,
    });

    const res = await POST(makeRequest());

    expect(res.status).toBe(429);
    expect(mocks.createRateLimiter).toHaveBeenCalledWith(
      expect.objectContaining({ prefix: "webhook:github" })
    );
  });

  it("não fica preso em 429 quando UPSTASH_REDIS_REST_URL está ausente e o limiter libera", async () => {
    mocks.limit.mockResolvedValue({
      success: true,
      limit: 100,
      remaining: 99,
      reset: Date.now() + 60_000,
    });

    const res = await POST(makeRequest());

    expect(res.status).not.toBe(429);
    expect(mocks.limit).toHaveBeenCalledWith("5.6.7.8");
  });
});
