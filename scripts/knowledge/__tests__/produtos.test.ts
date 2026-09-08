import { describe, expect, it } from "vitest";
import { EXCLUSOES, PALAVRAS_CHAVE, PREFIXOS, PRODUTOS } from "../produtos.mts";

describe("tabelas de produto", () => {
  it("todo produto exceto signal tem ao menos um prefixo", () => {
    for (const p of PRODUTOS) {
      if (p === "signal") {
        expect(PREFIXOS[p]).toEqual([]);
      } else {
        expect(PREFIXOS[p].length).toBeGreaterThan(0);
      }
    }
  });

  it("nenhum prefixo aparece em dois produtos", () => {
    const vistos = new Map<string, string>();
    for (const [p, lista] of Object.entries(PREFIXOS)) {
      for (const prefixo of lista) {
        expect(
          vistos.get(prefixo),
          `prefixo ${prefixo} em ${vistos.get(prefixo)} e ${p}`
        ).toBeUndefined();
        vistos.set(prefixo, p);
      }
    }
  });

  it("toda exclusão pertence a um prefixo do mesmo produto", () => {
    for (const [p, lista] of Object.entries(EXCLUSOES)) {
      for (const ex of lista ?? []) {
        expect(
          PREFIXOS[p as keyof typeof PREFIXOS].some((pre) => ex.startsWith(pre))
        ).toBe(true);
      }
    }
  });

  it("palavras-chave são minúsculas e sem duplicata entre produtos", () => {
    const vistos = new Set<string>();
    for (const { termos } of PALAVRAS_CHAVE) {
      for (const t of termos) {
        expect(t).toBe(t.toLowerCase());
        expect(vistos.has(t), `termo repetido: ${t}`).toBe(false);
        vistos.add(t);
      }
    }
  });
});
