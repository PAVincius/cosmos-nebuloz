import { beforeEach, describe, expect, it, vi } from "vitest";

// Guards do Meridian — FR-001/FR-002/FR-003.
//
// A ordem dos três portões não é cosmética: checar permissão antes de resolver
// a sessão de tenant é vazamento cross-tenant. E as duas negações de FORBIDDEN
// precisam continuar distinguíveis pela mensagem — módulo não contratado se
// resolve com quem assina o contrato, papel ausente se resolve com um consultor.

const h = vi.hoisted(() => ({
  requireTenantSession: vi.fn(),
  hasModule: vi.fn(),
  getMeridianRole: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: vi.fn().mockResolvedValue({}) }));
vi.mock("@repo/auth/server", async () => {
  class AuthError extends Error {
    readonly code: string;
    constructor(code: string, message?: string) {
      super(message);
      this.code = code;
      this.name = "AuthError";
    }
  }
  return { AuthError, requireTenantSession: h.requireTenantSession };
});
vi.mock("@repo/rbac", async () => {
  const actual = await vi.importActual<
    typeof import("@repo/rbac/src/meridian-matrix")
  >("../../../../packages/rbac/src/meridian-matrix");
  return {
    hasModule: h.hasModule,
    getMeridianRole: h.getMeridianRole,
    hasMeridianPermission: actual.hasMeridianPermission,
    meridianDenialReason: actual.meridianDenialReason,
  };
});

import { AuthError } from "@repo/auth/server";
import type { MeridianContext } from "@/lib/meridian/guards";
import {
  requireMeridianContext,
  requireMeridianPermission,
  requireMeridianPermissionContext,
} from "@/lib/meridian/guards";

const SESSION = {
  tenantId: "t1",
  userId: "u1",
  role: "ADMIN",
  user: {
    id: "u1",
    email: "m@x.com",
    name: "Marina",
    emailVerified: true,
    twoFactorEnabled: false,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  },
} as unknown as MeridianContext;

beforeEach(() => {
  vi.clearAllMocks();
  h.requireTenantSession.mockResolvedValue(SESSION);
  h.hasModule.mockResolvedValue(true);
  h.getMeridianRole.mockResolvedValue("CONSULTANT");
});

describe("requireMeridianContext", () => {
  it("devolve o contexto com o papel de diagnóstico", async () => {
    const ctx = await requireMeridianContext();
    expect(ctx.tenantId).toBe("t1");
    expect(ctx.meridianRole).toBe("CONSULTANT");
  });

  it("resolve a sessão ANTES de checar o módulo", async () => {
    const order: string[] = [];
    h.requireTenantSession.mockImplementation(() => {
      order.push("session");
      return Promise.resolve(SESSION);
    });
    h.hasModule.mockImplementation(() => {
      order.push("module");
      return Promise.resolve(true);
    });
    h.getMeridianRole.mockImplementation(() => {
      order.push("role");
      return Promise.resolve("CONSULTANT");
    });
    await requireMeridianContext();
    expect(order).toEqual(["session", "module", "role"]);
  });

  it("nega com mensagem de contratação quando o módulo não está contratado", async () => {
    h.hasModule.mockResolvedValue(false);
    await expect(requireMeridianContext()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(requireMeridianContext()).rejects.toThrow(/não contratado/i);
    expect(h.getMeridianRole).not.toHaveBeenCalled();
  });

  it("nega com mensagem de papel quando falta MeridianMembership", async () => {
    h.getMeridianRole.mockResolvedValue(null);
    await expect(requireMeridianContext()).rejects.toThrow(
      /papel de diagnóstico/i
    );
  });

  it("não herda acesso do papel de plataforma — ADMIN sem papel é negado", async () => {
    h.requireTenantSession.mockResolvedValue({ ...SESSION, role: "ADMIN" });
    h.getMeridianRole.mockResolvedValue(null);
    await expect(requireMeridianContext()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("propaga UNAUTHORIZED de sessão ausente sem tocar em módulo nem papel", async () => {
    h.requireTenantSession.mockRejectedValue(
      new AuthError("UNAUTHORIZED", "sem sessão")
    );
    await expect(requireMeridianContext()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(h.hasModule).not.toHaveBeenCalled();
    expect(h.getMeridianRole).not.toHaveBeenCalled();
  });

  it("checa o módulo MERIDIAN, não outro", async () => {
    await requireMeridianContext();
    expect(h.hasModule).toHaveBeenCalledWith("t1", "MERIDIAN");
  });
});

describe("requireMeridianPermission", () => {
  const ctx = { ...SESSION, meridianRole: "REVIEWER" as const };

  it("aceita permissão concedida ao papel", () => {
    expect(() =>
      requireMeridianPermission("override.write", ctx)
    ).not.toThrow();
  });

  it("nega permissão fora do papel, nomeando quem a concede", () => {
    expect(() => requireMeridianPermission("gap.promote", ctx)).toThrow(
      /Consultor/
    );
  });
});

describe("requireMeridianPermissionContext", () => {
  it("compõe contexto e permissão numa chamada", async () => {
    h.getMeridianRole.mockResolvedValue("VIEWER");
    await expect(
      requireMeridianPermissionContext("override.write")
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
