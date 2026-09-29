// Costura Scaffold ↔ Linear (decisões do Norte, seção e.2): link manual, de 0 a
// N por entregável, {provider, externalId, url}. O link é referência: o estado
// da issue nunca muda o estado do entregável, então a tabela não guarda estado
// externo nem chama API.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const PRISMA = join(dirname(fileURLToPath(import.meta.url)), "..", "prisma");
const ler = (...p: string[]) => readFileSync(join(PRISMA, ...p), "utf-8");
const SCHEMA = ler("schema", "scaffold-deliverable.prisma");
const DIR = "20260929000500_scaffold_deliverable_link";

function bloco(cabecalho: string): string {
  const inicio = SCHEMA.indexOf(cabecalho);
  if (inicio < 0) {
    throw new Error(`${cabecalho} ausente`);
  }
  return SCHEMA.slice(inicio, SCHEMA.indexOf("\n}", inicio));
}

describe("ScaffoldDeliverableLink", () => {
  const modelo = bloco("model ScaffoldDeliverableLink {");

  it("provedores da decisão", () => {
    const valores = bloco("enum ScaffoldDeliverableLinkProvider {")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => /^[A-Z_]+$/.test(l));
    expect(valores).toEqual(["COSMOS", "LINEAR", "GITHUB", "JIRA"]);
  });

  it("guarda provider, externalId e url, com tenant", () => {
    expect(modelo).toMatch(/tenantId\s+String/);
    expect(modelo).toMatch(/provider\s+ScaffoldDeliverableLinkProvider/);
    expect(modelo).toMatch(/externalId\s+String/);
    expect(modelo).toMatch(/url\s+String/);
  });

  it("0..N por entregável, sem repetir o mesmo item", () => {
    expect(modelo).toContain("@@unique([deliverableId, provider, externalId])");
    expect(modelo).toContain("@@index([deliverableId])");
  });

  it("não espelha estado da issue", () => {
    expect(modelo).not.toMatch(/\bstatus\b|\bstate\b/);
  });

  it("migration reversível", () => {
    expect(existsSync(join(PRISMA, "migrations", DIR, "down.sql"))).toBe(true);
  });
});
