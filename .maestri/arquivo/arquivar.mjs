#!/usr/bin/env node
// Arquivo no Drive: tira do disco o que não precisa mais estar no contexto.
// 1. Transcrições do Claude Code (~/.claude/projects/<projeto>/*.jsonl) com mais de ARQUIVO_DIAS dias:
//    segredos redigidos, um .tar.gz por projeto e mês, enviado para <remoto>transcricoes/<projeto>/.
//    Só depois de o Drive confirmar o mesmo tamanho, os originais vão para a Lixeira (o CEO esvazia).
// 2. Espelho da memória: .maestri/memoria e os registros (aprendizado, concessões, sugestões) em <remoto>espelho/.
//    Continuam no disco: são contexto vivo dos agentes.
//   node .maestri/arquivo/arquivar.mjs [--seco]
// Remote (uma vez por máquina): rclone config create nebuloz-drive drive scope=drive \
//   root_folder_id=1X8KgX97-CiTl6VrtofwTyDwbAMVUHO1i config_refresh_token=false
// Saída para a rotina (--pre-run): sai 0 e imprime o relato só se algo falhou (acorda a Morgana); tudo certo, sai 1.
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { registrar } from "../registrar.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const REMOTO = process.env.ARQUIVO_REMOTO ?? "nebuloz-drive:";
// O Claude Code apaga transcrições com mais de 30 dias (cleanupPeriodDays). 21 + rotina semanal = arquiva antes.
const DIAS = Number(process.env.ARQUIVO_DIAS ?? 21);
const RAIZ = process.env.ARQUIVO_RAIZ ?? join(homedir(), ".claude", "projects");
const ESPELHO = [
  "memoria",
  "aprendizado.jsonl",
  "concessoes.jsonl",
  "sugestoes.md",
];

// ponytail: lista fixa dos formatos que já apareceram por aqui; segredo em formato novo passa. Adicione o padrão quando surgir.
const SEGREDOS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /\bvck_[A-Za-z0-9]{20,}/g,
  /\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}/g,
  /\bgh[pousr]_[A-Za-z0-9]{30,}/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bGOCSPX-[A-Za-z0-9_-]{20,}/g,
  /\bya29\.[A-Za-z0-9_-]{20,}/g,
];
const SENHA_EM_URL = /\b(postgres(?:ql)?:\/\/[^:\s/@]+:)[^@\s]+@/g;

export function redigir(texto) {
  let n = 0;
  let saida = texto;
  for (const re of SEGREDOS) {
    saida = saida.replace(re, () => {
      n += 1;
      return "[REDIGIDO]";
    });
  }
  saida = saida.replace(SENHA_EM_URL, (_, inicio) => {
    n += 1;
    return `${inicio}[REDIGIDO]@`;
  });
  return { texto: saida, n };
}

// ponytail: só os .jsonl da raiz do projeto; as pastas de sessão (subagentes, tool-results) ficam. Incluir se pesarem.
export function planejarTranscricoes(raiz, agora, dias) {
  const limite = agora - dias * 864e5;
  const grupos = new Map();
  for (const projeto of readdirSync(raiz, { withFileTypes: true })) {
    if (!projeto.isDirectory()) {
      continue;
    }
    for (const f of readdirSync(join(raiz, projeto.name), {
      withFileTypes: true,
    })) {
      if (!(f.isFile() && f.name.endsWith(".jsonl"))) {
        continue;
      }
      const caminho = join(raiz, projeto.name, f.name);
      const mtime = statSync(caminho).mtime;
      if (mtime >= limite) {
        continue;
      }
      const mes = mtime.toISOString().slice(0, 7);
      const chave = `${projeto.name}\t${mes}`;
      const g = grupos.get(chave) ?? {
        projeto: projeto.name,
        mes,
        arquivos: [],
      };
      g.arquivos.push(caminho);
      grupos.set(chave, g);
    }
  }
  return [...grupos.values()].sort(
    (a, b) => a.projeto.localeCompare(b.projeto) || a.mes.localeCompare(b.mes)
  );
}

export function conferido(tamanhoLocal, saidaLsjson) {
  try {
    return JSON.parse(saidaLsjson).Size === tamanhoLocal;
  } catch {
    return false;
  }
}

const rclone = (...args) =>
  execFileSync("rclone", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

function arquivarGrupo(g, carimbo) {
  const tmp = mkdtempSync(join(tmpdir(), "arquivar-"));
  try {
    const pasta = join(tmp, g.projeto);
    mkdirSync(pasta);
    let redigidos = 0;
    for (const f of g.arquivos) {
      const r = redigir(readFileSync(f, "utf8"));
      redigidos += r.n;
      writeFileSync(join(pasta, basename(f)), r.texto);
    }
    const tgz = join(tmp, "arquivo.tar.gz");
    // "./": os nomes de projeto começam com "-" e o tar os leria como opção.
    execFileSync("tar", ["-czf", tgz, "-C", tmp, `./${g.projeto}`]);
    const destino = `${REMOTO}transcricoes/${g.projeto}/${g.mes}-${carimbo}.tar.gz`;
    rclone("copyto", tgz, destino);
    if (!conferido(statSync(tgz).size, rclone("lsjson", "--stat", destino))) {
      throw new Error(`o Drive não confirmou o tamanho de ${destino}`);
    }
    // trash do macOS: a Lixeira de verdade, com "Pôr de volta"; o shell não tem permissão de escrever em ~/.Trash.
    execFileSync("/usr/bin/trash", g.arquivos);
    return `${destino}: ${g.arquivos.length} transcrições, ${redigidos} segredos redigidos`;
  } finally {
    // Só a cópia temporária (já redigida); os originais seguem para a Lixeira acima.
    rmSync(tmp, { recursive: true, force: true });
  }
}

function espelhar() {
  const base = join(AQUI, "..");
  for (const item of ESPELHO.map((i) => join(base, i)).filter(existsSync)) {
    const modo = statSync(item).isDirectory() ? "copy" : "copyto";
    rclone(modo, item, `${REMOTO}espelho/${basename(item)}`);
  }
}

function principal() {
  const seco = process.argv.includes("--seco");
  const plano = existsSync(RAIZ)
    ? planejarTranscricoes(RAIZ, new Date(), DIAS)
    : [];
  if (seco) {
    for (const g of plano) {
      console.log(`${g.projeto} ${g.mes}: ${g.arquivos.length} transcrições`);
    }
    return 1;
  }
  const carimbo = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
  const falhas = [];
  const feitos = [];
  for (const g of plano) {
    try {
      feitos.push(arquivarGrupo(g, carimbo));
    } catch (e) {
      falhas.push(
        `${g.projeto} ${g.mes}: ${e.stderr?.toString().trim() || e.message}`
      );
    }
  }
  try {
    espelhar();
  } catch (e) {
    falhas.push(`espelho: ${e.stderr?.toString().trim() || e.message}`);
  }
  console.error(feitos.join("\n") || "nada a arquivar");
  if (!falhas.length) {
    return 1;
  }
  registrar({
    agente: "Arquivo",
    tarefa: `arquivo semanal ${carimbo}`,
    veredito: "achado",
    causa: `envio ao Drive falhou (${falhas.length})`,
  });
  console.log(
    `Arquivo no Drive falhou; nada foi para a Lixeira nos itens abaixo.\n${falhas.join("\n")}`
  );
  return 0;
}

// Caminho real: /var → /private/var e links simbólicos fariam o script não rodar, calado.
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === realpathSync(process.argv[1])
) {
  process.exitCode = principal();
}
