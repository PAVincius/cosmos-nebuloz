// rate-limit.test.ts — teto de requisição do back-office.
//
// O que merece teste aqui não é o Upstash, é a decisão em volta dele:
//
// 1. **A chave é a pessoa, não o IP.** O back-office é só autenticado, e a
//    equipe inteira atrás de um NAT dividiria uma cota — o primeiro a trabalhar
//    derrubaria os outros, e o sintoma pareceria bug de sessão.
// 2. **Sem Redis, passa — mas isso é registrado.** Degradar aberto é escolha
//    deliberada para dev e CI não quebrarem; o perigo é a ausência do controle
//    ficar parecida com o controle funcionando.
// 3. **O erro diz quando voltar.** "Limite excedido" sem prazo faz a pessoa
//    tentar de novo em laço, que é exatamente o que o limite quer parar.
// 4. **Provisionar tem cota própria.** É a operação que cria tenant e roda
//    bootstrap; o teto geral de navegação é largo demais para ela.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  limit: vi.fn(),
  createRateLimiter: vi.fn(),
  slidingWindow: vi.fn((n: number, janela: string) => ({ n, janela })),
  warn: vi.fn(),
}));

vi.mock("@repo/rate-limit", () => ({
  createRateLimiter: mocks.createRateLimiter,
  slidingWindow: mocks.slidingWindow,
}));
vi.mock("@repo/observability/log", () => ({
  log: { warn: mocks.warn, error: vi.fn(), info: vi.fn() },
}));

import {
  assertDentroDoLimite,
  LIMITE_PROVISIONAMENTO_POR_HORA,
  LIMITE_STAFF_POR_MINUTO,
  RateLimitError,
} from "../lib/rate-limit";

const DAQUI_A_UM_MINUTO = Date.now() + 60_000;

function resetar() {
  for (const m of Object.values(mocks)) {
    m.mockReset();
  }
  mocks.slidingWindow.mockImplementation((n: number, janela: string) => ({
    n,
    janela,
  }));
  mocks.createRateLimiter.mockReturnValue({ limit: mocks.limit });
  mocks.limit.mockResolvedValue({
    success: true,
    limit: LIMITE_STAFF_POR_MINUTO,
    remaining: 90,
    reset: DAQUI_A_UM_MINUTO,
  });
  process.env.UPSTASH_REDIS_REST_URL = "https://redis.exemplo";
}

describe("assertDentroDoLimite", () => {
  beforeEach(resetar);

  it("dentro do teto, não lança", async () => {
    await expect(
      assertDentroDoLimite("staff", "user-1")
    ).resolves.toBeUndefined();
  });

  it("a chave é a identidade recebida, não o IP", async () => {
    await assertDentroDoLimite("staff", "user-1");

    // Equipe atrás de um NAT dividiria cota se a chave fosse o IP, e o
    // primeiro a trabalhar derrubaria os outros.
    expect(mocks.limit).toHaveBeenCalledWith("user-1");
  });

  it("estourado, lança RateLimitError", async () => {
    mocks.limit.mockResolvedValue({
      success: false,
      limit: LIMITE_STAFF_POR_MINUTO,
      remaining: 0,
      reset: DAQUI_A_UM_MINUTO,
    });

    await expect(
      assertDentroDoLimite("staff", "user-1")
    ).rejects.toBeInstanceOf(RateLimitError);
  });

  it("a mensagem diz em quantos segundos tentar de novo", async () => {
    mocks.limit.mockResolvedValue({
      success: false,
      limit: LIMITE_STAFF_POR_MINUTO,
      remaining: 0,
      reset: Date.now() + 30_000,
    });

    // Sem prazo, a pessoa tenta de novo em laço — que é o que o limite quer
    // parar.
    await expect(assertDentroDoLimite("staff", "user-1")).rejects.toThrow(
      /\d+s/
    );
  });

  it("escopos diferentes não dividem cota", async () => {
    await assertDentroDoLimite("staff", "user-1");
    await assertDentroDoLimite("provisionamento", "user-1");

    const prefixos = mocks.createRateLimiter.mock.calls.map(
      (c) => c[0].prefix as string
    );
    expect(new Set(prefixos).size).toBe(2);
  });

  it("provisionar é mais apertado que navegar", async () => {
    // O teto de navegação é largo de propósito; usá-lo para a operação que
    // cria tenant e roda bootstrap seria não ter teto nenhum na prática.
    expect(LIMITE_PROVISIONAMENTO_POR_HORA).toBeLessThan(
      LIMITE_STAFF_POR_MINUTO
    );
  });

  describe("sem Redis configurado", () => {
    beforeEach(() => {
      resetar();
      process.env.UPSTASH_REDIS_REST_URL = "";
    });

    it("passa — dev e CI não podem quebrar por falta de infra", async () => {
      await expect(
        assertDentroDoLimite("staff", "user-1")
      ).resolves.toBeUndefined();
      expect(mocks.createRateLimiter).not.toHaveBeenCalled();
    });

    it("mas registra, para a ausência do controle não parecer o controle", async () => {
      await assertDentroDoLimite("staff", "user-1");

      expect(mocks.warn).toHaveBeenCalled();
    });
  });

  it("Redis fora do ar não derruba o back-office", async () => {
    mocks.limit.mockRejectedValue(new Error("ECONNREFUSED"));

    // Fechar aqui transformaria uma indisponibilidade do Upstash em queda
    // total do painel. A escolha é explícita e fica no log.
    await expect(
      assertDentroDoLimite("staff", "user-1")
    ).resolves.toBeUndefined();
    expect(mocks.warn).toHaveBeenCalled();
  });
});
