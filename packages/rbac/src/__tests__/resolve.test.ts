import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  artMembershipFindFirst: vi.fn(),
  tenantMemberFindFirst: vi.fn(),
  redisGet: vi.fn(),
  redisSet: vi.fn(),
  redisDel: vi.fn(),
}));

vi.mock("@repo/database", () => ({
  database: {
    aRTMembership: { findFirst: mocks.artMembershipFindFirst },
    tenantMember: { findFirst: mocks.tenantMemberFindFirst },
  },
}));

vi.mock("@repo/rate-limit", () => ({
  redis: {
    get: mocks.redisGet,
    set: mocks.redisSet,
    del: mocks.redisDel,
  },
}));

import { getEffectiveRole, invalidatePermissionCache } from "../resolve";

const USER = "user-1";
const TENANT = "tenant-1";
const ART = "art-1";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.UPSTASH_REDIS_REST_URL = undefined as unknown as string;
  // biome-ignore lint/performance/noDelete: precisa sumir, não virar "undefined"
  delete process.env.UPSTASH_REDIS_REST_URL;
  mocks.artMembershipFindFirst.mockResolvedValue(null);
  mocks.tenantMemberFindFirst.mockResolvedValue(null);
});

describe("getEffectiveRole — sem redis", () => {
  it("cai em MEMBER quando não há vínculo nenhum", async () => {
    // Default deny: usuário sem membership não herda nada do tenant.
    await expect(getEffectiveRole(USER, TENANT)).resolves.toBe("MEMBER");
  });

  it("usa o papel do vínculo de organização", async () => {
    mocks.tenantMemberFindFirst.mockResolvedValue({ role: "RTE" });
    await expect(getEffectiveRole(USER, TENANT)).resolves.toBe("RTE");
  });

  it("deixa o vínculo de ART ganhar do vínculo de organização", async () => {
    mocks.artMembershipFindFirst.mockResolvedValue({ role: "SM" });
    mocks.tenantMemberFindFirst.mockResolvedValue({ role: "MEMBER" });
    await expect(getEffectiveRole(USER, TENANT, ART)).resolves.toBe("SM");
    expect(mocks.tenantMemberFindFirst).not.toHaveBeenCalled();
  });

  it("volta para o vínculo de organização quando não há vínculo naquele ART", async () => {
    mocks.artMembershipFindFirst.mockResolvedValue(null);
    mocks.tenantMemberFindFirst.mockResolvedValue({ role: "PO" });
    await expect(getEffectiveRole(USER, TENANT, ART)).resolves.toBe("PO");
  });

  it("não consulta ART quando artId não é passado", async () => {
    await getEffectiveRole(USER, TENANT);
    expect(mocks.artMembershipFindFirst).not.toHaveBeenCalled();
  });

  // Isolamento entre tenants: sem tenantId no where, um vínculo de ART de
  // outro tenant satisfaria a busca por userId + artId.
  it("filtra as duas consultas por tenantId", async () => {
    await getEffectiveRole(USER, TENANT, ART);
    expect(mocks.artMembershipFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: TENANT, userId: USER }),
      })
    );
    expect(mocks.tenantMemberFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: TENANT, userId: USER }),
      })
    );
  });
});

describe("getEffectiveRole — com redis", () => {
  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.exemplo";
  });

  it("devolve o valor do cache sem ir ao banco", async () => {
    mocks.redisGet.mockResolvedValue("RTE");
    await expect(getEffectiveRole(USER, TENANT)).resolves.toBe("RTE");
    expect(mocks.tenantMemberFindFirst).not.toHaveBeenCalled();
  });

  it("resolve no banco e grava no cache quando não há valor", async () => {
    mocks.redisGet.mockResolvedValue(null);
    mocks.tenantMemberFindFirst.mockResolvedValue({ role: "PO" });

    await expect(getEffectiveRole(USER, TENANT)).resolves.toBe("PO");
    expect(mocks.redisSet).toHaveBeenCalledWith(
      `perm:${TENANT}:${USER}:org`,
      "PO",
      { ex: 300 }
    );
  });

  it("separa a chave por ART", async () => {
    mocks.redisGet.mockResolvedValue(null);
    mocks.artMembershipFindFirst.mockResolvedValue({ role: "SM" });

    await getEffectiveRole(USER, TENANT, ART);
    expect(mocks.redisSet).toHaveBeenCalledWith(
      `perm:${TENANT}:${USER}:${ART}`,
      "SM",
      { ex: 300 }
    );
  });
});

describe("invalidatePermissionCache", () => {
  it("não faz nada sem redis configurado", async () => {
    await invalidatePermissionCache(TENANT, USER);
    expect(mocks.redisDel).not.toHaveBeenCalled();
  });

  it("apaga a chave do escopo pedido", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.exemplo";

    await invalidatePermissionCache(TENANT, USER);
    expect(mocks.redisDel).toHaveBeenCalledWith(`perm:${TENANT}:${USER}:org`);

    await invalidatePermissionCache(TENANT, USER, ART);
    expect(mocks.redisDel).toHaveBeenCalledWith(
      `perm:${TENANT}:${USER}:${ART}`
    );
  });
});
