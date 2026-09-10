import { describe, expect, it } from "vitest";
import { planoPadrao } from "@/lib/comercial/plano-padrao";

/** O catálogo de produção em 2026-09: três planos, todos com piso. */
const PLATAFORMA = [
  { slug: "starter", minimoAssentos: 10 },
  { slug: "scale", minimoAssentos: 25 },
  { slug: "enterprise", minimoAssentos: 50 },
];

/** O plano de piso zero que passa a existir para cotar diagnóstico avulso. */
const DIAGNOSTICO = { slug: "diagnostico", minimoAssentos: 0 };

describe("planoPadrao", () => {
  it("abre no plano do meio, não no mais barato", () => {
    expect(planoPadrao(PLATAFORMA)).toBe("scale");
  });

  it("o plano de piso zero não muda o padrão, mesmo entrando na frente", () => {
    // É o caso que motivou a função: `diagnostico` tem `ordem = 0`, então vem
    // primeiro na lista. Com o índice cru, o padrão viraria `starter`.
    expect(planoPadrao([DIAGNOSTICO, ...PLATAFORMA])).toBe("scale");
  });

  it("plano de piso zero nunca é o padrão, nem sozinho no catálogo", () => {
    expect(planoPadrao([DIAGNOSTICO])).toBe("");
  });

  it("com um único plano de plataforma, é ele mesmo", () => {
    expect(
      planoPadrao([DIAGNOSTICO, { slug: "starter", minimoAssentos: 10 }])
    ).toBe("starter");
  });

  it("catálogo vazio devolve vazio, e a tela pede para escolher", () => {
    expect(planoPadrao([])).toBe("");
  });
});
