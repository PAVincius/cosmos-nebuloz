import type { NoDoProcesso, ProcessoBpmn } from "./esquema";

/**
 * Desenho com raias.
 *
 * O `bpmn-auto-layout` decide a ordem horizontal (coluna) e a vertical (linha)
 * de cada nó, mas não desenha pool nem raia — a colaboração inteira fica fora
 * do que ele sabe fazer. Então a coluna e a linha vêm dele, e este módulo põe
 * cada nó na faixa da própria raia: a linha global vira sub-linha dentro da
 * raia, preservando a ordem. Resultado: quem faz o quê fica visível e o fluxo
 * continua na ordem que o auto-layout escolheu. Tudo aqui é aritmética pura —
 * mesma grade, mesmo desenho.
 */

export type Posicao = { coluna: number; linha: number };
export type Caixa = { x: number; y: number; width: number; height: number };
export type Ponto = { x: number; y: number };

export type Desenho = {
  pool: Caixa;
  raias: Map<string, Caixa>;
  nos: Map<string, Caixa>;
  rotulosDeNo: Map<string, Caixa>;
  fluxos: Map<string, { pontos: Ponto[]; rotulo?: Caixa }>;
};

const POOL_X = 100;
const POOL_Y = 60;
const CABECALHO = 30;
const COL_W = 170;
const ROW_H = 130;
const PRIMEIRA_COLUNA = 100;
const MARGEM_DIREITA = 100;
const ALTURA_ROTULO = 27;

const TAMANHO: Record<NoDoProcesso["tipo"], { w: number; h: number }> = {
  inicio: { w: 36, h: 36 },
  fim: { w: 36, h: 36 },
  gatewayExclusivo: { w: 50, h: 50 },
  tarefaUsuario: { w: 100, h: 80 },
  tarefaServico: { w: 100, h: 80 },
  tarefaManual: { w: 100, h: 80 },
};

export const idDoFluxo = (de: string, para: string) => `Fluxo_${de}_${para}`;

type Centro = {
  cx: number;
  cy: number;
  caixa: Caixa;
  tipo: NoDoProcesso["tipo"];
};

function faixasDasRaias(p: ProcessoBpmn, grade: Map<string, Posicao>) {
  const subLinha = new Map<string, number>();
  const alturas = new Map<string, number>();
  for (const raia of p.raias) {
    const nosDaRaia = p.nos.filter((n) => n.raia === raia.id);
    const linhas = [
      ...new Set(nosDaRaia.map((n) => (grade.get(n.id) as Posicao).linha)),
    ].sort((a, b) => a - b);
    for (const n of nosDaRaia) {
      subLinha.set(n.id, linhas.indexOf((grade.get(n.id) as Posicao).linha));
    }
    alturas.set(raia.id, Math.max(1, linhas.length) * ROW_H);
  }
  return { subLinha, alturas };
}

function centros(p: ProcessoBpmn, grade: Map<string, Posicao>) {
  const { subLinha, alturas } = faixasDasRaias(p, grade);
  const xRaia = POOL_X + CABECALHO;
  const topoDaRaia = new Map<string, number>();
  let y = POOL_Y;
  for (const raia of p.raias) {
    topoDaRaia.set(raia.id, y);
    y += alturas.get(raia.id) as number;
  }

  const mapa = new Map<string, Centro>();
  for (const n of p.nos) {
    const { w, h } = TAMANHO[n.tipo];
    const cx =
      xRaia + PRIMEIRA_COLUNA + (grade.get(n.id) as Posicao).coluna * COL_W;
    const cy =
      (topoDaRaia.get(n.raia) as number) +
      (subLinha.get(n.id) as number) * ROW_H +
      ROW_H / 2;
    mapa.set(n.id, {
      cx,
      cy,
      tipo: n.tipo,
      caixa: { x: cx - w / 2, y: cy - h / 2, width: w, height: h },
    });
  }

  const direita =
    Math.max(...[...mapa.values()].map((c) => c.cx)) + MARGEM_DIREITA;
  const largura = direita - xRaia;
  const raias = new Map<string, Caixa>(
    p.raias.map((r) => [
      r.id,
      {
        x: xRaia,
        y: topoDaRaia.get(r.id) as number,
        width: largura,
        height: alturas.get(r.id) as number,
      },
    ])
  );
  const pool = {
    x: POOL_X,
    y: POOL_Y,
    width: largura + CABECALHO,
    height: y - POOL_Y,
  };
  return { mapa, raias, pool };
}

function rotuloDoNo(c: Centro): Caixa {
  if (c.tipo === "gatewayExclusivo") {
    // Acima e à esquerda: as saídas do gateway usam o topo e a base.
    return {
      x: c.caixa.x - 80,
      y: c.caixa.y - ALTURA_ROTULO - 5,
      width: 100,
      height: ALTURA_ROTULO,
    };
  }
  return {
    x: c.cx - 50,
    y: c.caixa.y + c.caixa.height + 6,
    width: 100,
    height: ALTURA_ROTULO,
  };
}

const baixo = (c: Caixa) => c.y + c.height;
const direitaDe = (c: Caixa) => c.x + c.width;

/** Rota ortogonal. Para frente: sai pela direita (ou topo/base, se gateway
 *  decidindo para outra linha e a direita já é de outra saída). Para trás:
 *  desce, volta por baixo e sobe. */
function rota(s: Centro, t: Centro, pelaDireita: boolean): Ponto[] {
  if (t.cx > s.cx) {
    if (Math.abs(t.cy - s.cy) < 1) {
      return [
        { x: direitaDe(s.caixa), y: s.cy },
        { x: t.caixa.x, y: t.cy },
      ];
    }
    if (s.tipo === "gatewayExclusivo" && !pelaDireita) {
      const saida = t.cy > s.cy ? baixo(s.caixa) : s.caixa.y;
      return [
        { x: s.cx, y: saida },
        { x: s.cx, y: t.cy },
        { x: t.caixa.x, y: t.cy },
      ];
    }
    if (t.tipo === "gatewayExclusivo") {
      const entrada = s.cy > t.cy ? baixo(t.caixa) : t.caixa.y;
      return [
        { x: direitaDe(s.caixa), y: s.cy },
        { x: t.cx, y: s.cy },
        { x: t.cx, y: entrada },
      ];
    }
    const meio = (direitaDe(s.caixa) + t.caixa.x) / 2;
    return [
      { x: direitaDe(s.caixa), y: s.cy },
      { x: meio, y: s.cy },
      { x: meio, y: t.cy },
      { x: t.caixa.x, y: t.cy },
    ];
  }
  const volta = Math.max(baixo(s.caixa), baixo(t.caixa)) + 20;
  return [
    { x: s.cx, y: baixo(s.caixa) },
    { x: s.cx, y: volta },
    { x: t.cx, y: volta },
    { x: t.cx, y: baixo(t.caixa) },
  ];
}

/** Rótulo junto do último trecho horizontal — perto do destino, que é único
 *  por saída; perto da origem, duas saídas do mesmo gateway se sobreporiam. */
function rotuloDoFluxo(pontos: Ponto[], texto: string): Caixa {
  const largura = Math.min(140, Math.max(24, texto.length * 6.5));
  for (let i = pontos.length - 1; i > 0; i -= 1) {
    const a = pontos[i - 1] as Ponto;
    const b = pontos[i] as Ponto;
    if (Math.abs(a.y - b.y) < 1 && Math.abs(a.x - b.x) >= 1) {
      return b.x > a.x
        ? { x: b.x - largura - 6, y: b.y - 18, width: largura, height: 14 }
        : { x: b.x + 6, y: b.y + 4, width: largura, height: 14 };
    }
  }
  const p0 = pontos[0] as Ponto;
  return { x: p0.x + 6, y: p0.y + 4, width: largura, height: 14 };
}

/** Qual saída de cada gateway usa o lado direito: a da mesma linha, se houver;
 *  senão a mais próxima na vertical. As outras saem pelo topo ou pela base. */
function saidasPelaDireita(
  p: ProcessoBpmn,
  mapa: Map<string, Centro>
): Set<string> {
  const escolhidas = new Set<string>();
  for (const n of p.nos.filter((x) => x.tipo === "gatewayExclusivo")) {
    const s = mapa.get(n.id) as Centro;
    const frente = p.fluxos
      .filter((f) => f.de === n.id && (mapa.get(f.para) as Centro).cx > s.cx)
      .sort((a, b) => {
        const ta = mapa.get(a.para) as Centro;
        const tb = mapa.get(b.para) as Centro;
        return Math.abs(ta.cy - s.cy) - Math.abs(tb.cy - s.cy) || ta.cy - tb.cy;
      });
    const primeira = frente[0];
    if (primeira) {
      escolhidas.add(idDoFluxo(primeira.de, primeira.para));
    }
  }
  return escolhidas;
}

export function desenhar(
  p: ProcessoBpmn,
  grade: Map<string, Posicao>
): Desenho {
  const { mapa, raias, pool } = centros(p, grade);
  const nos = new Map([...mapa].map(([id, c]) => [id, c.caixa]));
  const rotulosDeNo = new Map<string, Caixa>();
  for (const n of p.nos) {
    const c = mapa.get(n.id) as Centro;
    if (n.nome.trim() && !n.tipo.startsWith("tarefa")) {
      rotulosDeNo.set(n.id, rotuloDoNo(c));
    }
  }
  const pelaDireita = saidasPelaDireita(p, mapa);
  const fluxos = new Map<string, { pontos: Ponto[]; rotulo?: Caixa }>();
  for (const f of p.fluxos) {
    const id = idDoFluxo(f.de, f.para);
    const pontos = rota(
      mapa.get(f.de) as Centro,
      mapa.get(f.para) as Centro,
      pelaDireita.has(id)
    );
    fluxos.set(id, {
      pontos,
      rotulo: f.condicao ? rotuloDoFluxo(pontos, f.condicao) : undefined,
    });
  }
  return { pool, raias, nos, rotulosDeNo, fluxos };
}
