#!/usr/bin/env node
// Jev (TypeSafe System One) via Vercel AI Gateway, com retenção zero. Sem dependências.
// Uso: `node .maestri/jev.mjs triagem [desde]` no --pre-run de uma rotina do Maestri.
// Sai 1 quando não há nada para ninguém (a rotina é pulada, nenhum agente acorda);
// sai 0 com as linhas de roteamento no stdout, que entram no prompt via {{output}}.
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

const GATEWAY_URL = "https://ai-gateway.vercel.sh/v4/ai/evaluation-model";

// Uma pergunta por área para cada commit, todas de um lote numa chamada só (fan-out especulativo).
export const PERGUNTAS = {
  vigia:
    "altera autenticação, autorização, sessão ou isolamento entre tenants (requireTenantSession, requireRole, filtro por tenantId, RLS, acesso cross-tenant)",
  lacre:
    "passa a coletar, guardar, exportar ou compartilhar dado pessoal (nome, e-mail, CPF, telefone, gravação ou transcrição de reunião)",
};
const DONO = {
  vigia: "Vigia (recrute o Security Reviewer)",
  lacre: "Lacre (parecer de Compliance)",
};
// Schema é caminho de arquivo: decide o código, não o modelo.
const SCHEMA = /^packages\/database\/prisma\/schema\//;
// ponytail: limiares fixos; calibrar depois de uma semana de rotina olhando os incertos.
const LIMIAR = 0.7;
const INCERTO = 0.4;
const CONFIANCA = 0.5;
const MAX_DIFF = 2500;
const MAX_COMMITS = 40;
// Medido em 2026-09-23: sob a carga atual do Jev, lote de ~25k chars falha 3 em 5 e lotes em paralelo
// falham quase todos; ~12k em sequência, com nova tentativa, passa. Reavaliar quando o Jev folgar.
const MAX_LOTE = 12_000;
const TENTATIVAS = 3;

export async function ask(
  state,
  questions,
  { key = process.env.AI_GATEWAY_API_KEY, fetchImpl = fetch, espera = 800 } = {}
) {
  if (!key) {
    throw new Error("AI_GATEWAY_API_KEY ausente no ambiente");
  }
  const gatewayQuestions = Object.fromEntries(
    Object.entries(questions).map(([id, q]) => [
      id,
      q.type === "noul" ? { ...q, type: "boolean" } : q,
    ])
  );
  const pedir = () =>
    fetchImpl(GATEWAY_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
        "ai-gateway-protocol-version": "0.0.1",
        "ai-gateway-auth-method": "api-key",
        "ai-evaluation-model-specification-version": "4",
        "ai-model-id": "typesafe-ai/jev",
      },
      body: JSON.stringify({
        state,
        questions: gatewayQuestions,
        providerOptions: { gateway: { zeroDataRetention: true } },
      }),
      signal: AbortSignal.timeout(30_000),
    });
  let res;
  for (let i = 1; ; i++) {
    res = await pedir();
    // Só 429 e 5xx são passageiros; 4xx é pedido errado e não melhora repetindo.
    if (
      res.ok ||
      (res.status !== 429 && res.status < 500) ||
      i === TENTATIVAS
    ) {
      break;
    }
    await new Promise((r) => setTimeout(r, espera * 2 ** (i - 1)));
  }
  if (!res.ok) {
    throw new Error(
      `Gateway HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`
    );
  }
  const body = await res.json();
  const conf = body.providerMetadata?.typesafe?.confidence ?? {};
  return Object.fromEntries(
    Object.entries(body.answers ?? {}).map(([id, a]) => [
      id,
      { p: a.noul ?? a.probability, confidence: a.confidence ?? conf[id] },
    ])
  );
}

// Arquivo gerado não diz nada ao Jev e estoura o buffer (o graph.json tem MB).
const SEM_GERADOS = [
  ":(exclude).maestri/knowledge",
  ":(exclude)graphify-out",
  ":(exclude)pnpm-lock.yaml",
];
const gitRun = (args, cwd) =>
  execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });

/**
 * O Ground e os andares deste repo. Andar do Maestri é um clone completo, com .git próprio,
 * em <pai>/.maestri/floors/<repo>--<branch>: commit feito lá só aparece no Ground depois do land.
 */
export function repos(ws = process.env.MAESTRI_WORKSPACE_DIR || process.cwd()) {
  const dir = join(dirname(ws), ".maestri", "floors");
  const prefixo = `${basename(ws)}--`;
  let andares = [];
  try {
    andares = readdirSync(dir)
      .filter((n) => n.startsWith(prefixo))
      .map((n) => join(dir, n));
  } catch {
    // Sem pasta de andares: só o Ground.
  }
  return [ws, ...andares];
}

const logDe = (git, since, cwd) =>
  git(
    ["log", "--all", "--no-merges", `--since=${since}`, "--format=%h%x09%s"],
    cwd
  ).trim();

function lerCommit(git, cwd, { sha, subject, andar }) {
  const files = git(["show", "--name-only", "--format=", sha], cwd)
    .trim()
    .split("\n")
    .filter(Boolean);
  const diff = git(
    ["show", "--format=", "--unified=2", sha, "--", ".", ...SEM_GERADOS],
    cwd
  ).slice(0, MAX_DIFF);
  return { sha, subject, files, diff, ...(andar && { andar }) };
}

export function commits(since, git = gitRun, onde = repos()) {
  const vistos = new Set();
  const out = [];
  for (const cwd of onde) {
    const andar = cwd === onde[0] ? undefined : basename(cwd);
    for (const line of logDe(git, since, cwd).split("\n").filter(Boolean)) {
      const [sha, subject] = line.split("\t");
      // Commit já aterrissado aparece no Ground e no andar: conta uma vez, pelo Ground.
      if (vistos.has(sha) || out.length >= MAX_COMMITS) {
        continue;
      }
      vistos.add(sha);
      out.push(lerCommit(git, cwd, { sha, subject, andar }));
    }
  }
  return out;
}

/** Para o fechamento do dia: houve commit em algum repo (Ground ou andar) desde `since`? */
export function houveCommit(since, git = gitRun, onde = repos()) {
  return onde.some((cwd) => logDe(git, since, cwd) !== "");
}

/** Divide os commits em lotes que cabem numa chamada. */
export function lotes(cs, max = MAX_LOTE) {
  const out = [];
  let atual = [];
  for (const c of cs) {
    if (atual.length && JSON.stringify([...atual, c]).length > max) {
      out.push(atual);
      atual = [];
    }
    atual.push(c);
  }
  if (atual.length) {
    out.push(atual);
  }
  return out;
}

export function perguntas(cs) {
  return Object.fromEntries(
    cs.flatMap((c) =>
      Object.entries(PERGUNTAS).map(([area, texto]) => [
        `${area}_${c.sha}`,
        { type: "noul", instructions: `O commit ${c.sha} ${texto}` },
      ])
    )
  );
}

/** Roteamento por confiança: acima do limiar vai ao dono; zona incerta vai à Morgana decidir; resto some. */
function linhaDaArea(alvo, area, a) {
  if (typeof a?.p !== "number") {
    return null;
  }
  const conf = a.confidence ?? 1;
  const p = a.p.toFixed(2);
  if (a.p >= LIMIAR && conf >= CONFIANCA) {
    return `${alvo} → ${DONO[area]} (p=${p})`;
  }
  if (a.p >= INCERTO) {
    return `${alvo} → ${DONO[area]}? incerto (p=${p}, confiança=${conf.toFixed(2)}): decida`;
  }
  return null;
}

export function triar(cs, answers) {
  const linhas = [];
  for (const c of cs) {
    const alvo = `${c.sha}${c.andar ? ` [andar ${c.andar}]` : ""} "${c.subject}"`;
    for (const area of Object.keys(PERGUNTAS)) {
      const linha = linhaDaArea(alvo, area, answers[`${area}_${c.sha}`]);
      if (linha) {
        linhas.push(linha);
      }
    }
    if (c.files.some((f) => SCHEMA.test(f))) {
      linhas.push(
        `${alvo} → Pilar (mudou schema: Plataforma escreve, Infra aplica)`
      );
    }
  }
  return linhas;
}

export async function triagem(since = "65 minutes ago", deps = {}) {
  let cs;
  try {
    cs = commits(since, deps.git, deps.onde);
  } catch (e) {
    return {
      code: 0,
      out: `Triagem falhou ao ler o git (${e.message.split("\n")[0].slice(0, 120)}). Veja os commits da última hora à mão.`,
    };
  }
  if (!cs.length) {
    return { code: 1, out: "" };
  }
  let answers;
  try {
    answers = {};
    // Em sequência: em paralelo o Gateway recusa quase tudo (ver MAX_LOTE).
    for (const l of lotes(cs)) {
      Object.assign(
        answers,
        await ask({ repositorio: "Nebuloz", commits: l }, perguntas(l), deps)
      );
    }
  } catch (e) {
    // Falha aberta: sem Jev, a Morgana recebe a lista crua em vez de nada.
    const lista = cs.map((c) => `${c.sha} "${c.subject}"`).join("\n");
    return {
      code: 0,
      out: `Triagem Jev falhou (${e.message}). Commits sem triagem:\n${lista}`,
    };
  }
  const linhas = triar(cs, answers);
  if (!linhas.length) {
    return { code: 1, out: "" };
  }
  return {
    code: 0,
    out: `Triagem da última hora (Jev):\n${linhas.join("\n")}`,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [cmd, since] = process.argv.slice(2);
  if (cmd === "houve-commit") {
    process.exit(houveCommit(since ?? "midnight") ? 0 : 1);
  }
  if (cmd !== "triagem") {
    console.error(
      "uso: node .maestri/jev.mjs triagem [desde] | houve-commit [desde]"
    );
    process.exit(2);
  }
  const { code, out } = await triagem(since);
  if (out) {
    console.log(out);
  }
  process.exit(code);
}
