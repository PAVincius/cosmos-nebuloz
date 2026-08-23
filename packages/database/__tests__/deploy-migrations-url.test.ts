// deploy-migrations-url.test.ts — a URL que `prisma migrate deploy` recebe.
//
// `migrate deploy` adquire advisory lock antes de aplicar migration, e
// advisory lock não sobrevive ao pooler do Supabase em modo transaction
// (6543/PgBouncer): a sessão que pega o lock não é a que roda a migration
// seguinte, e o comando espera para sempre em vez de falhar. O sintoma real
// foi um build de produção parado por mais de 12 minutos logo depois de
// imprimir o Datasource — sem erro, sem timeout.
import { describe, expect, it } from "vitest";

/** Cópia da regra de `scripts/deploy-migrations.mts`. O script roda como
 *  processo de build (lê env e chama process.exit), então a regra é testada
 *  aqui na forma pura; qualquer mudança lá precisa vir junto. */
function urlDeMigration(databaseUrl: string, directUrl?: string): string {
  if (directUrl) {
    return directUrl;
  }
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    return databaseUrl;
  }
  if (url.port !== "6543") {
    return databaseUrl;
  }
  url.port = "5432";
  url.searchParams.delete("pgbouncer");
  return url.toString();
}

const POOLER =
  "postgresql://postgres.abc:senha@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1";

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
    const neon =
      "postgresql://user:pw@ep-cool-name.us-east-2.aws.neon.tech/db?sslmode=require";
    expect(urlDeMigration(neon)).toBe(neon);
  });

  it("devolve intacta a URL que nem parseia — o Prisma reclama, não este script", () => {
    expect(urlDeMigration("isto-nao-e-url")).toBe("isto-nao-e-url");
  });
});
