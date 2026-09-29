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

  it("não concede nada a anon/authenticated (fora de comentários)", () => {
    const comandos = migration
      .split("\n")
      .filter((l) => !l.trim().startsWith("--"))
      .join("\n");
    expect(comandos).not.toMatch(/GRANT\s/i);
    expect(comandos).not.toMatch(/\b(anon|authenticated)\b/);
  });
});
