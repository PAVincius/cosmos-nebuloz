// deploy-migrations.mts — aplica `prisma migrate deploy` nos builds da Vercel.
//
// Motivo: nada no pipeline de deploy rodava migrations. O deploy da Vercel
// só executa `turbo build`, que aqui reduzia a `prisma generate --no-hints`
// — nunca `migrate deploy`. Código novo subia contra schema velho e quebrava
// em produção com P2022 ColumnNotFound (produção ficou dias com 85 de 93
// migrations aplicadas antes disso ser notado). Este script fecha o buraco:
// ligado ao "build" de @repo/database, roda em todo deploy.
//
// Preview migrava nada antes do Dark Matter, porque preview e produção
// compartilhavam DATABASE_URL e um PR migraria o banco de produção. Com o
// branch Neon por PR isso deixa de valer, mas a permissão continua sendo
// concedida por prova positiva, nunca por ausência de sinal — ver
// `decidirMigration` em ./migration-target.ts.
import { spawnSync } from "node:child_process";
import { decidirMigration, urlDeMigration } from "./migration-target.ts";

const decisao = decidirMigration({
  VERCEL_ENV: process.env.VERCEL_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  DARK_MATTER_DB_HOST: process.env.DARK_MATTER_DB_HOST,
});

if (decisao.acao === "pular") {
  console.log(
    `deploy-migrations: ${decisao.motivo} Pulando prisma migrate deploy.`
  );
  process.exit(0);
}

if (decisao.acao === "falhar") {
  console.error(`deploy-migrations: ${decisao.motivo}`);
  process.exit(1);
}

// `decidirMigration` só devolve "migrar" com DATABASE_URL presente.
const databaseUrl = process.env.DATABASE_URL as string;
const migrateUrl = urlDeMigration(databaseUrl, process.env.DIRECT_URL);

if (migrateUrl !== databaseUrl) {
  console.log(
    "deploy-migrations: usando conexão de sessão para as migrations — o pooler em modo transaction trava no advisory lock do migrate deploy."
  );
}

// Falha de migration DEVE derrubar o build — deixar o deploy seguir com
// `migrate deploy` falhando reproduziria exatamente o incidente que motivou
// este script (código novo contra schema velho). Por isso o código de saída é
// propagado sem tratamento de erro que o esconda.
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
