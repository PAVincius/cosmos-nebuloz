import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  tenantModuleFindMany: vi.fn(),
  redisGet: vi.fn(),
  redisSet: vi.fn(),
  redisDel: vi.fn(),
}));

vi.mock("@repo/database", () => ({
  database: {
    tenantModule: { findMany: mocks.tenantModuleFindMany },
  },
}));

vi.mock("@repo/rate-limit", () => ({
  redis: {
    get: mocks.redisGet,
    set: mocks.redisSet,
    del: mocks.redisDel,
  },
}));

import { hasModule, invalidateModuleCache, listModules } from "../modules";

const TENANT = "tenant-1";

beforeEach(() => {
  vi.clearAllMocks();
  // biome-ignore lint/performance/noDelete: precisa sumir, não virar "undefined"
  delete process.env.UPSTASH_REDIS_REST_URL;
  mocks.tenantModuleFindMany.mockResolvedValue([]);
});

describe("listModules", () => {
  it("devolve lista vazia para tenant sem linha — default deny", async () => {
    await expect(listModules(TENANT)).resolves.toEqual([]);
  });

  it("mapeia as linhas para o nome do módulo", async () => {
    mocks.tenantModuleFindMany.mockResolvedValue([
      { module: "COSMOS" },
      { module: "CHARTER" },
    ]);
    await expect(listModules(TENANT)).resolves.toEqual(["COSMOS", "CHARTER"]);
  });

  // SUSPENDED e CANCELED não concedem: inadimplência e cancelamento fecham a
  // porta sem apagar dado. Se alguém acrescentar um status ao `in`, o gate
  // passa a liberar módulo não contratado.
  it("só aceita ACTIVE e TRIAL, e ignora o que já expirou", async () => {
    await listModules(TENANT);
    const where = mocks.tenantModuleFindMany.mock.calls[0][0].where;

    expect(where.status.in).toEqual(["ACTIVE", "TRIAL"]);
    expect(where.tenantId).toBe(TENANT);
    expect(where.OR).toEqual([
      { expiresAt: null },
      { expiresAt: { gt: expect.any(Date) } },
    ]);
  });
});

describe("listModules — com redis", () => {
  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.exemplo";
  });

  it("devolve o cache sem ir ao banco", async () => {
    mocks.redisGet.mockResolvedValue(["COSMOS"]);
    await expect(listModules(TENANT)).resolves.toEqual(["COSMOS"]);
    expect(mocks.tenantModuleFindMany).not.toHaveBeenCalled();
  });

  it("busca e grava quando não há cache", async () => {
    mocks.redisGet.mockResolvedValue(null);
    mocks.tenantModuleFindMany.mockResolvedValue([{ module: "CHARTER" }]);

    await expect(listModules(TENANT)).resolves.toEqual(["CHARTER"]);
    expect(mocks.redisSet).toHaveBeenCalledWith(
      `modules:${TENANT}`,
      ["CHARTER"],
      { ex: 300 }
    );
  });
});

describe("hasModule", () => {
  it("é falso para módulo não contratado", async () => {
    mocks.tenantModuleFindMany.mockResolvedValue([{ module: "COSMOS" }]);
    await expect(hasModule(TENANT, "CHARTER")).resolves.toBe(false);
  });

  it("é verdadeiro para módulo contratado e vigente", async () => {
    mocks.tenantModuleFindMany.mockResolvedValue([{ module: "COSMOS" }]);
    await expect(hasModule(TENANT, "COSMOS")).resolves.toBe(true);
  });

  it("é falso quando o tenant não tem módulo nenhum", async () => {
    await expect(hasModule(TENANT, "COSMOS")).resolves.toBe(false);
  });
});

describe("invalidateModuleCache", () => {
  it("não faz nada sem redis configurado", async () => {
    await invalidateModuleCache(TENANT);
    expect(mocks.redisDel).not.toHaveBeenCalled();
  });

  it("apaga a chave do tenant", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.exemplo";
    await invalidateModuleCache(TENANT);
    expect(mocks.redisDel).toHaveBeenCalledWith(`modules:${TENANT}`);
  });
});
