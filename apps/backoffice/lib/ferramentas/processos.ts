/**
 * Regras puras do mapa de processos (spec §2, design backoffice-processos.jsx:
 * PROC_LAYOUT, canvasRect, edgeSides, groupRects e toJsonCanvas).
 *
 * Sem Prisma, sem React, sem I/O: layout polar e export para JSON Canvas são
 * a mesma conta tanto na tela do mapa quanto num script de exportação futuro
 * — um não pode divergir do outro sobre onde um nó cai ou por onde uma
 * aresta entra.
 *
 * Referência: docs/superpowers/specs/2026-09-06-mapa-de-processos-design.md.
 */
import type { Tone } from "@repo/design-system/cosmos/kit";

export const DOMINIOS = {
  COMERCIAL: { rotulo: "Comercial", tom: "amber" },
  DELIVERY: { rotulo: "Delivery", tom: "blue" },
  GOVERNANCA: { rotulo: "Governança", tom: "accent" },
  PLATAFORMA: { rotulo: "Plataforma", tom: "purple" },
  LAB: { rotulo: "LAB", tom: "green" },
  MEDICAO: { rotulo: "Medição", tom: "neutral" },
} as const satisfies Record<string, { rotulo: string; tom: Tone }>;
export type Dominio = keyof typeof DOMINIOS;

export const NIVEIS = {
  1: {
    rotulo: "Estratégico",
    curto: "Estr.",
    descricao: "Define regra, meta e método. Muda pouco, muda tudo.",
  },
  2: {
    rotulo: "Tático",
    curto: "Tát.",
    descricao: "Decide dentro da regra: gate, revisão, aprovação.",
  },
  3: {
    rotulo: "Operacional",
    curto: "Oper.",
    descricao: "Executa no dia a dia. Volume alto, cadência curta.",
  },
} as const;
export type Nivel = 1 | 2 | 3;

export const STATUS = {
  MODELADO: {
    rotulo: "Modelado",
    tom: "green",
    descricao: "BPMN versionado e revisado",
  },
  RASCUNHO: {
    rotulo: "Rascunho",
    tom: "amber",
    descricao: "Existe documento, não existe modelo",
  },
  NAO_MAPEADO: {
    rotulo: "Não mapeado",
    tom: "red",
    descricao: "Roda na cabeça de alguém",
  },
} as const satisfies Record<
  string,
  { rotulo: string; tom: Tone; descricao: string }
>;
export type Status = keyof typeof STATUS;

export type Ponto = { x: number; y: number };

export type Processo = {
  id: string;
  codigo: string;
  nome: string;
  descricao: string;
  dominio: Dominio;
  nivel: Nivel;
  tipo: "CORE" | "APOIO";
  donoNome: string | null;
  revisadoEm: string | null;
  tags: string[];
  diagramId: string | null;
  docUrl: string | null;
  diagram: { id: string; name: string; slug: string } | null;
};

export type Ligacao = {
  id: string;
  deId: string;
  paraId: string;
  rotulo: string;
};

/** "neutral" (Medição) não tem variável de cor própria no kit — cai no azul.
 *  Mesmo mapeamento de `tomCssDoEstagio` em lib/comercial/funil.ts: um lugar
 *  só decide isso, porque `var(--neutral)` não existe e deixa o elemento sem
 *  cor. */
export function tomCssDoDominio(tom: Tone): Tone {
  return tom === "neutral" ? "blue" : tom;
}

/** BPMN é a verdade mais forte: um processo com diagrama e também um link de
 *  documento ainda é "modelado", não "rascunho". */
export function statusDe(p: Pick<Processo, "diagramId" | "docUrl">): Status {
  if (p.diagramId) {
    return "MODELADO";
  }
  if (p.docUrl) {
    return "RASCUNHO";
  }
  return "NAO_MAPEADO";
}

const ANEIS = {
  1: { rx: 250, ry: 128 },
  2: { rx: 470, ry: 268 },
  3: { rx: 670, ry: 392 },
} as const;

/** ×1.09 no índice ímpar, ×0.93 no par — só quando há mais de um nó no par
 *  (domínio, nível), pra dois deles não caírem exatamente na mesma altura. */
function fatorDoIndice(indice: number, total: number): number {
  if (total <= 1) {
    return 1;
  }
  return indice % 2 ? 1.09 : 0.93;
}

/** Espalha os nós de um par (domínio, nível) em arco, centrado no meio do
 *  setor do domínio. */
function posicionarNivel(
  processos: Processo[],
  alvo: { dominio: Dominio; nivel: Nivel },
  setor: { centro: number; largura: number },
  saida: { centro: Ponto; pos: Record<string, Ponto> }
): void {
  const ns = processos.filter(
    (n) => n.dominio === alvo.dominio && n.nivel === alvo.nivel
  );
  const passo = Math.min((setor.largura * 0.72) / Math.max(ns.length, 1), 0.42);
  const raios = ANEIS[alvo.nivel];
  ns.forEach((n, j) => {
    const angulo = setor.centro + (j - (ns.length - 1) / 2) * passo;
    const fator = fatorDoIndice(j, ns.length);
    saida.pos[n.id] = {
      x: Math.round(saida.centro.x + Math.cos(angulo) * raios.rx * fator),
      y: Math.round(saida.centro.y + Math.sin(angulo) * raios.ry * fator),
    };
  });
}

/** Porta de `PROC_LAYOUT` do design: seis setores angulares (um por domínio,
 *  na ordem de `DOMINIOS`, começando em -π/2) e três anéis (um por nível).
 *  `pos` é indexado pelo `id` do processo, não pelo `codigo` — quem precisa
 *  do nome estável do arquivo é só o export para JSON Canvas. */
export function layoutPolar(processos: Processo[]): {
  W: number;
  H: number;
  cx: number;
  cy: number;
  aneis: typeof ANEIS;
  pos: Record<string, Ponto>;
} {
  const W = 1560;
  const H = 940;
  const cx = W / 2;
  const cy = H / 2;
  const dominios = Object.keys(DOMINIOS) as Dominio[];
  const larguraDoSetor = (2 * Math.PI) / dominios.length;
  const pos: Record<string, Ponto> = {};

  dominios.forEach((dominio, i) => {
    const inicioDoSetor = -Math.PI / 2 + i * larguraDoSetor;
    const centroDoSetor = inicioDoSetor + larguraDoSetor / 2;
    for (const nivel of [1, 2, 3] as const) {
      posicionarNivel(
        processos,
        { dominio, nivel },
        { centro: centroDoSetor, largura: larguraDoSetor },
        { centro: { x: cx, y: cy }, pos }
      );
    }
  });

  return { W, H, cx, cy, aneis: ANEIS, pos };
}

export type Vizinho = {
  outro: string;
  dir: "in" | "out";
  rotulo: string;
  ligacaoId: string;
};

/** Vizinhos de um processo, na ordem em que as ligações aparecem — separa
 *  quem o processo alimenta (`out`) de quem o alimenta (`in`). */
export function vizinhos(id: string, ligacoes: Ligacao[]): Vizinho[] {
  const achados: Vizinho[] = [];
  for (const l of ligacoes) {
    if (l.deId === id) {
      achados.push({
        outro: l.paraId,
        dir: "out",
        rotulo: l.rotulo,
        ligacaoId: l.id,
      });
    } else if (l.paraId === id) {
      achados.push({
        outro: l.deId,
        dir: "in",
        rotulo: l.rotulo,
        ligacaoId: l.id,
      });
    }
  }
  return achados;
}

const ACENTOS = /[̀-ͯ]/g;

function normalizar(s: string): string {
  return s.normalize("NFD").replace(ACENTOS, "").toLowerCase();
}

const ESPACOS = /\s+/;

function termosDe(q: string): string[] {
  return normalizar(q)
    .split(ESPACOS)
    .filter((t) => t.length >= 3);
}

function textoBuscavel(p: Processo): string {
  return normalizar(`${p.nome} ${p.descricao} ${p.tags.join(" ")}`);
}

export type ResultadoBusca = {
  ids: Set<string> | null;
  primeiro: string | null;
};

/** Consulta vazia (ou só de termos curtos) não filtra nada — `ids: null` é o
 *  sinal para a tela mostrar todo mundo. Com termos, um processo só entra se
 *  TODOS aparecerem em nome + descrição + tags; entre os que entram, o mais
 *  batido vem primeiro. */
export function buscar(q: string, processos: Processo[]): ResultadoBusca {
  const termos = termosDe(q);
  if (termos.length === 0) {
    return { ids: null, primeiro: null };
  }

  const bateram = processos
    .map((p) => {
      const texto = textoBuscavel(p);
      return {
        id: p.id,
        pontos: termos.filter((t) => texto.includes(t)).length,
      };
    })
    .filter((r) => r.pontos === termos.length)
    .sort((a, b) => b.pontos - a.pontos);

  return {
    ids: new Set(bateram.map((r) => r.id)),
    primeiro: bateram[0]?.id ?? null,
  };
}

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

function slugify(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(ACENTOS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
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
 *  único lugar que faz essa tradução. */
function construirAresta(
  l: Ligacao,
  indice: number,
  porId: Map<string, Processo>,
  pos: Record<string, Ponto>
): ArestaCanvas {
  const de = porId.get(l.deId);
  const para = porId.get(l.paraId);
  if (!(de && para)) {
    throw new Error(`Ligação ${l.id} referencia processo fora do conjunto`);
  }
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
