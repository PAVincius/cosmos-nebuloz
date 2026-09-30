import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Rotas de cron da fase 1 (ADR-0021): retenção de evidência do Meridian e
// eliminação LGPD. Protegidas por CRON_SECRET no formato que a Vercel envia.

const mocks = vi.hoisted(() => ({
  retention: vi.fn(),
  erasure: vi.fn(),
}));

vi.mock("@/lib/jobs/meridian-evidence-retention", () => ({
  eliminateExpiredMeridianEvidence: mocks.retention,
}));
vi.mock("@/lib/jobs/lgpd-erasure", () => ({
  processPendingErasureRequests: mocks.erasure,
}));

import {
  GET as erasureGet,
  maxDuration as erasureMax,
  POST as erasurePost,
} from "@/app/api/cron/lgpd-erasure/route";
import {
  GET as retentionGet,
  maxDuration as retentionMax,
  POST as retentionPost,
} from "@/app/api/cron/meridian-evidence-retention/route";

const original = process.env.CRON_SECRET;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "s3cret-value";
  mocks.retention.mockResolvedValue({
    eliminated: 3,
    assessments: 1,
    failed: 0,
  });
  mocks.erasure.mockResolvedValue({
    claimed: 1,
    completed: 1,
    failed: 0,
    retried: 0,
  });
});

afterEach(() => {
  process.env.CRON_SECRET = original;
});

const req = (auth?: string) =>
  new Request("https://app.test/api/cron/x", {
    headers: auth ? { authorization: auth } : {},
  });

describe.each([
  [
    "meridian-evidence-retention",
    { GET: retentionGet, POST: retentionPost, maxDuration: retentionMax },
    mocks.retention,
  ],
  [
    "lgpd-erasure",
    { GET: erasureGet, POST: erasurePost, maxDuration: erasureMax },
    mocks.erasure,
  ],
])("/api/cron/%s", (_name, route, job) => {
  it("401 sem segredo, e não executa o job", async () => {
    const res = await route.GET(req());
    expect(res.status).toBe(401);
    expect(job).not.toHaveBeenCalled();
  });

  it("401 com segredo errado", async () => {
    const res = await route.GET(req("Bearer errado-errado"));
    expect(res.status).toBe(401);
    expect(job).not.toHaveBeenCalled();
  });

  it("200 com Bearer correto (GET, como a Vercel chama) e devolve o resultado", async () => {
    const res = await route.GET(req("Bearer s3cret-value"));
    expect(res.status).toBe(200);
    expect(job).toHaveBeenCalledTimes(1);
    expect(await res.json()).toMatchObject({ ok: true });
  });

  it("POST também autentica (disparo manual)", async () => {
    expect((await route.POST(req())).status).toBe(401);
    expect((await route.POST(req("Bearer s3cret-value"))).status).toBe(200);
  });

  it("declara maxDuration para a função da Vercel", () => {
    expect(route.maxDuration).toBeGreaterThanOrEqual(60);
  });
});

describe("status quando o job reporta falha", () => {
  it("retenção: 500 se algum assessment falhou (invocação aparece como falha na Vercel)", async () => {
    mocks.retention.mockResolvedValue({
      eliminated: 0,
      assessments: 1,
      failed: 1,
    });
    const res = await retentionGet(req("Bearer s3cret-value"));
    expect(res.status).toBe(500);
  });

  it("eliminação LGPD: 500 e ok:false se algum pedido falhou de vez (o monitor enxerga)", async () => {
    mocks.erasure.mockResolvedValue({
      claimed: 2,
      completed: 1,
      retried: 0,
      failed: 1,
    });
    const res = await erasureGet(req("Bearer s3cret-value"));
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ ok: false, failed: 1 });
  });

  it("eliminação LGPD: pedido que só será retentado não derruba a invocação", async () => {
    mocks.erasure.mockResolvedValue({
      claimed: 1,
      completed: 0,
      retried: 1,
      failed: 0,
    });
    const res = await erasureGet(req("Bearer s3cret-value"));
    expect(res.status).toBe(200);
  });

  it("job lança: 500 sem vazar a mensagem interna", async () => {
    mocks.erasure.mockRejectedValue(new Error("senha do banco: hunter2"));
    const res = await erasureGet(req("Bearer s3cret-value"));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("hunter2");
  });
});
