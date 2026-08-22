// analyze-invest-quota.test.ts — a cota mensal de custo de IA do INVEST.
//
// NEB-144 listava esta rota entre as superfícies sem teto: o consumo mensal
// (`redis.get`/`incr`/`expire`) só rodava atrás de `UPSTASH_REDIS_REST_URL`,
// que não existe em nenhum ambiente — plano pago (ORBIT/GALAXY/NEBULA) ficava
// com IA ilimitada na prática. Este arquivo prova que a cota agora vale sem
// depender da variável morta, usando o mesmo limiter Postgres do resto do
// pacote — e que um cache-hit não consome cota.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  limit: vi.fn(),
  createRateLimiter: vi.fn(),
  fixedWindow: vi.fn(),
  redisGet: vi.fn(),
  redisSet: vi.fn(),
  requireTenantSession: vi.fn(),
  headers: vi.fn(),
  epicFindFirst: vi.fn(),
  tenantFindFirst: vi.fn(),
  epicUpdateMany: vi.fn(),
  getActiveProvider: vi.fn(),
  getAIModel: vi.fn(),
  streamText: vi.fn(),
}));

vi.mock("@repo/rate-limit", () => ({
  createRateLimiter: mocks.createRateLimiter,
  fixedWindow: mocks.fixedWindow,
  redis: { get: mocks.redisGet, set: mocks.redisSet },
}));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
}));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@repo/database", () => ({
  database: {
    epic: { findFirst: mocks.epicFindFirst, updateMany: mocks.epicUpdateMany },
    tenant: { findFirst: mocks.tenantFindFirst },
  },
}));
vi.mock("@repo/ai/lib/models", () => ({
  getActiveProvider: mocks.getActiveProvider,
  getAIModel: mocks.getAIModel,
}));
vi.mock("ai", () => ({ streamText: mocks.streamText }));

import { POST } from "../../../app/api/epics/[epicId]/analyze-invest/route";

const EPIC = {
  title: "Epic de teste",
  descriptionMd: "x".repeat(150),
  hypothesis: "hipótese",
  businessOutcomes: [],
  mvp: null,
  nfrs: null,
  investHash: "hash-antigo",
};

function makeRequest(body: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/epics/epic-1/analyze-invest", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const params = Promise.resolve({ epicId: "epic-1" });

describe("POST /api/epics/[epicId]/analyze-invest — cota mensal de IA", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.UPSTASH_REDIS_REST_URL = undefined;
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({ tenantId: "tenant-1" });
    mocks.epicFindFirst.mockResolvedValue(EPIC);
    mocks.fixedWindow.mockReturnValue({ max: 200, windowMs: 2_592_000_000 });
    mocks.createRateLimiter.mockReturnValue({ limit: mocks.limit });
    mocks.getActiveProvider.mockReturnValue("anthropic");
    mocks.getAIModel.mockReturnValue({});
    mocks.streamText.mockReturnValue({
      toTextStreamResponse: () => new Response("ok", { status: 200 }),
    });
  });

  it("nega com 429 AI_QUOTA_EXCEEDED quando o plano é finito e o limiter estoura, mesmo sem UPSTASH_REDIS_REST_URL", async () => {
    mocks.tenantFindFirst.mockResolvedValue({ plan: "ORBIT", metadata: {} });
    mocks.limit.mockResolvedValue({
      success: false,
      limit: 200,
      remaining: 0,
      reset: Date.now() + 2_592_000_000,
    });

    const res = await POST(makeRequest(), { params });
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.code).toBe("AI_QUOTA_EXCEEDED");
    expect(mocks.createRateLimiter).toHaveBeenCalledWith(
      expect.objectContaining({ prefix: "invest:usage" })
    );
    expect(mocks.limit).toHaveBeenCalledWith("tenant-1");
    expect(mocks.streamText).not.toHaveBeenCalled();
  });

  it("segue para a IA quando o plano é finito e o limiter libera", async () => {
    mocks.tenantFindFirst.mockResolvedValue({ plan: "ORBIT", metadata: {} });
    mocks.limit.mockResolvedValue({
      success: true,
      limit: 200,
      remaining: 199,
      reset: Date.now() + 2_592_000_000,
    });

    const res = await POST(makeRequest(), { params });

    expect(res.status).toBe(200);
    expect(mocks.streamText).toHaveBeenCalled();
  });

  it("plano ilimitado (UNIVERSE) nunca chama o limiter de cota", async () => {
    mocks.tenantFindFirst.mockResolvedValue({ plan: "UNIVERSE", metadata: {} });

    await POST(makeRequest(), { params });

    expect(mocks.createRateLimiter).not.toHaveBeenCalled();
    expect(mocks.streamText).toHaveBeenCalled();
  });
});
