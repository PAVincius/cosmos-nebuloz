import { beforeEach, describe, expect, it, vi } from "vitest";

// O que a pessoa pode fazer, para a tela desabilitar com motivo em vez de
// oferecer o controle e derrubar a tela na recusa (Crivo F2). Matriz real.

const h = vi.hoisted(() => ({
  role: "CONSULTANT" as string | null,
  requireTenantSession: vi.fn(),
  AuthError: class AuthError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.name = "AuthError";
      this.code = code;
    }
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: () => new Headers() }));
vi.mock("@repo/auth/server", () => ({
  AuthError: h.AuthError,
  requireTenantSession: h.requireTenantSession,
}));
vi.mock("@repo/rbac", async () => {
  const matrix = await import("../../../../packages/rbac/src/scaffold-matrix");
  return {
    ...matrix,
    hasModule: async () => true,
    getScaffoldRole: async () => h.role,
  };
});

import { getScaffoldAccess } from "@/app/(scaffold)/actions/access";

beforeEach(() => {
  h.role = "CONSULTANT";
  h.requireTenantSession.mockResolvedValue({
    tenantId: "t1",
    userId: "u1",
    role: "ADMIN",
    user: { name: "Marina", email: "m@x.com" },
  });
});

describe("getScaffoldAccess", () => {
  it("consultor pode conduzir trilha e atribuir papel", async () => {
    const r = await getScaffoldAccess();
    expect(r.ok && r.data.role).toBe("CONSULTANT");
    expect(r.ok && r.data.can["track.manage"]).toEqual({
      allowed: true,
      reason: null,
    });
    expect(r.ok && r.data.can["membership.manage"].allowed).toBe(true);
  });

  it.each([
    "SPONSOR",
    "TEAM_LEAD",
  ])("%s só lê: nada de escrita, e cada negativa traz o motivo", async (role) => {
    h.role = role;
    const r = await getScaffoldAccess();
    expect(r.ok).toBe(true);
    if (r.ok) {
      for (const p of [
        "track.manage",
        "step.complete",
        "gate.close",
        "membership.manage",
        "deliverable.work",
      ] as const) {
        expect(r.data.can[p].allowed).toBe(false);
        expect(r.data.can[p].reason).toMatch(/Requer papel/);
      }
      expect(r.data.can["portfolio.read"].allowed).toBe(true);
      expect(r.data.can["deliverable.read"].allowed).toBe(true);
    }
  });

  it("cobre toda permissão da matriz, sem esquecer nenhuma", async () => {
    const r = await getScaffoldAccess();
    const { SCAFFOLD_PERMISSIONS } = await import(
      "../../../../packages/rbac/src/scaffold-matrix"
    );
    expect(r.ok && Object.keys(r.data.can).sort()).toEqual(
      [...SCAFFOLD_PERMISSIONS].sort()
    );
  });

  it("sem papel de adoção a recusa é a do guard, não um mapa vazio", async () => {
    h.role = null;
    const r = await getScaffoldAccess();
    expect(r.ok).toBe(false);
  });
});
