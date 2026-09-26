#!/usr/bin/env node
// Vigilante: terminal do Maestri que lê os registros do sistema e sugere evoluções com o modelo local.
// A cada rodada, coleta um resumo determinístico; só se mudou, pergunta ao modelo (via LiteLLM) e publica.
// Nada é aplicado: as sugestões vão para .maestri/sugestoes.md e para a nota "Sugestões do Vigilante",
// e a Morgana leva à retro semanal. Tudo fica na máquina (modelo local).
//   node .maestri/vigilante/vigilante.mjs [--uma-vez]
import { execFileSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { coletar } from "./coletar.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
// O checkout onde o script vive (no Maestri, o Ground); VIGILANTE_WS aponta outro, para teste.
const WS = process.env.VIGILANTE_WS ?? join(AQUI, "..", "..");
const URL_LLM =
  process.env.VIGILANTE_LLM_URL ?? "http://127.0.0.1:4000/v1/chat/completions";
const MODELO = process.env.VIGILANTE_MODELO ?? "local";
const INTERVALO_MIN = Number(process.env.VIGILANTE_INTERVALO_MIN ?? 30);
const ARQUIVO = join(WS, ".maestri", "sugestoes.md");
const ESTADO = join(homedir(), ".nebuloz", "vigilante", "estado.json");
const NOTA = "Sugestões do Vigilante";
const TENTATIVAS = 60;

const SISTEMA = `Você é o Vigilante da Nebuloz: lê o resumo dos registros de uma equipe de agentes de IA (Maestri) e sugere evoluções.
Regras:
- Português. No máximo 5 sugestões, da mais importante para a menos.
- Cada sugestão: o que mudar, a evidência (cite a linha do resumo), o dono (papel) e o degrau: memória do agente, memória da área, regra no gate, teste/lint, skill ou prompt do papel.
- Erro de ferramenta repetido costuma ser instrução errada no papel ou falta de skill: diga qual.
- Não invente dado que não está no resumo. Se nada merece mudança, responda só: "Sem sugestões nesta rodada."`;

export async function analisar(
  texto,
  { fetchImpl = fetch, url = URL_LLM, modelo = MODELO, espera = 2000 } = {}
) {
  const corpo = JSON.stringify({
    model: modelo,
    temperature: 0.2,
    max_tokens: 900,
    messages: [
      { role: "system", content: SISTEMA },
      { role: "user", content: texto },
    ],
  });
  for (let i = 1; ; i++) {
    try {
      const res = await fetchImpl(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: corpo,
      });
      if (!res.ok) {
        throw new Error(
          `LLM HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`
        );
      }
      return (await res.json()).choices[0].message.content.trim();
    } catch (e) {
      // Conexão recusada: o modelo ainda está subindo junto com o terminal. Erro HTTP não se repete.
      if (!(e instanceof TypeError) || i >= TENTATIVAS) {
        throw e;
      }
      await new Promise((r) => setTimeout(r, espera));
    }
  }
}

const notaMaestri = (texto) => {
  const m = process.env.MAESTRI_CLI || "maestri";
  try {
    execFileSync(m, ["note", "write", NOTA, texto], { stdio: "ignore" });
  } catch {
    try {
      execFileSync(m, ["note", "create", texto, "--name", NOTA], {
        stdio: "ignore",
      });
    } catch {
      // Fora do Maestri: fica só o arquivo.
    }
  }
};

export function publicar(
  sugestoes,
  { arquivo = ARQUIVO, hash, agora = new Date(), nota = notaMaestri }
) {
  const bloco = `## ${agora.toISOString()} · resumo ${hash}\n\n${sugestoes}\n\n`;
  if (!existsSync(arquivo)) {
    writeFileSync(
      arquivo,
      "# Sugestões do Vigilante\n\nGeradas pelo modelo local. Nada aqui é aplicado sem a Morgana e o CEO.\n\n"
    );
  }
  appendFileSync(arquivo, bloco);
  nota(`# ${NOTA}\n\nÚltima rodada: ${agora.toISOString()}\n\n${sugestoes}`);
}

export async function rodada(
  { ultimoHash },
  deps = { coletar: () => coletar(WS), analisar, publicar }
) {
  const { texto, hash } = deps.coletar();
  if (hash === ultimoHash) {
    return hash;
  }
  deps.publicar(await deps.analisar(texto), { hash });
  return hash;
}

const lerEstado = () => {
  try {
    return JSON.parse(readFileSync(ESTADO, "utf8"));
  } catch {
    return {};
  }
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  mkdirSync(dirname(ESTADO), { recursive: true });
  const umaVez = process.argv.includes("--uma-vez");
  let { ultimoHash } = lerEstado();
  for (;;) {
    const inicio = new Date();
    try {
      const hash = await rodada({ ultimoHash });
      console.log(
        `${inicio.toISOString()} ${hash === ultimoHash ? "sem novidade" : `sugestões publicadas (resumo ${hash})`}`
      );
      ultimoHash = hash;
      writeFileSync(
        ESTADO,
        JSON.stringify({ ultimoHash, em: inicio.toISOString() })
      );
    } catch (e) {
      console.error(`${inicio.toISOString()} rodada falhou: ${e.message}`);
    }
    if (umaVez) {
      break;
    }
    await new Promise((r) => setTimeout(r, INTERVALO_MIN * 60_000));
  }
}
