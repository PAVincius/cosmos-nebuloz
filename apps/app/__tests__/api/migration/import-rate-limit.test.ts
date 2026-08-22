// import-rate-limit.test.ts — o portão de teto da importação de migração.
//
// Mesmo defeito do Linear/GitHub/upload (NEB-144): `checkImportRateLimit`
// devolvia `false` sempre que `UPSTASH_REDIS_REST_URL` estava ausente —
// sempre —, então a rota respondia 429 para toda importação, sem nunca
// consultar o limiter real. Este arquivo prova que quem decide a resposta
// agora é o limiter, não a variável morta.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  limit: vi.fn(),
  createRateLimiter: vi.fn(),
  fixedWindow: vi.fn(),
  requireTenantSession: vi.fn(),
  headers: vi.fn(),
  migrationConnectionFindFirst: vi.fn(),
}));

vi.mock("@repo/rate-limit", () => ({
  createRateLimiter: mocks.createRateLimiter,
  fixedWindow: mocks.fixedWindow,
}));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
}));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@repo/database", () => ({
  database: {
    migrationConnection: { findFirst: mocks.migrationConnectionFindFirst },
  },
}));
vi.mock("@/lib/migration/azure-client", () => ({
  fetchAzureWorkItems: vi.fn(),
}));
vi.mock("@/lib/migration/csv-parser", () => ({ parseMigrationCSV: vi.fn() }));
vi.mock("@/lib/migration/jira-client", () => ({ fetchJiraItems: vi.fn() }));
vi.mock("@/lib/migration/trello-client", () => ({ fetchTrelloCards: vi.fn() }));

import { NextRequest } from "next/server";
import { POST } from "../../../app/api/migration/[source]/import/route";

function makeRequest() {
  return new NextRequest("http://localhost/api/migration/csv/import", {
    method: "POST",
    headers: {
      "x-forwarded-for": "3.3.3.3",
      "content-type": "application/json",
    },
    body: JSON.stringify({ connectionId: "conn-1", mappingData: [] }),
  });
}

const params = Promise.resolve({ source: "csv" });

describe("POST /api/migration/[source]/import — teto de requisição", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.UPSTASH_REDIS_REST_URL = undefined;
    mocks.requireTenantSession.mockResolvedValue({ tenantId: "tenant-1" });
    mocks.fixedWindow.mockReturnValue({ max: 5, windowMs: 600_000 });
    mocks.createRateLimiter.mockReturnValue({ limit: mocks.limit });
    mocks.migrationConnectionFindFirst.mockResolvedValue(null);
  });

  it("nega com 429 quando o limiter real diz que estourou", async () => {
    mocks.limit.mockResolvedValue({
      success: false,
      limit: 5,
      remaining: 0,
      reset: Date.now() + 600_000,
    });

    const res = await POST(makeRequest(), { params });

    expect(res.status).toBe(429);
    expect(mocks.createRateLimiter).toHaveBeenCalledWith(
      expect.objectContaining({ prefix: "migration-import" })
    );
    expect(mocks.limit).toHaveBeenCalledWith("3.3.3.3");
  });

  it("não fica preso em 429 quando UPSTASH_REDIS_REST_URL está ausente e o limiter libera", async () => {
    mocks.limit.mockResolvedValue({
      success: true,
      limit: 5,
      remaining: 4,
      reset: Date.now() + 600_000,
    });

    const res = await POST(makeRequest(), { params });

    expect(res.status).not.toBe(429);
    expect(mocks.migrationConnectionFindFirst).toHaveBeenCalled();
  });
});
