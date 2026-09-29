import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Benchmark travado por tenant (specs/012, FR-002/SC-005): só staff Nebuloz liga
// ou desliga a habilitação, e só pelo back-office. O escritor
// `setMeridianBenchmarkEnablement` vive em `packages/provisioning` e NÃO checa
// papel — quem chama garante staff. Se `apps/app` (o produto do cliente)
// importasse o escritor, um papel do tenant poderia ligar o benchmark de si
// mesmo. Este teste, no molde de `scaffold/adr-0013-boundary.test.ts`, é o que
// impede isso de acontecer por conveniência num PR futuro.
const APP_ROOT = join(import.meta.dirname, "..", "..");
const SKIP = new Set(["node_modules", ".next", ".turbo", "generated", "dist"]);
const EXT = /\.(ts|tsx|mts|cts)$/;
const SELF = "benchmark-writer-boundary.test.ts";

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

/** `import { setMeridianBenchmarkEnablement }` (com ou sem `as`, `type`) ou o
 *  acesso dinâmico `(await import(...)).setMeridianBenchmarkEnablement`. */
const IMPORTS_WRITER_BY_NAME =
  /import\s*(?:type\s*)?\{[^}]*\bsetMeridianBenchmarkEnablement\b[^}]*\}\s*from|\)\s*\.\s*setMeridianBenchmarkEnablement\b/;

/** Import (estático ou dinâmico) do módulo que define o escritor — pega
 *  `import * as x` e renomeios que escapariam do nome do binding. */
const IMPORTS_WRITER_MODULE =
  /from\s*["'][^"']*provisioning\/src\/meridian-benchmark(?:\.js)?["']|\bimport\(\s*["'][^"']*provisioning\/src\/meridian-benchmark(?:\.js)?["']\s*\)/;

function* sourceFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) {
      continue;
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      yield* sourceFiles(full);
    } else if (EXT.test(entry)) {
      yield full;
    }
  }
}

describe("benchmark travado — só a Nebuloz liga (fronteira)", () => {
  it("nenhum arquivo de apps/app importa setMeridianBenchmarkEnablement, por nome ou pelo módulo", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(APP_ROOT)) {
      if (file.endsWith(SELF)) {
        continue;
      }
      const src = stripComments(readFileSync(file, "utf8"));
      if (IMPORTS_WRITER_BY_NAME.test(src) || IMPORTS_WRITER_MODULE.test(src)) {
        offenders.push(file.slice(APP_ROOT.length + 1));
      }
    }
    expect(
      offenders,
      `apps/app não liga nem desliga a habilitação de benchmark: isso é staff, no back-office (specs/012).\n${offenders.join("\n")}`
    ).toEqual([]);
  });

  it("os padrões pegam as formas de import que importam", () => {
    // Montados por partes: uma string com `from "@repo/provisioning"` inteira
    // faria este arquivo acusar a fronteira do adr-0013 (barrel), que não
    // ignora strings.
    const W = "setMeridianBenchmarkEnablement";
    const PKG = ["@repo", "provisioning"].join("/");
    const MOD = `${PKG}/src/meridian-benchmark`;
    const hits = [
      `import { ${W} } fr${"om"} "${PKG}";`,
      `import { a, ${W} as liga } fr${"om"} "x";`,
      `import type { ${W} } fr${"om"} "x";`,
      `const m = (await imp${"ort"}("${PKG}")).${W};`,
    ];
    for (const src of hits) {
      expect(IMPORTS_WRITER_BY_NAME.test(src), src).toBe(true);
    }
    const moduleHits = [
      `import * as w fr${"om"} "${MOD}";`,
      `await imp${"ort"}("${MOD}.js")`,
    ];
    for (const src of moduleHits) {
      expect(IMPORTS_WRITER_MODULE.test(src), src).toBe(true);
    }
    expect(
      IMPORTS_WRITER_BY_NAME.test('import { provisionTenant } from "x";')
    ).toBe(false);
  });
});
