import { beforeEach, describe, expect, it, vi } from "vitest";

// X-04 / seção e.1 do Norte — o Cosmos consome o gate fechado do Scaffold:
//   • 1 épico por trilha, nascido no fechamento da ASSESS;
//   • 1 feature ao abrir a PILOT e outra ao abrir a SCALE, sob o épico;
//   • idempotente por (tenantId, originTrackId, originPhase);
//   • tenant sem o módulo Cosmos não gera nada;
//   • o gate reaberto NÃO apaga épico nem feature.
// O cliente Inngest é mockado: createFunction devolve config + handler, e o
// teste chama o handler direto.
const h = vi.hoisted(() => ({
  tenantModuleFindFirst: vi.fn(),
  epicFindUnique: vi.fn(),
  epicCreateMany: vi.fn(),
  epicUpdate: vi.fn(),
  featureFindUnique: vi.fn(),
  featureCreateMany: vi.fn(),
  versionFindFirst: vi.fn(),
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
vi.mock("@repo/database", () => ({
  database: { tenantModule: { findFirst: h.tenantModuleFindFirst } },
  withTenantDb: h.withTenantDb,
}));
vi.mock("@repo/observability/log", () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import {
  applyScaffoldGateClosed,
  consumeScaffoldGateClosed,
} from "@/lib/inngest/cosmos-scaffold-origin";

const base = {
  tenantId: "t-1",
  trackId: "tr-1",
  trackCode: "TR-104",
  processName: "Triagem de autorizações prévias",
  closedPhase: "ASSESS",
  openedPhase: "PILOT",
  outcome: "PASSED",
  gateResultId: "gr-1",
  at: "2026-09-29T12:00:00.000Z",
} as const;

beforeEach(() => {
  vi.clearAllMocks();
  h.tenantModuleFindFirst.mockResolvedValue({ id: "tm-1" });
  // Sem épico até o insert; com épico depois dele.
  let epicInserted = false;
  h.epicFindUnique.mockImplementation(async () =>
    epicInserted ? { id: "ep-1" } : null
  );
  h.epicCreateMany.mockImplementation(async () => {
    epicInserted = true;
    return { count: 1 };
  });
  h.epicUpdate.mockResolvedValue({});
  h.featureFindUnique.mockResolvedValue(null);
  h.featureCreateMany.mockResolvedValue({ count: 1 });
  h.versionFindFirst.mockResolvedValue({
    note: "Reduzir o tempo de triagem em 30%.",
  });
  h.withTenantDb.mockImplementation(
    async (_tenant: string, fn: (db: unknown) => Promise<unknown>) =>
      fn({
        epic: {
          findUnique: h.epicFindUnique,
          createMany: h.epicCreateMany,
          update: h.epicUpdate,
        },
        feature: {
          findUnique: h.featureFindUnique,
          createMany: h.featureCreateMany,
        },
        scaffoldBusinessCaseVersion: { findFirst: h.versionFindFirst },
      })
  );
});

describe("applyScaffoldGateClosed", () => {
  it("fecha a ASSESS: cria o épico em FUNNEL com a hipótese do caso e a feature do piloto", async () => {
    const r = await applyScaffoldGateClosed(base);

    expect(r).toEqual({ epic: "created", feature: "created" });
    const epic = h.epicCreateMany.mock.calls[0][0].data[0];
    expect(epic).toMatchObject({
      tenantId: "t-1",
      originTrackId: "tr-1",
      lifecycleStatus: "FUNNEL",
      hypothesis: "Reduzir o tempo de triagem em 30%.",
    });
    expect(epic.title).toContain("TR-104");
    const feature = h.featureCreateMany.mock.calls[0][0].data[0];
    expect(feature).toMatchObject({
      tenantId: "t-1",
      epicId: "ep-1",
      originTrackId: "tr-1",
      originPhase: "PILOT",
    });
    expect(feature.title).toBe("Piloto TR-104");
  });

  it("roda dentro do tenant (RLS)", async () => {
    await applyScaffoldGateClosed(base);

    expect(h.withTenantDb).toHaveBeenCalledWith("t-1", expect.any(Function));
  });

  it("fecha a PILOT: feature da escala sob o MESMO épico, sem criar outro", async () => {
    h.epicFindUnique.mockResolvedValue({ id: "ep-1" });

    const r = await applyScaffoldGateClosed({
      ...base,
      closedPhase: "PILOT",
      openedPhase: "SCALE",
      gateResultId: "gr-2",
    });

    expect(r).toEqual({ epic: "existing", feature: "created" });
    expect(h.epicCreateMany).not.toHaveBeenCalled();
    const feature = h.featureCreateMany.mock.calls[0][0].data[0];
    expect(feature).toMatchObject({ epicId: "ep-1", originPhase: "SCALE" });
    expect(feature.title).toBe("Escala TR-104");
  });

  it("fecha a SCALE: a EMBED não gera feature (é mudança de organização)", async () => {
    h.epicFindUnique.mockResolvedValue({ id: "ep-1" });

    const r = await applyScaffoldGateClosed({
      ...base,
      closedPhase: "SCALE",
      openedPhase: "EMBED",
    });

    expect(r).toEqual({ epic: "none", feature: "none" });
    expect(h.featureCreateMany).not.toHaveBeenCalled();
    expect(h.epicCreateMany).not.toHaveBeenCalled();
    expect(h.withTenantDb).not.toHaveBeenCalled();
  });

  it("fecha a EMBED (sem fase seguinte): nada a criar", async () => {
    const r = await applyScaffoldGateClosed({
      ...base,
      closedPhase: "EMBED",
      openedPhase: null,
    });

    expect(r).toEqual({ epic: "none", feature: "none" });
    expect(h.epicCreateMany).not.toHaveBeenCalled();
    expect(h.featureCreateMany).not.toHaveBeenCalled();
  });

  it("é idempotente: reprocessar o mesmo evento não duplica nada", async () => {
    h.epicFindUnique.mockResolvedValue({ id: "ep-1" });
    h.featureFindUnique.mockResolvedValue({ id: "ft-1" });

    const r = await applyScaffoldGateClosed(base);

    expect(r).toEqual({ epic: "existing", feature: "existing" });
    expect(h.epicCreateMany).not.toHaveBeenCalled();
    expect(h.featureCreateMany).not.toHaveBeenCalled();
    expect(h.epicUpdate).not.toHaveBeenCalled();
  });

  it("corrida entre duas entregas: o ON CONFLICT DO NOTHING vira 'já existe', sem erro", async () => {
    // O insert perdeu a corrida (count 0); o épico e a feature já existem.
    h.epicFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ id: "ep-9" });
    h.epicCreateMany.mockResolvedValue({ count: 0 });
    h.featureCreateMany.mockResolvedValue({ count: 0 });

    const r = await applyScaffoldGateClosed(base);

    expect(r).toEqual({ epic: "existing", feature: "existing" });
    expect(h.epicCreateMany.mock.calls[0][0].skipDuplicates).toBe(true);
    expect(h.featureCreateMany.mock.calls[0][0].skipDuplicates).toBe(true);
    // Quem perdeu a corrida não mexe no contador de quem ganhou.
    expect(h.epicUpdate).not.toHaveBeenCalled();
  });

  it("erro de banco sobe, para o Inngest tentar de novo", async () => {
    h.epicCreateMany.mockRejectedValue(new Error("banco caiu"));

    await expect(applyScaffoldGateClosed(base)).rejects.toThrow("banco caiu");
  });

  it("mantém o contador de features do épico ao criar a feature", async () => {
    await applyScaffoldGateClosed(base);

    expect(h.epicUpdate).toHaveBeenCalledWith({
      where: { id: "ep-1" },
      data: { featureCount: { increment: 1 } },
    });
  });

  it("tenant sem o módulo Cosmos não gera nada", async () => {
    h.tenantModuleFindFirst.mockResolvedValue(null);

    const r = await applyScaffoldGateClosed(base);

    expect(r).toEqual({ skipped: "cosmos-not-contracted" });
    expect(h.withTenantDb).not.toHaveBeenCalled();
    expect(h.tenantModuleFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "t-1",
          module: "COSMOS",
          status: { in: ["ACTIVE", "TRIAL"] },
        }),
      })
    );
  });

  it("sem caso de negócio assinado, o épico nasce sem hipótese em vez de falhar", async () => {
    h.versionFindFirst.mockResolvedValue(null);

    await applyScaffoldGateClosed(base);

    expect(h.epicCreateMany.mock.calls[0][0].data[0].hypothesis).toBeNull();
  });
});

describe("consumeScaffoldGateClosed (função Inngest)", () => {
  const fn = consumeScaffoldGateClosed as unknown as {
    config: {
      id: string;
      triggers: { event: string }[];
      concurrency: { key: string; limit: number }[];
      retries: number;
    };
    handler: (ctx: unknown) => Promise<unknown>;
  };

  it("assina scaffold/gate.closed, serializa por trilha e tenta de novo", () => {
    expect(fn.config.id).toBe("cosmos-scaffold-gate-consumer");
    expect(fn.config.triggers).toEqual([{ event: "scaffold/gate.closed" }]);
    expect(fn.config.concurrency).toEqual([
      { key: "event.data.trackId", limit: 1 },
    ]);
    expect(fn.config.retries).toBeGreaterThan(0);
  });

  it("valida o evento e aplica dentro de um step", async () => {
    const step = { run: vi.fn(async (_id: string, f: () => unknown) => f()) };

    const r = await fn.handler({ event: { data: base }, step });

    expect(step.run).toHaveBeenCalledTimes(1);
    expect(r).toEqual({ epic: "created", feature: "created" });
  });

  it("recusa evento fora do contrato", async () => {
    const step = { run: vi.fn(async (_id: string, f: () => unknown) => f()) };

    await expect(
      fn.handler({ event: { data: { ...base, closedPhase: "X" } }, step })
    ).rejects.toThrow();
    expect(h.withTenantDb).not.toHaveBeenCalled();
  });
});
