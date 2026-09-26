import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  tenantFindUnique: vi.fn(),
}));

vi.mock("@repo/database", () => ({
  database: {
    tenant: { findUnique: dbMocks.tenantFindUnique },
  },
}));

const authMocks = vi.hoisted(() => ({
  requireTenantSession: vi.fn(),
  headers: vi.fn(),
}));

vi.mock("@repo/auth/server", () => ({
  requireTenantSession: authMocks.requireTenantSession,
}));

vi.mock("next/headers", () => ({
  headers: authMocks.headers,
}));

const produtosMocks = vi.hoisted(() => ({
  listarProdutos: vi.fn(),
}));

vi.mock("../../app/actions/produtos", () => ({
  listarProdutos: produtosMocks.listarProdutos,
}));

import { resolvePostLoginDestination } from "../../app/(authenticated)/_lib/resolve-post-login-destination";

beforeEach(() => {
  vi.clearAllMocks();
  authMocks.headers.mockResolvedValue(new Headers());
  authMocks.requireTenantSession.mockResolvedValue({ tenantId: "tenant-1" });
});

describe("resolvePostLoginDestination — tenant interno", () => {
  it("resolve para o catálogo sem consultar listarProdutos", async () => {
    dbMocks.tenantFindUnique.mockResolvedValue({ isInternalTenant: true });

    await expect(resolvePostLoginDestination()).resolves.toBe("/produto");
    expect(produtosMocks.listarProdutos).not.toHaveBeenCalled();
  });

  it("lê isInternalTenant a partir do tenantId da sessão, não de input", async () => {
    dbMocks.tenantFindUnique.mockResolvedValue({ isInternalTenant: true });

    await resolvePostLoginDestination();
    expect(dbMocks.tenantFindUnique).toHaveBeenCalledWith({
      where: { id: "tenant-1" },
      select: { isInternalTenant: true },
    });
  });
});

describe("resolvePostLoginDestination — tenant sem a flag", () => {
  it("vai para o primeiro produto disponível, via listarProdutos", async () => {
    dbMocks.tenantFindUnique.mockResolvedValue({ isInternalTenant: false });
    produtosMocks.listarProdutos.mockResolvedValue({
      ok: true,
      data: [
        { modulo: "COSMOS", href: "/cosmos", estado: "DISPONIVEL" },
        { modulo: "CHARTER", href: null, estado: "SEM_CONTRATO" },
      ],
    });

    await expect(resolvePostLoginDestination()).resolves.toBe("/cosmos");
  });

  it("cai no destino padrão quando nenhum produto está disponível", async () => {
    dbMocks.tenantFindUnique.mockResolvedValue({ isInternalTenant: false });
    produtosMocks.listarProdutos.mockResolvedValue({
      ok: true,
      data: [{ modulo: "COSMOS", href: null, estado: "SEM_CONTRATO" }],
    });

    await expect(resolvePostLoginDestination()).resolves.toBe(
      "/cosmos/dashboard"
    );
  });

  it("cai no destino padrão quando listarProdutos falha", async () => {
    dbMocks.tenantFindUnique.mockResolvedValue({ isInternalTenant: false });
    produtosMocks.listarProdutos.mockResolvedValue({
      ok: false,
      error: "erro",
    });

    await expect(resolvePostLoginDestination()).resolves.toBe(
      "/cosmos/dashboard"
    );
  });

  it("trata tenant sem linha (findUnique null) como não-interno", async () => {
    dbMocks.tenantFindUnique.mockResolvedValue(null);
    produtosMocks.listarProdutos.mockResolvedValue({
      ok: true,
      data: [{ modulo: "COSMOS", href: "/cosmos", estado: "DISPONIVEL" }],
    });

    await expect(resolvePostLoginDestination()).resolves.toBe("/cosmos");
  });
});
