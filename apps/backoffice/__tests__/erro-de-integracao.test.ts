// erro-de-integracao.test.ts — a causa de uma integração quebrada, dita sem
// vazar credencial.
//
// Observabilidade prometia "nome, fonte e erro de cada integração" e não
// selecionava a mensagem. A mensagem vem de `SyncLog.errors`, que é o texto
// do provedor — e provedor devolve token no erro ("Bad credentials for
// ghp_…", "Authorization: Bearer …", URL com usuário e senha). O que chega à
// tela passa por aqui.
import { describe, expect, it } from "vitest";
import {
  causaDoErro,
  MAXIMO_DA_MENSAGEM,
  mensagemDeErro,
  semSegredo,
} from "@/lib/erro-de-integracao";

describe("causaDoErro — as três formas de SyncLog.errors", () => {
  it("objeto com message, string e array", () => {
    expect(causaDoErro({ message: "Token expirado" })).toBe("Token expirado");
    expect(causaDoErro("timeout")).toBe("timeout");
    expect(causaDoErro([{ message: "primeiro" }, "segundo"])).toBe("primeiro");
    expect(causaDoErro(["só texto"])).toBe("só texto");
  });

  it("sem nada legível, nulo — nunca uma causa inventada", () => {
    expect(causaDoErro(null)).toBeNull();
    expect(causaDoErro({ codigo: 42 })).toBeNull();
    expect(causaDoErro([])).toBeNull();
  });
});

describe("semSegredo", () => {
  it.each([
    ["Bad credentials for ghp_abcdefghijklmnopqrstuvwxyz0123456789", "ghp_"],
    ["github_pat_11ABCDEFG0123456789_abcdefghijklmnop rejected", "github_pat_"],
    ["glpat-abcdefghijklmnopqrst invalid", "glpat-"],
    ["Linear: lin_api_abcdefghijklmnopqrstuvwxyz invalid", "lin_api_"],
    ["Slack xoxb-1234567890-abcdefghij failed", "xoxb-"],
    ["OpenAI sk-proj-abcdefghijklmnopqrstu quota", "sk-proj"],
    ["AWS AKIAIOSFODNN7EXAMPLE denied", "AKIAIOSFODNN7EXAMPLE"],
  ])("tira token conhecido: %s", (texto, segredo) => {
    const limpo = semSegredo(texto);
    expect(limpo).not.toContain(segredo);
    expect(limpo).toContain("[oculto]");
  });

  it("tira Bearer, JWT, par chave=valor sensível e usuário:senha em URL", () => {
    const texto =
      "401 Authorization: Bearer abc.def-123 · jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJh · https://ana:s3nh4@jira.acme.com/rest?api_key=XYZ123&page=2 · password: hunter2";

    const limpo = semSegredo(texto);

    expect(limpo).not.toContain("abc.def-123");
    expect(limpo).not.toContain("eyJhbGciOiJIUzI1NiJ9");
    expect(limpo).not.toContain("s3nh4");
    expect(limpo).not.toContain("XYZ123");
    expect(limpo).not.toContain("hunter2");
    // O que ajuda a consertar fica.
    expect(limpo).toContain("401");
    expect(limpo).toContain("jira.acme.com");
    expect(limpo).toContain("page=2");
  });

  it("sequência opaca longa (chave sem prefixo conhecido) também sai", () => {
    const limpo = semSegredo(
      "chave Zx9Qm2Lp8Rt4Vw6Yb1Nc3Kd5Hf7Gj0Ss2Aa4Ee6 recusada"
    );
    expect(limpo).toBe("chave [oculto] recusada");
  });

  it("frase comum passa inteira", () => {
    const texto = "Time TEAM-12 não existe no Linear. Reautorize o OAuth.";
    expect(semSegredo(texto)).toBe(texto);
  });
});

describe("mensagemDeErro", () => {
  it("sem segredo e com teto de tamanho", () => {
    const longa = `token=abc123 ${"x ".repeat(600)}`;

    const msg = mensagemDeErro({ message: longa });

    expect(msg).not.toContain("abc123");
    expect(msg?.length).toBeLessThanOrEqual(MAXIMO_DA_MENSAGEM);
    expect(msg?.endsWith("…")).toBe(true);
  });

  it("sem causa legível, nulo", () => {
    expect(mensagemDeErro(undefined)).toBeNull();
  });
});
