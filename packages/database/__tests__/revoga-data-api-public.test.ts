// Supabase expõe `public` pela Data API e concede SELECT/INSERT/... a anon e
// authenticated em toda tabela nova ("Automatically expose new tables"). O app
// nunca usa esses papéis para ler `public` (Prisma como postgres; o supabase-js
// do packages/storage usa service_role e só o schema `storage`), então o acesso
// deles é risco sem uso. A migration revoga o que existe e o que vier.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "prisma",
  "migrations",
  "20260929020000_revoga_data_api_public"
);
const sql = readFileSync(join(DIR, "migration.sql"), "utf-8");

describe("revoga acesso de anon e authenticated ao schema public", () => {
  it.each(["TABLES", "SEQUENCES", "FUNCTIONS"])("revoga %s existentes", (o) => {
    expect(sql).toMatch(
      new RegExp(
        `REVOKE ALL ON ALL ${o}\\s+IN SCHEMA public FROM anon, authenticated`
      )
    );
  });

  it.each([
    "TABLES",
    "SEQUENCES",
    "FUNCTIONS",
  ])("revoga o default privilege de %s futuras", (o) => {
    expect(sql).toMatch(
      new RegExp(
        `ALTER DEFAULT PRIVILEGES[^;]*IN SCHEMA public REVOKE ALL ON ${o}\\s+FROM anon, authenticated`
      )
    );
  });

  it("só age se os papéis existirem (no Postgres local não existem)", () => {
    expect(sql).toContain("pg_roles");
    expect(sql).toMatch(/rolname = 'anon'/);
    expect(sql).toMatch(/rolname = 'authenticated'/);
  });

  it("down.sql devolve os GRANTs", () => {
    expect(existsSync(join(DIR, "down.sql"))).toBe(true);
    const down = readFileSync(join(DIR, "down.sql"), "utf-8");
    expect(down).toMatch(
      /GRANT ALL ON ALL TABLES\s+IN SCHEMA public TO anon, authenticated/
    );
    expect(down).toMatch(/GRANT ALL ON ALL SEQUENCES\s+IN SCHEMA public/);
    expect(down).toMatch(/GRANT ALL ON ALL FUNCTIONS\s+IN SCHEMA public/);
  });
});
