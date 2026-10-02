import { beforeEach, describe, expect, it, vi } from "vitest";

// BETTER_AUTH_SECRET vem de `test.env` no vitest.config.mts: server.ts valida
// no corpo do módulo, e o import abaixo é içado acima de qualquer atribuição
// feita aqui.

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  tenantMemberFindFirst: vi.fn(),
  sessionUpdate: vi.fn(),
  userFindUnique: vi.fn(),
  logInfo: vi.fn(),
  redirect: vi.fn(),
  nextHeaders: vi.fn(),
  /** Config passada ao betterAuth() na carga do módulo. */
  authConfig: undefined as Record<string, unknown> | undefined,
  /** Config passada ao twoFactor() na carga do módulo. */
  twoFactorConfig: undefined as Record<string, unknown> | undefined,
}));

vi.mock("better-auth", () => ({
  betterAuth: (config: Record<string, unknown>) => {
    mocks.authConfig = config;
    return { api: { getSession: mocks.getSession } };
  },
}));
vi.mock("better-auth/adapters/prisma", () => ({ prismaAdapter: () => ({}) }));
vi.mock("better-auth/plugins", () => ({
  twoFactor: (config: Record<string, unknown>) => {
    mocks.twoFactorConfig = config;
    return {};
  },
}));
vi.mock("@repo/email", () => ({
  keys: () => ({ RESEND_FROM: "noreply@nebuloz.ai" }),
  resend: { emails: { send: vi.fn() } },
  renderResetPasswordEmail: vi.fn().mockResolvedValue("<html />"),
}));

vi.mock("@repo/database", () => ({
  database: {
    tenantMember: { findFirst: mocks.tenantMemberFindFirst },
    session: { update: mocks.sessionUpdate },
    user: { findUnique: mocks.userFindUnique },
  },
}));

vi.mock("@repo/observability/log", () => ({ log: { info: mocks.logInfo } }));
vi.mock("next/headers", () => ({ headers: mocks.nextHeaders }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import {
  AuthError,
  currentUser,
  getOrgId,
  requireMfaForPrivilegedRoles,
  requireRole,
  requireTenantSession,
  type TenantContext,
} from "../server";

const HEADERS = new Headers();
const USER = { id: "user-1", email: "quem@exemplo.com" };

function session(activeTenantId?: string | null) {
  return {
    user: USER,
    session: { id: "sess-1", activeTenantId },
  };
}

function ctx(role: string): TenantContext {
  return {
    userId: "user-1",
    tenantId: "tenant-1",
    role: role as TenantContext["role"],
    user: USER as TenantContext["user"],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.nextHeaders.mockResolvedValue(HEADERS);
  mocks.sessionUpdate.mockResolvedValue({});
});

describe("requireTenantSession — sessão ausente", () => {
  it("lança UNAUTHORIZED sem sessão", async () => {
    mocks.getSession.mockResolvedValue(null);
    await expect(requireTenantSession(HEADERS)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("não consulta o banco sem sessão", async () => {
    mocks.getSession.mockResolvedValue(null);
    await requireTenantSession(HEADERS).catch(() => null);
    expect(mocks.tenantMemberFindFirst).not.toHaveBeenCalled();
  });
});

describe("requireTenantSession — com tenant ativo", () => {
  it("devolve o contexto quando o vínculo existe", async () => {
    mocks.getSession.mockResolvedValue(session("tenant-1"));
    mocks.tenantMemberFindFirst.mockResolvedValue({ role: "RTE" });

    await expect(requireTenantSession(HEADERS)).resolves.toEqual({
      userId: "user-1",
      tenantId: "tenant-1",
      role: "RTE",
      user: USER,
    });
  });

  // O coração do isolamento multi-tenant: cookie com activeTenantId de um
  // tenant do qual a pessoa não é membro não pode virar acesso.
  it("lança FORBIDDEN quando não há vínculo com o tenant do cookie", async () => {
    mocks.getSession.mockResolvedValue(session("tenant-de-outro"));
    mocks.tenantMemberFindFirst.mockResolvedValue(null);

    await expect(requireTenantSession(HEADERS)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("busca o vínculo pelo par tenant + usuário", async () => {
    mocks.getSession.mockResolvedValue(session("tenant-1"));
    mocks.tenantMemberFindFirst.mockResolvedValue({ role: "DEV" });

    await requireTenantSession(HEADERS);
    expect(mocks.tenantMemberFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "tenant-1", userId: "user-1" },
      })
    );
  });
});

describe("requireTenantSession — sem tenant ativo", () => {
  it("lança NO_ACTIVE_ORGANIZATION quando não há vínculo nenhum", async () => {
    mocks.getSession.mockResolvedValue(session(null));
    mocks.tenantMemberFindFirst.mockResolvedValue(null);

    await expect(requireTenantSession(HEADERS)).rejects.toMatchObject({
      code: "NO_ACTIVE_ORGANIZATION",
    });
  });

  it("adota o primeiro vínculo e o persiste na sessão", async () => {
    mocks.getSession.mockResolvedValue(session(null));
    mocks.tenantMemberFindFirst.mockResolvedValue({
      tenantId: "tenant-9",
      role: "PO",
    });

    await expect(requireTenantSession(HEADERS)).resolves.toMatchObject({
      tenantId: "tenant-9",
      role: "PO",
    });
    expect(mocks.sessionUpdate).toHaveBeenCalledWith({
      where: { id: "sess-1" },
      data: { activeTenantId: "tenant-9" },
    });
  });

  // US3 (spec 009, FR-007/008): sem orderBy, o vínculo escolhido depende de
  // ordem não determinística de banco — a mesma pessoa poderia cair numa
  // conta diferente em cada acesso. `createdAt: "asc"` torna a escolha
  // repetível (a membership mais antiga sempre ganha).
  it("busca o vínculo mais antigo por createdAt, não ordem arbitrária de banco", async () => {
    mocks.getSession.mockResolvedValue(session(null));
    mocks.tenantMemberFindFirst.mockResolvedValue({
      tenantId: "tenant-9",
      role: "PO",
    });

    await requireTenantSession(HEADERS);

    expect(mocks.tenantMemberFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
        orderBy: { createdAt: "asc" },
      })
    );
  });

  // P2025 = linha de Session não encontrada, o que acontece quando o cookie
  // cache do better-auth carrega um id já rotacionado. A sessão já foi
  // validada e o vínculo confirmado: persistir é best-effort, negar acesso
  // aqui seria derrubar quem tem direito de entrar.
  it("segue em frente quando a persistência falha com P2025", async () => {
    mocks.getSession.mockResolvedValue(session(null));
    mocks.tenantMemberFindFirst.mockResolvedValue({
      tenantId: "tenant-9",
      role: "SM",
    });
    mocks.sessionUpdate.mockRejectedValue({ code: "P2025" });

    await expect(requireTenantSession(HEADERS)).resolves.toMatchObject({
      tenantId: "tenant-9",
      role: "SM",
    });
  });

  it("propaga erro de banco que não seja P2025", async () => {
    mocks.getSession.mockResolvedValue(session(null));
    mocks.tenantMemberFindFirst.mockResolvedValue({
      tenantId: "tenant-9",
      role: "SM",
    });
    mocks.sessionUpdate.mockRejectedValue(new Error("conexão caiu"));

    await expect(requireTenantSession(HEADERS)).rejects.toThrow("conexão caiu");
  });
});

describe("requireRole", () => {
  it("deixa passar papel permitido", () => {
    expect(() => requireRole(["ADMIN", "RTE"], ctx("RTE"))).not.toThrow();
  });

  it("lança FORBIDDEN com o papel exigido na mensagem", () => {
    try {
      requireRole(["ADMIN", "STE"], ctx("DEV"));
      expect.unreachable("deveria ter lançado");
    } catch (e) {
      expect(e).toBeInstanceOf(AuthError);
      expect((e as AuthError).code).toBe("FORBIDDEN");
      expect((e as Error).message).toContain("ADMIN | STE");
    }
  });

  it("nega tudo quando a lista de permitidos é vazia", () => {
    expect(() => requireRole([], ctx("ADMIN"))).toThrow(AuthError);
  });
});

describe("requireMfaForPrivilegedRoles", () => {
  it("não exige nada de papel não privilegiado", async () => {
    await expect(
      requireMfaForPrivilegedRoles(ctx("DEV"), HEADERS)
    ).resolves.toBeUndefined();
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
  });

  it("barra ADMIN sem 2FA habilitado", async () => {
    mocks.userFindUnique.mockResolvedValue({ twoFactorEnabled: false });
    await expect(
      requireMfaForPrivilegedRoles(ctx("ADMIN"), HEADERS)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("barra STE com 2FA habilitado mas não verificado nesta sessão", async () => {
    mocks.userFindUnique.mockResolvedValue({ twoFactorEnabled: true });
    mocks.getSession.mockResolvedValue({
      session: { twoFactorVerified: false },
    });

    await expect(
      requireMfaForPrivilegedRoles(ctx("STE"), HEADERS)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("deixa passar ADMIN com 2FA verificado", async () => {
    mocks.userFindUnique.mockResolvedValue({ twoFactorEnabled: true });
    mocks.getSession.mockResolvedValue({
      session: { twoFactorVerified: true },
    });

    await expect(
      requireMfaForPrivilegedRoles(ctx("ADMIN"), HEADERS)
    ).resolves.toBeUndefined();
  });
});

describe("currentUser e getOrgId", () => {
  it("devolve null sem sessão", async () => {
    mocks.getSession.mockResolvedValue(null);
    await expect(currentUser()).resolves.toBeNull();
  });

  it("devolve o usuário da sessão", async () => {
    mocks.getSession.mockResolvedValue(session("tenant-1"));
    await expect(currentUser()).resolves.toEqual(USER);
  });

  it("devolve o tenant ativo", async () => {
    mocks.getSession.mockResolvedValue(session("tenant-1"));
    mocks.tenantMemberFindFirst.mockResolvedValue({ role: "DEV" });
    await expect(getOrgId()).resolves.toBe("tenant-1");
  });

  // getOrgId engole o erro de propósito: é usado onde "sem tenant" é resposta
  // válida, não exceção.
  it("devolve null em vez de propagar quando o guard rejeita", async () => {
    mocks.getSession.mockResolvedValue(null);
    await expect(getOrgId()).resolves.toBeNull();
  });
});

describe("configuração do better-auth", () => {
  // O cookieCache já valeu SESSION_ABSOLUTE_SECONDS (7 dias). Enquanto o
  // cookie valesse, o servidor não relia a linha de Session — apagar a sessão
  // não encerrava nada, e o sistema ficava sem forma de expulsar ninguém.
  // 60s é o teto do atraso da revogação que o AC-002 pede.
  it("mantém a revalidação de sessão em 60s", () => {
    const sessionCfg = mocks.authConfig?.session as {
      cookieCache: { enabled: boolean; maxAge: number };
      expiresIn: number;
    };
    expect(sessionCfg.cookieCache.enabled).toBe(true);
    expect(sessionCfg.cookieCache.maxAge).toBe(60);
    expect(sessionCfg.expiresIn).toBe(24 * 60 * 60);
  });

  it("exige senha de 12 caracteres — SOC2 CC6", () => {
    const emailCfg = mocks.authConfig?.emailAndPassword as {
      minPasswordLength: number;
    };
    expect(emailCfg.minPasswordLength).toBe(12);
  });

  // Achado do Vigia (BAIXO, revisão de segurança da spec 004):
  // /request-password-reset só tinha a regra especial embutida do
  // better-auth (janela de 60s), a mesma altura de proteção pensada pra
  // login — sem uma regra própria, mais restritiva, pra quem enumera
  // e-mail atrás de conta existente via "esqueci a senha".
  it("tem regra de rate-limit própria e mais restritiva pra /request-password-reset", () => {
    const rateLimitCfg = mocks.authConfig?.rateLimit as {
      customRules?: Record<string, { window: number; max: number }>;
    };
    const regra = rateLimitCfg?.customRules?.["/request-password-reset"];
    expect(regra).toBeDefined();
    expect(regra?.max).toBeLessThanOrEqual(3);
    expect(regra?.window).toBeGreaterThanOrEqual(300);
  });

  // Curinga em trustedOrigins abriria o fluxo de auth para qualquer página
  // hospedada no domínio.
  it("não aceita curinga em trustedOrigins", () => {
    for (const origin of (mocks.authConfig?.trustedOrigins as string[]) ?? []) {
      expect(origin).not.toContain("*");
    }
  });

  it("não deixa o cliente escrever activeTenantId", () => {
    const sessionCfg = mocks.authConfig?.session as {
      additionalFields: { activeTenantId: { input: boolean } };
    };
    expect(sessionCfg.additionalFields.activeTenantId.input).toBe(false);
  });

  it("registra criação e encerramento de sessão", async () => {
    const hooks = mocks.authConfig?.databaseHooks as {
      session: {
        create: { after: (s: unknown) => Promise<void> };
        delete: { after: (s: unknown) => Promise<void> };
      };
    };

    await hooks.session.create.after({
      id: "sess-1",
      userId: "user-1",
      expiresAt: new Date(),
    });
    expect(mocks.logInfo).toHaveBeenCalledWith(
      "[auth] session.created",
      expect.objectContaining({ userId: "user-1", sessionId: "sess-1" })
    );

    await hooks.session.delete.after({ id: "sess-2" });
    expect(mocks.logInfo).toHaveBeenCalledWith(
      "[auth] session.deleted",
      expect.objectContaining({ userId: "unknown", sessionId: "sess-2" })
    );
  });

  // T029/T030 — troca do issuer de "Cosmos" pra "Nebuloz". O `issuer` só
  // rotula a URI otpauth:// mostrada no cadastro (better-auth
  // plugins/two-factor/totp: `options?.issuer` entra em `.url()`, não em
  // `createOTP(secret, ...).verify()`); segredo TOTP já cadastrado não é
  // tocado, então contas com 2FA de antes da troca continuam validando.
  it("usa Nebuloz como issuer do 2FA, sem tocar o segredo TOTP já cadastrado", () => {
    expect(mocks.twoFactorConfig?.issuer).toBe("Nebuloz");
  });
});
