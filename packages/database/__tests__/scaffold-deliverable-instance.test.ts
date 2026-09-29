// RASCUNHO (SC-DEV-03): esboço do schema de entregável do Scaffold. Códigos
// A1..E3 e papéis dependem da decisão do Norte; este teste só trava o que o
// PDF já fixa: o fluxo de estados e o histórico append-only.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const PRISMA = join(dirname(fileURLToPath(import.meta.url)), "..", "prisma");
const SCHEMA = readFileSync(
  join(PRISMA, "schema", "scaffold-deliverable.prisma"),
  "utf-8"
);

function bloco(cabecalho: string): string {
  const inicio = SCHEMA.indexOf(cabecalho);
  if (inicio < 0) {
    throw new Error(`${cabecalho} ausente`);
  }
  return SCHEMA.slice(inicio, SCHEMA.indexOf("\n}", inicio));
}

describe("ScaffoldDeliverableInstance (rascunho)", () => {
  it("estados seguem o fluxo do PDF", () => {
    const valores = bloco("enum ScaffoldDeliverableStatus {")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => /^[A-Z_]+$/.test(l));
    expect(valores).toEqual([
      "NOT_STARTED",
      "IN_PROGRESS",
      "IN_REVIEW",
      "ADJUSTMENT_REQUESTED",
      "APPROVED",
      "REOPENED",
    ]);
  });

  it("tem os campos de SC-DEV-03", () => {
    const modelo = bloco("model ScaffoldDeliverableInstance {");
    for (const campo of [
      "tenantId",
      "status",
      "ownerId",
      "approverId",
      "version",
      "summary",
      "dueAt",
      "isExtra",
      "required",
    ]) {
      expect(modelo).toMatch(new RegExp(`\\b${campo}\\b`));
    }
  });

  it("histórico é append-only: sem updatedAt e sem campo mutável", () => {
    const evento = bloco("model ScaffoldDeliverableEvent {");
    expect(evento).not.toMatch(/updatedAt/);
    expect(evento).toMatch(/actorId\s+String/);
    expect(evento).toMatch(/createdAt\s+DateTime/);
  });

  it("migration própria e reversível", () => {
    const dir = join(
      PRISMA,
      "migrations",
      "20260929000200_scaffold_deliverable_draft"
    );
    expect(existsSync(join(dir, "migration.sql"))).toBe(true);
    expect(existsSync(join(dir, "down.sql"))).toBe(true);
  });
});
