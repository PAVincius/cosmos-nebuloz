// linear-rate-limit.test.ts — o portão de teto do webhook do Linear.
//
// NEB-144: a rota checava `UPSTASH_REDIS_REST_URL` antes de chamar o limiter
// de verdade — variável que não existe em nenhum ambiente. Como o guard
// devolvia `false` (não liberado), a rota respondia 429 para TODA requisição,
// sem nunca consultar `createRateLimiter`. Não era "sem teto", era a rota
// inteira fora do ar. O que este arquivo prova: o resultado do limiter real
// é o que decide a resposta — não a variável de ambiente morta.
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
  verifyLinearSignature: vi.fn().mockReturnValue(true),
}));
vi.mock("@/lib/security/replay-protection", () => ({
  checkReplayTimestamp: vi.fn(),
}));

import { NextRequest } from "next/server";
import { POST } from "../../../app/api/webhooks/linear/route";

function makeRequest() {
  return new NextRequest("http://localhost/api/webhooks/linear", {
    method: "POST",
    headers: { "x-forwarded-for": "1.2.3.4" },
    body: "{}",
  });
}

describe("POST /api/webhooks/linear — teto de requisição", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.UPSTASH_REDIS_REST_URL = undefined;
    process.env.LINEAR_WEBHOOK_SECRET = undefined;
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
      expect.objectContaining({ prefix: "webhook:linear" })
    );
  });

  it("não fica preso em 429 quando UPSTASH_REDIS_REST_URL está ausente e o limiter libera", async () => {
    // Sem UPSTASH_REDIS_REST_URL (nunca existiu em nenhum ambiente) e sem
    // LINEAR_WEBHOOK_SECRET — antes da correção, o guard morto devolvia 429
    // aqui de qualquer forma, mesmo com o limiter liberando. Depois da
    // correção, a rota passa do teto e cai no próximo guard real (segredo
    // ausente = 500), nunca em 429.
    mocks.limit.mockResolvedValue({
      success: true,
      limit: 100,
      remaining: 99,
      reset: Date.now() + 60_000,
    });

    const res = await POST(makeRequest());

    expect(res.status).not.toBe(429);
    expect(mocks.limit).toHaveBeenCalledWith("1.2.3.4");
  });
});
