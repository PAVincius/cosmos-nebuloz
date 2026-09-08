import { beforeEach, describe, expect, it, vi } from "vitest";

// Guards do Signal — a ordem dos quatro portões e o quinto, de posse.
//
// Checar permissão antes de resolver a sessão de tenant é vazamento
// cross-tenant, e por isso a ordem é testada e não só o resultado. As duas
// negações de FORBIDDEN precisam continuar distinguíveis pela mensagem: módulo
// não contratado se resolve com quem assina o contrato, papel ausente se
// resolve com um administrador do Signal.

const h = vi.hoisted(() => ({
  requireTenantSession: vi.fn(),
  hasModule: vi.fn(),
  getSignalRole: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: vi.fn().mockResolvedValue({}) }));
vi.mock("@repo/auth/server", () => {
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
    typeof import("@repo/rbac/src/signal-matrix")
  >("../../../../../packages/rbac/src/signal-matrix");
  return {
    ...actual,
    hasModule: h.hasModule,
    getSignalRole: h.getSignalRole,
  };
});

import { AuthError } from "@repo/auth/server";
import { SignalRuleError, SignalStateConflictError } from "@/lib/signal/errors";
import {
  requireInitiativeOwnership,
  requireSignalContext,
  requireSignalPermission,
  requireSignalPermissionContext,
} from "@/lib/signal/guards";

const SESSION = {
  userId: "usr_1",
  tenantId: "tnt_1",
  user: { id: "usr_1", name: "Marina Duarte", email: "marina@vanta.test" },
};

beforeEach(() => {
  vi.clearAllMocks();
  h.requireTenantSession.mockResolvedValue(SESSION);
  h.hasModule.mockResolvedValue(true);
  h.getSignalRole.mockResolvedValue("ANALYST");
});

describe("ordem dos portões", () => {
  it("resolve a sessão ANTES de consultar módulo ou papel", async () => {
    const order: string[] = [];
    h.requireTenantSession.mockImplementation(async () => {
      order.push("session");
      return SESSION;
    });
    h.hasModule.mockImplementation(async () => {
      order.push("module");
      return true;
    });
    h.getSignalRole.mockImplementation(async () => {
      order.push("role");
      return "ANALYST";
    });

    await requireSignalContext();
    expect(order).toEqual(["session", "module", "role"]);
  });

  it("não consulta o papel quando o módulo não está contratado", async () => {
    // Consultar papel antes do módulo vazaria a existência do vínculo.
    h.hasModule.mockResolvedValue(false);
    await expect(requireSignalContext()).rejects.toThrow(AuthError);
    expect(h.getSignalRole).not.toHaveBeenCalled();
  });

  it("não consulta módulo nem papel sem sessão válida", async () => {
    h.requireTenantSession.mockRejectedValue(
      new AuthError("UNAUTHORIZED", "sem sessão")
    );
    await expect(requireSignalContext()).rejects.toThrow(AuthError);
    expect(h.hasModule).not.toHaveBeenCalled();
    expect(h.getSignalRole).not.toHaveBeenCalled();
  });

  it("consulta o módulo com o tenant DA SESSÃO, nunca de outro lugar", async () => {
    await requireSignalContext();
    expect(h.hasModule).toHaveBeenCalledWith("tnt_1", "SIGNAL");
    expect(h.getSignalRole).toHaveBeenCalledWith("usr_1", "tnt_1");
  });
});

describe("negativas", () => {
  it("sem sessão → UNAUTHORIZED", async () => {
    h.requireTenantSession.mockRejectedValue(
      new AuthError("UNAUTHORIZED", "sem sessão")
    );
    await expect(requireSignalContext()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("módulo não contratado → FORBIDDEN, com o motivo do comercial", async () => {
    h.hasModule.mockResolvedValue(false);
    await expect(requireSignalContext()).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: expect.stringContaining("não contratado"),
    });
  });

  it("sem papel no Signal → FORBIDDEN, com o motivo do administrador", async () => {
    h.getSignalRole.mockResolvedValue(null);
    await expect(requireSignalContext()).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: expect.stringContaining("Sem papel de medição"),
    });
  });

  it("as duas negativas de FORBIDDEN continuam distinguíveis pela mensagem", async () => {
    h.hasModule.mockResolvedValue(false);
    const noModule = await requireSignalContext().catch(
      (e: Error) => e.message
    );
    h.hasModule.mockResolvedValue(true);
    h.getSignalRole.mockResolvedValue(null);
    const noRole = await requireSignalContext().catch((e: Error) => e.message);
    // Uma se resolve com quem assina o contrato; a outra, com um administrador.
    // Mensagem igual mandaria metade dos usuários ao lugar errado.
    expect(noModule).not.toBe(noRole);
  });

  it("ADMIN do tenant NÃO herda papel de Signal", async () => {
    // Default deny nos dois eixos: contratar o módulo e ser admin da plataforma
    // não substitui o papel nomeado.
    h.getSignalRole.mockResolvedValue(null);
    await expect(requireSignalContext()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("permissão", () => {
  it("deixa passar quando o papel concede", async () => {
    const ctx = await requireSignalContext();
    expect(() =>
      requireSignalPermission("signal.mapping.write", ctx)
    ).not.toThrow();
  });

  it("nega com o motivo legível quando o papel não alcança", async () => {
    const ctx = await requireSignalContext();
    try {
      requireSignalPermission("signal.report.freeze", ctx);
      expect.unreachable("deveria ter negado");
    } catch (e) {
      expect((e as AuthError).code).toBe("FORBIDDEN");
      expect((e as Error).message).toContain("Administrador");
    }
  });

  it("VIEWER só lê", async () => {
    h.getSignalRole.mockResolvedValue("VIEWER");
    const ctx = await requireSignalContext();
    expect(() => requireSignalPermission("signal.read", ctx)).not.toThrow();
    expect(() =>
      requireSignalPermission("signal.initiative.write", ctx)
    ).toThrow();
  });

  it("combina contexto e permissão numa chamada", async () => {
    const ctx = await requireSignalPermissionContext("signal.formula.write");
    expect(ctx.signalRole).toBe("ANALYST");
    expect(ctx.tenantId).toBe("tnt_1");
  });

  it("requireSignalPermissionContext falha no portão do módulo, não no da permissão", async () => {
    h.hasModule.mockResolvedValue(false);
    await expect(
      requireSignalPermissionContext("signal.read")
    ).rejects.toMatchObject({
      message: expect.stringContaining("não contratado"),
    });
  });
});

describe("posse da iniciativa — o quinto portão", () => {
  const OTHERS = { ownerId: "usr_outra_pessoa", code: "IN-014" };
  const MINE = { ownerId: "usr_1", code: "IN-021" };

  it("OWNER escreve na própria", async () => {
    h.getSignalRole.mockResolvedValue("OWNER");
    const ctx = await requireSignalContext();
    expect(() => requireInitiativeOwnership(ctx, MINE)).not.toThrow();
  });

  it("OWNER NÃO escreve na de outra pessoa, mesmo tendo a permissão", async () => {
    // A permissão passa; a posse não. Parar no quarto portão deixaria um OWNER
    // editar a iniciativa de qualquer colega.
    h.getSignalRole.mockResolvedValue("OWNER");
    const ctx = await requireSignalContext();
    expect(() =>
      requireSignalPermission("signal.initiative.write", ctx)
    ).not.toThrow();
    expect(() => requireInitiativeOwnership(ctx, OTHERS)).toThrow(AuthError);
  });

  it("nomeia a iniciativa negada, para a UI não mandar procurar", async () => {
    h.getSignalRole.mockResolvedValue("OWNER");
    const ctx = await requireSignalContext();
    try {
      requireInitiativeOwnership(ctx, OTHERS);
      expect.unreachable("deveria ter negado");
    } catch (e) {
      expect((e as Error).message).toContain("IN-014");
    }
  });

  it("ANALYST e ADMIN alcançam qualquer iniciativa", async () => {
    for (const role of ["ANALYST", "ADMIN"] as const) {
      h.getSignalRole.mockResolvedValue(role);
      const ctx = await requireSignalContext();
      expect(() => requireInitiativeOwnership(ctx, OTHERS)).not.toThrow();
    }
  });
});

describe("taxonomia de erro", () => {
  it("regra de domínio é 422 e carrega o nome da regra", () => {
    const e = new SignalRuleError(
      "baseline.required",
      "Ative só depois de assinar o baseline."
    );
    expect(e.status).toBe(422);
    expect(e.rule).toBe("baseline.required");
  });

  it("conflito de estado é 409 e carrega os bloqueadores para a UI listar", () => {
    const e = new SignalStateConflictError(
      "report.sources.down",
      "Fontes fora do ar",
      ["Zendesk", "Planilha de custos"]
    );
    expect(e.status).toBe(409);
    expect(e.blockers).toEqual(["Zendesk", "Planilha de custos"]);
  });

  it("403, 409 e 422 são tipos distintos — a UI reage diferente a cada um", () => {
    const rule = new SignalRuleError("r", "m");
    const conflict = new SignalStateConflictError("r", "m");
    expect(rule).not.toBeInstanceOf(SignalStateConflictError);
    expect(conflict).not.toBeInstanceOf(SignalRuleError);
    expect(rule).not.toBeInstanceOf(AuthError);
  });
});
