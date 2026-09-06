/**
 * Regras puras do mapa de processos (spec §2, design backoffice-processos.jsx:
 * taxonomia de domínio/nível/status, PROC_LAYOUT e a busca). O export para
 * JSON Canvas mora em `processos-canvas.ts`, separado só por tamanho de
 * arquivo — os dois seguem sem Prisma, sem React, sem I/O.
 *
 * Referência: docs/superpowers/specs/2026-09-06-mapa-de-processos-design.md.
 */
import type { Tone } from "@repo/design-system/cosmos/kit";

/** Formato do código do processo, "PZ-01" — um lugar só, importado tanto pela
 *  action (`"use server"` não exporta constante) quanto pelo diálogo, que já
 *  importa este módulo puro para os tipos. */
export const CODIGO = /^PZ-\d{2,3}$/;

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
  MODELADO: { rotulo: "Modelado", tom: "green" },
  RASCUNHO: { rotulo: "Rascunho", tom: "amber" },
  NAO_MAPEADO: { rotulo: "Não mapeado", tom: "red" },
} as const satisfies Record<string, { rotulo: string; tom: Tone }>;
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
  diagram: { id: string; name: string; slug: string; versoes: number } | null;
};

export type Ligacao = {
  id: string;
  deId: string;
  paraId: string;
  rotulo: string;
};

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

/** Palavras do português que não carregam sentido de busca — sem isso, uma
 *  consulta como "processo de vendas" vira "todos os termos precisam bater",
 *  incluindo "de", que está em quase todo texto e não filtra nada de útil.
 *  Lista curta e local, no espírito do `PROC_STOP` do design. */
const PROC_STOP = new Set(
  [
    "a",
    "o",
    "e",
    "um",
    "uma",
    "de",
    "da",
    "do",
    "das",
    "dos",
    "em",
    "no",
    "na",
    "nos",
    "nas",
    "que",
    "como",
    "para",
    "pra",
    "por",
    "com",
    "se",
    "ao",
    "os",
    "as",
    "qual",
    "quem",
    "onde",
    "quando",
    "antes",
    "depois",
    "roda",
    "faz",
    "fazer",
    "ser",
    "é",
    "nosso",
    "nossa",
    "meu",
    "minha",
    "isso",
    "esse",
    "essa",
    "gente",
  ].map(normalizar)
);

function termosDe(q: string): string[] {
  return normalizar(q)
    .split(ESPACOS)
    .filter((t) => t.length >= 3 && !PROC_STOP.has(t));
}

function textoBuscavel(p: Processo): string {
  return normalizar(`${p.nome} ${p.descricao} ${p.tags.join(" ")}`);
}

/** Pontos de relevância por campo atingido, contados separado (nome pesa mais
 *  que descrição, que pesa mais que tags) — é o que faz um processo achado
 *  pelo nome vir antes de um achado só nas tags, mesmo quando os dois batem o
 *  mesmo número de termos. */
function pontosDeRelevancia(termos: string[], p: Processo): number {
  const nome = normalizar(p.nome);
  const descricao = normalizar(p.descricao);
  const tags = normalizar(p.tags.join(" "));
  let pontos = 0;
  if (termos.some((t) => nome.includes(t))) {
    pontos += 4;
  }
  if (termos.some((t) => descricao.includes(t))) {
    pontos += 2;
  }
  if (termos.some((t) => tags.includes(t))) {
    pontos += 1;
  }
  return pontos;
}

export type ResultadoBusca = {
  ids: Set<string> | null;
  primeiro: string | null;
};

/** Consulta vazia (ou só de termos curtos/stop-words) não filtra nada —
 *  `ids: null` é o sinal para a tela mostrar todo mundo. Com termos, um
 *  processo só entra se TODOS aparecerem em nome + descrição + tags; entre os
 *  que entram, o mais relevante (campo mais forte atingido) vem primeiro. */
export function buscar(q: string, processos: Processo[]): ResultadoBusca {
  const termos = termosDe(q);
  if (termos.length === 0) {
    return { ids: null, primeiro: null };
  }

  const bateram = processos
    .filter((p) => {
      const texto = textoBuscavel(p);
      return termos.every((t) => texto.includes(t));
    })
    .map((p) => ({ id: p.id, pontos: pontosDeRelevancia(termos, p) }))
    .sort((a, b) => b.pontos - a.pontos);

  return {
    ids: new Set(bateram.map((r) => r.id)),
    primeiro: bateram[0]?.id ?? null,
  };
}
