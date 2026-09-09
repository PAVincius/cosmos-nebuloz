// scaffold-resolve.test.ts — o papel de adoção do Scaffold.
//
// Mesma mecânica dos outros resolvedores: membership no banco, cache opcional
// no Redis, sentinela "none" para ausência. O que se trava aqui é a tabela
// certa e o prefixo certo — errar qualquer um dos dois devolve null, que é
// indistinguível de "sem acesso", e nega em silêncio.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  scaffoldMembershipFindUnique: vi.fn(),
  redisGet: vi.fn(),
  redisSet: vi.fn(),
  redisDel: vi.fn(),
}));

vi.mock("@repo/database", () => ({
  database: {
    scaffoldMembership: { findUnique: mocks.scaffoldMembershipFindUnique },
  },
}));

vi.mock("@repo/rate-limit", () => ({
  redis: {
    get: mocks.redisGet,
    set: mocks.redisSet,
    del: mocks.redisDel,
  },
}));

import {
  getScaffoldRole,
  invalidateScaffoldRoleCache,
} from "../scaffold-resolve";

const USER = "user-1";
const TENANT = "tenant-1";
const KEY = `scaffold-role:${TENANT}:${USER}`;

beforeEach(() => {
  vi.clearAllMocks();
  // biome-ignore lint/performance/noDelete: precisa sumir, não virar "undefined"
  delete process.env.UPSTASH_REDIS_REST_URL;
  mocks.scaffoldMembershipFindUnique.mockResolvedValue(null);
});

describe("getScaffoldRole — sem redis", () => {
  it("devolve null sem membership", async () => {
    await expect(getScaffoldRole(USER, TENANT)).resolves.toBeNull();
  });

  it("devolve o papel do membership", async () => {
    mocks.scaffoldMembershipFindUnique.mockResolvedValue({
      role: "TRANSFORMATION_LEAD",
    });
    await expect(getScaffoldRole(USER, TENANT)).resolves.toBe(
      "TRANSFORMATION_LEAD"
    );
  });

  it("busca pela chave composta tenant + usuário", async () => {
    await getScaffoldRole(USER, TENANT);
    expect(mocks.scaffoldMembershipFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId_userId: { tenantId: TENANT, userId: USER } },
      })
    );
  });
});

describe("getScaffoldRole — com redis", () => {
  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.exemplo";
  });

  it("devolve o papel do cache sem ir ao banco", async () => {
    mocks.redisGet.mockResolvedValue("PROCESS_OWNER");
    await expect(getScaffoldRole(USER, TENANT)).resolves.toBe("PROCESS_OWNER");
    expect(mocks.scaffoldMembershipFindUnique).not.toHaveBeenCalled();
  });

  it("traduz o sentinela 'none' para null", async () => {
    mocks.redisGet.mockResolvedValue("none");
    await expect(getScaffoldRole(USER, TENANT)).resolves.toBeNull();
    expect(mocks.scaffoldMembershipFindUnique).not.toHaveBeenCalled();
  });

  it("grava 'none' quando não há membership", async () => {
    mocks.redisGet.mockResolvedValue(null);
    await expect(getScaffoldRole(USER, TENANT)).resolves.toBeNull();
    expect(mocks.redisSet).toHaveBeenCalledWith(KEY, "none", { ex: 300 });
  });

  it("grava o papel quando há membership", async () => {
    mocks.redisGet.mockResolvedValue(null);
    mocks.scaffoldMembershipFindUnique.mockResolvedValue({ role: "ADMIN" });

    await expect(getScaffoldRole(USER, TENANT)).resolves.toBe("ADMIN");
    expect(mocks.redisSet).toHaveBeenCalledWith(KEY, "ADMIN", { ex: 300 });
  });

  // ADMIN do Scaffold não é ADMIN do Signal nem do tenant. Sem prefixo próprio
  // na chave, o cache de um módulo responderia pelo outro.
  it("usa chave com o prefixo do Scaffold", async () => {
    mocks.redisGet.mockResolvedValue(null);
    await getScaffoldRole(USER, TENANT);
    expect(mocks.redisGet).toHaveBeenCalledWith(KEY);
  });
});

describe("invalidateScaffoldRoleCache", () => {
  it("não faz nada sem redis configurado", async () => {
    await invalidateScaffoldRoleCache(TENANT, USER);
    expect(mocks.redisDel).not.toHaveBeenCalled();
  });

  it("apaga a chave do par tenant + usuário", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.exemplo";
    await invalidateScaffoldRoleCache(TENANT, USER);
    expect(mocks.redisDel).toHaveBeenCalledWith(KEY);
  });
});
