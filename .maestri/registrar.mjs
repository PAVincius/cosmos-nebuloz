#!/usr/bin/env node
// Registro de resultados dos agentes: uma linha JSON por veredito, em .maestri/aprendizado.jsonl.
// É o sinal do ciclo de melhoria: sem ele, "o agente aprendeu" é impressão.
//   node .maestri/registrar.mjs --agente Crivo --tarefa "PR #250" --veredito reprovado --causa "sem filtro tenantId" [--produto cosmos]
//   node .maestri/registrar.mjs resumo [--dias 7]   (sai 1 sem eventos: a retro semanal é pulada)
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

// Sempre o arquivo do checkout onde o script vive: floors e worktrees chamam pelo caminho absoluto do Ground.
export const ARQUIVO = fileURLToPath(new URL("./aprendizado.jsonl", import.meta.url));
const VEREDITOS = ["aprovado", "reprovado", "achado"];

export function registrar({ agente, tarefa, veredito, causa, produto }, arquivo = ARQUIVO, agora = new Date()) {
  if (!agente) throw new Error("falta --agente");
  if (!tarefa) throw new Error("falta --tarefa");
  if (!VEREDITOS.includes(veredito)) throw new Error(`veredito deve ser um de: ${VEREDITOS.join(", ")}`);
  if (veredito !== "aprovado" && !causa) throw new Error("reprovado/achado exige --causa");
  const evento = { ts: agora.toISOString(), agente, tarefa, veredito, ...(causa && { causa }), ...(produto && { produto }) };
  appendFileSync(arquivo, `${JSON.stringify(evento)}\n`);
  return evento;
}

export function resumo(arquivo = ARQUIVO, dias = 7, agora = new Date()) {
  const desde = agora - dias * 864e5;
  const eventos = existsSync(arquivo)
    ? readFileSync(arquivo, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l))
        .filter((e) => Date.parse(e.ts) >= desde)
    : [];
  if (!eventos.length) return { code: 1, out: "" };

  const porAgente = new Map();
  const causas = new Map();
  for (const e of eventos) {
    const c = porAgente.get(e.agente) ?? { aprovado: 0, reprovado: 0, achado: 0 };
    c[e.veredito]++;
    porAgente.set(e.agente, c);
    if (e.causa) {
      // ponytail: agrupa por texto normalizado; causas parecidas com palavras diferentes não se juntam.
      const chave = e.causa.trim().toLowerCase();
      const k = causas.get(chave) ?? { n: 0, agentes: new Set(), texto: e.causa.trim() };
      k.n++;
      k.agentes.add(e.agente);
      causas.set(chave, k);
    }
  }
  const linhas = [`Aprendizado: ${eventos.length} eventos em ${dias} dias`, "", "Por agente:"];
  for (const [a, c] of porAgente) linhas.push(`- ${a}: ${c.aprovado} aprovado, ${c.reprovado} reprovado, ${c.achado} achado`);
  const recorrentes = [...causas].filter(([, k]) => k.n >= 2).sort((x, y) => y[1].n - x[1].n);
  linhas.push("", recorrentes.length ? "Causas que se repetem (candidatas a subir de degrau):" : "Nenhuma causa se repetiu.");
  for (const [, k] of recorrentes) linhas.push(`- ${k.n}× ${k.texto} (${[...k.agentes].join(", ")})`);
  return { code: 0, out: linhas.join("\n") };
}

function flags(args) {
  const out = {};
  for (let i = 0; i < args.length; i += 2) out[args[i].replace(/^--/, "")] = args[i + 1];
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const args = process.argv.slice(2);
  try {
    if (args[0] === "resumo") {
      const { code, out } = resumo(ARQUIVO, Number(flags(args.slice(1)).dias ?? 7));
      if (out) console.log(out);
      process.exit(code);
    }
    const e = registrar(flags(args));
    console.log(`registrado: ${e.agente} ${e.veredito} ${e.tarefa}`);
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }
}
