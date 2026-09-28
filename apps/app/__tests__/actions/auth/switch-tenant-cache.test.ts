// @vitest-environment node
// FR-009/SC-004 (spec 009): depois de um 200 de POST /api/auth/switch-tenant,
// uma leitura imediata via requireTenantSession já precisa enxergar a conta
// nova — sem esperar a janela de 60s de revalidação do cache de sessão
// (packages/auth/server.ts, cookieCache.maxAge).
//
// O mecanismo: a rota apaga o cookie `better-auth.session_data` na resposta
// (route.ts:53), forçando a próxima `getSession()` a reler a sessão do banco
// em vez de servir do cache assinado — sem isso, a conta nova só apareceria
// depois da janela de 60s. Este arquivo cobre essa metade do contrato: a
// rota sempre apaga o cookie num 200, e nunca num erro. A outra metade —
// requireTenantSession devolver o `activeTenantId` que a sessão já tem — já
// tem cobertura própria em packages/auth/__tests__/server.test.ts (import
// direto do módulo real, sem mockar `@repo/auth/server`).

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  tenantMemberFindFirst: vi.fn(),
  sessionUpdate: vi.fn(),
  // Mutável: cada teste ajusta baseURL pra simular http (dev) ou https
  // (produção) — é o que decide se better-auth prefixa o cookie com
  // "__Secure-" (dist/cookies/index.mjs: secureCookiePrefix).
  authOptions: { baseURL: "http://localhost:3000" } as Record<string, unknown>,
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/auth/server", () => ({
  auth: {
    api: { getSession: mocks.getSession },
    get options() {
      return mocks.authOptions;
    },
  },
}));
vi.mock("@repo/database", () => ({
  database: {
    tenantMember: { findFirst: mocks.tenantMemberFindFirst },
    session: { update: mocks.sessionUpdate },
  },
}));

import { POST } from "../../../app/api/auth/switch-tenant/route";

function request(body: unknown) {
  return new Request("http://localhost/api/auth/switch-tenant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authOptions.baseURL = "http://localhost:3000";
});

describe("POST /api/auth/switch-tenant — limpa o cache no 200 (FR-009)", () => {
  it("apaga o cookie better-auth.session_data quando a troca é aceita", async () => {
    mocks.getSession.mockResolvedValue({
      user: { id: "user-1" },
      session: { token: "tok-1" },
    });
    mocks.tenantMemberFindFirst.mockResolvedValue({ id: "member-1" });
    mocks.sessionUpdate.mockResolvedValue({});

    const response = await POST(request({ tenantId: "tenant-2" }));

    expect(response.status).toBe(200);
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("better-auth.session_data=");
    // Cookie apagado: valor vazio + Expires no passado (epoch) — sem isso,
    // o cache de 60s continuaria servindo a conta antiga.
    expect(setCookie).toMatch(
      /better-auth\.session_data=;.*Expires=Thu, 01 Jan 1970/i
    );
  });

  it("em produção (baseURL https), apaga __Secure-better-auth.session_data — não o nome sem prefixo (P1 spec 009)", async () => {
    mocks.authOptions.baseURL = "https://app.nebuloz.ai";
    mocks.getSession.mockResolvedValue({
      user: { id: "user-1" },
      session: { token: "tok-1" },
    });
    mocks.tenantMemberFindFirst.mockResolvedValue({ id: "member-1" });
    mocks.sessionUpdate.mockResolvedValue({});

    const response = await POST(request({ tenantId: "tenant-2" }));

    expect(response.status).toBe(200);
    const setCookie = response.headers.get("set-cookie") ?? "";
    // Better Auth nomeia o cookie com o prefixo __Secure- quando o baseURL é
    // https (dist/cookies/index.mjs: secureCookiePrefix). Apagar
    // "better-auth.session_data" nesse caso é no-op: o navegador ainda tem o
    // cookie __Secure-, e getSession() continua servindo o cache antigo por
    // até 60s (FR-009/SC-004).
    expect(setCookie).toContain("__Secure-better-auth.session_data=");
    expect(setCookie).toMatch(
      /__Secure-better-auth\.session_data=;.*Expires=Thu, 01 Jan 1970/i
    );
    // Sem o atributo Secure, o navegador descarta um Set-Cookie de nome
    // __Secure- (regra do próprio navegador) — o cookie antigo sobrevive e
    // o bug persiste mesmo com o nome certo. Precisa vir com os mesmos
    // atributos que o better-auth usa pra setar esse cookie (secure, path).
    expect(setCookie).toMatch(/;\s*Secure/i);
    expect(setCookie).toContain("Path=/");
  });

  it("não apaga o cookie quando a troca é recusada (FORBIDDEN)", async () => {
    mocks.getSession.mockResolvedValue({
      user: { id: "user-1" },
      session: { token: "tok-1" },
    });
    mocks.tenantMemberFindFirst.mockResolvedValue(null);

    const response = await POST(request({ tenantId: "tenant-2" }));

    expect(response.status).toBe(403);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(mocks.sessionUpdate).not.toHaveBeenCalled();
  });
});
