// deploy-migrations-url.test.ts — as duas regras de `scripts/migration-target.ts`:
// se este build pode migrar, e contra qual URL.
//
// `migrate deploy` adquire advisory lock antes de aplicar migration, e
// advisory lock não sobrevive ao pooler do Supabase em modo transaction
// (6543/PgBouncer): a sessão que pega o lock não é a que roda a migration
// seguinte, e o comando espera para sempre em vez de falhar. O sintoma real
// foi um build de produção parado por mais de 12 minutos logo depois de
// imprimir o Datasource — sem erro, sem timeout.
import { describe, expect, it } from "vitest";
import {
  decidirMigration,
  urlDeMigration,
} from "../scripts/migration-target.ts";

const POOLER =
  "postgresql://postgres.abc:senha@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1";

const BRANCH_NEON =
  "postgresql://user:pw@ep-cool-name-123.us-east-2.aws.neon.tech/cosmos?sslmode=require";
const HOST_BRANCH = "ep-cool-name-123.us-east-2.aws.neon.tech";

describe("urlDeMigration", () => {
  it("troca o pooler de transaction (6543) pela sessão (5432)", () => {
    const r = new URL(urlDeMigration(POOLER));
    expect(r.port).toBe("5432");
    expect(r.hostname).toBe("aws-0-us-east-1.pooler.supabase.com");
  });

  it("remove pgbouncer=true, que não se aplica em session mode", () => {
    const r = new URL(urlDeMigration(POOLER));
    expect(r.searchParams.get("pgbouncer")).toBeNull();
    // O resto da query sobrevive — derrubar connection_limit junto mudaria
    // o comportamento por acidente.
    expect(r.searchParams.get("connection_limit")).toBe("1");
  });

  it("preserva credencial e banco ao trocar a porta", () => {
    const r = new URL(urlDeMigration(POOLER));
    expect(r.username).toBe("postgres.abc");
    expect(r.password).toBe("senha");
    expect(r.pathname).toBe("/postgres");
  });

  it("DIRECT_URL tem precedência sobre a derivação", () => {
    const direta = "postgresql://postgres:s@db.abc.supabase.co:5432/postgres";
    expect(urlDeMigration(POOLER, direta)).toBe(direta);
  });

  it("não mexe em URL que já é conexão direta", () => {
    const direta = "postgresql://postgres:s@db.abc.supabase.co:5432/postgres";
    expect(urlDeMigration(direta)).toBe(direta);
  });

  it("não mexe em banco local nem em outro provedor", () => {
    const local = "postgresql://postgres:postgres@localhost:5434/cosmos_dev";
    expect(urlDeMigration(local)).toBe(local);
    expect(urlDeMigration(BRANCH_NEON)).toBe(BRANCH_NEON);
  });

  it("devolve intacta a URL que nem parseia — o Prisma reclama, não este script", () => {
    expect(urlDeMigration("isto-nao-e-url")).toBe("isto-nao-e-url");
  });
});

describe("decidirMigration — produção", () => {
  it("migra", () => {
    expect(
      decidirMigration({ VERCEL_ENV: "production", DATABASE_URL: POOLER })
    ).toEqual({ acao: "migrar" });
  });

  it("derruba o build sem DATABASE_URL, em vez de publicar contra schema não verificado", () => {
    expect(decidirMigration({ VERCEL_ENV: "production" }).acao).toBe("falhar");
  });
});

describe("decidirMigration — preview do Dark Matter", () => {
  it("migra quando o host do DATABASE_URL é o do branch efêmero", () => {
    expect(
      decidirMigration({
        VERCEL_ENV: "preview",
        DATABASE_URL: BRANCH_NEON,
        DARK_MATTER_DB_HOST: HOST_BRANCH,
      })
    ).toEqual({ acao: "migrar" });
  });

  it("recusa quando o DATABASE_URL aponta para outro host — este é o guard que protege o banco compartilhado", () => {
    // Cenário real: a Vercel iniciou o build antes de a Action escrever as
    // vars do branch, então DATABASE_URL veio do valor global de preview.
    const d = decidirMigration({
      VERCEL_ENV: "preview",
      DATABASE_URL: POOLER,
      DARK_MATTER_DB_HOST: HOST_BRANCH,
    });
    expect(d.acao).toBe("pular");
  });

  it("recusa preview sem DARK_MATTER_DB_HOST — PR sem branch efêmero", () => {
    expect(
      decidirMigration({ VERCEL_ENV: "preview", DATABASE_URL: BRANCH_NEON })
        .acao
    ).toBe("pular");
  });

  it("recusa preview cujo DATABASE_URL não parseia — sem host, não há prova", () => {
    expect(
      decidirMigration({
        VERCEL_ENV: "preview",
        DATABASE_URL: "isto-nao-e-url",
        DARK_MATTER_DB_HOST: HOST_BRANCH,
      }).acao
    ).toBe("pular");
  });
});

describe("decidirMigration — fora da Vercel", () => {
  it("pula sem VERCEL_ENV, que é o caso do job de build do CI", () => {
    expect(
      decidirMigration({
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/cosmos",
      }).acao
    ).toBe("pular");
  });

  it("pula em development, mesmo com o sentinela setado", () => {
    expect(
      decidirMigration({
        VERCEL_ENV: "development",
        DATABASE_URL: BRANCH_NEON,
        DARK_MATTER_DB_HOST: HOST_BRANCH,
      }).acao
    ).toBe("pular");
  });
});
