// rate-limit-gate.test.ts — o que acontece quando o limitador não existe.
//
// A versão anterior devolvia `true` quando `UPSTASH_REDIS_REST_URL` não estava
// definida: sem Redis, sem limite, em silêncio. Em desenvolvimento isso é
// conveniência; em produção é um controle de segurança que desliga sozinho
// quando alguém mexe numa variável de ambiente, sem nada falhar e sem nada
// alertar. O primeiro a perceber seria a fatura.
//
// O modo de falha certo para um controle de segurança é fechado. Mas fechado
// **com o motivo certo**: 429 diria ao cliente "você excedeu o limite", que é
// mentira e manda a pessoa esperar em vez de olhar a configuração. Por isso
// existe um terceiro estado.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { avaliarLimite } from "../../../app/actions/safe-copilot/rate-limit-gate";

const semRedis = { UPSTASH_REDIS_REST_URL: undefined };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("avaliarLimite", () => {
  it("sem Redis em desenvolvimento, deixa passar", async () => {
    const r = await avaliarLimite("1.2.3.4", {
      env: semRedis,
      producao: false,
      limitar: async () => true,
    });

    expect(r).toBe("ok");
  });

  it("sem Redis em produção, NÃO deixa passar", async () => {
    // O caso que a mudança existe para cobrir.
    const r = await avaliarLimite("1.2.3.4", {
      env: semRedis,
      producao: true,
      limitar: async () => true,
    });

    expect(r).not.toBe("ok");
  });

  it("sem Redis em produção devolve `indisponivel`, não `excedido`", async () => {
    // A distinção inteira: "excedido" manda a pessoa esperar; "indisponível"
    // manda alguém olhar a configuração. Chamar um de outro esconde um erro de
    // deploy atrás de uma mensagem plausível.
    const r = await avaliarLimite("1.2.3.4", {
      env: semRedis,
      producao: true,
      limitar: async () => true,
    });

    expect(r).toBe("indisponivel");
  });

  it("com Redis, dentro do limite passa", async () => {
    const r = await avaliarLimite("1.2.3.4", {
      env: { UPSTASH_REDIS_REST_URL: "https://redis.exemplo" },
      producao: true,
      limitar: async () => true,
    });

    expect(r).toBe("ok");
  });

  it("com Redis, acima do limite é `excedido`", async () => {
    const r = await avaliarLimite("1.2.3.4", {
      env: { UPSTASH_REDIS_REST_URL: "https://redis.exemplo" },
      producao: true,
      limitar: async () => false,
    });

    expect(r).toBe("excedido");
  });

  it("Redis fora do ar em produção fecha, não abre", async () => {
    // Redis configurado mas inacessível é o mesmo risco: se o erro virasse
    // `true`, derrubar o Redis passaria a ser a maneira de remover o limite.
    const r = await avaliarLimite("1.2.3.4", {
      env: { UPSTASH_REDIS_REST_URL: "https://redis.exemplo" },
      producao: true,
      limitar: async () => {
        throw new Error("ECONNREFUSED");
      },
    });

    expect(r).toBe("indisponivel");
  });

  it("Redis fora do ar em desenvolvimento deixa passar", async () => {
    const r = await avaliarLimite("1.2.3.4", {
      env: { UPSTASH_REDIS_REST_URL: "https://redis.exemplo" },
      producao: false,
      limitar: async () => {
        throw new Error("ECONNREFUSED");
      },
    });

    expect(r).toBe("ok");
  });

  it("passa o identificador adiante", async () => {
    const limitar = vi.fn().mockResolvedValue(true);
    await avaliarLimite("9.9.9.9", {
      env: { UPSTASH_REDIS_REST_URL: "https://redis.exemplo" },
      producao: true,
      limitar,
    });

    expect(limitar).toHaveBeenCalledWith("9.9.9.9");
  });
});
