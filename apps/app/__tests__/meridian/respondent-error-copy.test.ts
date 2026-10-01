import { describe, expect, it } from "vitest";
import { respondentErrorCopy } from "@/lib/meridian/respondent-error-copy";
import {
  COLLECTION_CLOSED_MESSAGE,
  TOKEN_INVALID_MESSAGE,
  TOKEN_RATE_LIMITED_MESSAGE,
} from "@/lib/meridian/respondent-token";

// page.tsx ignorava `res.error` no primeiro carregamento e sempre mostrava
// "Link inválido ou expirado" — um respondente barrado pelo rate limit nunca
// via a mensagem própria (achado do Crivo). Duas mensagens conhecidas, nunca
// texto interno: token inválido/expirado/revogado e limite de tentativas.

describe("respondentErrorCopy", () => {
  it("TOKEN_INVALID_MESSAGE mostra o título de link inválido", () => {
    const copy = respondentErrorCopy(TOKEN_INVALID_MESSAGE);
    expect(copy.title).toBe("Link inválido ou expirado");
  });

  it("TOKEN_RATE_LIMITED_MESSAGE mostra título e corpo próprios, não os de link inválido", () => {
    const copy = respondentErrorCopy(TOKEN_RATE_LIMITED_MESSAGE);
    expect(copy.title).not.toBe("Link inválido ou expirado");
    expect(copy.title.toLowerCase()).toContain("tentativa");
    expect(copy.body.toLowerCase()).toContain("minuto");
  });

  it("mensagem desconhecida cai no genérico de link inválido — nunca mostra detalhe interno", () => {
    const copy = respondentErrorCopy(
      "PrismaClientKnownRequestError: connection terminated unexpectedly at pool.js:412"
    );
    expect(copy.title).toBe("Link inválido ou expirado");
  });

  it("COLLECTION_CLOSED_MESSAGE tem copy própria: coleta encerrada, a quem pedir", () => {
    const copy = respondentErrorCopy(COLLECTION_CLOSED_MESSAGE);
    expect(copy.title).toBe("Coleta encerrada");
    expect(copy.title).not.toBe("Link inválido ou expirado");
    expect(copy.body.toLowerCase()).toContain("não aceita mais respostas");
  });
});
