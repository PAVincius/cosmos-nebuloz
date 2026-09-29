// SC-DEV-01/02/03 (correcoes.pdf) conforme decisões do Norte de 29/09, seções
// (b) códigos, (c.0) esqueleto e (d) papéis: schema do entregável do Scaffold.
// Sem harness de banco neste pacote: o contrato testável é o schema e o SQL.
// O comportamento do trigger é conferido contra o Postgres local à parte.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const PRISMA = join(dirname(fileURLToPath(import.meta.url)), "..", "prisma");
const ler = (...p: string[]) => readFileSync(join(PRISMA, ...p), "utf-8");
const SCHEMA = ler("schema", "scaffold-deliverable.prisma");
const DIR = "20260929000300_scaffold_deliverable_v1";

function bloco(cabecalho: string, fonte = SCHEMA): string {
  const inicio = fonte.indexOf(cabecalho);
  if (inicio < 0) {
    throw new Error(`${cabecalho} ausente`);
  }
  return fonte.slice(inicio, fonte.indexOf("\n}", inicio));
}

function valoresDe(enumDecl: string): string[] {
  return bloco(enumDecl)
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^[A-Z_]+$/.test(l));
}

describe("ScaffoldDeliverableInstance", () => {
  it("estados seguem o fluxo do PDF", () => {
    expect(valoresDe("enum ScaffoldDeliverableStatus {")).toEqual([
      "NOT_STARTED",
      "IN_PROGRESS",
      "IN_REVIEW",
      "ADJUSTMENT_REQUESTED",
      "APPROVED",
      "REOPENED",
    ]);
  });

  it("tem os campos de SC-DEV-03 e os códigos de passo e entregável", () => {
    const modelo = bloco("model ScaffoldDeliverableInstance {");
    for (const campo of [
      "tenantId",
      "stepCode",
      "code",
      "kind",
      "producer",
      "status",
      "ownerId",
      "approverId",
      "version",
      "summary",
      "dueAt",
      "isExtra",
      "required",
      "dispensedReason",
    ]) {
      expect(modelo).toMatch(new RegExp(`\\b${campo}\\b`));
    }
    expect(modelo).toContain("@@unique([tenantId, trackId, code])");
  });

  it("tipos e responsáveis do esqueleto (c.0)", () => {
    expect(valoresDe("enum ScaffoldDeliverableKind {")).toEqual([
      "DOCUMENT",
      "SPREADSHEET",
      "DATASET",
      "CONFIGURATION",
      "SIGNATURE",
      "TRAINING",
      "REPORT",
      "PACKAGE",
    ]);
    expect(valoresDe("enum ScaffoldDeliverableProducer {")).toEqual([
      "OWNER",
      "CONSULTANT",
      "TECHNICAL",
      "LEGAL",
    ]);
  });
});

describe("ScaffoldDeliverableTemplate (código travado no publish)", () => {
  const modelo = bloco("model ScaffoldDeliverableTemplate {");

  it("é imutável como a versão: sem updatedAt", () => {
    expect(modelo).not.toMatch(/updatedAt/);
  });

  it("código único por versão, com passo e módulo condicional", () => {
    expect(modelo).toContain("@@unique([versionId, code])");
    expect(modelo).toMatch(/stepCode\s+String/);
    expect(modelo).toMatch(/requiresModule\s+ProductModule\?/);
    expect(modelo).toMatch(/required\s+Boolean\s+@default\(true\)/);
  });

  it("passo do template ganha o código A1..E3", () => {
    const passo = bloco(
      "model ScaffoldStepTemplate {",
      ler("schema", "scaffold.prisma")
    );
    expect(passo).toMatch(/code\s+String\?/);
    expect(passo).toContain("@@unique([versionId, code])");
  });
});

describe("ScaffoldDeliverableEvent (histórico append-only)", () => {
  const evento = bloco("model ScaffoldDeliverableEvent {");
  const sql = ler("migrations", DIR, "migration.sql");

  it("sem updatedAt e com ator e data", () => {
    expect(evento).not.toMatch(/updatedAt/);
    expect(evento).toMatch(/actorId\s+String/);
    expect(evento).toMatch(/createdAt\s+DateTime/);
  });

  it("trigger bloqueia UPDATE e DELETE direto, deixando o cascade passar", () => {
    expect(sql).toMatch(/CREATE TRIGGER scaffold_deliverable_event_immutable/);
    expect(sql).toMatch(
      /BEFORE UPDATE OR DELETE ON "ScaffoldDeliverableEvent"/
    );
    expect(sql).toContain("pg_trigger_depth() > 1");
    expect(sql).toMatch(/RAISE EXCEPTION/);
  });

  it("migration é reversível", () => {
    expect(existsSync(join(PRISMA, "migrations", DIR, "down.sql"))).toBe(true);
    expect(ler("migrations", DIR, "down.sql")).toContain(
      "DROP TRIGGER scaffold_deliverable_event_immutable"
    );
  });
});
