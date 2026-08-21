/**
 * Catraca de vulnerabilidade em dependência de runtime.
 *
 * O portão global do CI está em `critical` porque com `high` ele ficava
 * vermelho em todo run — são 125 altas, quase todas transitivas de tooling — e
 * job que nunca passa não é portão, é ruído que o time aprende a ignorar.
 *
 * O problema não era o nível: era a lista não ter dono. Este script separa o
 * que realmente é embarcado do que só existe para construir, e trava só a
 * primeira metade. Hoje são 14 pacotes de runtime, registrados na baseline
 * como dívida aceita. Qualquer alta NOVA em runtime para a esteira.
 *
 * O que conta como runtime: apps/app, apps/api e apps/web mais o fecho
 * transitivo dos @repo/* que eles puxam em `dependencies`. devDependency de
 * qualquer workspace é build, mesmo em app publicado — vitest, storybook e
 * turbo não vão para o bundle.
 *
 * Uso:
 *   pnpm audit:runtime            # falha se houver alta nova
 *   pnpm audit:runtime --update   # regrava a baseline (revisar o diff!)
 */

import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..");
const BASELINE = join(HERE, "audit-runtime-baseline.json");

const DEPLOYED_APPS = ["apps/app", "apps/api", "apps/web"];

type Pk = {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

function readPk(dir: string): Pk | null {
  const p = join(REPO, dir, "package.json");
  return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as Pk) : null;
}

/** apps publicados + todo @repo/* alcançável por `dependencies`. */
function runtimeWorkspaces(): Map<string, Set<string>> {
  const nameToDir = new Map<string, string>();
  for (const entry of readdirSync(join(REPO, "packages"))) {
    const pk = readPk(`packages/${entry}`);
    if (pk?.name) {
      nameToDir.set(pk.name, `packages/${entry}`);
    }
  }

  const dirs = new Set(DEPLOYED_APPS);
  const queue = [...DEPLOYED_APPS];
  while (queue.length > 0) {
    const dir = queue.shift() as string;
    for (const dep of Object.keys(readPk(dir)?.dependencies ?? {})) {
      const target = nameToDir.get(dep);
      if (target && !dirs.has(target)) {
        dirs.add(target);
        queue.push(target);
      }
    }
  }

  // Chave no formato que o pnpm audit usa nos paths: apps__app, packages__auth.
  const out = new Map<string, Set<string>>();
  for (const dir of dirs) {
    out.set(
      dir.replace(/\//g, "__"),
      new Set(Object.keys(readPk(dir)?.dependencies ?? {}))
    );
  }
  return out;
}

type Advisory = {
  severity: string;
  module_name: string;
  findings?: { paths?: string[] }[];
};

function auditAdvisories(): Advisory[] {
  // `pnpm audit` sai com código != 0 quando encontra algo; o JSON vem no stdout
  // do mesmo jeito, então o erro é capturado e o stdout aproveitado.
  let raw = "";
  try {
    raw = execSync("pnpm audit --json", {
      cwd: REPO,
      maxBuffer: 256 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    }).toString();
  } catch (e) {
    raw = (e as { stdout?: Buffer }).stdout?.toString() ?? "";
  }
  if (!raw.trim()) {
    throw new Error("pnpm audit não devolveu JSON");
  }
  const report = JSON.parse(raw) as {
    advisories?: Record<string, Advisory>;
  };
  return Object.values(report.advisories ?? {});
}

function runtimeHighs(): Map<string, string[]> {
  const prodDeps = runtimeWorkspaces();
  const found = new Map<string, Set<string>>();

  for (const adv of auditAdvisories()) {
    if (adv.severity !== "high") {
      continue;
    }
    for (const finding of adv.findings ?? []) {
      for (const path of finding.paths ?? []) {
        const [ws, direct] = path.split(">");
        if (!prodDeps.get(ws)?.has(direct)) {
          continue;
        }
        const vias = found.get(adv.module_name) ?? new Set<string>();
        vias.add(`${ws.replace(/__/g, "/")}>${direct}`);
        found.set(adv.module_name, vias);
      }
    }
  }

  return new Map(
    [...found].sort().map(([mod, vias]) => [mod, [...vias].sort()])
  );
}

const current = runtimeHighs();

if (process.argv.includes("--update")) {
  writeFileSync(
    BASELINE,
    `${JSON.stringify(Object.fromEntries(current), null, 2)}\n`
  );
  console.log(`baseline regravada com ${current.size} pacotes de runtime`);
  process.exit(0);
}

const baseline: Record<string, string[]> = existsSync(BASELINE)
  ? JSON.parse(readFileSync(BASELINE, "utf8"))
  : {};

const novas = [...current.keys()].filter((m) => !(m in baseline));
const resolvidas = Object.keys(baseline).filter((m) => !current.has(m));

console.log(
  `altas em runtime: ${current.size} · baseline: ${Object.keys(baseline).length}`
);

if (resolvidas.length > 0) {
  console.log(
    `\n${resolvidas.length} resolvida(s) — rode com --update para baixar a catraca:`
  );
  for (const m of resolvidas) {
    console.log(`  - ${m}`);
  }
}

if (novas.length === 0) {
  console.log("\nNenhuma alta nova em dependência de runtime.");
  process.exit(0);
}

console.error(`\n${novas.length} alta(s) NOVA(s) em dependência de runtime:`);
for (const m of novas) {
  console.error(`  ${m}  via ${current.get(m)?.join(", ")}`);
}
console.error(
  "\nAtualize a dependência, ou registre a exceção com --update explicando o porquê no commit."
);
process.exit(1);
