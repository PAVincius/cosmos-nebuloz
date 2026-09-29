// Habilitação do benchmark travado por tenant (D-29 do CEO, spec #307,
// proposta da Bussola). Sem linha = desligado; tabela nova, sem backfill.
// Histórico de quem ligou/desligou vive no AuditLog, não aqui.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const PRISMA = join(dirname(fileURLToPath(import.meta.url)), "..", "prisma");
const DIR = "20260929030000_meridian_benchmark_enablement";
const migration = readFileSync(
  join(PRISMA, "migrations", DIR, "migration.sql"),
  "utf-8"
);
const schema = readFileSync(join(PRISMA, "schema", "meridian.prisma"), "utf-8");
const tenant = readFileSync(join(PRISMA, "schema", "tenant.prisma"), "utf-8");

const inicio = schema.indexOf("model MeridianBenchmarkEnablement {");
const modelo = schema.slice(inicio, schema.indexOf("\n}", inicio));

describe("model MeridianBenchmarkEnablement", () => {
  it("existe no meridian.prisma", () => {
    expect(inicio).toBeGreaterThan(-1);
  });

  it("tem tenantId como chave primária (uma linha por tenant)", () => {
    expect(modelo).toMatch(/tenantId\s+String\s+@id/);
  });

  it("nasce desligado", () => {
    expect(modelo).toMatch(/enabled\s+Boolean\s+@default\(false\)/);
  });

  it("agreementRef e updatedById são opcionais; updatedAt é automático", () => {
    expect(modelo).toMatch(/agreementRef\s+String\?/);
    expect(modelo).toMatch(/updatedById\s+String\?/);
    expect(modelo).toMatch(/updatedAt\s+DateTime\s+@updatedAt/);
  });

  it("FK para Tenant com onDelete Cascade, e o Tenant declara a relação inversa", () => {
    expect(modelo).toMatch(
      /tenant\s+Tenant\s+@relation\(fields: \[tenantId\], references: \[id\], onDelete: Cascade\)/
    );
    expect(tenant).toMatch(/meridianBenchmark\s+MeridianBenchmarkEnablement\?/);
  });
});

describe(`migration ${DIR}`, () => {
  it("cria a tabela com enabled DEFAULT false, sem backfill", () => {
    expect(migration).toContain('CREATE TABLE "MeridianBenchmarkEnablement"');
    expect(migration).toMatch(/"enabled" BOOLEAN NOT NULL DEFAULT false/);
    expect(migration).not.toMatch(/INSERT INTO/i);
  });

  it("FK para Tenant em cascata", () => {
    expect(migration).toMatch(
      /FOREIGN KEY \("tenantId"\) REFERENCES "Tenant"\("id"\) ON DELETE CASCADE/
    );
  });

  const comandos = migration
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");

  it("não concede nada a anon/authenticated e revoga o que tenham (guardado pela existência dos papéis)", () => {
    const grants = comandos.match(/GRANT[^;]*;/gi) ?? [];
    for (const g of grants) {
      expect(g).not.toMatch(/\b(anon|authenticated|PUBLIC)\b/);
    }
    expect(comandos).toMatch(
      /REVOKE ALL ON "MeridianBenchmarkEnablement" FROM PUBLIC, anon, authenticated/
    );
    expect(comandos).toMatch(/rolname = 'anon'/);
  });

  it("papel do app (cosmos_app): só SELECT — INSERT/UPDATE/DELETE reservados ao papel de plataforma", () => {
    expect(comandos).toMatch(/rolname = 'cosmos_app'/);
    expect(comandos).toMatch(
      /REVOKE ALL ON "MeridianBenchmarkEnablement" FROM cosmos_app/
    );
    expect(comandos).toMatch(
      /GRANT SELECT ON "MeridianBenchmarkEnablement" TO cosmos_app/
    );
    const grants = comandos.match(/GRANT[^;]*TO cosmos_app;/gi) ?? [];
    for (const g of grants) {
      expect(g).not.toMatch(/INSERT|UPDATE|DELETE|TRUNCATE|ALL/i);
    }
  });

  it("mantém RLS FORCE + tenant_isolation junto dos grants", () => {
    expect(comandos).toMatch(/FORCE ROW LEVEL SECURITY/);
    expect(comandos).toMatch(/CREATE POLICY "tenant_isolation"/);
  });
});
