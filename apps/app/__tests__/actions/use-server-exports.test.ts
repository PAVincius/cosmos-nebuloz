import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Um arquivo `"use server"` só pode exportar função async. Exportar um array,
 * objeto ou string dali não falha no build — falha em runtime, na primeira vez
 * que o Next resolve o manifest de server actions:
 *
 *   Error: A "use server" file can only export async functions, found object.
 *
 * O sintoma é cruel porque não é local: o GET da página responde 200 e só o
 * POST da server action devolve 500, em toda tela cujo chunk carregue o módulo
 * ofensor — não apenas na tela que o declarou. Foi assim que um
 * `export const COLUNAS` em `(cosmos)/actions/board.ts` derrubou o POST de
 * `/cosmos/kanban` em produção.
 *
 * Este teste é o portão que faltava: varre a origem, não o bundle, e reprova
 * antes do deploy.
 */

const APP_DIR = join(__dirname, "..", "..", "app");
const IGNORED_DIRS = new Set(["node_modules", ".next", "graphify-out"]);
const SOURCE_FILE = /\.tsx?$/;

/** `"use server"` como primeira diretiva do módulo, ignorando comentários. */
const USE_SERVER_DIRECTIVE =
  /^\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*["']use server["']/;

/**
 * `export const X = <valor>` cujo valor começa com um literal — array, objeto,
 * string, número, booleano, `null` ou `new`. Deliberadamente conservador: só
 * acusa o que é comprovadamente um valor, nunca uma função. `export const f =
 * async () => {}` e `export const g = function () {}` não casam aqui.
 */
const EXPORTED_LITERAL =
  /^export\s+(?:const|let|var)\s+(\w+)\s*(?::[^=]+)?=\s*(\[|\{|"|'|`|\d|true\b|false\b|null\b|new\s)/;

function collectSourceFiles(dir: string): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED_DIRS.has(entry.name)) {
      continue;
    }
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...collectSourceFiles(full));
    } else if (SOURCE_FILE.test(entry.name)) {
      found.push(full);
    }
  }

  return found;
}

type Offender = { file: string; line: number; name: string };

function findOffendingExports(): Offender[] {
  const offenders: Offender[] = [];

  for (const file of collectSourceFiles(APP_DIR)) {
    const source = readFileSync(file, "utf8");
    if (!USE_SERVER_DIRECTIVE.test(source.slice(0, 400))) {
      continue;
    }

    source.split("\n").forEach((line, index) => {
      const match = EXPORTED_LITERAL.exec(line);
      if (match) {
        offenders.push({
          file: relative(APP_DIR, file),
          line: index + 1,
          name: match[1],
        });
      }
    });
  }

  return offenders;
}

describe('arquivos "use server"', () => {
  it("não exportam valor — só função async", () => {
    const offenders = findOffendingExports();

    expect(
      offenders.map((o) => `${o.file}:${o.line} exporta \`${o.name}\``)
    ).toEqual([]);
  });

  it("o scanner enxerga os arquivos de action", () => {
    // Se um refactor mover as actions de lugar, o teste acima passaria vazio e
    // pararia de proteger sem ninguém perceber.
    const withDirective = collectSourceFiles(APP_DIR).filter((file) =>
      USE_SERVER_DIRECTIVE.test(readFileSync(file, "utf8").slice(0, 400))
    );

    expect(withDirective.length).toBeGreaterThan(100);
  });
});
