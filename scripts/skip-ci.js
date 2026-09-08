// skip-ci.js — o `ignoreCommand` dos projetos Vercel.
//
// Semântica da Vercel, ao contrário do usual: **exit 0 pula o build**, exit 1
// manda buildar.
//
// Existe por causa de uma corrida. A Vercel dispara o build no instante do
// push, em paralelo com o workflow do Dark Matter — então o primeiro build de
// um PR novo leria o DATABASE_URL global de preview, e não o do branch
// efêmero daquele PR. Esse build é lixo: `deploy-migrations` recusa migrar
// (ver packages/database/scripts/migration-target.ts) e o preview sobe contra
// o banco errado. Pular ele deixa o redeploy disparado pelo workflow, já com
// as vars escritas, ser o único build que roda.
//
// Fail-safe é buildar. Sem `DARK_MATTER_ENABLED` no projeto, este arquivo não
// pula nada e o comportamento é o de sempre — um workflow quebrado não pode
// apagar o preview de todo mundo. Ligar por projeto: env var
// `DARK_MATTER_ENABLED=1`, target preview, no painel da Vercel.

const BUILDAR = 1;
const PULAR = 0;

function decidir() {
  if (!process.env.DARK_MATTER_ENABLED) {
    return {
      codigo: BUILDAR,
      motivo: "DARK_MATTER_ENABLED não está ligada neste projeto",
    };
  }

  if (process.env.VERCEL_ENV !== "preview") {
    return {
      codigo: BUILDAR,
      motivo: `VERCEL_ENV="${process.env.VERCEL_ENV ?? ""}" não é preview`,
    };
  }

  if (process.env.DARK_MATTER_DB_HOST) {
    return {
      codigo: BUILDAR,
      motivo: "branch efêmero já está ligado a este build",
    };
  }

  return {
    codigo: PULAR,
    motivo: "preview sem branch efêmero — aguardando o redeploy do Dark Matter",
  };
}

const { codigo, motivo } = decidir();
console.log(
  `skip-ci: ${codigo === PULAR ? "pulando" : "buildando"} — ${motivo}.`
);
process.exit(codigo);
