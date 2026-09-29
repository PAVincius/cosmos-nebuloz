// @vitest-environment node
// P1 28/09: tenant com SCAFFOLD contratado derrubava /meridian (500,
// "Cannot read properties of undefined (reading 'href')"). `listModules`
// devolve os 5 módulos; o AppSwitcher de cada casca só conhece um subconjunto
// (MODULE_META). getShellData precisa entregar só o que a casca sabe desenhar.

import { beforeEach, describe, expect, it, vi } from "vitest";

const ALL_MODULES = ["COSMOS", "CHARTER", "SIGNAL", "MERIDIAN", "SCAFFOLD"];

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
  return { ...actual, listModules: vi.fn().mockResolvedValue(ALL_MODULES) };
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

const USER = { name: "Bia", email: "bia@nebuloz.test" };

beforeEach(() => {
  vi.clearAllMocks();
  h.tenantMemberFindMany.mockResolvedValue([]);
  h.tenantFindUnique.mockResolvedValue({
    name: "Empresa Teste",
    plan: "orbit",
  });
});

describe("getShellData com SCAFFOLD na lista de módulos", () => {
  it("Meridian não repassa módulo que a casca não desenha", async () => {
    h.requireMeridianContext.mockResolvedValue({
      tenantId: "t-1",
      userId: "u-1",
      meridianRole: "CONSULTANT",
      user: USER,
    });
    const { getShellData } = await import("@/app/(meridian)/actions/shell");
    const shell = await getShellData();
    expect(shell.modules).toEqual(["COSMOS", "CHARTER", "SIGNAL", "MERIDIAN"]);
  });

  it("Signal não repassa módulo que a casca não desenha", async () => {
    h.requireSignalContext.mockResolvedValue({
      tenantId: "t-1",
      userId: "u-1",
      signalRole: "ANALYST",
      user: USER,
    });
    const { getShellData } = await import("@/app/(signal)/actions/shell");
    const shell = await getShellData();
    expect(shell.modules).toEqual(["COSMOS", "CHARTER", "SIGNAL", "MERIDIAN"]);
  });

  it("Charter não repassa SCAFFOLD nem MERIDIAN (fora do MODULE_META dela)", async () => {
    h.requireCharterContext.mockResolvedValue({
      tenantId: "t-1",
      userId: "u-1",
      charterRole: "COMPLIANCE_LEAD",
      user: USER,
    });
    const { getShellData } = await import("@/app/(charter)/actions/shell");
    const shell = await getShellData();
    expect(shell.modules).toEqual(["COSMOS", "CHARTER", "SIGNAL"]);
  });
});
