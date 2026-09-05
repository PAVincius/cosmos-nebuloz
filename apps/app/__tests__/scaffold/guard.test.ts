import { beforeEach, describe, expect, it, vi } from "vitest";

// Guard triplo do Scaffold.
//
// A ordem importa e é testada como ordem, não só como resultado: checar
// permissão antes de resolver a sessão de tenant é vazamento cross-tenant, e um
// teste que só afirma "deu FORBIDDEN" passaria com a ordem invertida.
//
// A recusa por papel ausente tem razão própria neste produto: quem fecha um
// gate precisa ser nomeável. Um ADMIN de tenant que fecha gate sem papel de
// adoção produz um fechamento sem responsável — que é o defeito que o SRD trata
// como de severidade máxima.

// AuthError vive dentro do hoisted: `vi.mock` é içado para o topo do arquivo, e
// uma classe declarada aqui em cima ainda estaria na zona morta temporal quando
// a fábrica rodasse.
const h = vi.hoisted(() => ({
  requireTenantSession: vi.fn(),
  hasModule: vi.fn(),
  getScaffoldRole: vi.fn(),
  calls: [] as string[],
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
vi.mock("@repo/rbac", () => ({
  hasModule: h.hasModule,
  getScaffoldRole: h.getScaffoldRole,
  hasScaffoldPermission: (role: string, permission: string) =>
    role === "CONSULTANT" || permission === "portfolio.read",
  scaffoldDenialReason: (p: string) => `Requer papel — ${p}`,
}));

import {
  requireScaffoldContext,
  requireScaffoldPermissionContext,
} from "@/lib/scaffold/guards";

const CTX = {
  tenantId: "t1",
  userId: "u1",
  role: "ADMIN",
  user: { name: "Marina", email: "m@x.com" },
};

beforeEach(() => {
  vi.clearAllMocks();
  h.calls.length = 0;
  h.requireTenantSession.mockImplementation(async () => {
    h.calls.push("session");
    return CTX;
  });
  h.hasModule.mockImplementation(async () => {
    h.calls.push("module");
    return true;
  });
  h.getScaffoldRole.mockImplementation(async () => {
    h.calls.push("role");
    return "CONSULTANT";
  });
});

describe("requireScaffoldContext", () => {
  it("devolve contexto com o papel quando os três portões passam", async () => {
    const ctx = await requireScaffoldContext();
    expect(ctx.tenantId).toBe("t1");
    expect(ctx.scaffoldRole).toBe("CONSULTANT");
  });

  it("resolve sessão → módulo → papel, nessa ordem", async () => {
    await requireScaffoldContext();
    expect(h.calls).toEqual(["session", "module", "role"]);
  });

  it("propaga UNAUTHORIZED quando não há sessão de tenant", async () => {
    h.requireTenantSession.mockRejectedValue(
      new h.AuthError("UNAUTHORIZED", "sem sessão")
    );
    await expect(requireScaffoldContext()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    // Não chegou a consultar módulo nem papel: sem saber de qual tenant é a
    // pergunta, qualquer resposta é de outro tenant.
    expect(h.hasModule).not.toHaveBeenCalled();
    expect(h.getScaffoldRole).not.toHaveBeenCalled();
  });

  it("recusa com FORBIDDEN quando o módulo SCAFFOLD não está contratado", async () => {
    h.hasModule.mockResolvedValue(false);
    await expect(requireScaffoldContext()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(h.getScaffoldRole).not.toHaveBeenCalled();
  });

  it("recusa com FORBIDDEN quando não há papel de adoção, mesmo sendo ADMIN do tenant", async () => {
    h.getScaffoldRole.mockResolvedValue(null);
    await expect(requireScaffoldContext()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("consulta o módulo com SCAFFOLD, não com outro produto", async () => {
    await requireScaffoldContext();
    expect(h.hasModule).toHaveBeenCalledWith("t1", "SCAFFOLD");
  });
});

describe("requireScaffoldPermissionContext", () => {
  it("passa quando o papel concede a permissão", async () => {
    const ctx = await requireScaffoldPermissionContext("gate.override");
    expect(ctx.scaffoldRole).toBe("CONSULTANT");
  });

  it("recusa quando o papel não concede", async () => {
    h.getScaffoldRole.mockResolvedValue("TEAM_MEMBER");
    await expect(
      requireScaffoldPermissionContext("gate.override")
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("repete o guard de sessão — layout não protege RPC", async () => {
    await requireScaffoldPermissionContext("portfolio.read");
    expect(h.requireTenantSession).toHaveBeenCalledTimes(1);
    expect(h.hasModule).toHaveBeenCalledTimes(1);
  });
});
