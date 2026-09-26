import { describe, expect, it } from "vitest";
import { LIGACOES_NEBULOZ, PROCESSOS_NEBULOZ } from "../processos-nebuloz";

describe("processos da Nebuloz", () => {
  it("tem os 21 processos e 23 ligações do design, mais PZ-22 e PZ-23 e uma ligação", () => {
    expect(PROCESSOS_NEBULOZ).toHaveLength(23);
    expect(LIGACOES_NEBULOZ).toHaveLength(24);
  });

  it("códigos são únicos e no formato PZ-nn", () => {
    const codigos = PROCESSOS_NEBULOZ.map((p) => p.codigo);
    expect(new Set(codigos).size).toBe(codigos.length);
    for (const c of codigos) {
      expect(c).toMatch(/^PZ-\d{2}$/);
    }
  });

  it("toda ligação aponta para processos que existem e nunca para si mesma", () => {
    const codigos = new Set(PROCESSOS_NEBULOZ.map((p) => p.codigo));
    for (const l of LIGACOES_NEBULOZ) {
      expect(codigos.has(l.de)).toBe(true);
      expect(codigos.has(l.para)).toBe(true);
      expect(l.de).not.toBe(l.para);
    }
  });

  it("nível é 1, 2 ou 3 e domínio é um dos seis", () => {
    const dominios = new Set([
      "COMERCIAL",
      "DELIVERY",
      "GOVERNANCA",
      "PLATAFORMA",
      "LAB",
      "MEDICAO",
    ]);
    for (const p of PROCESSOS_NEBULOZ) {
      expect([1, 2, 3]).toContain(p.nivel);
      expect(dominios.has(p.dominio)).toBe(true);
      expect(["CORE", "APOIO"]).toContain(p.tipo);
    }
  });
});
