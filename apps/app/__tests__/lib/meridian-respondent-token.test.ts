import { describe, expect, it } from "vitest";
import {
  hashToken,
  issueToken,
  isTokenUsable,
} from "@/lib/meridian/respondent-token";

// O token é a única porta do módulo que não passa por sessão. Guardar o segredo
// em claro transformaria um dump de banco em acesso à bateria inteira, e
// distinguir "expirado" de "inexistente" na resposta diria a um estranho que o
// assessment existe.

describe("issueToken", () => {
  it("gera token opaco de 64 hex (32 bytes)", () => {
    expect(issueToken()).toMatch(/^[0-9a-f]{64}$/);
  });

  it("não repete", () => {
    const seen = new Set(Array.from({ length: 200 }, () => issueToken()));
    expect(seen.size).toBe(200);
  });
});

describe("hashToken", () => {
  it("é estável para a mesma entrada", () => {
    const t = issueToken();
    expect(hashToken(t)).toBe(hashToken(t));
  });

  it("não devolve o token em claro", () => {
    const t = issueToken();
    expect(hashToken(t)).not.toBe(t);
    expect(hashToken(t)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("difere para tokens diferentes", () => {
    expect(hashToken(issueToken())).not.toBe(hashToken(issueToken()));
  });
});

describe("isTokenUsable", () => {
  const future = new Date("2026-12-31T00:00:00Z");
  const past = new Date("2020-01-01T00:00:00Z");
  const now = new Date("2026-08-28T00:00:00Z");

  it("aceita respondente ativo dentro do prazo", () => {
    expect(
      isTokenUsable({ status: "PENDING", tokenExpiresAt: future }, now)
    ).toBe(true);
  });

  it("aceita respondente que já concluiu — para ele rever o que enviou", () => {
    expect(isTokenUsable({ status: "DONE", tokenExpiresAt: future }, now)).toBe(
      true
    );
  });

  it("recusa token expirado", () => {
    expect(
      isTokenUsable({ status: "PENDING", tokenExpiresAt: past }, now)
    ).toBe(false);
  });

  it("recusa respondente revogado, mesmo dentro do prazo", () => {
    expect(
      isTokenUsable({ status: "REVOKED", tokenExpiresAt: future }, now)
    ).toBe(false);
  });
});
