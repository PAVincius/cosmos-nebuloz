/**
 * Catraca de tamanho de arquivo.
 *
 * A regra é "nenhum arquivo novo acima de 800 linhas, e os grandes que já
 * existem encolhem quando alguém os tocar". Escrita num documento, isso é
 * intenção; aqui vira portão.
 *
 * Grandfathering deliberado: os arquivos que já passam do teto entram na
 * baseline com o tamanho atual. Nenhum deles precisa ser quebrado hoje — o
 * que não pode é crescer. Quem tocar um deles e encolher, baixa a catraca
 * com --update.
 *
 * 800 não é número mágico: é o teto que o CLAUDE.md do usuário já usa como
 * limite de arquivo focado.
 *
 * Uso:
 *   pnpm size:guard            # falha se algo novo passou do teto ou cresceu
 *   pnpm size:guard --update   # regrava a baseline (revisar o diff!)
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..");
const BASELINE = join(HERE, "file-size-baseline.json");
const LIMIT = 800;

const IGNORE =
  /node_modules|\/generated\/|\.design-ref|\/v0\/|graphify-out|playwright-report|test-results|\.d\.ts$/;

/** Só o que está versionado — evita contar build local e dependência. */
function trackedSources(): string[] {
  const out = execFileSync(
    "git",
    [
      "ls-files",
      "apps/**/*.ts",
      "apps/**/*.tsx",
      "packages/**/*.ts",
      "packages/**/*.tsx",
    ],
    { cwd: REPO, maxBuffer: 64 * 1024 * 1024 }
  ).toString();
  return out.split("\n").filter((f) => f.length > 0 && !IGNORE.test(f));
}

function lineCount(file: string): number {
  return readFileSync(join(REPO, file), "utf8").split("\n").length;
}

function oversized(): Record<string, number> {
  const found: Record<string, number> = {};
  for (const file of trackedSources()) {
    const n = lineCount(file);
    if (n > LIMIT) {
      found[file] = n;
    }
  }
  return Object.fromEntries(Object.entries(found).sort());
}

const current = oversized();

if (process.argv.includes("--update")) {
  writeFileSync(BASELINE, `${JSON.stringify(current, null, 2)}\n`);
  console.log(
    `baseline regravada: ${Object.keys(current).length} arquivos acima de ${LIMIT} linhas`
  );
  process.exit(0);
}

const baseline: Record<string, number> = existsSync(BASELINE)
  ? JSON.parse(readFileSync(BASELINE, "utf8"))
  : {};

const novos = Object.keys(current).filter((f) => !(f in baseline));
const cresceram = Object.keys(current).filter(
  (f) => f in baseline && current[f] > baseline[f]
);
const encolheram = Object.keys(current).filter(
  (f) => f in baseline && current[f] < baseline[f]
);
const sairam = Object.keys(baseline).filter((f) => !(f in current));

console.log(
  `acima de ${LIMIT} linhas: ${Object.keys(current).length} · baseline: ${Object.keys(baseline).length}`
);

if (encolheram.length > 0 || sairam.length > 0) {
  console.log("\nprogresso — rode com --update para baixar a catraca:");
  for (const f of sairam) {
    console.log(`  ✓ ${f} caiu abaixo de ${LIMIT}`);
  }
  for (const f of encolheram) {
    console.log(`  ↓ ${f}: ${baseline[f]} → ${current[f]}`);
  }
}

if (novos.length === 0 && cresceram.length === 0) {
  console.log("\nNenhum arquivo novo acima do teto, nenhum grande cresceu.");
  process.exit(0);
}

if (novos.length > 0) {
  console.error(
    `\n${novos.length} arquivo(s) NOVO(s) acima de ${LIMIT} linhas:`
  );
  for (const f of novos) {
    console.error(`  ${f}  (${current[f]})`);
  }
}

if (cresceram.length > 0) {
  console.error(`\n${cresceram.length} arquivo(s) da baseline CRESCERAM:`);
  for (const f of cresceram) {
    console.error(`  ${f}: ${baseline[f]} → ${current[f]}`);
  }
}

console.error(
  "\nQuebre o arquivo, ou registre a exceção com --update explicando o porquê no commit."
);
process.exit(1);
