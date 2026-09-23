// registro-de-acesso.test.ts — a trilha de acesso ao painel (FR-30).
//
// Antes, quem gravava era `registrarAcesso`, uma server action sem sessão e
// sem teto: qualquer um fazia um POST e gravava "LOGIN de fulano" em
// AccessLog. Agora grava o servidor, olhando o desfecho da própria rota de
// auth — o que a lib respondeu, não o que o cliente diz que aconteceu.
//
// O que merece teste:
//
// 1. Tentativa recusada continua na trilha, com o e-mail tentado e nunca a
//    senha. Sem ela a trilha responde "quem usou" e não "quem tentou".
// 2. LOGIN só quando a lib cria a sessão — senha certa com 2FA pendente ainda
//    não entrou, e confirmar o 2FA já logado não é login.
// 3. Teto: por pessoa quando há sessão, por IP quando não há.
// 4. Nada disso derruba o login.
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  accessCreate: vi.fn(),
  assertDentroDoLimite: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
  authHandler: vi.fn(),
}));

vi.mock("@repo/database", () => ({
  database: { accessLog: { create: mocks.accessCreate } },
}));
vi.mock("@/lib/guard", () => ({ SYSTEM_TENANT_ID: "system" }));
vi.mock("@/lib/rate-limit", () => ({
  assertDentroDoLimite: mocks.assertDentroDoLimite,
  RateLimitError: class RateLimitError extends Error {},
}));
vi.mock("@repo/observability/log", () => ({
  log: { error: mocks.logError, warn: mocks.logWarn, info: vi.fn() },
}));
vi.mock("@repo/auth/server", () => ({ auth: { handler: mocks.authHandler } }));

import { POST } from "../app/api/auth/[...all]/route";
import { RateLimitError } from "../lib/rate-limit";
import { registrarDesfechoDoLogin } from "../lib/registro-de-acesso";

const RAIZ = "https://backoffice.nebuloz.ai/api/auth";
const ANA = { id: "u-ana", email: "Ana@Nebuloz.com", name: "Ana" };
/** O desafio que a lib emite quando a senha passou e falta o segundo fator. */
const DESAFIO_2FA = "__Secure-better-auth.two_factor=desafio.assinado";
const SESSAO_ABERTA = "__Secure-better-auth.session_token=tok.assinado";

function pedido(rota: string, corpo: unknown = {}, cookie?: string) {
  return new Request(`${RAIZ}${rota}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.7, 10.0.0.1",
      "user-agent": "Teste/1.0",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(corpo),
  });
}

function resposta(status: number, corpo: unknown) {
  return new Response(JSON.stringify(corpo), { status });
}

/** As linhas que chegaram ao banco. */
function linhas() {
  return mocks.accessCreate.mock.calls.map((chamada) => chamada[0].data);
}

beforeEach(() => {
  for (const m of Object.values(mocks)) {
    m.mockReset();
  }
  mocks.accessCreate.mockResolvedValue({ id: "al-1" });
  mocks.assertDentroDoLimite.mockResolvedValue(undefined);
});

describe("registrarDesfechoDoLogin", () => {
  it("senha errada vira RECUSADO com o e-mail tentado — nunca a senha", async () => {
    await registrarDesfechoDoLogin(
      pedido("/sign-in/email", {
        email: " Estranho@Fora.com ",
        password: "hunter2-hunter2",
      }),
      resposta(401, { code: "INVALID_EMAIL_OR_PASSWORD" })
    );

    expect(linhas()).toEqual([
      expect.objectContaining({
        tenantId: "system",
        userId: null,
        email: "estranho@fora.com",
        evento: "RECUSADO",
        motivo: "credencial inválida",
        ip: "203.0.113.7",
        userAgent: "Teste/1.0",
      }),
    ]);
    expect(JSON.stringify(linhas())).not.toContain("hunter2");
  });

  it("sem sessão, o teto é por IP — não há outra chave", async () => {
    await registrarDesfechoDoLogin(
      pedido("/sign-in/email", { email: "x@fora.com", password: "p" }),
      resposta(401, {})
    );

    expect(mocks.assertDentroDoLimite).toHaveBeenCalledWith(
      "acesso",
      "ip:203.0.113.7"
    );
  });

  it("login sem 2FA vira LOGIN com a identidade que a lib devolveu, com teto por pessoa", async () => {
    await registrarDesfechoDoLogin(
      pedido("/sign-in/email", { email: "ana@nebuloz.com", password: "p" }),
      resposta(200, { redirect: false, token: "t", user: ANA })
    );

    expect(linhas()).toEqual([
      expect.objectContaining({
        userId: "u-ana",
        email: "ana@nebuloz.com",
        evento: "LOGIN",
        motivo: null,
      }),
    ]);
    expect(mocks.assertDentroDoLimite).toHaveBeenCalledWith("acesso", "u-ana");
  });

  it("senha certa com 2FA pendente não grava — ainda não entrou", async () => {
    await registrarDesfechoDoLogin(
      pedido("/sign-in/email", { email: "ana@nebuloz.com", password: "p" }),
      resposta(200, { twoFactorRedirect: true, twoFactorMethods: ["totp"] })
    );

    expect(mocks.accessCreate).not.toHaveBeenCalled();
    // É o caminho normal de todo staff — não é motivo de aviso.
    expect(mocks.logWarn).not.toHaveBeenCalled();
  });

  // Sem usuário e sem 2FA pendente, a lib mudou de formato: a trilha pararia
  // de gravar LOGIN sem ninguém saber.
  it("login respondido num formato que a trilha não reconhece avisa no log", async () => {
    await registrarDesfechoDoLogin(
      pedido("/sign-in/email", { email: "ana@nebuloz.com", password: "p" }),
      resposta(200, { token: "t", conta: ANA })
    );

    expect(mocks.accessCreate).not.toHaveBeenCalled();
    expect(mocks.logWarn).toHaveBeenCalledTimes(1);
  });

  it("código do autenticador aceito, com o desafio do login, vira LOGIN", async () => {
    await registrarDesfechoDoLogin(
      pedido("/two-factor/verify-totp", { code: "123456" }, DESAFIO_2FA),
      resposta(200, { token: "t", user: ANA })
    );

    expect(linhas()).toEqual([
      expect.objectContaining({ userId: "u-ana", evento: "LOGIN" }),
    ]);
  });

  // O cadastro do 2FA (packages/auth/two-factor-enrollment.ts) confirma o
  // código com a sessão já aberta, e a lib responde igual a um login:
  // `{ token, user }`, com sessão rotacionada. Só o desafio no pedido separa
  // os dois.
  it("confirmar o 2FA já logado não é login", async () => {
    await registrarDesfechoDoLogin(
      pedido("/two-factor/verify-totp", { code: "123456" }, SESSAO_ABERTA),
      resposta(200, { token: "t", user: ANA })
    );

    expect(mocks.accessCreate).not.toHaveBeenCalled();
  });

  it("outras rotas de auth não gravam", async () => {
    await registrarDesfechoDoLogin(
      pedido("/sign-out"),
      resposta(200, { success: true })
    );

    expect(mocks.accessCreate).not.toHaveBeenCalled();
  });

  // O teto limita a tabela, não o login: a tentativa acontece de qualquer
  // jeito. Por isso o estouro não pode ser mudo — é justamente quando alguém
  // insiste.
  it("acima do teto não grava, mas avisa no log qual origem estourou", async () => {
    mocks.assertDentroDoLimite.mockRejectedValue(
      new RateLimitError("Muitas requisições.")
    );

    await expect(
      registrarDesfechoDoLogin(
        pedido("/sign-in/email", { email: "x@fora.com", password: "p" }),
        resposta(401, {})
      )
    ).resolves.toBeUndefined();
    expect(mocks.accessCreate).not.toHaveBeenCalled();
    expect(mocks.logError).not.toHaveBeenCalled();
    expect(mocks.logWarn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ chave: "ip:203.0.113.7" })
    );
  });

  it("falha ao gravar não derruba o login — vai para o log", async () => {
    mocks.accessCreate.mockRejectedValue(new Error("banco fora"));

    await expect(
      registrarDesfechoDoLogin(
        pedido("/sign-in/email", { email: "ana@nebuloz.com", password: "p" }),
        resposta(200, { token: "t", user: ANA })
      )
    ).resolves.toBeUndefined();
    expect(mocks.logError).toHaveBeenCalled();
  });
});

describe("POST /api/auth/*", () => {
  it("devolve a resposta da lib intacta e grava o desfecho", async () => {
    const daLib = resposta(401, { code: "INVALID_EMAIL_OR_PASSWORD" });
    mocks.authHandler.mockResolvedValue(daLib);

    const res = await POST(
      new NextRequest(`${RAIZ}/sign-in/email`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "x@fora.com", password: "p" }),
      })
    );

    expect(res).toBe(daLib);
    // A lib recebeu o pedido com o corpo intacto — ler o e-mail para a trilha
    // não pode consumir o corpo que o login precisa.
    expect(await mocks.authHandler.mock.calls[0][0].json()).toEqual({
      email: "x@fora.com",
      password: "p",
    });
    expect(linhas()).toEqual([expect.objectContaining({ evento: "RECUSADO" })]);
  });
});
