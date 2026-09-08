// dark-matter.mts — ambiente efêmero por PR.
//
// `up`   cria (ou reaproveita) o branch Neon do PR e escreve as env vars
//        escopadas ao git branch nos projetos da Vercel.
// `down` apaga as duas coisas.
//
// Por que aqui e não no YAML: a mesma lógica é usada pelo teardown e, depois,
// pelo reaper noturno. Neon e Vercel são REST puro sobre o `fetch` global —
// nenhuma dependência nova.
//
//   pnpm dark-matter up       --pr 123 --branch feat/x
//   pnpm dark-matter redeploy --pr 123 --branch feat/x --sha <commit>
//   pnpm dark-matter down     --pr 123 --branch feat/x
//   pnpm dark-matter reap     [--dry-run] [--idade 7] [--limite 20]
//
// Env obrigatórias: NEON_API_KEY, NEON_PROJECT_ID, VERCEL_TOKEN,
// VERCEL_TEAM_ID, VERCEL_PROJECT_IDS (ids separados por vírgula).
// Opcional: NEON_PARENT_BRANCH_ID (default: branch padrão do projeto).
// `reap` também usa GITHUB_TOKEN e GITHUB_REPOSITORY.
import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { setTimeout as esperar } from "node:timers/promises";

const NEON_API = "https://console.neon.tech/api/v2";
const GITHUB_API = "https://api.github.com";
const VERCEL_API = "https://api.vercel.com";

/** Vars escritas juntas, no mesmo git branch. `DARK_MATTER_DB_HOST` é a
 *  prova que `decidirMigration` exige antes de deixar um preview migrar —
 *  ver packages/database/scripts/migration-target.ts. */
type VarsDoBranch = {
  DATABASE_URL: string;
  DIRECT_URL: string;
  DARK_MATTER_DB_HOST: string;
};

function exigir(nome: string): string {
  const valor = process.env[nome];
  if (!valor) {
    throw new Error(`${nome} não está definida.`);
  }
  return valor;
}

function argumento(nome: string): string | undefined {
  const i = process.argv.indexOf(`--${nome}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function chamar(
  url: string,
  init: RequestInit & { token: string },
  aceitar404 = false
): Promise<unknown> {
  const { token, ...resto } = init;
  const resposta = await fetch(url, {
    ...resto,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...resto.headers,
    },
  });
  if (resposta.status === 404 && aceitar404) {
    return null;
  }
  if (!resposta.ok) {
    // O corpo do erro não carrega segredo — a URL e o método, sim, então só
    // o corpo entra no log.
    throw new Error(
      `${resto.method ?? "GET"} ${new URL(url).pathname} → ${resposta.status}: ${await resposta.text()}`
    );
  }
  return resposta.status === 204 ? null : await resposta.json();
}

const neon = (caminho: string, init: RequestInit = {}, aceitar404 = false) =>
  chamar(
    `${NEON_API}${caminho}`,
    { ...init, token: exigir("NEON_API_KEY") },
    aceitar404
  );

const vercel = (caminho: string, init: RequestInit = {}, aceitar404 = false) =>
  chamar(
    `${VERCEL_API}${caminho}${caminho.includes("?") ? "&" : "?"}teamId=${exigir("VERCEL_TEAM_ID")}`,
    { ...init, token: exigir("VERCEL_TOKEN") },
    aceitar404
  );

const github = (caminho: string, aceitar404 = false) =>
  chamar(
    `${GITHUB_API}/repos/${exigir("GITHUB_REPOSITORY")}${caminho}`,
    {
      token: exigir("GITHUB_TOKEN"),
      headers: { Accept: "application/vnd.github+json" },
    },
    aceitar404
  );

/** `pr-<numero>`, e não o nome do git branch: nomes de branch aqui têm barra,
 *  podem ser renomeados, e o número do PR está em todo evento do GitHub. */
const nomeDoBranch = (pr: string) => `pr-${pr}`;

type BranchNeon = { id: string; name: string; updated_at?: string };

async function listarBranches(): Promise<BranchNeon[]> {
  const projeto = exigir("NEON_PROJECT_ID");
  const r = (await neon(`/projects/${projeto}/branches`)) as {
    branches: BranchNeon[];
  };
  return r.branches;
}

/** Idempotente: `synchronize` cai aqui a cada push e não pode recriar nada —
 *  o banco não mudou, e recriar apagaria o que o reviewer digitou à mão. */
async function garantirBranch(pr: string): Promise<BranchNeon> {
  const projeto = exigir("NEON_PROJECT_ID");
  const nome = nomeDoBranch(pr);

  const existente = (await listarBranches()).find((b) => b.name === nome);
  if (existente) {
    console.log(`dark-matter: branch ${nome} já existe (${existente.id}).`);
    return existente;
  }

  const criado = (await neon(`/projects/${projeto}/branches`, {
    method: "POST",
    body: JSON.stringify({
      branch: {
        name: nome,
        ...(process.env.NEON_PARENT_BRANCH_ID
          ? { parent_id: process.env.NEON_PARENT_BRANCH_ID }
          : {}),
      },
      endpoints: [{ type: "read_write" }],
    }),
  })) as { branch: BranchNeon };

  console.log(`dark-matter: branch ${nome} criado (${criado.branch.id}).`);
  return criado.branch;
}

/** As URLs vêm da própria API para não montar connection string na mão —
 *  host, role e senha do branch são dela, não nossos. */
async function urlsDoBranch(branchId: string): Promise<VarsDoBranch> {
  const projeto = exigir("NEON_PROJECT_ID");

  const { databases } = (await neon(
    `/projects/${projeto}/branches/${branchId}/databases`
  )) as { databases: { name: string; owner_name: string }[] };
  const banco = databases[0];
  if (!banco) {
    throw new Error(`branch ${branchId} não tem banco algum.`);
  }

  const uri = async (pooled: boolean) => {
    const r = (await neon(
      `/projects/${projeto}/connection_uri?branch_id=${branchId}&database_name=${encodeURIComponent(banco.name)}&role_name=${encodeURIComponent(banco.owner_name)}&pooled=${pooled}`
    )) as { uri: string };
    return r.uri;
  };

  const direta = await uri(false);
  return {
    // Runtime: packages/database/index.ts fareja "neon.tech" e usa o adapter Neon.
    DATABASE_URL: await uri(true),
    // Migration: advisory lock não sobrevive ao pooler.
    DIRECT_URL: direta,
    DARK_MATTER_DB_HOST: new URL(direta).hostname,
  };
}

const projetosVercel = () =>
  exigir("VERCEL_PROJECT_IDS")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

async function escreverEnvVars(
  gitBranch: string,
  vars: VarsDoBranch,
  pr: string
) {
  const corpo = Object.entries(vars).map(([key, value]) => ({
    key,
    value,
    type: "encrypted",
    target: ["preview"],
    gitBranch,
    comment: `dark-matter ${nomeDoBranch(pr)}`,
  }));

  for (const projeto of projetosVercel()) {
    await vercel(`/v10/projects/${projeto}/env?upsert=true`, {
      method: "POST",
      body: JSON.stringify(corpo),
    });
    console.log(`dark-matter: env vars escritas em ${projeto} (${gitBranch}).`);
  }
}

async function apagarEnvVars(gitBranch: string) {
  for (const projeto of projetosVercel()) {
    const r = (await vercel(`/v9/projects/${projeto}/env`)) as {
      envs: { id: string; key: string; gitBranch?: string }[];
    };
    const doBranch = r.envs.filter((e) => e.gitBranch === gitBranch);
    for (const env of doBranch) {
      await vercel(
        `/v9/projects/${projeto}/env/${env.id}`,
        { method: "DELETE" },
        true
      );
    }
    console.log(
      `dark-matter: ${doBranch.length} env vars removidas de ${projeto} (${gitBranch}).`
    );
  }
}

async function apagarBranch(pr: string) {
  const projeto = exigir("NEON_PROJECT_ID");
  const nome = nomeDoBranch(pr);
  const branch = (await listarBranches()).find((b) => b.name === nome);
  if (!branch) {
    console.log(`dark-matter: branch ${nome} não existe — nada a apagar.`);
    return;
  }
  await neon(
    `/projects/${projeto}/branches/${branch.id}`,
    { method: "DELETE" },
    true
  );
  console.log(`dark-matter: branch ${nome} apagado.`);
}

/**
 * Refaz o build de preview do commit para ele enxergar as env vars novas.
 *
 * A Vercel dispara o build no instante do push, em paralelo com esta Action:
 * o primeiro build de um PR novo lê o `DATABASE_URL` global de preview, não o
 * do branch. Custa um build desperdiçado por PR aberto — o preço de v0 por
 * não ter ainda o `ignoreCommand` que faria o build automático se pular.
 *
 * O deployment pode ainda não existir quando chegamos aqui (a corrida corre
 * para os dois lados), daí a espera.
 */
async function redeployar(sha: string) {
  for (const projeto of projetosVercel()) {
    let alvo: string | undefined;

    for (let tentativa = 0; tentativa < 10 && !alvo; tentativa++) {
      const r = (await vercel(
        `/v6/deployments?projectId=${projeto}&target=preview&limit=20`
      )) as { deployments: { url: string; meta?: Record<string, string> }[] };
      alvo = r.deployments.find((d) => d.meta?.githubCommitSha === sha)?.url;
      if (!alvo) {
        await esperar(15_000);
      }
    }

    if (!alvo) {
      console.log(
        `dark-matter: nenhum deployment de ${sha.slice(0, 7)} em ${projeto} — o próximo push pega as vars.`
      );
      continue;
    }

    // `vercel redeploy` em vez da API crua: o corpo do POST de redeploy é
    // detalhe interno do CLI, e ele já resolve.
    const r = spawnSync(
      "npx",
      [
        "--yes",
        "vercel",
        "redeploy",
        alvo,
        `--token=${exigir("VERCEL_TOKEN")}`,
        `--scope=${exigir("VERCEL_TEAM_ID")}`,
      ],
      { stdio: "inherit" }
    );
    if (r.status !== 0) {
      throw new Error(`vercel redeploy falhou em ${projeto} (${alvo}).`);
    }
  }
}

/** O git branch só é conhecido pelo GitHub; sem ele não dá para achar as env
 *  vars. PR apagado de vez (404) deixa o branch Neon ser removido mesmo
 *  assim — vazar banco é pior que vazar env var. */
async function apagarOrfao(pr: number) {
  const detalhe = (await github(`/pulls/${pr}`, true)) as {
    head?: { ref: string };
  } | null;
  if (detalhe?.head?.ref) {
    await apagarEnvVars(detalhe.head.ref);
  } else {
    console.log(
      `dark-matter: PR #${pr} não encontrado — env vars ficam para trás.`
    );
  }
  await apagarBranch(String(pr));
}

function publicarResumo(total: number, linhas: string[]) {
  const resumo = [
    "## Dark Matter — reaper",
    "",
    `${total} branches efêmeros, ${linhas.length} órfãos.`,
    "",
    ...(linhas.length > 0 ? linhas : ["Nada a limpar."]),
  ].join("\n");
  console.log(resumo);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${resumo}\n`);
  }
}

const DIA_EM_MS = 24 * 60 * 60 * 1000;
const NOME_EFEMERO = /^pr-\d+$/;

/**
 * Varre branches órfãos.
 *
 * O handler de `closed` é a primeira garantia, e uma hora ele falha — job
 * cancelado, token expirado, evento perdido. Branch órfão não dá erro: dá
 * conta no fim do mês e, antes disso, estoura a cota de branches do projeto
 * Neon, que é o limite que morde de verdade (storage é copy-on-write).
 *
 * Dois critérios, porque o primeiro não pega tudo: PR fechado (o que o
 * handler deveria ter limpado) e PR aberto mas parado há dias (que o handler
 * estruturalmente nunca pega, porque não houve evento).
 */
async function reap(opcoes: {
  dryRun: boolean;
  idadeDias: number;
  limite: number;
}) {
  const branches = (await listarBranches()).filter((b) =>
    NOME_EFEMERO.test(b.name)
  );

  const pagina = (await github("/pulls?state=open&per_page=100")) as {
    number: number;
  }[];
  const abertos = new Set(pagina.map((pr) => pr.number));

  // Uma página cheia significa que existem PRs abertos que não vimos — e
  // "não está na lista" passaria a significar "apague", em cima de branch
  // vivo. Sem paginação, o critério de PR fechado deixa de valer; o de
  // inatividade continua, porque não depende da lista.
  const listaCompleta = pagina.length < 100;
  if (!listaCompleta) {
    console.log(
      "dark-matter: mais de 100 PRs abertos — reaper só considera inatividade nesta rodada."
    );
  }

  const limiteDeIdade = Date.now() - opcoes.idadeDias * DIA_EM_MS;
  const linhas: string[] = [];

  for (const branch of branches) {
    const pr = Number(branch.name.slice(3));
    const parado =
      branch.updated_at !== undefined &&
      Date.parse(branch.updated_at) < limiteDeIdade;
    const fechado = listaCompleta && !abertos.has(pr);

    if (!(fechado || parado)) {
      continue;
    }

    const motivo = fechado
      ? "PR fechado"
      : `sem atividade há mais de ${opcoes.idadeDias} dias`;
    linhas.push(
      `- \`${branch.name}\` — ${motivo}${opcoes.dryRun ? " (dry-run)" : ""}`
    );
    console.log(`dark-matter: ${branch.name} órfão (${motivo}).`);

    if (!opcoes.dryRun) {
      await apagarOrfao(pr);
    }
  }

  publicarResumo(branches.length, linhas);

  // Falhar aqui é o que faz a cota aparecer antes de ser atingida: um teto
  // silencioso vira PR que não provisiona, e ninguém liga uma coisa na outra.
  const restantes = branches.length - (opcoes.dryRun ? 0 : linhas.length);
  if (restantes > opcoes.limite) {
    throw new Error(
      `${restantes} branches efêmeros vivos, acima do limite de ${opcoes.limite}. Cota do Neon em risco.`
    );
  }
}

/** O workflow consome isto nos steps seguintes (migrate, seed, redeploy). */
function publicarSaidas(vars: VarsDoBranch) {
  const arquivo = process.env.GITHUB_OUTPUT;
  if (!arquivo) {
    return;
  }
  appendFileSync(
    arquivo,
    `database_url=${vars.DATABASE_URL}\ndirect_url=${vars.DIRECT_URL}\ndb_host=${vars.DARK_MATTER_DB_HOST}\n`
  );
}

async function main() {
  const comando = process.argv[2];
  const pr = argumento("pr");
  const gitBranch = argumento("branch");

  if (comando === "reap") {
    await reap({
      dryRun: process.argv.includes("--dry-run"),
      idadeDias: Number(argumento("idade") ?? 7),
      limite: Number(argumento("limite") ?? 20),
    });
    return;
  }

  if (!(comando && pr && gitBranch)) {
    console.error(
      "uso: dark-matter <up|redeploy|down> --pr <numero> --branch <ref> | reap [--dry-run]"
    );
    process.exit(2);
  }

  if (comando === "up") {
    const branch = await garantirBranch(pr);
    const vars = await urlsDoBranch(branch.id);
    // Escreve as vars ANTES de migrar: um build concorrente da Vercel não
    // pode ganhar a corrida com o valor antigo.
    await escreverEnvVars(gitBranch, vars, pr);
    publicarSaidas(vars);
    return;
  }

  if (comando === "redeploy") {
    const sha = argumento("sha");
    if (!sha) {
      console.error("redeploy exige --sha <commit>");
      process.exit(2);
    }
    await redeployar(sha);
    return;
  }

  if (comando === "down") {
    // Os dois lados toleram ausência, então rodar duas vezes não quebra.
    await apagarEnvVars(gitBranch);
    await apagarBranch(pr);
    return;
  }

  console.error(`comando desconhecido: ${comando}`);
  process.exit(2);
}

main().catch((erro: unknown) => {
  console.error(`dark-matter: ${erro instanceof Error ? erro.message : erro}`);
  process.exit(1);
});
