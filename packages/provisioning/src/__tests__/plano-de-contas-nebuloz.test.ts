import { describe, expect, it } from "vitest";
import { PLANO_DE_CONTAS_NEBULOZ } from "../plano-de-contas-nebuloz";

describe("plano de contas", () => {
  it("27 contas, códigos únicos no formato N.N, grupos 1..6 com centro coerente", () => {
    expect(PLANO_DE_CONTAS_NEBULOZ).toHaveLength(27);
    expect(new Set(PLANO_DE_CONTAS_NEBULOZ.map((c) => c.conta)).size).toBe(27);
    for (const c of PLANO_DE_CONTAS_NEBULOZ) {
      expect(c.conta).toMatch(/^\d\.\d{1,2}$/);
      expect(Number(c.conta[0])).toBe(c.grupo);
      if (c.grupo <= 2) expect(c.centroDeCusto).toBeNull();
      if (c.grupo === 3) expect(c.centroDeCusto).toBe("entrega");
      if (c.grupo === 4) expect(c.centroDeCusto).toBe("comercial");
      if (c.grupo === 5) expect(c.centroDeCusto).toBe("produto-engenharia");
      if (c.grupo === 6) expect(c.centroDeCusto).toBe("ga");
    }
  });
});
