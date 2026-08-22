// upload-rate-limit.test.ts — o portão de teto do upload do copiloto.
//
// NEB-143/144: `checkUploadRateLimit` devolvia `false` sempre que
// `UPSTASH_REDIS_REST_URL` estava ausente — sempre, em todo ambiente —,
// então a rota respondia 429 ("Upload rate limit exceeded") para todo
// upload, sem nunca consultar o limiter real no Postgres. Este arquivo prova
// que quem decide a resposta agora é o limiter, não a variável morta.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  limit: vi.fn(),
  createRateLimiter: vi.fn(),
  fixedWindow: vi.fn(),
  requireTenantSession: vi.fn(),
  headers: vi.fn(),
}));

vi.mock("@repo/rate-limit", () => ({
  createRateLimiter: mocks.createRateLimiter,
  fixedWindow: mocks.fixedWindow,
}));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
}));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@repo/observability/log", () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));
vi.mock("@/app/actions/safe-copilot/indexer", () => ({
  indexDocumentChunk: vi.fn(),
}));

import { POST } from "../../../app/api/copilot/upload/route";

function makeRequest() {
  return new Request("http://localhost/api/copilot/upload", {
    method: "POST",
    body: new FormData(),
  });
}

describe("POST /api/copilot/upload — teto de requisição", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.UPSTASH_REDIS_REST_URL = undefined;
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({ tenantId: "tenant-1" });
    mocks.fixedWindow.mockReturnValue({ max: 10, windowMs: 3_600_000 });
    mocks.createRateLimiter.mockReturnValue({ limit: mocks.limit });
  });

  it("nega com 429 quando o limiter real diz que estourou", async () => {
    mocks.limit.mockResolvedValue({
      success: false,
      limit: 10,
      remaining: 0,
      reset: Date.now() + 3_600_000,
    });

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error).toMatch(/rate limit/i);
    expect(mocks.createRateLimiter).toHaveBeenCalledWith(
      expect.objectContaining({ prefix: "copilot:upload" })
    );
    expect(mocks.limit).toHaveBeenCalledWith("tenant-1");
  });

  it("não fica preso em 429 quando UPSTASH_REDIS_REST_URL está ausente e o limiter libera", async () => {
    mocks.limit.mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 9,
      reset: Date.now() + 3_600_000,
    });

    const res = await POST(makeRequest());

    // Sem arquivo no FormData vazio, a rota segue até o guard de negócio
    // (400 "file and sessionId required") — o que importa aqui é que ela
    // passou do teto, não que 429 nunca apareça de novo.
    expect(res.status).not.toBe(429);
  });
});
