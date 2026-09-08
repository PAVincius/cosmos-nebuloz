/**
 * Export do mapa de processos para JSON Canvas 1.0 (spec §2, design
 * backoffice-processos.jsx: canvasRect, edgeSides, groupRects e toJsonCanvas).
 *
 * Separado de `lib/ferramentas/processos.ts` só por tamanho de arquivo — a
 * taxonomia e a geometria do layout polar moram lá, o formato de saída do
 * `.canvas` mora aqui. Mesma regra do arquivo original: sem Prisma, sem
 * React, sem I/O.
 *
 * Referência: docs/superpowers/specs/2026-09-06-mapa-de-processos-design.md.
 */
import {
  DOMINIOS,
  type Dominio,
  type Ligacao,
  type Ponto,
  type Processo,
} from "./processos";

const ACENTOS = /[̀-ͯ]/g;
const NAO_ALFANUM = /[^a-z0-9]+/g;
const BORDA_HIFEN = /(^-|-$)/g;

const NO_CANVAS = { w: 168, h: 52 } as const;

/** Cores hex literais por domínio — a única exceção deliberada à regra de só
 *  usar tokens do design system. O `.canvas` exportado é lido fora do
 *  back-office (Obsidian ou qualquer leitor de JSON Canvas), onde
 *  `var(--tom)` não existe. */
const HEX_DO_DOMINIO: Record<Dominio, string> = {
  COMERCIAL: "#ecd06a",
  DELIVERY: "#89cff0",
  GOVERNANCA: "#5cb4e4",
  PLATAFORMA: "#b2a5ff",
  LAB: "#29cc7a",
  MEDICAO: "#718596",
};

type RetanguloCanvas = { x: number; y: number; w: number; h: number };

function retanguloDoCanvas(
  id: string,
  pos: Record<string, Ponto>
): RetanguloCanvas {
  const p = pos[id];
  return {
    x: p.x - NO_CANVAS.w / 2,
    y: p.y - NO_CANVAS.h / 2,
    w: NO_CANVAS.w,
    h: NO_CANVAS.h,
  };
}

type LadoCanvas = "top" | "right" | "bottom" | "left";

/** Decide por qual lado a aresta sai/entra a partir da geometria dos dois
 *  retângulos: o eixo dominante (horizontal ou vertical) vence. */
function ladosDaAresta(
  a: RetanguloCanvas,
  b: RetanguloCanvas
): [LadoCanvas, LadoCanvas] {
  const dx = b.x + b.w / 2 - (a.x + a.w / 2);
  const dy = b.y + b.h / 2 - (a.y + a.h / 2);
  if (Math.abs(dx) * a.h > Math.abs(dy) * a.w) {
    return dx > 0 ? ["right", "left"] : ["left", "right"];
  }
  return dy > 0 ? ["bottom", "top"] : ["top", "bottom"];
}

type GrupoCanvas = {
  id: string;
  type: "group";
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  color: string;
  // Ausente num grupo de verdade — só aqui para que `.file` seja acessável
  // sem narrowing de `type` em quem só quer o nó de arquivo pelo `id`.
  file?: undefined;
};

function gruposDoCanvas(
  processos: Processo[],
  pos: Record<string, Ponto>
): GrupoCanvas[] {
  const grupos: GrupoCanvas[] = [];
  for (const dominio of Object.keys(DOMINIOS) as Dominio[]) {
    const ns = processos.filter((n) => n.dominio === dominio);
    if (ns.length === 0) {
      continue;
    }
    const rs = ns.map((n) => retanguloDoCanvas(n.id, pos));
    const x0 = Math.min(...rs.map((r) => r.x)) - 22;
    const y0 = Math.min(...rs.map((r) => r.y)) - 34;
    const x1 = Math.max(...rs.map((r) => r.x + r.w)) + 22;
    const y1 = Math.max(...rs.map((r) => r.y + r.h)) + 18;
    grupos.push({
      id: `group-${dominio}`,
      type: "group",
      x: Math.round(x0),
      y: Math.round(y0),
      width: Math.round(x1 - x0),
      height: Math.round(y1 - y0),
      label: DOMINIOS[dominio].rotulo,
      color: HEX_DO_DOMINIO[dominio],
    });
  }
  return grupos;
}

type ArquivoCanvas = {
  id: string;
  type: "file";
  x: number;
  y: number;
  width: number;
  height: number;
  file: string;
  color: string;
};

/** Mesmas etapas de `lib/slug.ts`, inclusive a poda de hífen nas bordas: um
 * nome com pontuação na ponta ("(Legado) Funil") viraria `-legado-funil` e o
 * arquivo do `.canvas` sairia malformado. Não dá para reusar `slugificar` de
 * lá — este módulo é puro e só importa tipo. */
function slugify(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(ACENTOS, "")
    .toLowerCase()
    .replace(NAO_ALFANUM, "-")
    .replace(BORDA_HIFEN, "");
}

/** O nó do `.canvas` e o nome do arquivo usam `codigo`, não `id`: o arquivo
 *  exportado precisa ficar legível e estável, e um cuid não é nem uma coisa
 *  nem outra. */
function arquivoDoCanvas(
  p: Processo,
  pos: Record<string, Ponto>
): ArquivoCanvas {
  const r = retanguloDoCanvas(p.id, pos);
  return {
    id: p.codigo,
    type: "file",
    x: Math.round(r.x),
    y: Math.round(r.y),
    width: r.w,
    height: r.h,
    file: `processos/${p.codigo}-${slugify(p.nome)}.md`,
    color: HEX_DO_DOMINIO[p.dominio],
  };
}

type ArestaCanvas = {
  id: string;
  fromNode: string;
  fromSide: LadoCanvas;
  fromEnd: "none";
  toNode: string;
  toSide: LadoCanvas;
  toEnd: "arrow";
  label: string;
};

/** `l.deId`/`l.paraId` referenciam `Processo.id`, igual à FK do banco. O nó
 *  do canvas usa `codigo`, então a aresta traduz para `codigo` aqui — é o
 *  único lugar que faz essa tradução. O chamador já filtrou pelo mesmo `porId`
 *  duas linhas antes, então os dois sempre existem aqui. */
function construirAresta(
  l: Ligacao,
  indice: number,
  porId: Map<string, Processo>,
  pos: Record<string, Ponto>
): ArestaCanvas {
  const de = porId.get(l.deId) as Processo;
  const para = porId.get(l.paraId) as Processo;
  const [fromSide, toSide] = ladosDaAresta(
    retanguloDoCanvas(de.id, pos),
    retanguloDoCanvas(para.id, pos)
  );
  return {
    id: `e${String(indice + 1).padStart(2, "0")}`,
    fromNode: de.codigo,
    fromSide,
    fromEnd: "none",
    toNode: para.codigo,
    toSide,
    toEnd: "arrow",
    label: l.rotulo,
  };
}

export type DocumentoJsonCanvas = {
  nodes: (GrupoCanvas | ArquivoCanvas)[];
  edges: ArestaCanvas[];
};

/** Porta de `toJsonCanvas` do design: emite JSON Canvas 1.0 — um grupo por
 *  domínio presente, um nó de arquivo por processo, e uma aresta por ligação
 *  cujos dois lados estão no conjunto visível (`processos`). */
export function paraJsonCanvas(
  processos: Processo[],
  ligacoes: Ligacao[],
  pos: Record<string, Ponto>
): DocumentoJsonCanvas {
  const grupos = gruposDoCanvas(processos, pos);
  const arquivos = processos.map((p) => arquivoDoCanvas(p, pos));
  const porId = new Map(processos.map((p) => [p.id, p]));
  const visiveis = ligacoes.filter(
    (l) => porId.has(l.deId) && porId.has(l.paraId)
  );
  const edges = visiveis.map((l, i) => construirAresta(l, i, porId, pos));

  return { nodes: [...grupos, ...arquivos], edges };
}
