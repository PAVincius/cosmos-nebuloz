/**
 * Cobertura agregada por diretório, do pior para o melhor.
 *
 * A catraca de `apps/app/vitest.config.mts` é global: ela impede piorar, mas
 * não diz onde melhorar. E a regra combinada é por módulo tocado — feature que
 * entra num diretório fraco sai com teste. Para isso funcionar, quem vai
 * mexer precisa conseguir ver em que diretório está pisando.
 *
 * O relatório de texto do vitest é por arquivo, e com 12 mil linhas em ~62
 * diretórios ninguém lê. Isto agrega e ordena por linha DESCOBERTA, não por
 * percentual: um diretório de 366 linhas a 28% custa muito mais que um de 14
 * linhas a 43%.
 *
 * Uso:
 *   cd apps/app && pnpm test:coverage    # gera o coverage-summary.json
 *   pnpm coverage:gaps                   # da raiz, lê e resume
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SUMMARY = join(HERE, "..", "apps/app/coverage/coverage-summary.json");

if (!existsSync(SUMMARY)) {
  console.error(
    "coverage-summary.json não encontrado.\nRode antes: cd apps/app && pnpm test:coverage"
  );
  process.exit(1);
}

type Metric = { covered: number; total: number; pct: number };
type Entry = { lines: Metric };

const report = JSON.parse(readFileSync(SUMMARY, "utf8")) as Record<
  string,
  Entry
>;

const byDir = new Map<string, { covered: number; total: number }>();
for (const [file, entry] of Object.entries(report)) {
  if (file === "total") {
    continue;
  }
  const match = file.match(/\/(app\/actions\/[^/]+|lib\/[^/]+)\//);
  if (!match) {
    continue;
  }
  const acc = byDir.get(match[1]) ?? { covered: 0, total: 0 };
  acc.covered += entry.lines.covered;
  acc.total += entry.lines.total;
  byDir.set(match[1], acc);
}

const rows = [...byDir]
  .map(([dir, v]) => ({
    dir,
    total: v.total,
    uncovered: v.total - v.covered,
    pct: v.total > 0 ? (v.covered / v.total) * 100 : 100,
  }))
  // Diretório sem linha mensurável (só schema ou tipo) não é lacuna.
  .filter((r) => r.total > 0)
  .sort((a, b) => b.uncovered - a.uncovered);

const totalUncovered = rows.reduce((sum, r) => sum + r.uncovered, 0);

console.log(
  `${rows.length} diretórios com código medível · ${totalUncovered} linhas descobertas\n`
);
console.log("descob.  cobertura  diretório");
for (const r of rows.slice(0, 15)) {
  const pct = `${r.pct.toFixed(1)}%`;
  console.log(
    `${String(r.uncovered).padStart(7)}  ${pct.padStart(9)}  ${r.dir}`
  );
}

const zerados = rows.filter((r) => r.pct === 0);
if (zerados.length > 0) {
  console.log(`\nainda em 0%: ${zerados.map((r) => r.dir).join(", ")}`);
}
