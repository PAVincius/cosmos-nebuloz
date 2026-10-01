// @vitest-environment node
// FR-003 + contracts/shell-data-contract.md (spec 009): cada
// getShellData()/ShellIdentity dos 5 produtos precisa devolver `tenants[]` +
// `activeTenantId` no formato que o AccountSwitcher espera — a mesma
// leitura já usada por /api/tenants (TenantMember por userId, sem
// cross-tenant, FR-014), não uma consulta nova.
//
// Este arquivo cobre só o contrato novo (tenants/activeTenantId); o resto de
// cada getShellData (badges, portfólio, etc.) já tem cobertura própria em
// __tests__/signal/integration/shell.test.ts e afins.

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  requireMeridianContext: vi.fn(),
  requireSignalContext: vi.fn(),
  requireScaffoldContext: vi.fn(),
  requireCharterContext: vi.fn(),
  requireTenantSession: vi.fn(),
  tenantMemberFindMany: vi.fn(),
  tenantFindUnique: vi.fn(),
}));

/** Qualquer `db.<model>.<method>(...)` dentro de `withTenantDb` devolve um
 *  default inofensivo — o que interessa aqui é só tenants/activeTenantId,
 *  o resto de cada getShellData já é coberto noutro lugar. */
function fakeTenantDb(): unknown {
  return new Proxy(
    {},
    {
      get: (_target, model: string) =>
        new Proxy(
          {},
          {
            get:
              (_t, method: string) =>
              async (..._args: unknown[]) => {
                if (method === "findMany") {
                  return [];
                }
                if (method === "count") {
                  return 0;
                }
                if (method === "findUnique" || method === "findFirst") {
                  return model === "tenant" ? { name: "Empresa Teste" } : null;
                }
                return null;
              },
          }
        ),
    }
  );
}

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: vi.fn().mockResolvedValue({}) }));
vi.mock("@repo/database", () => ({
  database: {
    tenantMember: { findMany: h.tenantMemberFindMany },
    tenant: { findUnique: h.tenantFindUnique },
  },
  withTenantDb: (_tenantId: string, fn: (db: unknown) => unknown) =>
    fn(fakeTenantDb()),
}));
vi.mock("@repo/rbac", async () => {
  const actual =
    await vi.importActual<typeof import("@repo/rbac")>("@repo/rbac");
  return { ...actual, listModules: vi.fn().mockResolvedValue(["COSMOS"]) };
});
vi.mock("@/lib/meridian/guards", () => ({
  requireMeridianContext: h.requireMeridianContext,
}));
vi.mock("@/lib/signal/guards", () => ({
  requireSignalContext: h.requireSignalContext,
}));
vi.mock("@/lib/scaffold/guards", () => ({
  requireScaffoldContext: h.requireScaffoldContext,
}));
vi.mock("@/lib/charter/guards", () => ({
  requireCharterContext: h.requireCharterContext,
}));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: h.requireTenantSession,
  redirectToSignIn: vi.fn(),
  AuthError: class AuthError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  },
}));
// Quebra a cadeia transitiva de resolveActiveAccountDestination (importado
// pelos 5 shells para o AccountSwitcher) → resolvePostLoginDestination →
// listarProdutos → MemberRole — mesma saída de
// __tests__/produto/resolve-post-login-destination.test.ts, já que este
// arquivo não testa esse caminho, só o contrato de tenants/activeTenantId.
vi.mock("@/app/actions/produtos", () => ({ listarProdutos: vi.fn() }));

const MEMBERSHIPS = [
  {
    role: "ADMIN",
    tenant: { id: "tenant-1", name: "Nebula" },
  },
  {
    role: "SM",
    tenant: { id: "tenant-2", name: "Nebuloz" },
  },
];

const EXPECTED_TENANTS = [
  { id: "tenant-1", name: "Nebula", role: "ADMIN" },
  { id: "tenant-2", name: "Nebuloz", role: "SM" },
];

beforeEach(() => {
  vi.clearAllMocks();
  h.tenantMemberFindMany.mockResolvedValue(MEMBERSHIPS);
  h.tenantFindUnique.mockResolvedValue({
    name: "Empresa Teste",
    plan: "orbit",
  });
});

describe("Meridian — getShellData devolve tenants[] + activeTenantId", () => {
  it("shape do contrato", async () => {
    h.requireMeridianContext.mockResolvedValue({
      tenantId: "tenant-1",
      userId: "user-1",
      meridianRole: "CONSULTANT",
      user: { name: "Bia", email: "bia@nebuloz.test" },
    });
    const { getShellData } = await import("@/app/(meridian)/actions/shell");
    const shell = await getShellData();
    expect(shell.activeTenantId).toBe("tenant-1");
    expect(shell.tenants).toEqual(EXPECTED_TENANTS);
    expect(h.tenantMemberFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } })
    );
  });
});

describe("Signal — getShellData devolve tenants[] + activeTenantId", () => {
  it("shape do contrato", async () => {
    h.requireSignalContext.mockResolvedValue({
      tenantId: "tenant-1",
      userId: "user-1",
      signalRole: "ANALYST",
      user: { name: "Bia", email: "bia@nebuloz.test" },
    });
    const { getShellData } = await import("@/app/(signal)/actions/shell");
    const shell = await getShellData();
    expect(shell.activeTenantId).toBe("tenant-1");
    expect(shell.tenants).toEqual(EXPECTED_TENANTS);
  });
});

describe("Scaffold — getShellData devolve tenants[] + activeTenantId", () => {
  it("shape do contrato", async () => {
    h.requireScaffoldContext.mockResolvedValue({
      tenantId: "tenant-1",
      userId: "user-1",
      scaffoldRole: "CSM",
      user: { name: "Bia", email: "bia@nebuloz.test" },
    });
    const { getShellData } = await import("@/app/(scaffold)/actions/shell");
    const shell = await getShellData();
    expect(shell.activeTenantId).toBe("tenant-1");
    expect(shell.tenants).toEqual(EXPECTED_TENANTS);
  });
});

describe("Charter — getShellData devolve tenants[] + activeTenantId", () => {
  it("shape do contrato", async () => {
    h.requireCharterContext.mockResolvedValue({
      tenantId: "tenant-1",
      userId: "user-1",
      charterRole: "COMPLIANCE_LEAD",
      user: { name: "Bia", email: "bia@nebuloz.test" },
    });
    const { getShellData } = await import("@/app/(charter)/actions/shell");
    const shell = await getShellData();
    expect(shell.activeTenantId).toBe("tenant-1");
    expect(shell.tenants).toEqual(EXPECTED_TENANTS);
  });
});

describe("Cosmos — resolveIdentity devolve tenants[] + activeTenantId", () => {
  // ponytail: resolveIdentity mora no layout, e importar o layout traz o shell
  // client inteiro (~3 s isolado); os 5 s padrão estouram com a suíte toda.
  // Tirar resolveIdentity para (cosmos)/actions/shell.ts dispensa o timeout.
  it("shape do contrato", async () => {
    h.requireTenantSession.mockResolvedValue({
      tenantId: "tenant-1",
      userId: "user-1",
      role: "ADMIN",
      user: { name: "Bia", email: "bia@nebuloz.test" },
    });
    const { resolveIdentity } = await import("@/app/(cosmos)/layout");
    const identity = await resolveIdentity();
    expect(identity?.activeTenantId).toBe("tenant-1");
    expect(identity?.tenants).toEqual(EXPECTED_TENANTS);
  }, 60_000);
});
