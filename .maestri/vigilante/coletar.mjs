// Resumo determinístico do que aconteceu no Maestri, para o modelo local analisar.
// Só contagens e a primeira linha de cada erro: nada de conteúdo de arquivo sai daqui.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { repos } from "../jev.mjs";
import { ARQUIVO, CONCESSOES, concessoes, resumo } from "../registrar.mjs";

const SEP_CAMINHO = /[/.]/g;
const QUEBRA = /\s*\n\s*/;
const MAX_ERROS_POR_PAPEL = 3;
const MAX_TEXTO_ERRO = 110;

/** Claude Code guarda as sessões em ~/.claude/projects/<pasta com / e . trocados por ->. */
export const pastaDeSessoes = (dir, home = homedir()) =>
  join(home, ".claude", "projects", dir.replace(SEP_CAMINHO, "-"));

/** Papéis do Ground e dos andares: cada cópia de papel roda na própria pasta. */
export function papeis(ws) {
  const out = [];
  for (const repo of repos(ws)) {
    const dir = join(repo, ".maestri", "roles");
    if (!existsSync(dir)) {
      continue;
    }
    for (const id of readdirSync(dir)) {
      try {
        const { name } = JSON.parse(
          readFileSync(join(dir, id, "role.json"), "utf8")
        );
        out.push({
          nome: name,
          dir: join(dir, id),
          andar: repo === ws ? undefined : basename(repo),
        });
      } catch {
        // pasta sem role.json: não é papel
      }
    }
  }
  return out;
}

const textoDe = (c) => {
  if (typeof c === "string") {
    return c;
  }
  if (Array.isArray(c)) {
    return c.map((b) => (typeof b?.text === "string" ? b.text : "")).join("\n");
  }
  return "";
};

/** Erros de ferramenta na janela, agrupados pelas duas primeiras linhas. */
export function errosDeSessao(linhas, desde) {
  const grupos = new Map();
  let total = 0;
  for (const l of linhas) {
    let o;
    try {
      o = JSON.parse(l);
    } catch {
      continue;
    }
    if (
      !(Date.parse(o.timestamp) >= desde && Array.isArray(o.message?.content))
    ) {
      continue;
    }
    for (const b of o.message.content) {
      if (b?.type !== "tool_result" || !b.is_error) {
        continue;
      }
      total += 1;
      const chave = textoDe(b.content)
        .trim()
        .split(QUEBRA)
        .slice(0, 2)
        .join(" · ")
        .slice(0, MAX_TEXTO_ERRO);
      grupos.set(chave, (grupos.get(chave) ?? 0) + 1);
    }
  }
  const top = [...grupos]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_ERROS_POR_PAPEL);
  return { total, top };
}

function errosDoPapel(papel, desde) {
  const pasta = pastaDeSessoes(papel.dir);
  if (!existsSync(pasta)) {
    return { total: 0, top: [] };
  }
  const linhas = readdirSync(pasta)
    .filter(
      (f) => f.endsWith(".jsonl") && statSync(join(pasta, f)).mtimeMs >= desde
    )
    .flatMap((f) => readFileSync(join(pasta, f), "utf8").split("\n"));
  return errosDeSessao(linhas, desde);
}

const contarCommits = (repo, horas) =>
  execFileSync(
    "git",
    [
      "log",
      "--all",
      "--no-merges",
      `--since=${horas} hours ago`,
      "--format=%h",
    ],
    {
      cwd: repo,
      encoding: "utf8",
    }
  )
    .split("\n")
    .filter(Boolean).length;

export function montarResumo({
  vereditos,
  concessoes: ativas,
  commits,
  erros,
}) {
  const linhas = [
    "## Vereditos (7 dias)",
    vereditos || "nenhum registrado",
    "",
    "## Concessões ativas",
    ...(ativas.length ? ativas : ["nenhuma"]),
    "",
    `## Commits (24 h): ${commits.map(([onde, n]) => `${onde} ${n}`).join(" · ")}`,
    "",
    "## Erros de ferramenta por agente (24 h)",
    ...(erros.length
      ? erros.map(
          (e) =>
            `- ${e.nome}: ${e.total} erro(s) — ${e.top.map(([t, n]) => `${n}× ${t}`).join(" | ")}`
        )
      : ["nenhum"]),
  ];
  const texto = linhas.join("\n");
  return {
    texto,
    hash: createHash("sha256").update(texto).digest("hex").slice(0, 16),
  };
}

export function coletar(ws, agora = new Date(), horas = 24) {
  const desde = agora - horas * 36e5;
  const erros = papeis(ws)
    .map((p) => ({
      nome: p.andar ? `${p.nome} [andar ${p.andar}]` : p.nome,
      ...errosDoPapel(p, desde),
    }))
    .filter((e) => e.total > 0)
    .sort((a, b) => b.total - a.total);
  return montarResumo({
    vereditos: resumo(ARQUIVO, 7, agora).out,
    concessoes: concessoes(CONCESSOES, agora).map(
      (c) => `${c.de} → ${c.para} até ${c.ate}: ${c.escopo}`
    ),
    commits: repos(ws).map((r) => [
      r === ws ? "Ground" : basename(r),
      contarCommits(r, horas),
    ]),
    erros,
  });
}
