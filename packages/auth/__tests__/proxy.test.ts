// proxy.test.ts — falha ao verificar a sessão não pode deslogar ninguém.
//
// O middleware consulta `/api/auth/get-session` por fetch para decidir se
// redireciona antes de renderizar RSC. O endereço tem teto de requisição do
// better-auth, então a resposta pode ser 429 mesmo com sessão perfeitamente
// válida — e a versão anterior tratava qualquer não-ok como "sem sessão".
//
// O caso que este arquivo trava é o 429: quem está logado segue trabalhando.
// A garantia de acesso continua sendo do layout de cada route group
// (`requireTenantSession`), que roda logo depois; aqui só se decide se vale a
// pena poupar o RSC.

import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { authMiddleware } from "../proxy";

const fetchOriginal = global.fetch;

afterEach(() => {
  global.fetch = fetchOriginal;
  vi.restoreAllMocks();
});

/** Resposta do `/api/auth/get-session`. */
function respondeGetSession(status: number, corpo: unknown) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(corpo),
  }) as unknown as typeof fetch;
}

/** O middleware embrulhando um callback que marca que chegou ao fim. */
function middleware(aoPassar = vi.fn()) {
  return authMiddleware((req) => {
    aoPassar(req.nextUrl.pathname);
    return;
  });
}

const pedido = (caminho: string) =>
  new NextRequest(new URL(`http://localhost:3012${caminho}`), {
    headers: { cookie: "better-auth.session_token=qualquer" },
  });

describe("authMiddleware", () => {
  it("429 no get-session NÃO desloga — segue para o layout decidir", async () => {
    respondeGetSession(429, { message: "Too many requests" });
    const passou = vi.fn();

    const res = await middleware(passou)(pedido("/cosmos/teams"));

    expect(res.status).not.toBe(307);
    expect(res.headers.get("location")).toBeNull();
    expect(passou).toHaveBeenCalledWith("/cosmos/teams");
  });

  it("500 no get-session também não desloga", async () => {
    respondeGetSession(500, {});
    const passou = vi.fn();

    await middleware(passou)(pedido("/cosmos/teams"));

    expect(passou).toHaveBeenCalled();
  });

  it("fetch que lança não desloga", async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValue(
        new Error("conexão recusada")
      ) as unknown as typeof fetch;
    const passou = vi.fn();

    await middleware(passou)(pedido("/cosmos/teams"));

    expect(passou).toHaveBeenCalled();
  });

  it("200 sem user redireciona — aqui a pergunta FOI respondida", async () => {
    respondeGetSession(200, null);
    const passou = vi.fn();

    const res = await middleware(passou)(pedido("/cosmos/teams"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/sign-in");
    expect(passou).not.toHaveBeenCalled();
  });

  it("200 com user segue adiante", async () => {
    respondeGetSession(200, { user: { id: "u1" } });
    const passou = vi.fn();

    await middleware(passou)(pedido("/cosmos/teams"));

    expect(passou).toHaveBeenCalledWith("/cosmos/teams");
  });

  it("rota fora da lista protegida nem consulta a sessão", async () => {
    const spy = vi.fn();
    global.fetch = spy as unknown as typeof fetch;
    const passou = vi.fn();

    await middleware(passou)(pedido("/sign-in"));

    expect(spy).not.toHaveBeenCalled();
    expect(passou).toHaveBeenCalledWith("/sign-in");
  });
});
