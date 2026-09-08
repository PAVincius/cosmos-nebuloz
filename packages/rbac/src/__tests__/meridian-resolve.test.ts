// meridian-resolve.test.ts — o papel de diagnóstico do Meridian.
//
// Espelha charter-resolve.test.ts porque a mecânica é a mesma: membership no
// banco, cache opcional no Redis, sentinela "none" para ausência. O que muda é
// a tabela consultada e o prefixo da chave, e é justamente aí que um erro passa
// despercebido — consultar a tabela errada devolve null, que é indistinguível
// de "sem acesso". Falha silenciosa em autorização nega o dia inteiro de alguém
// sem dar pista nenhuma.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  meridianMembershipFindUnique: vi.fn(),
  redisGet: vi.fn(),
  redisSet: vi.fn(),
  redisDel: vi.fn(),
}));

vi.mock("@repo/database", () => ({
  database: {
    meridianMembership: { findUnique: mocks.meridianMembershipFindUnique },
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
  getMeridianRole,
  invalidateMeridianRoleCache,
} from "../meridian-resolve";

const USER = "user-1";
const TENANT = "tenant-1";
const KEY = `meridian-role:${TENANT}:${USER}`;

beforeEach(() => {
  vi.clearAllMocks();
  // biome-ignore lint/performance/noDelete: precisa sumir, não virar "undefined"
  delete process.env.UPSTASH_REDIS_REST_URL;
  mocks.meridianMembershipFindUnique.mockResolvedValue(null);
});

describe("getMeridianRole — sem redis", () => {
  it("devolve null sem membership", async () => {
    await expect(getMeridianRole(USER, TENANT)).resolves.toBeNull();
  });

  it("devolve o papel do membership", async () => {
    mocks.meridianMembershipFindUnique.mockResolvedValue({
      role: "CONSULTANT",
    });
    await expect(getMeridianRole(USER, TENANT)).resolves.toBe("CONSULTANT");
  });

  it("busca pela chave composta tenant + usuário", async () => {
    await getMeridianRole(USER, TENANT);
    expect(mocks.meridianMembershipFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId_userId: { tenantId: TENANT, userId: USER } },
      })
    );
  });
});

describe("getMeridianRole — com redis", () => {
  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.exemplo";
  });

  it("devolve o papel do cache sem ir ao banco", async () => {
    mocks.redisGet.mockResolvedValue("CONSULTANT");
    await expect(getMeridianRole(USER, TENANT)).resolves.toBe("CONSULTANT");
    expect(mocks.meridianMembershipFindUnique).not.toHaveBeenCalled();
  });

  it("traduz o sentinela 'none' para null", async () => {
    mocks.redisGet.mockResolvedValue("none");
    await expect(getMeridianRole(USER, TENANT)).resolves.toBeNull();
    expect(mocks.meridianMembershipFindUnique).not.toHaveBeenCalled();
  });

  it("grava 'none' quando não há membership", async () => {
    mocks.redisGet.mockResolvedValue(null);
    await expect(getMeridianRole(USER, TENANT)).resolves.toBeNull();
    expect(mocks.redisSet).toHaveBeenCalledWith(KEY, "none", { ex: 300 });
  });

  it("grava o papel quando há membership", async () => {
    mocks.redisGet.mockResolvedValue(null);
    mocks.meridianMembershipFindUnique.mockResolvedValue({
      role: "CONSULTANT",
    });

    await expect(getMeridianRole(USER, TENANT)).resolves.toBe("CONSULTANT");
    expect(mocks.redisSet).toHaveBeenCalledWith(KEY, "CONSULTANT", { ex: 300 });
  });

  // Prefixo próprio por módulo: com a chave compartilhada, quem é CONSULTANT no
  // Meridian apareceria com esse papel no Charter e no Signal.
  it("usa chave com o prefixo do Meridian", async () => {
    mocks.redisGet.mockResolvedValue(null);
    await getMeridianRole(USER, TENANT);
    expect(mocks.redisGet).toHaveBeenCalledWith(KEY);
  });
});

describe("invalidateMeridianRoleCache", () => {
  it("não faz nada sem redis configurado", async () => {
    await invalidateMeridianRoleCache(TENANT, USER);
    expect(mocks.redisDel).not.toHaveBeenCalled();
  });

  it("apaga a chave do par tenant + usuário", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.exemplo";
    await invalidateMeridianRoleCache(TENANT, USER);
    expect(mocks.redisDel).toHaveBeenCalledWith(KEY);
  });
});
