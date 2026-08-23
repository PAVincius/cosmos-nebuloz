// deploy-migrations.mts — aplica `prisma migrate deploy` no build de
// produção da Vercel.
//
// Motivo: nada no pipeline de deploy rodava migrations. O deploy da Vercel
// só executa `turbo build`, que aqui reduzia a `prisma generate --no-hints`
// — nunca `migrate deploy`. Código novo subia contra schema velho e quebrava
// em produção com P2022 ColumnNotFound (produção ficou dias com 85 de 93
// migrations aplicadas antes disso ser notado). Este script fecha o buraco:
// ligado ao "build" de @repo/database, roda em todo deploy.
//
// Guarda de ambiente: só age quando VERCEL_ENV === "production". Preview e
// desenvolvimento NUNCA podem migrar — preview e produção compartilham
// DATABASE_URL, então um preview de PR rodando migrate deploy migraria o
// banco de produção. Isso seria pior que o incidente que este script resolve.
import { spawnSync } from "node:child_process";

if (process.env.VERCEL_ENV !== "production") {
  console.log(
    `deploy-migrations: VERCEL_ENV="${process.env.VERCEL_ENV ?? ""}" não é "production" — pulando prisma migrate deploy.`
  );
  process.exit(0);
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  // Falha proposital, e não um aviso. Build de produção sem DATABASE_URL
  // significa que nenhuma migration pode ser aplicada — e seguir assim
  // publicaria código novo contra um schema possivelmente velho, que é o
  // incidente inteiro que este script existe para impedir. Sair com 0 aqui
  // deixaria o pipeline decorativo: verde, silencioso e sem efeito.
  // Se este erro aparecer, o conserto é configurar DATABASE_URL no ambiente
  // de produção da Vercel — não afrouxar esta verificação.
  console.error(
    "deploy-migrations: DATABASE_URL ausente no build de produção. Nenhuma migration pode ser aplicada — derrubando o build em vez de publicar contra schema não verificado."
  );
  process.exit(1);
}

/**
 * URL que as migrations devem usar.
 *
 * `migrate deploy` adquire um advisory lock antes de aplicar qualquer
 * migration, e advisory lock não sobrevive ao pooler do Supabase em modo
 * transaction (porta 6543, PgBouncer): a sessão que pega o lock não é a
 * mesma que roda a migration seguinte, então o comando fica esperando para
 * sempre em vez de falhar. O sintoma é um build que passa de 90s para
 * dezenas de minutos parado logo depois de imprimir o Datasource.
 *
 * `DIRECT_URL` tem precedência quando existir. Sem ela, a porta 6543 é
 * trocada por 5432 — o mesmo host do pooler expõe o modo session ali, que
 * mantém a conexão dedicada e por isso suporta o lock. `pgbouncer=true` sai
 * junto: em session mode ele não se aplica.
 *
 * Qualquer outra forma de URL passa intacta — banco direto, Neon, local.
 */
function urlDeMigration(databaseUrl: string): string {
  if (process.env.DIRECT_URL) {
    return process.env.DIRECT_URL;
  }
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    // Sem parse, não há o que derivar — deixa o Prisma reclamar da URL.
    return databaseUrl;
  }
  if (url.port !== "6543") {
    return databaseUrl;
  }
  url.port = "5432";
  url.searchParams.delete("pgbouncer");
  return url.toString();
}

const migrateUrl = urlDeMigration(databaseUrl);
if (migrateUrl !== databaseUrl) {
  console.log(
    "deploy-migrations: usando conexão de sessão (5432) para as migrations — o pooler em modo transaction trava no advisory lock do migrate deploy."
  );
}

// A partir daqui: produção, com banco configurado. Falha de migration DEVE
// derrubar o build — deixar o deploy seguir com `migrate deploy` falhando
// reproduziria exatamente o incidente que motivou este script (código novo
// contra schema velho). Por isso o código de saída é propagado sem tratamento
// de erro que o esconda.
const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: migrateUrl },
});

if (result.error) {
  console.error(
    `deploy-migrations: falha ao executar prisma migrate deploy: ${result.error.message}`
  );
  process.exit(1);
}

process.exit(result.status ?? 1);
