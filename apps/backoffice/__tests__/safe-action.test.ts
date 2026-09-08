// safe-action.test.ts — o que o operador vê quando a action falha.
//
// O caso que motivou o arquivo: a tela de módulos oferecia SCAFFOLD porque o
// client do Prisma é gerado do schema, o banco ainda não tinha o valor no enum,
// e o erro `22P02` do Postgres virava "Não foi possível concluir a operação."
// A causa estava no log do servidor e a pessoa na tela não tinha como chegar
// nela. O que se prova aqui é que o código sobrevive — e que a mensagem, que
// carrega dado de cliente, não.
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

const erroDeLog = vi.fn();

vi.mock("@repo/observability/log", () => ({ log: { error: erroDeLog } }));

// Os três erros nomeados entram como stub: o que o `safeAction` promete é
// "instância desta classe segue por este ramo", e é isso que o stub exercita.
// Importar os módulos reais traria auth, Prisma e env atrás deles sem provar
// nada a mais.
class ProvisioningErrorStub extends Error {
  code = "TENANT_NOT_FOUND";
}
class StaffAuthErrorStub extends Error {
  code = "FORBIDDEN";
}
class RateLimitErrorStub extends Error {
  code = "RATE_LIMITED";
}

vi.mock("@repo/provisioning", () => ({
  ProvisioningError: ProvisioningErrorStub,
}));
vi.mock("../lib/guard", () => ({ StaffAuthError: StaffAuthErrorStub }));
vi.mock("../lib/rate-limit", () => ({ RateLimitError: RateLimitErrorStub }));

const { safeAction } = await import("../lib/safe-action");

/** Erro com a forma que o Prisma e o driver do Postgres produzem. */
function erroDoBanco(
  message: string,
  extra: { code?: unknown; meta?: unknown }
): Error {
  return Object.assign(new Error(message), extra);
}

const falhaCom = (e: unknown) =>
  safeAction(() => {
    throw e;
  });

describe("safeAction — sucesso e erros nomeados", () => {
  it("devolve o dado quando não lança", async () => {
    expect(await safeAction(async () => 42)).toEqual({ ok: true, data: 42 });
  });

  it.each([
    [
      "ProvisioningError",
      new ProvisioningErrorStub("Nenhum cliente com o slug x."),
      "TENANT_NOT_FOUND",
    ],
    [
      "StaffAuthError",
      new StaffAuthErrorStub("Seu papel não permite."),
      "FORBIDDEN",
    ],
    [
      "RateLimitError",
      new RateLimitErrorStub("Tente de novo em 30s."),
      "RATE_LIMITED",
    ],
  ])("%s mantém mensagem e código", async (_nome, erro, code) => {
    const r = await falhaCom(erro);
    expect(r).toEqual({ ok: false, error: (erro as Error).message, code });
  });

  it("erro nomeado vence, mesmo carregando código de banco", async () => {
    // Sem isto, um `ProvisioningError` que embrulhasse falha do driver perderia
    // a mensagem escrita para o operador e viraria um SQLSTATE cru.
    const erro = Object.assign(
      new ProvisioningErrorStub("Nenhum cliente com o slug atlas."),
      { meta: { code: "22P02" } }
    );
    const r = await falhaCom(erro);
    expect(r).toMatchObject({
      error: "Nenhum cliente com o slug atlas.",
      code: "TENANT_NOT_FOUND",
    });
  });
});

describe("safeAction — ZodError chega na tela", () => {
  it("mensagem de .refine não vira a genérica", async () => {
    // Sem o ramo `ZodError`, isto caía em GENERICA — a mensagem escrita para
    // o operador ("Conta no formato N.N…") nunca chegava à tela.
    const schema = z
      .object({ conta: z.string() })
      .refine(() => false, "Conta no formato N.N (grupo 1 a 6).");
    const r = await safeAction(() => {
      schema.parse({ conta: "47" });
      return Promise.resolve(undefined);
    });
    expect(r).toMatchObject({
      ok: false,
      error: "Conta no formato N.N (grupo 1 a 6).",
      code: "VALIDACAO",
    });
  });
});

describe("safeAction — código do banco", () => {
  it("explica o 22P02 apontando para migration pendente", async () => {
    // O caso real: enum sem o valor que o código já conhece.
    const r = await falhaCom(
      erroDoBanco("invalid input value for enum", { code: "22P02" })
    );
    expect(r.ok).toBe(false);
    if (r.ok) {
      return;
    }
    expect(r.code).toBe("22P02");
    expect(r.error).toContain("22P02");
    expect(r.error).toContain("migration pendente");
  });

  it("acha o código dentro de meta, onde o Prisma põe o do driver", async () => {
    const r = await falhaCom(
      erroDoBanco("Raw query failed", {
        code: "P2010",
        meta: { code: "42P01" },
      })
    );
    // A raiz vence quando existe: `P2010` é o que o Prisma afirma.
    expect(r).toMatchObject({ code: "P2010" });

    const soEmMeta = await falhaCom(
      erroDoBanco("Raw query failed", { meta: { code: "42P01" } })
    );
    expect(soEmMeta).toMatchObject({ code: "42P01" });
    if (!soEmMeta.ok) {
      expect(soEmMeta.error).toContain("atrás das migrations");
    }
  });

  it("código sem explicação ainda chega na tela", async () => {
    // Serialization failure: raro, e ninguém vai escrever texto para cada um
    // dos ~200 SQLSTATE. O que não pode é sumir.
    const r = await falhaCom(
      erroDoBanco("could not serialize", { code: "40001" })
    );
    if (r.ok) {
      throw new Error("esperava falha");
    }
    expect(r.code).toBe("40001");
    expect(r.error).toContain("40001");
  });

  it.each([
    ["ECONNREFUSED", "código de rede do Node, não do banco"],
    ["P999", "curto demais para ser código do Prisma"],
    ["22p02", "minúsculo — SQLSTATE é maiúsculo"],
  ])("ignora %s (%s)", async (code) => {
    const r = await falhaCom(erroDoBanco("falhou", { code }));
    expect(r).toEqual({
      ok: false,
      error: "Não foi possível concluir a operação.",
      code: undefined,
    });
  });

  it("erro sem código nenhum segue com a mensagem genérica", async () => {
    const r = await falhaCom(new Error("boom"));
    expect(r).toEqual({
      ok: false,
      error: "Não foi possível concluir a operação.",
      code: undefined,
    });
  });

  it("valor lançado que não é objeto não quebra", async () => {
    // `throw "texto"` existe em código de terceiro; `codigoDoErro` recebe
    // `unknown` de verdade.
    expect(await falhaCom("texto solto")).toMatchObject({ ok: false });
    expect(await falhaCom(null)).toMatchObject({ ok: false });
  });
});

describe("safeAction — não vaza a mensagem do banco", () => {
  it("descarta a mensagem, que carrega query e parâmetro", async () => {
    // A mensagem do Prisma traz trecho da query e valor de parâmetro — dado de
    // um tenant. Este painel atende a plataforma toda: quem está olhando um
    // cliente não pode ler conteúdo de outro por causa de um erro.
    const vazamento =
      'INSERT INTO "TenantModule" ... email=diretoria@cliente-secreto.com.br';
    const r = await falhaCom(erroDoBanco(vazamento, { code: "22P02" }));
    if (r.ok) {
      throw new Error("esperava falha");
    }
    expect(r.error).not.toContain("cliente-secreto");
    expect(r.error).not.toContain("TenantModule");
    expect(r.error).not.toContain(vazamento);
  });

  it("a mensagem inteira vai para o log do servidor", async () => {
    // O contrário do de cima: o operador não vê, quem lê o log vê tudo.
    erroDeLog.mockClear();
    await falhaCom(erroDoBanco("detalhe cru do driver", { code: "42703" }));
    expect(erroDeLog).toHaveBeenCalledWith(
      "[backoffice]",
      expect.objectContaining({
        error: expect.stringContaining("detalhe cru do driver"),
        codigo: "42703",
      })
    );
  });
});
