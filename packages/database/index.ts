import "server-only";

import { PrismaClient } from "./generated/client";
import { keys } from "./keys";

const globalForPrisma = global as unknown as {
  prisma_cosmos_v10: PrismaClient;
};

const DATABASE_URL = keys().DATABASE_URL;

/** Remove `sslmode` da connection string.
 *
 *  O `pg` lê esse parâmetro da própria URL e sobrepõe o objeto `ssl` montado
 *  abaixo — com `sslmode=require` ele volta a exigir validação da cadeia e a
 *  primeira consulta morre em "self-signed certificate in certificate chain",
 *  que chega no usuário como 500 no login. Quem manda no TLS aqui é o objeto
 *  `ssl`, não a env: assim o valor cadastrado no painel não derruba produção.
 */
function withoutSslMode(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete("sslmode");
    return parsed.toString();
  } catch {
    // URL malformada: devolve como veio e deixa o `pg` reclamar com a mensagem dele.
    return url;
  }
}

function createPrismaClient(): PrismaClient {
  const isNeon =
    DATABASE_URL.includes("neon.tech") ||
    DATABASE_URL.includes("neon.database.azure.com");

  if (isNeon) {
    const { neonConfig } = require("@neondatabase/serverless");
    const { PrismaNeon } = require("@prisma/adapter-neon");
    const ws = require("ws");
    neonConfig.webSocketConstructor = ws;
    const adapter = new PrismaNeon({ connectionString: DATABASE_URL });
    return new PrismaClient({ adapter });
  }

  // Local/managed Postgres — pg driver adapter (Prisma v7 client engine).
  // Managed poolers (Supabase's Supavisor/PgBouncer, etc.) present a cert
  // chain Node's default trust store doesn't carry, so plain TLS validation
  // fails with "self-signed certificate in certificate chain". A local
  // Postgres (CI service container, `localhost`) has no TLS at all — passing
  // an `ssl` object there breaks the handshake instead of fixing it.
  const { Pool } = require("pg");
  const { PrismaPg } = require("@prisma/adapter-pg");
  const isLocalDb = /localhost|127\.0\.0\.1/.test(DATABASE_URL);
  const pool = new Pool({
    // Sem `max`, o `pg` usa 10 conexões por pool. Na Vercel cada instância de
    // função tem o próprio pool, então o total é `instâncias × 10` — e sob
    // carga o número de instâncias é a variável que ninguém controla. É assim
    // que se esgota o pooler do Supabase sem nenhuma query lenta.
    //
    // 5 e não 1: as leituras do painel usam `Promise.all` com três consultas
    // em paralelo, e um pool de 1 as serializaria — trocaria esgotamento por
    // latência, que é o mesmo problema com outra cara.
    max: 5,
    // Sem isto, requisição que não acha conexão livre espera para sempre.
    // Esgotamento de pool vira requisição pendurada em vez de erro, e
    // pendurado não aparece em taxa de erro — só em usuário desistindo.
    connectionTimeoutMillis: 10_000,
    connectionString: isLocalDb ? DATABASE_URL : withoutSslMode(DATABASE_URL),
    ssl: isLocalDb ? undefined : { rejectUnauthorized: false },
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const database =
  globalForPrisma.prisma_cosmos_v10 || createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma_cosmos_v10 = database;
}

// TODO(NEB-115): Prevent auditLog.update/delete at the Prisma client layer via $extends
// so that application code gets a type error if it attempts mutation on AuditLog.
// The database trigger (migration 20260603000002_audit_log_immutable_trigger) already
// blocks it at the DB level; the $extends guard adds a second layer and surfaces errors
// earlier (compile-time). Do NOT add this extension until the trigger is deployed and
// integration-tested against the staging DB.

export * from "./generated/client";
export { withTenantDb } from "./tenant-db";
export * from "./vector-search";
