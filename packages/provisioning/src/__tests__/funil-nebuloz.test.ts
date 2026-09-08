import { describe, expect, it } from "vitest";
import { CANAIS_NEBULOZ, ESTAGIOS_NEBULOZ } from "../funil-nebuloz";

describe("estágios do funil", () => {
  it("4 estágios, na ordem, com pesos crescentes, tetos e critérios do design", () => {
    expect(ESTAGIOS_NEBULOZ).toHaveLength(4);
    expect(ESTAGIOS_NEBULOZ.map((e) => e.codigo)).toEqual([
      "LEAD",
      "DISCOVERY",
      "EVALUATION",
      "PROPOSAL",
    ]);
    expect(ESTAGIOS_NEBULOZ.map((e) => e.ordem)).toEqual([0, 1, 2, 3]);
    expect(ESTAGIOS_NEBULOZ.map((e) => e.tetoDias)).toEqual([7, 14, 21, 30]);

    let pesoAnterior = 0;
    for (const estagio of ESTAGIOS_NEBULOZ) {
      expect(estagio.pesoPercent).toBeGreaterThan(pesoAnterior);
      pesoAnterior = estagio.pesoPercent;
      expect(estagio.criterios.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("canais de lead", () => {
  it("5 canais com slug único e CAC médio nulo (não medido)", () => {
    expect(CANAIS_NEBULOZ).toHaveLength(5);
    expect(new Set(CANAIS_NEBULOZ.map((c) => c.slug)).size).toBe(5);
    for (const canal of CANAIS_NEBULOZ) {
      expect(canal.cacMedioCentavos).toBeNull();
    }
  });
});
