// Estados de controle do Charter — o que jsdom não mede, prova por leitura.
//
// O anel de foco é um só e global (`.charter-root :focus-visible`, com token
// do sistema). Estilo inline vence CSS: um `outline: "none"` num <input> ou
// num <button> apaga o anel para o teclado inteiro (WCAG 2.4.7). E `disabled`
// precisa de regra visual — o kit promete que "o CSS já cobre `.btn:disabled`".

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const CHARTER = join(__dirname, "../../components/charter");

function componentes(): string[] {
  return readdirSync(CHARTER, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && /\.tsx$/.test(e.name))
    .map((e) => join(e.parentPath, e.name))
    .sort();
}

describe("charter/control-states", () => {
  it("nenhum componente apaga o anel de foco com outline inline", () => {
    const ofensores = componentes().flatMap((file) => {
      const src = readFileSync(file, "utf8");
      return src
        .split("\n")
        .map((line, i) => ({ line, n: i + 1 }))
        .filter(({ line }) => /\boutline:/.test(line))
        .map(({ n }) => `${relative(CHARTER, file)}:${n}`);
    });
    expect(ofensores).toEqual([]);
  });

  it("charter.css dá anel de foco com token e estado disabled ao .btn", () => {
    const css = readFileSync(join(CHARTER, "charter.css"), "utf8");
    expect(css).toMatch(
      /\.charter-root :focus-visible \{[^}]*outline: 2px solid var\(--accent\)/
    );
    expect(css).toMatch(
      /\.charter-root \.btn:disabled,\s*\.charter-root \.btn\[aria-disabled="true"\] \{[^}]*cursor: not-allowed/
    );
  });
});
