import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Todo export de um arquivo "use server" vira Server Action, e o Next recusa
// Server Action que não seja async ("Server Actions must be async functions").
// O erro só aparece no build/dev do Next: vitest e tsc passam. Este teste pega
// antes — um `export function` síncrono derrubou todas as rotas do Signal em
// 29/09 (plan.ts, approveMetric/pauseMetric/resumeMetric).

const APP_DIR = join(__dirname, "..", "app");

function collect(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) {
      continue;
    }
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      collect(full, out);
    } else if (/\.(ts|tsx)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

function isUseServer(source: string): boolean {
  const firstStatement = source
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line !== "" && !line.startsWith("//"));
  return (
    firstStatement === '"use server";' || firstStatement === "'use server';"
  );
}

const SYNC_EXPORT =
  /^export\s+(?:function\s+\w+|const\s+\w+\s*=\s*(?!async\b)(?:\([^)]*\)|\w+)\s*=>)/;

describe('arquivos "use server" só exportam funções async', () => {
  const files = collect(APP_DIR).filter((file) =>
    isUseServer(readFileSync(file, "utf8"))
  );

  it("encontra arquivos de Server Action", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("nenhum export síncrono", () => {
    const offenders: string[] = [];
    for (const file of files) {
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, index) => {
          if (SYNC_EXPORT.test(line.trim())) {
            offenders.push(`${relative(APP_DIR, file)}:${index + 1}`);
          }
        });
    }
    expect(offenders).toEqual([]);
  });
});
