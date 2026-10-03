import { describe, expect, it } from "vitest";
import {
  isTokenShape,
  RESPONDENT_PATH,
  respondentLink,
  tokenFromHash,
} from "@/lib/meridian/respondent-link";

// Achado 28a do Lacre, 2ª parte: o cookie + redirect ainda deixava o token na
// PRIMEIRA requisição, que a Vercel loga. O link novo leva o token no fragmento
// (#t=<token>): o navegador nunca envia o fragmento ao servidor, então nenhuma
// requisição, de nenhuma etapa, carrega o token no endereço.

const TOKEN = "ab".repeat(32);
const ORIGIN = "https://app.nebuloz.ai";

describe("respondentLink", () => {
  it("emite o formato novo: o token só depois do #", () => {
    expect(respondentLink(ORIGIN, TOKEN)).toBe(
      `${ORIGIN}/meridian-responder#t=${TOKEN}`
    );
  });

  it("o que o navegador envia ao servidor (caminho e query) não contém o token", () => {
    const url = new URL(respondentLink(ORIGIN, TOKEN));
    expect(url.pathname + url.search).toBe(RESPONDENT_PATH);
    expect(url.pathname + url.search).not.toContain(TOKEN);
    expect(url.hash).toBe(`#t=${TOKEN}`);
  });
});

describe("tokenFromHash", () => {
  it("lê o token do formato novo", () => {
    expect(tokenFromHash(`#t=${TOKEN}`)).toBe(TOKEN);
  });

  it.each([
    "",
    "#",
    "#t=",
    "#t=curto",
    `#x=${"a".repeat(32)}`,
    `#t=${TOKEN}&outro=1`,
    `#t=${TOKEN}/../x`,
    `t=${TOKEN}`,
    `#t=${"a".repeat(200)}`,
  ])("recusa %j", (hash) => {
    expect(tokenFromHash(hash)).toBeNull();
  });
});

describe("isTokenShape", () => {
  it("aceita hex de 64 e a fixture de E2E, recusa o resto", () => {
    expect(isTokenShape(TOKEN)).toBe(true);
    expect(isTokenShape("meridian-dogfood-e2e-fixed-token-nao-usar")).toBe(
      true
    );
    expect(isTokenShape("curto")).toBe(false);
    expect(isTokenShape(`com espaço ${"a".repeat(20)}`)).toBe(false);
    expect(isTokenShape("a".repeat(129))).toBe(false);
  });
});
