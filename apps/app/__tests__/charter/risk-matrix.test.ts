import { describe, expect, it } from "vitest";
import { nivel, severidade } from "@/lib/charter/risk-matrix";

describe("severidade", () => {
  it("é impacto × probabilidade", () => {
    expect(severidade(4, 3)).toBe(12);
  });

  it("trata probabilidade ausente como 1 — score legado não vira zero", () => {
    // Linhas gravadas antes desta migration têm prob* = 1 por default. Se a
    // fórmula multiplicasse por 0, todo risco histórico viraria "sem risco".
    expect(severidade(4, 1)).toBe(4);
  });
});

describe("nivel", () => {
  it.each([
    [1, "BAIXO"],
    [6, "MEDIO"],
    [12, "ALTO"],
    [20, "CRITICO"],
  ])("severidade %i é %s", (sev, esperado) => {
    expect(nivel(sev)).toBe(esperado);
  });

  it("a fronteira pertence ao nível mais alto — 9 é ALTO, não MEDIO", () => {
    // Arredondar risco para baixo na fronteira é como comitê de risco perde
    // caso: o número fica logo abaixo do gatilho de aprovação.
    expect(nivel(9)).toBe("ALTO");
  });
});
