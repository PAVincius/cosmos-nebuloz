import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  charterMembershipFindUnique: vi.fn(),
  redisGet: vi.fn(),
  redisSet: vi.fn(),
  redisDel: vi.fn(),
}));

vi.mock("@repo/database", () => ({
  database: {
    charterMembership: { findUnique: mocks.charterMembershipFindUnique },
  },
}));

vi.mock("@repo/rate-limit", () => ({
  redis: {
    get: mocks.redisGet,
    set: mocks.redisSet,
    del: mocks.redisDel,
  },
}));

import { getCharterRole, invalidateCharterRoleCache } from "../charter-resolve";

const USER = "user-1";
const TENANT = "tenant-1";
const KEY = `charter-role:${TENANT}:${USER}`;

beforeEach(() => {
  vi.clearAllMocks();
  // biome-ignore lint/performance/noDelete: precisa sumir, não virar "undefined"
  delete process.env.UPSTASH_REDIS_REST_URL;
  mocks.charterMembershipFindUnique.mockResolvedValue(null);
});

describe("getCharterRole — sem redis", () => {
  // Default deny no eixo de governança: sem CharterMembership não há papel,
  // mesmo sendo ADMIN do tenant e mesmo com o módulo contratado.
  it("devolve null sem membership", async () => {
    await expect(getCharterRole(USER, TENANT)).resolves.toBeNull();
  });

  it("devolve o papel do membership", async () => {
    mocks.charterMembershipFindUnique.mockResolvedValue({ role: "AUDITOR" });
    await expect(getCharterRole(USER, TENANT)).resolves.toBe("AUDITOR");
  });

  it("busca pela chave composta tenant + usuário", async () => {
    await getCharterRole(USER, TENANT);
    expect(mocks.charterMembershipFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId_userId: { tenantId: TENANT, userId: USER } },
      })
    );
  });
});

describe("getCharterRole — com redis", () => {
  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.exemplo";
  });

  it("devolve o papel do cache sem ir ao banco", async () => {
    mocks.redisGet.mockResolvedValue("LEGAL");
    await expect(getCharterRole(USER, TENANT)).resolves.toBe("LEGAL");
    expect(mocks.charterMembershipFindUnique).not.toHaveBeenCalled();
  });

  // O sentinela "none" é o que evita que todo request de quem não tem acesso
  // volte ao banco. Traduzir de volta para null é obrigatório: devolver a
  // string "none" daria um papel truthy a quem não tem nenhum.
  it("traduz o sentinela 'none' para null", async () => {
    mocks.redisGet.mockResolvedValue("none");
    await expect(getCharterRole(USER, TENANT)).resolves.toBeNull();
    expect(mocks.charterMembershipFindUnique).not.toHaveBeenCalled();
  });

  it("grava 'none' quando não há membership", async () => {
    mocks.redisGet.mockResolvedValue(null);
    await expect(getCharterRole(USER, TENANT)).resolves.toBeNull();
    expect(mocks.redisSet).toHaveBeenCalledWith(KEY, "none", { ex: 300 });
  });

  it("grava o papel quando há membership", async () => {
    mocks.redisGet.mockResolvedValue(null);
    mocks.charterMembershipFindUnique.mockResolvedValue({ role: "SECURITY" });

    await expect(getCharterRole(USER, TENANT)).resolves.toBe("SECURITY");
    expect(mocks.redisSet).toHaveBeenCalledWith(KEY, "SECURITY", { ex: 300 });
  });
});

describe("invalidateCharterRoleCache", () => {
  it("não faz nada sem redis configurado", async () => {
    await invalidateCharterRoleCache(TENANT, USER);
    expect(mocks.redisDel).not.toHaveBeenCalled();
  });

  it("apaga a chave do par tenant + usuário", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.exemplo";
    await invalidateCharterRoleCache(TENANT, USER);
    expect(mocks.redisDel).toHaveBeenCalledWith(KEY);
  });
});
