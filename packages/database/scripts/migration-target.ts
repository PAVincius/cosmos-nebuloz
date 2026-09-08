// migration-target.ts — as duas regras que decidem se `prisma migrate deploy`
// roda, e contra qual URL.
//
// Vive fora de `deploy-migrations.mts` porque aquele arquivo é um processo de
// build: lê env e chama `process.exit`. Aqui as regras são funções puras, o
// script vira invólucro fino, e o teste exercita a regra de verdade em vez de
// uma cópia dela.

export type Decisao =
  | { acao: "migrar" }
  | { acao: "pular"; motivo: string }
  | { acao: "falhar"; motivo: string };

type Ambiente = {
  VERCEL_ENV?: string;
  DATABASE_URL?: string;
  DARK_MATTER_DB_HOST?: string;
};

/**
 * Decide se este build pode aplicar migrations.
 *
 * Duas rotas, ambas afirmativas — nunca por negação. Produção migra porque é
 * produção. Preview migra somente com prova de que o `DATABASE_URL` que
 * recebeu é o branch efêmero daquele PR: `DARK_MATTER_DB_HOST` é escrito na
 * mesma chamada de API que o `DATABASE_URL`, escopado ao git branch, e as
 * duas vars só batem quando a Vercel resolveu o par correto.
 *
 * Se qualquer coisa der errado — corrida com o build automático, var
 * apagada, redeploy de commit antigo, branch errado — os hostnames divergem
 * e o resultado é `pular`. Não existe configuração que faça um preview
 * migrar o banco compartilhado em silêncio.
 */
export function decidirMigration(env: Ambiente): Decisao {
  const { VERCEL_ENV, DATABASE_URL, DARK_MATTER_DB_HOST } = env;

  if (VERCEL_ENV === "production") {
    if (!DATABASE_URL) {
      // Falha proposital, e não um aviso. Build de produção sem DATABASE_URL
      // significa que nenhuma migration pode ser aplicada — e seguir assim
      // publicaria código novo contra um schema possivelmente velho, que é o
      // incidente inteiro que este script existe para impedir.
      return {
        acao: "falhar",
        motivo:
          "DATABASE_URL ausente no build de produção. Nenhuma migration pode ser aplicada — derrubando o build em vez de publicar contra schema não verificado.",
      };
    }
    return { acao: "migrar" };
  }

  if (VERCEL_ENV !== "preview") {
    return {
      acao: "pular",
      motivo: `VERCEL_ENV="${VERCEL_ENV ?? ""}" não é "production" nem "preview".`,
    };
  }

  if (!(DARK_MATTER_DB_HOST && DATABASE_URL)) {
    return {
      acao: "pular",
      motivo:
        "preview sem par DARK_MATTER_DB_HOST + DATABASE_URL — este PR não tem branch efêmero do Dark Matter.",
    };
  }

  let host: string;
  try {
    host = new URL(DATABASE_URL).hostname;
  } catch {
    return {
      acao: "pular",
      motivo:
        "preview com DATABASE_URL que não parseia — sem host, não há prova.",
    };
  }

  if (host !== DARK_MATTER_DB_HOST) {
    return {
      acao: "pular",
      motivo: `preview cujo DATABASE_URL aponta para "${host}", e não para o branch efêmero "${DARK_MATTER_DB_HOST}" — recusando para não migrar banco compartilhado.`,
    };
  }

  return { acao: "migrar" };
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
 * `DIRECT_URL` tem precedência quando existir — é por onde o Dark Matter
 * passa a URL sem pooler do branch Neon. Sem ela, a porta 6543 é trocada por
 * 5432: o mesmo host do pooler expõe o modo session ali, que mantém a
 * conexão dedicada e por isso suporta o lock. `pgbouncer=true` sai junto: em
 * session mode ele não se aplica.
 *
 * Qualquer outra forma de URL passa intacta — banco direto, Neon, local.
 */
export function urlDeMigration(
  databaseUrl: string,
  directUrl?: string
): string {
  if (directUrl) {
    return directUrl;
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
