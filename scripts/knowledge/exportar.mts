/**
 * Fundação de conhecimento por produto para o Maestri.
 *
 *   pnpm knowledge:refresh
 *
 * Lê graphify-out/graph.json, .claude/completions, docs/adr e a memória do
 * usuário; escreve .maestri/knowledge/<produto>/. Fonte de verdade é o
 * arquivo — a note do Maestri é gerada daqui, nunca o contrário
 * (docs/superpowers/specs/2026-09-03-maestri-fundacao-conhecimento-design.md).
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { preservarSecoes, SECOES_RESERVADAS } from "./preservar-secoes.mts";
import { EXCLUSOES, PREFIXOS, PRODUTOS } from "./produtos.mts";
import { recortar } from "./recortar-grafo.mts";
import { rotear } from "./rotear-memoria.mts";
import type { Destino, Grafo, Produto } from "./tipos.mts";

const RAIZ = process.cwd();
const SAIDA = join(RAIZ, ".maestri", "knowledge");
const GRAFO_MESTRE = join(RAIZ, "graphify-out", "graph.json");
const COMPLETIONS = join(RAIZ, ".claude", "completions");
const SESSOES = join(RAIZ, ".claude", "sessions");
const ADRS = join(RAIZ, "docs", "adr");
const MEMORIA_USUARIO = join(
  homedir(),
  ".claude",
  "projects",
  "-Users-azos-Documents-Github-web-backoffice-my-cosmos-nebuloz",
  "memory"
);
const MIN_NOS = 20;
const MAX_PALAVRAS_RESUMO = 200;
const MAX_LINHAS_NOTE = 60;
const RE_TITULO_MD = /^#\s+(.+)$/m;
const RE_TITULO_LINHA = /^#.*$/m;
const RE_FRONTMATTER = /^---[\s\S]*?---/m;
const RE_ESPACOS = /\s+/;

type Doc = {
  arquivo: string;
  titulo: string;
  corpo: string;
  destino: Destino;
  motivo: string;
};
type ContextoProduto = {
  grafo: Grafo;
  adrs: Doc[];
  completions: Doc[];
  avisos: string[];
};

function lerMd(
  dir: string
): Array<{ arquivo: string; titulo: string; corpo: string }> {
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md") && f !== "README.md" && f !== "MEMORY.md")
    .sort()
    .reverse()
    .map((f) => {
      const corpo = readFileSync(join(dir, f), "utf8");
      const titulo = corpo.match(RE_TITULO_MD)?.[1]?.trim() ?? f;
      return { arquivo: f, titulo, corpo };
    });
}

function resumir(corpo: string, maxPalavras: number): string {
  const semTitulo = corpo
    .replace(RE_TITULO_LINHA, "")
    .replace(RE_FRONTMATTER, "");
  const palavras = semTitulo.split(RE_ESPACOS).filter(Boolean);
  const corte = palavras.slice(0, maxPalavras).join(" ");
  return palavras.length > maxPalavras ? `${corte} …` : corte;
}

function rotearTodos(dir: string): Doc[] {
  return lerMd(dir).map((d) => ({ ...d, ...rotear(d.arquivo, d.titulo) }));
}

function escrever(caminho: string, conteudo: string): void {
  mkdirSync(join(caminho, ".."), { recursive: true });
  writeFileSync(caminho, conteudo);
}

function indexMd(p: Produto, ctx: ContextoProduto): string {
  const { grafo, adrs, completions, avisos } = ctx;
  const cmd = `.maestri/knowledge/${p}/graph.json`;
  return [
    `# ${p} — índice de conhecimento`,
    "",
    "Gerado por `pnpm knowledge:refresh`. Fonte de verdade: os arquivos abaixo. Não editar à mão.",
    "",
    "## Onde o código vive",
    ...(PREFIXOS[p].length
      ? PREFIXOS[p].map((x) => `- \`${x}\``)
      : ["- *nenhum caminho — este produto ainda não tem código*"]),
    "",
    "## Grafo",
    `- ${grafo.nodes.length} nós, ${grafo.links.length} arestas (recorte do mestre com 2 hops)`,
    ...avisos.map((a) => `- ⚠ ${a}`),
    "",
    "Consultar sem carregar o arquivo:",
    "```bash",
    `graphify explain "<nó>" --graph ${cmd}`,
    `graphify path "<a>" "<b>" --graph ${cmd}`,
    "```",
    "",
    "## ADRs que valem aqui",
    ...(adrs.length
      ? adrs.map((a) => `- [${a.titulo}](../../../docs/adr/${a.arquivo})`)
      : ["- nenhum roteado"]),
    "",
    "## Memória de execução",
    `- ${completions.length} completions em \`memory.md\``,
    "",
  ].join("\n");
}

function memoryMd(p: Produto, docs: Doc[]): string {
  return [
    `# ${p} — memória de execução`,
    "",
    ...docs.flatMap((d) => [
      `## ${d.titulo}`,
      `*${d.arquivo}* · roteado por "${d.motivo}"`,
      "",
      resumir(d.corpo, MAX_PALAVRAS_RESUMO),
      "",
    ]),
  ].join("\n");
}

function noteMd(p: Produto, ctx: ContextoProduto): string {
  const { grafo, adrs, completions, avisos } = ctx;
  const linhas = [
    `# ${p}`,
    "",
    `Você é o especialista em **${p}**. Leia isto ao acordar; consulte o resto sob demanda.`,
    "",
    `- Código: ${PREFIXOS[p].length ? PREFIXOS[p].map((x) => `\`${x}\``).join(", ") : "*ainda não existe*"}`,
    `- Grafo: ${grafo.nodes.length} nós — \`graphify explain "<nó>" --graph .maestri/knowledge/${p}/graph.json\``,
    `- Índice completo: \`.maestri/knowledge/${p}/index.md\``,
    `- Memória: \`.maestri/knowledge/${p}/memory.md\` (${completions.length} completions)`,
    ...avisos.map((a) => `- ⚠ ${a}`),
    "",
    "## ADRs",
    ...adrs.slice(0, 8).map((a) => `- ${a.titulo}`),
    ...(adrs.length > 8 ? [`- … e mais ${adrs.length - 8} no index.md`] : []),
    "",
    "## Últimas execuções",
    ...completions
      .slice(0, 5)
      .map((c) => `- ${c.titulo} (${c.arquivo.slice(0, 10)})`),
    "",
    ...SECOES_RESERVADAS.flatMap((s) => [s, ""]),
  ];
  return linhas.slice(0, MAX_LINHAS_NOTE).join("\n");
}

function main(): void {
  const mestre: Grafo = JSON.parse(readFileSync(GRAFO_MESTRE, "utf8"));
  const completions = [...rotearTodos(COMPLETIONS), ...rotearTodos(SESSOES)];
  const adrs = rotearTodos(ADRS);
  const relatorio: string[] = [
    `# refresh ${new Date().toISOString().slice(0, 10)}`,
    "",
  ];

  for (const p of PRODUTOS) {
    const avisos: string[] = [];
    const grafo = recortar(mestre, PREFIXOS[p], {
      hops: 2,
      exclusoes: EXCLUSOES[p],
    });
    if (grafo.nodes.length < MIN_NOS) {
      avisos.push(
        `recorte com ${grafo.nodes.length} nós (< ${MIN_NOS}) — ${p === "signal" ? "esperado: sem código" : "conferir prefixos"}`
      );
    }
    const adrsP = adrs.filter((a) => a.destino === p);
    const compP = completions.filter((c) => c.destino === p);
    const dir = join(SAIDA, p);
    const ctx: ContextoProduto = {
      grafo,
      adrs: adrsP,
      completions: compP,
      avisos,
    };

    escrever(join(dir, "graph.json"), JSON.stringify(grafo));
    escrever(join(dir, "index.md"), indexMd(p, ctx));
    escrever(join(dir, "memory.md"), memoryMd(p, compP));

    const noteAtual = existsSync(join(dir, "note.md"))
      ? readFileSync(join(dir, "note.md"), "utf8")
      : null;
    const { note, avisos: avisosNote } = preservarSecoes(
      noteAtual,
      noteMd(p, ctx)
    );
    escrever(join(dir, "note.md"), note);

    relatorio.push(
      `- **${p}**: ${grafo.nodes.length} nós · ${adrsP.length} ADRs · ${compP.length} completions${[...avisos, ...avisosNote].map((a) => ` · ⚠ ${a}`).join("")}`
    );
  }

  const naoRoteados = [...completions, ...adrs].filter(
    (d) => d.destino === "compartilhado"
  );
  const memoriaEmpresa = lerMd(MEMORIA_USUARIO);
  const maestro = join(SAIDA, "maestro");
  escrever(
    join(maestro, "mapa.md"),
    [
      "# mapa — um produto por linha",
      "",
      ...PRODUTOS.map(
        (p) => `- **${p}** → \`.maestri/knowledge/${p}/index.md\``
      ),
      "",
    ].join("\n")
  );
  escrever(
    join(maestro, "memoria-empresa.md"),
    [
      "# memória de empresa (do usuário, não de produto)",
      "",
      ...memoriaEmpresa.flatMap((m) => [
        `## ${m.titulo}`,
        "",
        resumir(m.corpo, MAX_PALAVRAS_RESUMO),
        "",
      ]),
    ].join("\n")
  );
  escrever(
    join(maestro, "nao-roteados.md"),
    [
      "# não roteados — decidir o produto à mão",
      "",
      ...(naoRoteados.length
        ? naoRoteados.map((d) => `- \`${d.arquivo}\` — ${d.titulo}`)
        : ["- nenhum"]),
      "",
    ].join("\n")
  );
  relatorio.push(
    "",
    `- não roteados: ${naoRoteados.length} (ver maestro/nao-roteados.md)`
  );

  escrever(
    join(SAIDA, `refresh-${new Date().toISOString().slice(0, 10)}.md`),
    relatorio.join("\n")
  );
  console.log(relatorio.join("\n"));
}

main();
