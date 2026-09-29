// X-02 (enum das 5 formas de trabalho) e X-01 (registro único de processo).
//
// Sem harness de banco neste pacote (ver tenant-is-internal.test.ts): o
// contrato testável é o schema e as migrations, as mesmas fontes que o Prisma
// gera e aplica. A aplicação contra Postgres local é conferida à parte.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const PRISMA = join(dirname(fileURLToPath(import.meta.url)), "..", "prisma");
const ler = (...partes: string[]) =>
  readFileSync(join(PRISMA, ...partes), "utf-8");

const FORMAS = [
  "CONVERSATIONAL_ASSISTANT",
  "ANALYSIS_PRIORITIZATION",
  "DOCUMENT_REVIEW",
  "DEMAND_TRIAGE",
  "RECURRING_REPORTS",
];

function bloco(fonte: string, cabecalho: string): string {
  const inicio = fonte.indexOf(cabecalho);
  if (inicio < 0) {
    throw new Error(`${cabecalho} ausente`);
  }
  return fonte.slice(inicio, fonte.indexOf("\n}", inicio));
}

describe("X-02 — enum WorkForm", () => {
  const schema = ler("schema", "work-form.prisma");
  const migration = ler(
    "migrations",
    "20260929000000_work_form_enum",
    "migration.sql"
  );

  it("declara exatamente as 5 formas do handoff", () => {
    const valores = bloco(schema, "enum WorkForm {")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => /^[A-Z_]+$/.test(l));
    expect(valores).toEqual(FORMAS);
  });

  it("a migration cria o tipo com os mesmos valores e tem down.sql", () => {
    for (const forma of FORMAS) {
      expect(migration).toContain(`'${forma}'`);
    }
    expect(
      existsSync(
        join(PRISMA, "migrations", "20260929000000_work_form_enum", "down.sql")
      )
    ).toBe(true);
  });
});

describe("X-01 — ProcessRegistry", () => {
  const schema = ler("schema", "process-registry.prisma");
  const modelo = bloco(schema, "model ProcessRegistry {");
  const dir = "20260929000100_process_registry";
  const migration = ler("migrations", dir, "migration.sql");

  it("tenantId é obrigatório e há índice por tenant", () => {
    expect(modelo).toMatch(/tenantId\s+String\s*(\n|$)/);
    expect(modelo).toMatch(/@@index\(\[tenantId\]\)/);
  });

  it("liga os 4 produtos por id string opcional, sem FK cruzada", () => {
    for (const campo of [
      "meridianGapId",
      "scaffoldTrackId",
      "signalInitiativeId",
      "charterUseCaseId",
    ]) {
      expect(modelo).toMatch(new RegExp(`${campo}\\s+String\\?`));
    }
    // única relação permitida é a do Tenant
    const relacoes = modelo.match(/@relation\(/g) ?? [];
    expect(relacoes).toHaveLength(1);
    expect(modelo).toMatch(/tenant\s+Tenant\s+@relation/);
    expect(migration.match(/FOREIGN KEY/g) ?? []).toHaveLength(1);
  });

  it("cada id de produto aparece no máximo uma vez por tenant", () => {
    for (const campo of [
      "meridianGapId",
      "scaffoldTrackId",
      "signalInitiativeId",
      "charterUseCaseId",
    ]) {
      expect(modelo).toContain(`@@unique([tenantId, ${campo}])`);
    }
  });

  it("usa WorkForm e o Tenant tem a relação inversa", () => {
    expect(modelo).toMatch(/workForm\s+WorkForm\?/);
    expect(bloco(ler("schema", "tenant.prisma"), "model Tenant {")).toMatch(
      /processRegistries\s+ProcessRegistry\[\]/
    );
  });

  it("migration é reversível", () => {
    expect(existsSync(join(PRISMA, "migrations", dir, "down.sql"))).toBe(true);
  });
});
