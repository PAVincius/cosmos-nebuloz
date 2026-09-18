// Tipografia do Charter na escala do cosmos.
//
// `cosmos.css` define seis degraus (`--fs-micro` … `--fs-display`) e diz que
// um tamanho fora deles é um degrau novo. Este teste é a catraca: nenhum
// `fontSize:` numérico sobra em `components/charter`, e `FS` só expõe os seis
// degraus que o cosmos declara. Lê os fontes com fs — sem jsdom, sem render.

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const CHARTER = join(__dirname, "../../components/charter");
const COSMOS_CSS = join(
  __dirname,
  "../../../../packages/design-system/cosmos/cosmos.css"
);
const DEGRAUS = ["micro", "nota", "base", "forte", "titulo", "display"];

function fontesDoCharter(): string[] {
  return readdirSync(CHARTER, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && /\.(tsx?|css)$/.test(e.name))
    .map((e) => join(e.parentPath, e.name))
    .sort();
}

function linhaDe(src: string, index: number): number {
  return src.slice(0, index).split("\n").length;
}

/** Cada literal numérico dentro de um `fontSize:` (ou `font-size:` em CSS). */
function literaisDeFontSize(file: string): string[] {
  const src = readFileSync(file, "utf8");
  const rel = relative(CHARTER, file);
  const re = file.endsWith(".css")
    ? /font-size:\s*([^;\n]*)/g
    : /fontSize:\s*([^,\n}]*)/g;
  const found: string[] = [];
  for (const m of src.matchAll(re)) {
    for (const n of m[1].match(/\b\d+(?:\.\d+)?/g) ?? []) {
      found.push(`${rel}:${linhaDe(src, m.index)}: ${n}`);
    }
  }
  return found;
}

describe("charter/type-scale", () => {
  it("nenhum fontSize literal sobra em components/charter", () => {
    const literais = fontesDoCharter().flatMap(literaisDeFontSize);
    expect(
      literais,
      `${literais.length} literal(is) fora da escala --fs-*:\n${literais.join("\n")}`
    ).toEqual([]);
  });

  it("FS expõe exatamente os seis degraus do cosmos", async () => {
    const { FS } = await import("../../components/charter/type-scale");
    const cosmos = readFileSync(COSMOS_CSS, "utf8");
    expect(Object.keys(FS)).toEqual(DEGRAUS);
    for (const degrau of DEGRAUS) {
      expect(FS[degrau as keyof typeof FS]).toBe(`var(--fs-${degrau})`);
      expect(cosmos).toMatch(new RegExp(`--fs-${degrau}:\\s*\\d`));
    }
  });
});
