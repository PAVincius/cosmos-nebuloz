// fireflies-rate-limit.test.ts — o portão de teto do webhook do Fireflies.
//
// Aqui o defeito era o oposto do Linear/GitHub (NEB-144): `checkWebhookRateLimit`
// devolvia `true` (libera) sempre que `UPSTASH_REDIS_REST_URL` estava ausente
// — sempre, em todo ambiente —, então `createRateLimiter` nunca era chamado e
// o webhook ficava sem teto nenhum, para sempre. Este arquivo prova que uma
// negativa do limiter real agora chega como 429.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  limit: vi.fn(),
  createRateLimiter: vi.fn(),
  fixedWindow: vi.fn(),
  meetingIntegrationFindFirst: vi.fn(),
}));

vi.mock("@repo/rate-limit", () => ({
  createRateLimiter: mocks.createRateLimiter,
  fixedWindow: mocks.fixedWindow,
}));
vi.mock("@repo/database", () => ({
  database: {
    meetingIntegration: { findFirst: mocks.meetingIntegrationFindFirst },
  },
}));
vi.mock("@repo/observability/log", () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));
vi.mock("@/app/actions/integrations/webhooks/verify-signature", () => ({
  verifyFirefliesSignature: vi.fn(),
}));

import { NextRequest } from "next/server";
import { POST } from "../../../app/api/webhooks/fireflies/[integrationId]/route";

function makeRequest() {
  return new NextRequest("http://localhost/api/webhooks/fireflies/int-1", {
    method: "POST",
    headers: { "x-forwarded-for": "9.9.9.9" },
    body: "{}",
  });
}

const params = Promise.resolve({ integrationId: "int-1" });

describe("POST /api/webhooks/fireflies/[integrationId] — teto de requisição", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.UPSTASH_REDIS_REST_URL = undefined;
    mocks.fixedWindow.mockReturnValue({ max: 100, windowMs: 60_000 });
    mocks.createRateLimiter.mockReturnValue({ limit: mocks.limit });
    mocks.meetingIntegrationFindFirst.mockResolvedValue(null);
  });

  it("nega com 429 quando o limiter real diz que estourou, mesmo sem UPSTASH_REDIS_REST_URL", async () => {
    mocks.limit.mockResolvedValue({
      success: false,
      limit: 100,
      remaining: 0,
      reset: Date.now() + 60_000,
    });

    const res = await POST(makeRequest(), { params });

    expect(res.status).toBe(429);
    expect(mocks.createRateLimiter).toHaveBeenCalledWith(
      expect.objectContaining({ prefix: "webhook:fireflies" })
    );
    // Antes da correção, isto nunca era chamado: o guard morto liberava a
    // requisição sem consultar o limiter.
    expect(mocks.limit).toHaveBeenCalledWith("9.9.9.9");
  });

  it("segue o fluxo normal quando o limiter libera", async () => {
    mocks.limit.mockResolvedValue({
      success: true,
      limit: 100,
      remaining: 99,
      reset: Date.now() + 60_000,
    });

    const res = await POST(makeRequest(), { params });

    expect(res.status).not.toBe(429);
    expect(mocks.meetingIntegrationFindFirst).toHaveBeenCalled();
  });
});
