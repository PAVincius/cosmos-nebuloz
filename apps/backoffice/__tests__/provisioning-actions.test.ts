import { describe, expect, it, vi } from "vitest";

// Mesma armadilha do clients-query.test.ts: o módulo importa requirePlatformStaff
// (que puxa @repo/auth/server, versão que quebra ao carregar) e @repo/database
// (que valida DATABASE_URL no import). Os mesmos mocks evitam os dois problemas.
vi.mock("@repo/observability/log", () => ({ log: { error: vi.fn() } }));
vi.mock("@repo/auth/server", () => ({
  auth: { api: { getSession: vi.fn() } },
}));
vi.mock("@repo/database", () => ({
  database: { tenantMember: { findFirst: vi.fn() } },
  withTenantDb: vi.fn(),
}));
vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers()),
}));

const { assertCanWrite } = await import("../app/actions/provisioning");
const { StaffAuthError } = await import("../lib/guard");

describe("assertCanWrite", () => {
  it("deixa passar quem é ADMIN no tenant interno", () => {
    expect(() =>
      assertCanWrite({
        userId: "u",
        email: "a@b.c",
        name: null,
        canWrite: true,
      })
    ).not.toThrow();
  });

  it("barra quem só tem leitura — ver cliente não é contratar módulo", () => {
    expect(() =>
      assertCanWrite({
        userId: "u",
        email: "a@b.c",
        name: null,
        canWrite: false,
      })
    ).toThrow(StaffAuthError);
  });
});
