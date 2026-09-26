#!/usr/bin/env node
// Registro de resultados dos agentes: uma linha JSON por veredito, em .maestri/aprendizado.jsonl.
// É o sinal do ciclo de melhoria: sem ele, "o agente aprendeu" é impressão.
//   node .maestri/registrar.mjs --agente Crivo --tarefa "PR #250" --veredito reprovado --causa "sem filtro tenantId" [--produto cosmos]
//   node .maestri/registrar.mjs resumo [--dias 7]   (sai 1 sem eventos: a retro semanal é pulada)
// Concessões: o superior libera, por tempo, que o subordinado aja dentro do domínio DO SUPERIOR.
//   node .maestri/registrar.mjs conceder --de Norte --para Regua --escopo "editar docs/produto/x.md" --motivo "..." --horas 4
//   node .maestri/registrar.mjs concessoes [--para Regua]   (só as ativas)
// ponytail: é trilha de auditoria + regra de prompt; as permissões do Claude Code não mudam. Quem aplica é o agente.
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

// Sempre o arquivo do checkout onde o script vive: floors e worktrees chamam pelo caminho absoluto do Ground.
export const ARQUIVO = fileURLToPath(
  new URL("./aprendizado.jsonl", import.meta.url)
);
export const CONCESSOES = fileURLToPath(
  new URL("./concessoes.jsonl", import.meta.url)
);
const MAX_HORAS = 24;
const VEREDITOS = ["aprovado", "reprovado", "achado"];
const PREFIXO_FLAG = /^--/;

export function registrar(
  { agente, tarefa, veredito, causa, produto },
  arquivo = ARQUIVO,
  agora = new Date()
) {
  if (!agente) {
    throw new Error("falta --agente");
  }
  if (!tarefa) {
    throw new Error("falta --tarefa");
  }
  if (!VEREDITOS.includes(veredito)) {
    throw new Error(`veredito deve ser um de: ${VEREDITOS.join(", ")}`);
  }
  if (veredito !== "aprovado" && !causa) {
    throw new Error("reprovado/achado exige --causa");
  }
  const evento = {
    ts: agora.toISOString(),
    agente,
    tarefa,
    veredito,
    ...(causa && { causa }),
    ...(produto && { produto }),
  };
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
  if (!eventos.length) {
    return { code: 1, out: "" };
  }

  const porAgente = new Map();
  const causas = new Map();
  for (const e of eventos) {
    const c = porAgente.get(e.agente) ?? {
      aprovado: 0,
      reprovado: 0,
      achado: 0,
    };
    c[e.veredito] += 1;
    porAgente.set(e.agente, c);
    if (e.causa) {
      // ponytail: agrupa por texto normalizado; causas parecidas com palavras diferentes não se juntam.
      const chave = e.causa.trim().toLowerCase();
      const k = causas.get(chave) ?? {
        n: 0,
        agentes: new Set(),
        texto: e.causa.trim(),
      };
      k.n += 1;
      k.agentes.add(e.agente);
      causas.set(chave, k);
    }
  }
  const linhas = [
    `Aprendizado: ${eventos.length} eventos em ${dias} dias`,
    "",
    "Por agente:",
  ];
  for (const [a, c] of porAgente) {
    linhas.push(
      `- ${a}: ${c.aprovado} aprovado, ${c.reprovado} reprovado, ${c.achado} achado`
    );
  }
  const recorrentes = [...causas]
    .filter(([, k]) => k.n >= 2)
    .sort((x, y) => y[1].n - x[1].n);
  linhas.push(
    "",
    recorrentes.length
      ? "Causas que se repetem (candidatas a subir de degrau):"
      : "Nenhuma causa se repetiu."
  );
  for (const [, k] of recorrentes) {
    linhas.push(`- ${k.n}× ${k.texto} (${[...k.agentes].join(", ")})`);
  }
  return { code: 0, out: linhas.join("\n") };
}

export function conceder(
  { de, para, escopo, motivo, horas },
  arquivo = CONCESSOES,
  agora = new Date()
) {
  for (const [campo, valor] of Object.entries({ de, para, escopo, motivo })) {
    if (!valor) {
      throw new Error(`falta --${campo}`);
    }
  }
  if (de === para) {
    throw new Error("ninguém concede acesso a si mesmo");
  }
  const h = Number(horas);
  if (!(h > 0 && h <= MAX_HORAS)) {
    throw new Error(`--horas entre 0 e ${MAX_HORAS}`);
  }
  const c = {
    ts: agora.toISOString(),
    de,
    para,
    escopo,
    motivo,
    ate: new Date(agora.getTime() + h * 36e5).toISOString(),
  };
  appendFileSync(arquivo, `${JSON.stringify(c)}\n`);
  return c;
}

export function concessoes(
  arquivo = CONCESSOES,
  agora = new Date(),
  para = ""
) {
  if (!existsSync(arquivo)) {
    return [];
  }
  return readFileSync(arquivo, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l))
    .filter((c) => Date.parse(c.ate) > agora && (!para || c.para === para));
}

function flags(args) {
  const out = {};
  for (let i = 0; i < args.length; i += 2) {
    out[args[i].replace(PREFIXO_FLAG, "")] = args[i + 1];
  }
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const args = process.argv.slice(2);
  try {
    if (args[0] === "resumo") {
      const { code, out } = resumo(
        ARQUIVO,
        Number(flags(args.slice(1)).dias ?? 7)
      );
      if (out) {
        console.log(out);
      }
      process.exit(code);
    }
    if (args[0] === "conceder") {
      const c = conceder(flags(args.slice(1)));
      console.log(`concedido: ${c.de} → ${c.para} até ${c.ate}: ${c.escopo}`);
      process.exit(0);
    }
    if (args[0] === "concessoes") {
      const ativas = concessoes(
        CONCESSOES,
        new Date(),
        flags(args.slice(1)).para
      );
      for (const c of ativas) {
        console.log(
          `${c.de} → ${c.para} até ${c.ate}: ${c.escopo} (${c.motivo})`
        );
      }
      process.exit(ativas.length ? 0 : 1);
    }
    const e = registrar(flags(args));
    console.log(`registrado: ${e.agente} ${e.veredito} ${e.tarefa}`);
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }
}
