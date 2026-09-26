// tenant-is-internal.test.ts — `Tenant.isInternalTenant` existe no schema,
// tem default `false`, e é distinto de `isSystem` (propósito diferente:
// dogfood real de cliente vs. tenant técnico de auditoria).
//
// Sem harness de banco neste pacote (ver migrations-do-codigo.test.ts) — o
// contrato testável aqui é a declaração do campo no schema, a mesma fonte que
// o Prisma Client gera. Leitura a partir da sessão (nunca de input) é
// responsabilidade de quem chama `requireTenantSession` — coberto em
// apps/app/__tests__/produto/resolve-post-login-destination.test.ts.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SCHEMA = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "prisma",
    "schema",
    "tenant.prisma"
  ),
  "utf-8"
);

function modeloTenant(): string {
  const inicio = SCHEMA.indexOf("model Tenant {");
  const fim = SCHEMA.indexOf("\n}", inicio);
  return SCHEMA.slice(inicio, fim);
}

describe("Tenant.isInternalTenant", () => {
  it("existe como Boolean com default false", () => {
    expect(modeloTenant()).toMatch(
      /isInternalTenant\s+Boolean\s+@default\(false\)/
    );
  });

  it("é distinto de isSystem — os dois campos existem lado a lado", () => {
    const modelo = modeloTenant();
    expect(modelo).toMatch(/isSystem\s+Boolean\s+@default\(false\)/);
    expect(modelo).toMatch(/isInternalTenant\s+Boolean\s+@default\(false\)/);
  });
});
