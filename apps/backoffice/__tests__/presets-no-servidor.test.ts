import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Um `Preset` carrega `intervalo` como função. Server component que importa
 * `PRESETS_COMPETENCIA`/`PRESETS_CAIXA` quase sempre faz isso para repassar o
 * array a um client component — e aí a serialização do RSC quebra em runtime
 * com "Functions cannot be passed directly to Client Components". Foi o que
 * derrubou /empresa/financeiro em produção no deploy 89390344: tipo válido,
 * tsc limpo, suíte verde, tela em branco.
 *
 * A regra é estrutural, então o teste é estrutural: quem importa os presets
 * declara "use client". Quem é server escolhe o intervalo por outro caminho.
 */
const RAIZ = join(__dirname, "..", "app");

function arquivosTsx(dir: string): string[] {
  const saida: string[] = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      saida.push(...arquivosTsx(caminho));
    } else if (nome.endsWith(".tsx") || nome.endsWith(".ts")) {
      saida.push(caminho);
    }
  }
  return saida;
}

describe("presets de período não atravessam a fronteira do servidor", () => {
  it("todo arquivo de app/ que importa PRESETS_* é client component", () => {
    const infratores = arquivosTsx(RAIZ)
      .map((caminho) => ({ caminho, fonte: readFileSync(caminho, "utf8") }))
      .filter(({ fonte }) => /\bPRESETS_(COMPETENCIA|CAIXA)\b/.test(fonte))
      .filter(({ fonte }) => !/^\s*["']use client["']/m.test(fonte))
      .map(({ caminho }) => caminho.slice(RAIZ.length + 1));

    expect(infratores).toEqual([]);
  });

  it("os presets realmente carregam função — é isso que torna a regra necessária", async () => {
    const { PRESETS_CAIXA, PRESETS_COMPETENCIA } = await import(
      "@/lib/empresa/periodo"
    );
    for (const p of [...PRESETS_COMPETENCIA, ...PRESETS_CAIXA]) {
      expect(typeof p.intervalo).toBe("function");
    }
  });
});
