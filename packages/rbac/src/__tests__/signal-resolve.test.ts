// signal-resolve.test.ts — o papel de medição do Signal.
//
// Mesma mecânica dos outros resolvedores, com uma diferença que merece teste
// próprio: a tabela aqui é `signalMember`, no singular e sem "-ship", enquanto
// Charter, Meridian e Scaffold usam `*Membership`. Quem copiar um dos outros
// para mexer neste erra o nome sem perceber, e o resultado é `undefined?.role`
// → null → negação silenciosa para todo mundo. O teste abaixo trava o nome.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signalMemberFindUnique: vi.fn(),
  redisGet: vi.fn(),
  redisSet: vi.fn(),
  redisDel: vi.fn(),
}));

vi.mock("@repo/database", () => ({
  database: {
    signalMember: { findUnique: mocks.signalMemberFindUnique },
  },
}));

vi.mock("@repo/rate-limit", () => ({
  redis: {
    get: mocks.redisGet,
    set: mocks.redisSet,
    del: mocks.redisDel,
  },
}));

import { getSignalRole, invalidateSignalRoleCache } from "../signal-resolve";

const USER = "user-1";
const TENANT = "tenant-1";
const KEY = `signal-role:${TENANT}:${USER}`;

beforeEach(() => {
  vi.clearAllMocks();
  // biome-ignore lint/performance/noDelete: precisa sumir, não virar "undefined"
  delete process.env.UPSTASH_REDIS_REST_URL;
  mocks.signalMemberFindUnique.mockResolvedValue(null);
});

describe("getSignalRole — sem redis", () => {
  it("devolve null sem membro", async () => {
    await expect(getSignalRole(USER, TENANT)).resolves.toBeNull();
  });

  it("devolve o papel do membro", async () => {
    mocks.signalMemberFindUnique.mockResolvedValue({ role: "ANALYST" });
    await expect(getSignalRole(USER, TENANT)).resolves.toBe("ANALYST");
  });

  // O mock só existe em `database.signalMember`. Se o código passar a ler
  // `signalMembership`, isto estoura em vez de devolver null calado.
  it("lê de signalMember, não de signalMembership", async () => {
    mocks.signalMemberFindUnique.mockResolvedValue({ role: "OWNER" });
    await expect(getSignalRole(USER, TENANT)).resolves.toBe("OWNER");
    expect(mocks.signalMemberFindUnique).toHaveBeenCalledTimes(1);
  });

  it("busca pela chave composta tenant + usuário", async () => {
    await getSignalRole(USER, TENANT);
    expect(mocks.signalMemberFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId_userId: { tenantId: TENANT, userId: USER } },
      })
    );
  });
});

describe("getSignalRole — com redis", () => {
  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.exemplo";
  });

  it("devolve o papel do cache sem ir ao banco", async () => {
    mocks.redisGet.mockResolvedValue("VIEWER");
    await expect(getSignalRole(USER, TENANT)).resolves.toBe("VIEWER");
    expect(mocks.signalMemberFindUnique).not.toHaveBeenCalled();
  });

  it("traduz o sentinela 'none' para null", async () => {
    mocks.redisGet.mockResolvedValue("none");
    await expect(getSignalRole(USER, TENANT)).resolves.toBeNull();
    expect(mocks.signalMemberFindUnique).not.toHaveBeenCalled();
  });

  it("grava 'none' quando não há membro", async () => {
    mocks.redisGet.mockResolvedValue(null);
    await expect(getSignalRole(USER, TENANT)).resolves.toBeNull();
    expect(mocks.redisSet).toHaveBeenCalledWith(KEY, "none", { ex: 300 });
  });

  it("grava o papel quando há membro", async () => {
    mocks.redisGet.mockResolvedValue(null);
    mocks.signalMemberFindUnique.mockResolvedValue({ role: "ADMIN" });

    await expect(getSignalRole(USER, TENANT)).resolves.toBe("ADMIN");
    expect(mocks.redisSet).toHaveBeenCalledWith(KEY, "ADMIN", { ex: 300 });
  });

  it("usa chave com o prefixo do Signal", async () => {
    mocks.redisGet.mockResolvedValue(null);
    await getSignalRole(USER, TENANT);
    expect(mocks.redisGet).toHaveBeenCalledWith(KEY);
  });
});

describe("invalidateSignalRoleCache", () => {
  it("não faz nada sem redis configurado", async () => {
    await invalidateSignalRoleCache(TENANT, USER);
    expect(mocks.redisDel).not.toHaveBeenCalled();
  });

  it("apaga a chave do par tenant + usuário", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.exemplo";
    await invalidateSignalRoleCache(TENANT, USER);
    expect(mocks.redisDel).toHaveBeenCalledWith(KEY);
  });
});
