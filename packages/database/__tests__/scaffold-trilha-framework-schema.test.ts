// D-24 (docs/produto/trilhas/framework-no-scaffold.md §3), o mínimo de schema
// da trilha de framework: F3 archetype opcional no template e F1
// requirementRefs no entregável do template, sem FK para o Charter. A dispensa
// já existe (dispensedReason + required=false) e não muda; F2 (perfil) fica fora.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const PRISMA = join(dirname(fileURLToPath(import.meta.url)), "..", "prisma");
const schema = (f: string) => readFileSync(join(PRISMA, "schema", f), "utf-8");
const DIR = "20260930120000_scaffold_trilha_framework";
const sql = (file = "migration.sql") =>
  readFileSync(join(PRISMA, "migrations", DIR, file), "utf-8");
const semComentarios = (texto: string) =>
  texto
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");

const bloco = (texto: string, inicio: string) => {
  const i = texto.indexOf(inicio);
  if (i === -1) {
    throw new Error(`bloco não encontrado: ${inicio}`);
  }
  return texto.slice(i, texto.indexOf("\n}", i));
};

describe("F3 — ScaffoldTemplate.archetype opcional", () => {
  it("schema: WorkForm?", () => {
    const modelo = bloco(schema("scaffold.prisma"), "model ScaffoldTemplate {");
    expect(modelo).toMatch(/archetype\s+WorkForm\?/);
  });

  it("migration relaxa a coluna (DROP NOT NULL), sem mexer em dado", () => {
    const m = semComentarios(sql());
    expect(m).toMatch(
      /ALTER TABLE "ScaffoldTemplate" ALTER COLUMN "archetype" DROP NOT NULL/
    );
    expect(m).not.toMatch(/DELETE|UPDATE\s/i);
  });
});

describe("F1 — requirementRefs no entregável do template", () => {
  const modelo = bloco(
    schema("scaffold-deliverable.prisma"),
    "model ScaffoldDeliverableTemplate {"
  );
  const semComentario = modelo
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n");

  it("é Json opcional", () => {
    expect(semComentario).toMatch(/requirementRefs\s+Json\?/);
  });

  it("sem FK: nenhuma relação com o Charter", () => {
    expect(semComentario).not.toMatch(/Charter/);
  });

  it("migration: coluna JSONB nula, e quando presente só aceita lista", () => {
    const m = semComentarios(sql());
    expect(m).toMatch(
      /ALTER TABLE "ScaffoldDeliverableTemplate" ADD COLUMN "requirementRefs" JSONB;/
    );
    expect(m).toMatch(
      /CHECK \("requirementRefs" IS NULL OR jsonb_typeof\("requirementRefs"\) = 'array'\)/
    );
  });
});

describe("o que NÃO entra", () => {
  it("dispensa não ganha estado nem coluna; instância intocada; sem perfil (F2)", () => {
    const m = semComentarios(sql());
    expect(m).not.toMatch(/WAIVED|ScaffoldDeliverableStatus/);
    expect(m).not.toMatch(/ScaffoldDeliverableInstance/);
    expect(m).not.toMatch(/orgProfile|profiles/);
  });

  it("o enum de estados segue sem valor de dispensa", () => {
    const e = bloco(
      schema("scaffold-deliverable.prisma"),
      "enum ScaffoldDeliverableStatus {"
    );
    expect(e).not.toMatch(/WAIVED|DISPENSED/);
  });
});

describe("down.sql", () => {
  it("reverte as duas mudanças", () => {
    const d = semComentarios(sql("down.sql"));
    expect(d).toMatch(/ALTER COLUMN "archetype" SET NOT NULL/);
    expect(d).toMatch(/DROP COLUMN "requirementRefs"/);
  });
});
