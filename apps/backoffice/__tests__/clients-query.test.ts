import { describe, expect, it, vi } from "vitest";

// clientListArgs não toca banco, mas o módulo importa requirePlatformStaff no
// topo — e este puxa @repo/auth/server (better-auth), que na versão instalada
// quebra ao carregar (mismatch de zod, pré-existente ao repo). Os mesmos
// mocks de guard.test.ts evitam esse carregamento sem depender dele.
vi.mock("@repo/auth/server", () => ({
  auth: { api: { getSession: vi.fn() } },
}));
vi.mock("@repo/database", () => ({
  database: { tenantMember: { findFirst: vi.fn() } },
}));
vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers()),
}));

const { clientListArgs } = await import("../app/actions/clients");

describe("clientListArgs", () => {
  it("exclui o tenant interno — ele não é cliente", () => {
    expect(clientListArgs().where).toEqual({ isSystem: false });
  });

  it("traz módulos e contagem de membros numa consulta só", () => {
    const { select } = clientListArgs();

    expect(select).toMatchObject({
      id: true,
      name: true,
      slug: true,
      createdAt: true,
      modules: expect.anything(),
      _count: { select: { members: true } },
    });
  });
});
