import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CONTEXTO,
  EXCLUSOES,
  MAPA_DE_FRONTEIRAS,
  PALAVRAS_CHAVE,
  PREFIXOS,
  PRODUTOS,
} from "../produtos.mts";

const RAIZ = fileURLToPath(new URL("../../../", import.meta.url));

describe("tabelas de produto", () => {
  it("todo produto tem ao menos um prefixo", () => {
    for (const p of PRODUTOS) {
      expect(PREFIXOS[p].length, p).toBeGreaterThan(0);
    }
  });

  it("back-office é produto próprio; plataforma fica com os pacotes compartilhados", () => {
    expect(PRODUTOS).toContain("backoffice");
    expect(PREFIXOS.backoffice).toContain("apps/backoffice");
    expect(PREFIXOS.plataforma).not.toContain("apps/backoffice");
  });

  it("todo caminho de contexto que a note cita existe no repositório", () => {
    expect(existsSync(`${RAIZ}${MAPA_DE_FRONTEIRAS}`), MAPA_DE_FRONTEIRAS).toBe(
      true
    );
    for (const p of PRODUTOS) {
      const ctx = CONTEXTO[p];
      expect(ctx.resumo.length, p).toBeGreaterThan(0);
      const caminhos = [
        ...ctx.docs,
        ...(ctx.impeccable
          ? [`${ctx.impeccable}/PRODUCT.md`, `${ctx.impeccable}/DESIGN.md`]
          : []),
      ];
      for (const c of caminhos) {
        expect(existsSync(`${RAIZ}${c}`), `${p}: ${c}`).toBe(true);
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
