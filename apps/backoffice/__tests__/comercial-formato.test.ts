// comercial-formato.test.ts — fix-wave B2: `paraCentavos` tinha que preservar
// o sinal de um texto negativo. Sem isso, `centavosParaTexto(-123456)` mostra
// "-1.234,56" e salvar sem mexer grava "+123456" — o DRE anda o dobro do
// valor sem aviso nenhum.
import { describe, expect, it } from "vitest";
import {
  centavosParaCampo,
  formatarBRL,
  paraCentavos,
} from "../lib/comercial/formato";

describe("paraCentavos", () => {
  it("lê positivo com separador de milhar e vírgula decimal", () => {
    expect(paraCentavos("1.234,56")).toBe(123_456);
    expect(paraCentavos("1250")).toBe(1250);
  });

  it("texto vazio ou sem dígito devolve 0", () => {
    expect(paraCentavos("")).toBe(0);
    expect(paraCentavos("R$")).toBe(0);
  });

  it("preserva o sinal quando o texto começa com '-'", () => {
    expect(paraCentavos("-1.234,56")).toBe(-123_456);
    expect(paraCentavos("-1250")).toBe(-1250);
  });

  it("um '-' que não é o primeiro caractere não conta como sinal", () => {
    expect(paraCentavos("1-234,56")).toBe(123_456);
  });

  it("round-trip com formatarBRL preserva o valor negativo", () => {
    const centavos = -123_456;
    const texto = (centavos / 100).toLocaleString("pt-BR", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    });
    expect(texto.startsWith("-")).toBe(true);
    expect(paraCentavos(texto)).toBe(centavos);
  });

  it("round-trip com centavosParaCampo (o campo editável de verdade) preserva o valor", () => {
    for (const centavos of [0, 50, 199_999, -123_456, 100_000_000]) {
      expect(paraCentavos(centavosParaCampo(centavos))).toBe(centavos);
    }
  });
});

describe("formatarBRL", () => {
  it("formata centavos como moeda pt-BR", () => {
    expect(formatarBRL(123_456)).toContain("1.234,56");
  });
});
