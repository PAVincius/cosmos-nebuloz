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
