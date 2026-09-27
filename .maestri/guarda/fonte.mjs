#!/usr/bin/env node
// Hook Stop "fonte": antes de um C-level (ou o Vigia) encerrar o turno, confere se as afirmações com número
// ou de verificação ("está confirmado", "todos passaram") têm sustentação nas saídas de ferramenta recentes.
// Quem julga é o serviço NLI local (com.nebuloz.nli, :8765). Contradição ou falta de fonte devolve o turno
// uma vez, com o motivo; o segundo stop do mesmo turno passa. Serviço fora do ar: passa (falha aberta).
// Saída técnica seca ("PASS (660)") o NLI julga mal — por isso devs/QA usam o Canny (regra), não este hook.
import { appendFileSync, mkdirSync, readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";
import { registrar as registrarVeredito } from "../registrar.mjs";

const NLI = process.env.NEBULOZ_NLI_URL ?? "http://127.0.0.1:8765/nli";
const LOG = join(homedir(), ".nebuloz", "guarda.log");
const MAX_AFIRMACOES = 6;
const MAX_EVIDENCIAS_SESSAO = 12; // saídas de ferramenta antes do turno atual, das mais recentes
const POR_AFIRMACAO = 6;
const MAX_CHARS_EVIDENCIA = 2000;

const BLOCO_CODIGO = /```[\s\S]*?```/g;
const FIM_DE_FRASE = /(?<=[.!?])\s+/;
const TEM_NUMERO = /\d/;
const VERIFICACAO =
  /\b(confirmad[oa]s?|verificad[oa]s?|validad[oa]s?|comprovad[oa]s?|garantid[oa]s?|aprovad[oa]s?|passaram|passou|est[áa] corret[oa]|est[ãa]o corret[oa]s)\b/i;
// Estado de produção afirmado (merge, deploy, migration): é onde agente mais erra confiante.
const ESTADO_DE_PRODUCAO =
  /\b(mergead[oa]s?|deployad[oa]s?|est[áa] no ar|entrou no ar|foi aplicad[oa]|foram aplicad[oa]s|subiu (para|pra) produ[çc][ãa]o)\b/i;
// O NLI não liga "mergeado" a "state: MERGED" (saída seca de ferramenta). Para essas frases, regra:
// sinal de ferramenta na evidência sustenta; sem sinal, segue para o NLI (que pega contradição e falta de fonte).
// ponytail: um sinal só para os três tipos; "está no ar" sustentado por um "merged" passa. Separar por tipo se acontecer.
const SINAL_DE_PRODUCAO =
  /\bmerged\b|Merge pull request #|\bREADY\b|\bapplied\b|Applying migration/i;
const PALAVRA = /[\p{L}\d][\p{L}\d.,]*/gu;
const PONTUACAO_FINAL = /[.,]+$/;
const SEPARADOR_MILHAR = /[.,]/g;

const textoDe = (c) => {
  if (typeof c === "string") {
    return c;
  }
  if (Array.isArray(c)) {
    return c.map((b) => (typeof b?.text === "string" ? b.text : "")).join("\n");
  }
  return "";
};

const ehPedido = (o) =>
  o.type === "user" &&
  (typeof o.message?.content === "string" ||
    (Array.isArray(o.message?.content) &&
      !o.message.content.some((b) => b?.type === "tool_result")));

/** Evidência (pedido do usuário + saídas de ferramenta) e a resposta final do turno atual. */
export function turnoAtual(linhas) {
  const msgs = [];
  for (const l of linhas) {
    try {
      const o = JSON.parse(l);
      if (o.type === "user" || o.type === "assistant") {
        msgs.push(o);
      }
    } catch {
      // linha que não é JSON
    }
  }
  const inicio = msgs.findLastIndex(ehPedido);
  const antes = msgs
    .slice(0, Math.max(inicio, 0))
    .flatMap((o) =>
      Array.isArray(o.message?.content) ? o.message.content : []
    )
    .filter((b) => b?.type === "tool_result")
    .map((b) => textoDe(b.content))
    .slice(-MAX_EVIDENCIAS_SESSAO);
  const evidencias = inicio >= 0 ? [textoDe(msgs[inicio].message.content)] : [];
  let ultimaFerramenta = inicio;
  msgs.forEach((o, i) => {
    if (
      i > inicio &&
      Array.isArray(o.message?.content) &&
      o.message.content.some((b) => b?.type === "tool_result")
    ) {
      evidencias.push(
        ...o.message.content
          .filter((b) => b?.type === "tool_result")
          .map((b) => textoDe(b.content))
      );
      ultimaFerramenta = i;
    }
  });
  const final = msgs
    .slice(ultimaFerramenta + 1)
    .filter((o) => o.type === "assistant")
    .map((o) => textoDe(o.message.content))
    .join("\n")
    .trim();
  return {
    final,
    evidencias: [...antes, ...evidencias].filter((e) => e.trim()),
    turno: evidencias.filter((e) => e.trim()),
  };
}

/** Frases com número ou com afirmação de verificação; perguntas e código ficam de fora. */
export function afirmacoes(texto) {
  return texto
    .replace(BLOCO_CODIGO, " ")
    .split(FIM_DE_FRASE)
    .map((f) => f.trim())
    .filter(
      (f) =>
        f &&
        !f.endsWith("?") &&
        (TEM_NUMERO.test(f) ||
          VERIFICACAO.test(f) ||
          ESTADO_DE_PRODUCAO.test(f))
    )
    .slice(0, MAX_AFIRMACOES);
}

const termos = (t) =>
  new Set(
    (t.toLowerCase().match(PALAVRA) ?? [])
      .map((w) => w.replace(PONTUACAO_FINAL, ""))
      .map((w) => (TEM_NUMERO.test(w) ? w.replace(SEPARADOR_MILHAR, "") : w))
      .filter((w) => TEM_NUMERO.test(w) || w.length >= 4)
  );

/**
 * Estado de produção sustentado pelo sinal da ferramenta, mas só na evidência que fala do mesmo alvo:
 * se a frase tem número (#261), a evidência precisa ter o número; se não, dividir ao menos um termo.
 * Sem isso, um "merged" de outro PR na sessão liberaria qualquer "está mergeado".
 */
export function sustentadaPorSinal(afirmacao, evidencias) {
  if (!ESTADO_DE_PRODUCAO.test(afirmacao)) {
    return false;
  }
  const alvo = termos(afirmacao);
  const numeros = [...alvo].filter((w) => TEM_NUMERO.test(w));
  return evidencias.some((e) => {
    if (!SINAL_DE_PRODUCAO.test(e)) {
      return false;
    }
    const t = termos(e);
    return numeros.length
      ? numeros.every((n) => t.has(n))
      : [...alvo].some((w) => t.has(w));
  });
}

/** Índices das evidências mais parecidas (número pesa 3); empate: a mais recente primeiro. */
export function candidatas(afirmacao, evidencias, k = POR_AFIRMACAO) {
  const alvo = termos(afirmacao);
  return evidencias
    .map((e, i) => {
      let nota = 0;
      for (const w of termos(e)) {
        if (alvo.has(w)) {
          nota += TEM_NUMERO.test(w) ? 3 : 1;
        }
      }
      return { i, nota };
    })
    .sort((a, b) => b.nota - a.nota || b.i - a.i)
    .slice(0, k)
    .map((x) => x.i);
}

export function decidir(resultados) {
  const linhas = [];
  for (const r of resultados) {
    if (r.veredito === "contradita") {
      linhas.push(
        `- "${r.afirmacao}" contradiz a evidência: "${(r.evidencia ?? "").slice(0, 200)}"`
      );
    } else if (r.veredito === "sem_fonte") {
      linhas.push(
        `- "${r.afirmacao}": nenhuma saída de ferramenta recente sustenta esta afirmação.`
      );
    }
  }
  if (!linhas.length) {
    return null;
  }
  return [
    "Checagem de fonte (NLI local) antes de encerrar:",
    ...linhas,
    "Corrija, cite a fonte (arquivo e linha) ou rode a consulta. Se já está certo, diga de onde veio e encerre.",
  ].join("\n");
}

async function nliHttp(afirmacao, evidencias) {
  const res = await fetch(NLI, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ afirmacao, evidencias }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    throw new Error(`NLI HTTP ${res.status}`);
  }
  return res.json();
}

const papelDe = (cwd) => {
  try {
    return JSON.parse(readFileSync(join(cwd, "role.json"), "utf8")).name;
  } catch {
    return basename(cwd ?? "") || "desconhecido";
  }
};

/** Devolve o JSON de bloqueio do hook, ou null para deixar o turno terminar. */
export async function guarda(entrada, deps = {}) {
  if (entrada.stop_hook_active) {
    return null;
  }
  const {
    ler = () => readFileSync(entrada.transcript_path, "utf8").split("\n"),
    nli = nliHttp,
    registrar = (e) => registrarVeredito(e),
    papel = papelDe(entrada.cwd),
  } = deps;
  const { final, evidencias } = turnoAtual(ler());
  const alvos = afirmacoes(final);
  if (!alvos.length) {
    return null;
  }
  const resultados = [];
  try {
    for (const afirmacao of alvos) {
      if (sustentadaPorSinal(afirmacao, evidencias)) {
        resultados.push({ afirmacao, veredito: "sustentada", evidencia: null });
        continue;
      }
      const idx = candidatas(afirmacao, evidencias);
      const enviadas = idx.map((i) =>
        evidencias[i].slice(0, MAX_CHARS_EVIDENCIA)
      );
      const r = await nli(afirmacao, enviadas);
      resultados.push({
        afirmacao,
        veredito: r.veredito,
        evidencia: r.melhor ? enviadas[r.melhor.i] : null,
      });
    }
  } catch (e) {
    registrarLog(`NLI indisponível, turno liberado: ${e.message}`);
    return null;
  }
  const motivo = decidir(resultados);
  if (!motivo) {
    return null;
  }
  const contradita = resultados.some((r) => r.veredito === "contradita");
  registrar({
    agente: papel,
    tarefa: "fim de turno",
    veredito: "achado",
    causa: contradita
      ? "afirmação contradita pela evidência"
      : "afirmação sem fonte",
  });
  return { decision: "block", reason: motivo };
}

function registrarLog(msg) {
  try {
    mkdirSync(join(homedir(), ".nebuloz"), { recursive: true });
    appendFileSync(LOG, `${new Date().toISOString()} ${msg}\n`);
  } catch {
    // log é conveniência
  }
}

// Caminho real dos dois lados: por link simbólico (ex.: /var → /private/var no macOS) a comparação
// crua falhava e o hook saía calado, sem checar nada.
const principal = () => {
  try {
    return (
      pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url
    );
  } catch {
    return false;
  }
};

if (principal()) {
  try {
    const r = await guarda(JSON.parse(readFileSync(0, "utf8")));
    if (r) {
      process.stdout.write(JSON.stringify(r));
    }
  } catch (e) {
    registrarLog(`hook falhou, turno liberado: ${e.message}`);
  }
  process.exit(0);
}
