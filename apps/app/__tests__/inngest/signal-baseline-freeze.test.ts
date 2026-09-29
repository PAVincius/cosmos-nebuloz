import { beforeEach, describe, expect, it, vi } from "vitest";

// X-04 / SG-PO-03 — "→ Congelada: Sistema, no evento de baseline congelado".
// O Signal congela as métricas do plano da iniciativa quando o baseline é
// assinado: estado FROZEN, baselineValue copiado da dimensão do baseline, e um
// evento FREEZE sem ator no histórico. Idempotente. Cliente Inngest mockado.
const h = vi.hoisted(() => ({
  baselineFindFirst: vi.fn(),
  metricFindMany: vi.fn(),
  metricUpdateMany: vi.fn(),
  metricFindUnique: vi.fn(),
  eventCreateMany: vi.fn(),
  withTenantDb: vi.fn(),
}));

vi.mock("@/lib/inngest/client", () => ({
  inngest: {
    createFunction: (
      config: unknown,
      handler: (ctx: unknown) => Promise<unknown>
    ) => ({ config, handler }),
  },
}));
vi.mock("@repo/database", () => ({ withTenantDb: h.withTenantDb }));
vi.mock("@repo/observability/log", () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import {
  applyBaselineFrozen,
  freezePlanOnBaseline,
} from "@/lib/inngest/signal-baseline-freeze";

const base = {
  tenantId: "t-1",
  initiativeId: "i-1",
  initiativeCode: "IN-014",
  baselineId: "b-1",
  version: 1,
  scaffoldTrackId: "tr-1",
  at: "2026-09-29T12:00:00.000Z",
} as const;

const metric = (over: Record<string, unknown> = {}) => ({
  id: "m-1",
  state: "MEASURING",
  version: 2,
  baselineDimensionKey: "TIME",
  baselineValue: null,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.baselineFindFirst.mockResolvedValue({
    id: "b-1",
    signedAt: new Date("2026-09-29T11:59:00Z"),
    dimensions: [
      { key: "TIME", numericValue: "46" },
      { key: "COST", numericValue: "64.5" },
      { key: "QUALITY", numericValue: null },
    ],
  });
  h.metricFindMany.mockResolvedValue([metric()]);
  h.metricUpdateMany.mockResolvedValue({ count: 1 });
  h.eventCreateMany.mockResolvedValue({ count: 1 });
  h.withTenantDb.mockImplementation(
    async (_t: string, fn: (db: unknown) => Promise<unknown>) =>
      fn({
        signalBaseline: { findFirst: h.baselineFindFirst },
        signalPlanMetric: {
          findMany: h.metricFindMany,
          updateMany: h.metricUpdateMany,
        },
        signalPlanMetricEvent: { createMany: h.eventCreateMany },
      })
  );
});

describe("applyBaselineFrozen", () => {
  it("congela a métrica: FROZEN, baselineValue da dimensão e versão nova", async () => {
    const r = await applyBaselineFrozen(base);

    expect(r).toEqual({ frozen: 1, alreadyFrozen: 0 });
    expect(h.metricUpdateMany).toHaveBeenCalledWith({
      where: { id: "m-1", tenantId: "t-1", state: { not: "FROZEN" } },
      data: {
        state: "FROZEN",
        baselineValue: "46",
        version: { increment: 1 },
      },
    });
  });

  it("só lê baseline ASSINADO da própria iniciativa e tenant", async () => {
    await applyBaselineFrozen(base);

    expect(h.baselineFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "b-1",
          tenantId: "t-1",
          initiativeId: "i-1",
          signedAt: { not: null },
        }),
      })
    );
  });

  it("grava o evento FREEZE sem ator, com o antes e o depois", async () => {
    await applyBaselineFrozen(base);

    const { data } = h.eventCreateMany.mock.calls[0][0];
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({
      tenantId: "t-1",
      planMetricId: "m-1",
      action: "FREEZE",
      actorId: null,
      fromState: "MEASURING",
      toState: "FROZEN",
      version: 3,
    });
    expect(data[0].changes).toEqual([
      ["state", "MEASURING", "FROZEN"],
      ["baselineValue", null, "46"],
    ]);
  });

  it("não congela proposta: fora do veredito, não assumiu baseline", async () => {
    await applyBaselineFrozen(base);

    expect(h.metricFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "t-1",
          initiativeId: "i-1",
          state: { in: ["NO_SOURCE", "MEASURING", "PAUSED"] },
        }),
      })
    );
  });

  it("NÃO apaga um baselineValue que a métrica já tinha quando a dimensão não traz valor", async () => {
    h.metricFindMany.mockResolvedValue([
      metric({ baselineDimensionKey: "QUALITY", baselineValue: "12" }),
      metric({ id: "m-2", baselineDimensionKey: null, baselineValue: "7" }),
    ]);

    await applyBaselineFrozen(base);

    const updates = h.metricUpdateMany.mock.calls.map((c) => c[0].data);
    expect(updates[0].baselineValue).toBe("12");
    expect(updates[1].baselineValue).toBe("7");
    const events = h.eventCreateMany.mock.calls[0][0].data;
    // Ficou com valor: sem a nota de "congelada sem valor".
    expect(events[0].comment).toBeNull();
    expect(events[1].comment).toBeNull();
    // E o histórico não inventa mudança de baseline que não houve.
    expect(events[0].changes).toEqual([["state", "MEASURING", "FROZEN"]]);
  });

  it("a nota de 'sem valor' só aparece se o valor ficou nulo mesmo", async () => {
    h.metricFindMany.mockResolvedValue([
      metric({ baselineDimensionKey: "QUALITY", baselineValue: null }),
    ]);

    await applyBaselineFrozen(base);

    expect(h.eventCreateMany.mock.calls[0][0].data[0].comment).toMatch(
      /sem valor de baseline/i
    );
  });

  it("métrica sem dimensão correspondente congela com baselineValue nulo e diz isso", async () => {
    h.metricFindMany.mockResolvedValue([
      metric({ baselineDimensionKey: null }),
      metric({ id: "m-2", baselineDimensionKey: "QUALITY" }),
    ]);

    const r = await applyBaselineFrozen(base);

    expect(r).toEqual({ frozen: 2, alreadyFrozen: 0 });
    const updates = h.metricUpdateMany.mock.calls.map((c) => c[0].data);
    expect(updates.every((d) => d.baselineValue === null)).toBe(true);
    const events = h.eventCreateMany.mock.calls[0][0].data;
    expect(events[0].comment).toMatch(/sem valor de baseline/i);
    expect(events[1].comment).toMatch(/sem valor de baseline/i);
  });

  it("é idempotente: métrica já congelada não gera evento nem muda versão", async () => {
    h.metricUpdateMany.mockResolvedValue({ count: 0 });

    const r = await applyBaselineFrozen(base);

    expect(r).toEqual({ frozen: 0, alreadyFrozen: 1 });
    expect(h.eventCreateMany).not.toHaveBeenCalled();
  });

  it("iniciativa sem plano não faz nada", async () => {
    h.metricFindMany.mockResolvedValue([]);

    const r = await applyBaselineFrozen(base);

    expect(r).toEqual({ frozen: 0, alreadyFrozen: 0 });
    expect(h.metricUpdateMany).not.toHaveBeenCalled();
  });

  it("baseline que não existe ou não está assinado: nada é congelado", async () => {
    h.baselineFindFirst.mockResolvedValue(null);

    const r = await applyBaselineFrozen(base);

    expect(r).toEqual({ skipped: "baseline-not-signed" });
    expect(h.metricUpdateMany).not.toHaveBeenCalled();
  });

  it("roda dentro do tenant (RLS)", async () => {
    await applyBaselineFrozen(base);

    expect(h.withTenantDb).toHaveBeenCalledWith("t-1", expect.any(Function));
  });
});

describe("freezePlanOnBaseline (função Inngest)", () => {
  const fn = freezePlanOnBaseline as unknown as {
    config: {
      id: string;
      triggers: { event: string }[];
      concurrency: { key: string; limit: number }[];
      retries: number;
    };
    handler: (ctx: unknown) => Promise<unknown>;
  };

  it("assina signal/baseline.frozen e serializa por iniciativa", () => {
    expect(fn.config.id).toBe("signal-baseline-freeze-plan");
    expect(fn.config.triggers).toEqual([{ event: "signal/baseline.frozen" }]);
    expect(fn.config.concurrency).toEqual([
      { key: "event.data.initiativeId", limit: 1 },
    ]);
    expect(fn.config.retries).toBeGreaterThan(0);
  });

  it("valida o evento e aplica dentro de um step", async () => {
    const step = { run: vi.fn(async (_id: string, f: () => unknown) => f()) };

    const r = await fn.handler({ event: { data: base }, step });

    expect(step.run).toHaveBeenCalledTimes(1);
    expect(r).toEqual({ frozen: 1, alreadyFrozen: 0 });
  });

  it("recusa evento fora do contrato", async () => {
    const step = { run: vi.fn(async (_id: string, f: () => unknown) => f()) };

    await expect(
      fn.handler({ event: { data: { ...base, version: 0 } }, step })
    ).rejects.toThrow();
    expect(h.withTenantDb).not.toHaveBeenCalled();
  });
});
