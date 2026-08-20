// rate-limit-gate.test.ts — como o portão do copiloto falha.
//
// O contador vive no Postgres (@repo/rate-limit): não existe mais o estado
// "limitador não configurado" que a versão Upstash tinha — sem DATABASE_URL o
// app nem sobe. O que sobra, e o que se prova aqui, é o modo de falha em
// tempo de execução.
//
// O modo certo para um controle de custo é fechado. Mas fechado **com o motivo
// certo**: 429 diria ao cliente "você excedeu o limite", que é mentira e manda
// a pessoa esperar em vez de alguém olhar a infraestrutura. Por isso existe o
// terceiro estado.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { avaliarLimite } from "../../../app/actions/safe-copilot/rate-limit-gate";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("avaliarLimite", () => {
  it("dentro do limite passa", async () => {
    const r = await avaliarLimite("1.2.3.4", {
      producao: true,
      limitar: async () => true,
    });

    expect(r).toBe("ok");
  });

  it("acima do limite é `excedido`", async () => {
    const r = await avaliarLimite("1.2.3.4", {
      producao: true,
      limitar: async () => false,
    });

    expect(r).toBe("excedido");
  });

  it("contador fora do ar em produção fecha, não abre", async () => {
    // Se o erro virasse `true`, derrubar o banco do limite passaria a ser a
    // maneira de remover o teto de custo de IA.
    const r = await avaliarLimite("1.2.3.4", {
      producao: true,
      limitar: async () => {
        throw new Error("connection refused");
      },
    });

    expect(r).toBe("indisponivel");
  });

  it("contador fora do ar fora de produção deixa passar", async () => {
    // Em dev e CI, exigir o contador de pé transformaria qualquer suíte em
    // dependente de banco — e o risco que o portão cobre é fatura de
    // produção, não custo de laboratório.
    const r = await avaliarLimite("1.2.3.4", {
      producao: false,
      limitar: async () => {
        throw new Error("connection refused");
      },
    });

    expect(r).toBe("ok");
  });

  it("`indisponivel` nunca se disfarça de `excedido`", async () => {
    // A distinção inteira: "excedido" manda a pessoa esperar; "indisponível"
    // manda alguém olhar a infraestrutura. Chamar um de outro esconde um erro
    // de operação atrás de uma mensagem plausível.
    const r = await avaliarLimite("1.2.3.4", {
      producao: true,
      limitar: async () => {
        throw new Error("boom");
      },
    });

    expect(r).not.toBe("excedido");
  });
});
