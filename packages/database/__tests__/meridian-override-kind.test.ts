// D-29 (PR #334, finalizar assessment): a revisão do consultor passa a distinguir
// ajuste de nota (OVERRIDE) de confirmação da nota calculada (CONFIRMATION). Linhas
// existentes são todas ajustes, então o default é OVERRIDE e não há backfill.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const PRISMA = join(dirname(fileURLToPath(import.meta.url)), "..", "prisma");
const DIR = "20260930130000_meridian_override_kind";
const schema = readFileSync(join(PRISMA, "schema", "meridian.prisma"), "utf-8");
const sql = (file = "migration.sql") =>
  readFileSync(join(PRISMA, "migrations", DIR, file), "utf-8");
const semComentarios = (texto: string) =>
  texto
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");

const bloco = (inicio: string) => {
  const i = schema.indexOf(inicio);
  if (i === -1) {
    throw new Error(`bloco não encontrado: ${inicio}`);
  }
  return schema.slice(i, schema.indexOf("\n}", i));
};

describe("enum MeridianOverrideKind", () => {
  it("tem OVERRIDE e CONFIRMATION, nessa ordem", () => {
    const valores = bloco("enum MeridianOverrideKind {")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => /^[A-Z_]+$/.test(l));
    expect(valores).toEqual(["OVERRIDE", "CONFIRMATION"]);
  });
});

describe("MeridianOverride.kind", () => {
  it("schema: obrigatório, default OVERRIDE", () => {
    expect(bloco("model MeridianOverride {")).toMatch(
      /kind\s+MeridianOverrideKind\s+@default\(OVERRIDE\)/
    );
  });

  it("migration: cria o tipo e a coluna NOT NULL DEFAULT 'OVERRIDE', sem UPDATE", () => {
    const m = semComentarios(sql());
    expect(m).toMatch(
      /CREATE TYPE "MeridianOverrideKind" AS ENUM \('OVERRIDE', 'CONFIRMATION'\);/
    );
    expect(m).toMatch(
      /ALTER TABLE "MeridianOverride" ADD COLUMN "kind" "MeridianOverrideKind" NOT NULL DEFAULT 'OVERRIDE';/
    );
    expect(m).not.toMatch(/UPDATE\s/i);
  });

  it("não mexe em outras tabelas", () => {
    const alteradas = semComentarios(sql()).match(/ALTER TABLE "(\w+)"/g) ?? [];
    expect(new Set(alteradas)).toEqual(
      new Set(['ALTER TABLE "MeridianOverride"'])
    );
  });
});

describe("down.sql", () => {
  it("remove a coluna e depois o tipo", () => {
    const d = semComentarios(sql("down.sql"));
    const coluna = d.indexOf('DROP COLUMN "kind"');
    const tipo = d.indexOf('DROP TYPE "MeridianOverrideKind"');
    expect(coluna).toBeGreaterThan(-1);
    expect(tipo).toBeGreaterThan(coluna);
  });
});
