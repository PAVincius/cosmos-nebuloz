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

if (!process.env.DATABASE_URL) {
  // Build sem banco configurado não deve quebrar por causa deste script —
  // mas nenhuma migration foi aplicada, e isso precisa ficar visível no log.
  console.warn(
    "deploy-migrations: DATABASE_URL ausente em produção — pulando prisma migrate deploy. Nenhuma migration foi aplicada."
  );
  process.exit(0);
}

// A partir daqui: produção, com banco configurado. Falha de migration DEVE
// derrubar o build — deixar o deploy seguir com `migrate deploy` falhando
// reproduziria exatamente o incidente que motivou este script (código novo
// contra schema velho). Por isso o código de saída é propagado sem tratamento
// de erro que o esconda.
const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
});

if (result.error) {
  console.error(
    `deploy-migrations: falha ao executar prisma migrate deploy: ${result.error.message}`
  );
  process.exit(1);
}

process.exit(result.status ?? 1);
