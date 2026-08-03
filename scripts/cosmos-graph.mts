/**
 * Grafo de completude do Cosmos — scaffold, build e check.
 *
 *   pnpm cosmos:graph scaffold   cria nó faltante para cada id do registry
 *   pnpm cosmos:graph build      regenera docs/cosmos/grafo.json e GRAFO.md
 *   pnpm cosmos:graph check      valida (roda no CI)
 *
 * Por que um arquivo por nó: três trilhas escrevem em paralelo. JSON único
 * daria conflito de merge a cada task. Aqui cada agente escreve apenas nos nós
 * listados em `Owns:` do seu brief, e os arquivos consolidados são gerados —
 * conflito neles se resolve regenerando, nunca editando à mão.
 *
 * O `check` existe para o grafo não virar ficção. O audit de 2026-07-23 provou
 * que documento separado do código deriva em silêncio: ele afirmava telas
 * "prontas e ligadas a dado real" enquanto metade era casca. Por isso toda
 * afirmação verificável é verificada — caminho existe em disco, export existe
 * no arquivo, model existe no schema Prisma. Campo que o check não consegue
 * conferir é dívida, não documentação.
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIR_NOS = join(RAIZ, "docs/cosmos/nodes");
const SAIDA_JSON = join(RAIZ, "docs/cosmos/grafo.json");
const SAIDA_MD = join(RAIZ, "docs/cosmos/GRAFO.md");
const REGISTRY = join(RAIZ, "apps/app/components/cosmos/screens/registry.tsx");
const DIR_SCHEMA_PRISMA = join(RAIZ, "packages/database/prisma/schema");

type Acao = {
  arquivo: string;
  export: string;
  tipo: "read" | "mutation";
  estado: "existe" | "ausente";
};

type Aresta = { no: string; tipo: string; produz?: string; porque: string };

type Ficha = {
  pratica: string;
  nivel: string;
  faz: string;
  invariantes: string[];
  fonte: string[];
  codigo?: string[];
};

type No = {
  id: string;
  kind: "tela" | "capacidade";
  titulo: string;
  rota: string | null;
  componente: string | null;
  registro?: string | null;
  balde: "A" | "B" | "C" | null;
  profundidade: "REAL" | "THIN" | "SHELL" | null;
  trilha: string | null;
  dono: string | null;
  estado: string;
  actions: Acao[];
  models: string[];
  safe?: Ficha;
  lacunas: { id: string; bloqueio: boolean; fechada_em: string | null }[];
  depende_de: Aresta[];
  seed: string[];
  verifica: string[];
  commits: string[];
  notas?: string;
  atualizado_em?: string;
};

function lerNos(): No[] {
  if (!existsSync(DIR_NOS)) {
    return [];
  }
  return readdirSync(DIR_NOS)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(DIR_NOS, f), "utf8")) as No)
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** Ids do registry — a fonte de verdade sobre quais telas existem. */
function idsDoRegistry(): string[] {
  const txt = readFileSync(REGISTRY, "utf8");
  const bloco = txt.slice(txt.indexOf("SCREENS"));
  return [...bloco.matchAll(/^\s{2}"?([a-z][a-z0-9-]*)"?:\s/gm)].map(
    (m) => m[1]
  );
}

function modelsDoPrisma(): Set<string> {
  const nomes = new Set<string>();
  for (const arq of readdirSync(DIR_SCHEMA_PRISMA).filter((f) =>
    f.endsWith(".prisma")
  )) {
    const txt = readFileSync(join(DIR_SCHEMA_PRISMA, arq), "utf8");
    for (const m of txt.matchAll(/^model\s+(\w+)\s*\{/gm)) {
      nomes.add(m[1]);
    }
  }
  return nomes;
}

// ─────────────────────────────── scaffold ───────────────────────────────

function scaffold(): void {
  mkdirSync(DIR_NOS, { recursive: true });
  const existentes = new Set(lerNos().map((n) => n.id));
  let criados = 0;

  for (const id of idsDoRegistry()) {
    if (existentes.has(id)) {
      continue;
    }
    const componente = `apps/app/components/cosmos/screens/${id}.tsx`;
    const no: Partial<No> = {
      id,
      kind: "tela",
      titulo: id,
      rota: `/cosmos/${id}`,
      componente: existsSync(join(RAIZ, componente)) ? componente : null,
      registro: "apps/app/components/cosmos/screens/registry.tsx",
      balde: null,
      profundidade: null,
      trilha: null,
      dono: null,
      estado: "pendente",
      actions: [],
      models: [],
      lacunas: [],
      depende_de: [],
      seed: [],
      verifica: [],
      commits: [],
    };
    writeFileSync(
      join(DIR_NOS, `${id}.json`),
      `${JSON.stringify({ $schema: "../schema/no.schema.json", ...no }, null, 2)}\n`
    );
    criados += 1;
  }
  process.stdout.write(`scaffold: ${criados} nó(s) criado(s)\n`);
}

// ───────────────────────────────── build ─────────────────────────────────

function build(): void {
  const nos = lerNos();
  const consumidoPor = new Map<string, string[]>();
  for (const no of nos) {
    for (const a of no.depende_de ?? []) {
      consumidoPor.set(a.no, [...(consumidoPor.get(a.no) ?? []), no.id]);
    }
  }

  const grafo = {
    gerado_por: "scripts/cosmos-graph.mts",
    total: nos.length,
    nos: nos.map((n) => ({
      ...n,
      consumido_por: consumidoPor.get(n.id) ?? [],
    })),
  };
  writeFileSync(SAIDA_JSON, `${JSON.stringify(grafo, null, 2)}\n`);

  const linha = (n: No) =>
    `| \`${n.id}\` | ${n.rota ?? "—"} | ${n.balde ?? "—"} | ${n.profundidade ?? "—"} | ${n.estado} | ${n.trilha ?? "—"} | ${n.actions.length} | ${n.models.length} |`;

  const fichas = nos
    .filter((n) => n.safe)
    .map((n) => {
      const externa = (n.safe?.fonte ?? []).some(
        (f) => !existsSync(join(RAIZ, f.split(":")[0]))
      );
      return `| \`${n.id}\` | ${n.safe?.pratica} | ${n.safe?.nivel} | ${n.safe?.faz} | ${(n.safe?.fonte ?? []).join("<br>")}${externa ? " ⚠ fonte externa" : ""} |`;
    });

  const md = `# Grafo de completude do Cosmos

<!-- GERADO por scripts/cosmos-graph.mts — não edite à mão.
     Edite docs/cosmos/nodes/<id>.json e rode \`pnpm cosmos:graph build\`. -->

Estado do programa que leva as telas do Cosmos de THIN a REAL: o que cada uma
faz, qual regra do SAFe 6.0 cumpre, que actions e tabelas usa, o que falta.

**Este grafo não se funde com os outros dois do repo.** \`graphify-out/\` é grafo
de código (10 mil nós de símbolos e imports, regenerado por tooling) e
\`.code-review-graph/\` é o grafo de review por diff. Este aqui é estado de
programa: quem faz o quê, contra qual regra, e o que já pode ser reusado.

## Como usar, sendo agente

Leia esta tabela para saber o que já existe antes de escrever qualquer coisa.
Depois leia os \`nodes/<id>.json\` que você possui (\`Owns:\` no seu brief) e os
que você declara em \`depende_de\`. Não leia \`grafo.json\` — ele é para o \`check\`.

Escreva **apenas** nos nós que você possui. Aresta é declarada pelo consumidor,
nunca pelo produtor.

## Nós

| id | rota | balde | profund. | estado | trilha | actions | models |
|---|---|---|---|---|---|---|---|
${nos.map(linha).join("\n")}

## Fichas SAFe

${fichas.length === 0 ? "_Nenhuma ficha redigida ainda._" : `| id | prática | nível | o que faz | fonte |\n|---|---|---|---|---|\n${fichas.join("\n")}`}
`;
  writeFileSync(SAIDA_MD, md);
  process.stdout.write(`build: ${nos.length} nós → grafo.json + GRAFO.md\n`);
}

// ───────────────────────────────── check ─────────────────────────────────

/** Caminho citado tem que existir em disco — é o que separa grafo de ficção. */
function validarCaminhos(no: No, erros: string[]): void {
  for (const p of [no.componente, ...(no.verifica ?? []), ...(no.seed ?? [])]) {
    if (p && !existsSync(join(RAIZ, p.split(" ")[0]))) {
      erros.push(`${no.id}: caminho inexistente "${p}"`);
    }
  }
}

/** Action marcada como `existe` tem que estar exportada de fato. */
function validarActions(no: No, erros: string[]): void {
  for (const a of no.actions ?? []) {
    if (a.estado !== "existe") {
      continue;
    }
    const abs = join(RAIZ, a.arquivo);
    if (!existsSync(abs)) {
      erros.push(
        `${no.id}: action "${a.export}" aponta para arquivo inexistente ${a.arquivo}`
      );
    } else if (!readFileSync(abs, "utf8").includes(a.export)) {
      erros.push(`${no.id}: ${a.arquivo} não exporta "${a.export}"`);
    }
  }
}

/** Nó entregue sem prova é alegação, não entrega. */
function validarEntrega(no: No, erros: string[]): void {
  if (no.estado !== "entregue") {
    return;
  }
  if ((no.commits ?? []).length === 0) {
    erros.push(`${no.id}: entregue sem commits[]`);
  }
  if ((no.verifica ?? []).length === 0) {
    erros.push(`${no.id}: entregue sem verifica[]`);
  }
  if (!no.safe) {
    erros.push(`${no.id}: entregue sem ficha SAFe`);
  }
}

function validarCiclos(nos: No[], erros: string[]): void {
  const visitando = new Set<string>();
  const pronto = new Set<string>();
  const porId = new Map(nos.map((n) => [n.id, n]));
  const visita = (id: string, caminho: string[]): void => {
    if (pronto.has(id)) {
      return;
    }
    if (visitando.has(id)) {
      erros.push(`ciclo: ${[...caminho, id].join(" → ")}`);
      return;
    }
    visitando.add(id);
    for (const a of porId.get(id)?.depende_de ?? []) {
      visita(a.no, [...caminho, id]);
    }
    visitando.delete(id);
    pronto.add(id);
  };
  for (const n of nos) {
    visita(n.id, []);
  }
}

function validarGerados(erros: string[]): void {
  if (!existsSync(SAIDA_JSON)) {
    erros.push("grafo.json ausente — rode `pnpm cosmos:graph build`");
    return;
  }
  const antes = readFileSync(SAIDA_JSON, "utf8");
  build();
  if (readFileSync(SAIDA_JSON, "utf8") !== antes) {
    erros.push(
      "grafo.json/GRAFO.md desatualizados — rode `pnpm cosmos:graph build`"
    );
  }
}

/** Aresta tem que apontar para nó existente — senão a dependência é fantasia. */
function validarArestas(no: No, ids: Set<string>, erros: string[]): void {
  for (const a of no.depende_de ?? []) {
    if (!ids.has(a.no)) {
      erros.push(`${no.id}: depende de nó inexistente "${a.no}"`);
    }
  }
}

function validarRota(
  no: No,
  rotas: Map<string, string>,
  erros: string[]
): void {
  if (!no.rota) {
    return;
  }
  const dono = rotas.get(no.rota);
  if (dono) {
    erros.push(`rota ${no.rota} reivindicada por "${dono}" e "${no.id}"`);
  }
  rotas.set(no.rota, no.id);
}

function validarModels(no: No, models: Set<string>, erros: string[]): void {
  for (const m of no.models ?? []) {
    if (!models.has(m)) {
      erros.push(`${no.id}: model "${m}" não existe no schema Prisma`);
    }
  }
  if (no.safe && (no.safe.fonte ?? []).length === 0) {
    erros.push(`${no.id}: ficha SAFe sem fonte`);
  }
}

function check(): number {
  const nos = lerNos();
  const ids = new Set(nos.map((n) => n.id));
  const models = modelsDoPrisma();
  const erros: string[] = [];
  const rotas = new Map<string, string>();

  for (const no of nos) {
    validarArestas(no, ids, erros);
    validarRota(no, rotas, erros);
    validarModels(no, models, erros);
    validarCaminhos(no, erros);
    validarActions(no, erros);
    validarEntrega(no, erros);
  }

  validarCiclos(nos, erros);
  validarGerados(erros);

  if (erros.length > 0) {
    process.stdout.write(`check: ${erros.length} problema(s)\n`);
    for (const e of erros) {
      process.stdout.write(`  ✗ ${e}\n`);
    }
    return 1;
  }
  process.stdout.write(`check: ${nos.length} nós, tudo consistente\n`);
  return 0;
}

const comando = process.argv[2];
if (comando === "scaffold") {
  scaffold();
} else if (comando === "build") {
  build();
} else if (comando === "check") {
  process.exit(check());
} else {
  process.stdout.write("uso: cosmos-graph.mts scaffold|build|check\n");
  process.exit(1);
}
