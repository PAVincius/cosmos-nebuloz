/**
 * Todo script de seed roda `main()` no topo do módulo. `main()` começa com
 * deleteMany em dezenas de tabelas tenant-scoped — logo, sem guarda de
 * entrypoint, um `import` inocente (reusar um tipo, uma constante) apaga e
 * recria o banco.
 *
 * Este teste importa cada script num processo tsx separado e exige que nada
 * aconteça. DATABASE_URL aponta para uma porta morta: se a guarda quebrar,
 * o seed falha na primeira query em vez de destruir dados reais (dotenv não
 * sobrescreve env já definido, então o .env.local não vence aqui).
 */
import { execFile } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

const APP_DIR = path.resolve(__dirname, "../..");
const REPO_ROOT = path.resolve(APP_DIR, "../..");

const SEED_MODULES = [
  "apps/app/scripts/seed-e2e.ts",
  "apps/app/scripts/seed-tenants.ts",
  "apps/app/scripts/seed-portfolio.ts",
  "apps/app/scripts/seed-demo-full.ts",
  "apps/app/scripts/seed-personas.ts",
  "apps/app/scripts/seed-admin.ts",
  "apps/app/scripts/seed-okr-tree-demo.ts",
  "apps/app/scripts/verify-seed.ts",
  "packages/database/seed-safe-full.ts",
  "packages/database/seed-admin.ts",
  "packages/database/scripts/seed-cosmos.mts",
  "packages/database/scripts/seed-regulacao.mts",
];

const INERT_ENV = {
  ...process.env,
  // porta 1: nada escuta aqui — qualquer query morre na conexão
  DATABASE_URL: "postgresql://nobody:nobody@127.0.0.1:1/nodb",
  BETTER_AUTH_SECRET: "test-dummy-secret-min-32-chars-placeholder",
  BETTER_AUTH_URL: "http://localhost:3012",
  E2E_PASSWORD: "dummy-not-used",
};

const MARKER = "IMPORT_OK_NO_SIDE_EFFECTS";

async function importInChildProcess(moduleRelPath: string) {
  const dir = mkdtempSync(path.join(tmpdir(), "seed-guard-"));
  const probe = path.join(dir, "probe.ts");
  writeFileSync(
    probe,
    `import ${JSON.stringify(path.join(REPO_ROOT, moduleRelPath))};\n` +
      `console.log(${JSON.stringify(MARKER)});\n`
  );
  try {
    return await execFileAsync("npx", ["tsx", probe], {
      cwd: APP_DIR,
      env: INERT_ENV,
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("seed scripts: guarda de entrypoint", () => {
  // ponytail: spawn real de tsx em vez de mockar Prisma — prova o
  // comportamento de runtime de verdade, ao custo de ~5s por módulo.
  it.each(
    SEED_MODULES
  )("importar %s não executa nada", async (moduleRelPath) => {
    const { stdout } = await importInChildProcess(moduleRelPath);

    expect(stdout).toContain(MARKER);
    // Se main() tivesse rodado, teria falhado na conexão ou impresso o
    // cabeçalho do seed antes do marker.
    expect(stdout).not.toMatch(/Seed|seed completo|deleteMany/i);
  }, 60_000);
});
