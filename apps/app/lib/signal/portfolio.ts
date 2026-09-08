// Portfólio — a leitura de cima, para US3.
//
// Função pura. A pergunta que esta tela responde não é "quanto rendeu?", é
// "onde o dinheiro rende e onde não rende" — e a diferença muda o desenho: o
// agregado sozinho esconde que metade do retorno vem de uma iniciativa e o
// resto está preso em três que não andam.

import { adoptionPct } from "./adoption";
import { computePortfolioRoi, computeRoi, type RoiEntryInput } from "./roi";
import {
  isAtRisk,
  type SignalVerdict,
  VERDICT_META,
  type VerdictBars,
  verdictOf,
} from "./verdict";

export type PortfolioInput = {
  code: string;
  name: string;
  businessUnit: string;
  category: string;
  status: string;
  entries: RoiEntryInput[];
  adoption: { activeUsers: number; licensedUsers: number } | null;
};

export type PortfolioItem = {
  code: string;
  name: string;
  businessUnit: string;
  category: string;
  invested: number;
  returned: number;
  multiple: number | null;
  adoptionPct: number;
  verdict: SignalVerdict;
};

export type PortfolioGroup = {
  key: string;
  invested: number;
  returned: number;
  multiple: number | null;
  atRisk: number;
  count: number;
};

export type PortfolioSummary = {
  invested: number;
  returned: number;
  multiple: number | null;
  /** Investido preso em iniciativas com veredito VANITY ou STOP. */
  atRisk: number;
  /** Quantas iniciativas em cada quadrante. */
  byVerdict: Record<SignalVerdict, number>;
  items: PortfolioItem[];
  byBusinessUnit: PortfolioGroup[];
  byCategory: PortfolioGroup[];
  /** As réguas usadas neste cálculo. Viajam junto porque a matriz precisa
   *  delas para posicionar, e porque discutir um quadrante sem saber contra o
   *  que ele foi medido é discutir no vazio. */
  bars: VerdictBars;
};

function toItem(i: PortfolioInput, bars: VerdictBars): PortfolioItem {
  const roi = computeRoi(i.entries);
  const pct = i.adoption ? adoptionPct(i.adoption) : 0;
  return {
    code: i.code,
    name: i.name,
    businessUnit: i.businessUnit,
    category: i.category,
    invested: roi.invested,
    returned: roi.returned,
    multiple: roi.multiple,
    adoptionPct: pct,
    verdict: verdictOf({ adoptionPct: pct, multiple: roi.multiple }, bars),
  };
}

function groupBy(
  items: PortfolioItem[],
  pick: (i: PortfolioItem) => string
): PortfolioGroup[] {
  const map = new Map<string, PortfolioItem[]>();
  for (const item of items) {
    const key = pick(item);
    map.set(key, [...(map.get(key) ?? []), item]);
  }
  return (
    [...map.entries()]
      .map(([key, group]) => {
        const agg = computePortfolioRoi(group);
        return {
          key,
          invested: agg.invested,
          returned: agg.returned,
          multiple: agg.multiple,
          atRisk: group
            .filter((i) => isAtRisk(i.verdict))
            .reduce((a, i) => a + i.invested, 0),
          count: group.length,
        };
      })
      // Maior investimento primeiro: é onde a decisão pesa mais.
      .sort((a, b) => b.invested - a.invested)
  );
}

export function computePortfolio(
  initiatives: PortfolioInput[],
  bars: VerdictBars
): PortfolioSummary {
  const items = initiatives.map((i) => toItem(i, bars));
  const agg = computePortfolioRoi(items);

  const byVerdict: Record<SignalVerdict, number> = {
    PROVEN: 0,
    VANITY: 0,
    PROMISE: 0,
    STOP: 0,
  };
  for (const item of items) {
    byVerdict[item.verdict] += 1;
  }

  return {
    ...agg,
    atRisk: items
      .filter((i) => isAtRisk(i.verdict))
      .reduce((a, i) => a + i.invested, 0),
    byVerdict,
    items,
    byBusinessUnit: groupBy(items, (i) => i.businessUnit),
    byCategory: groupBy(items, (i) => i.category),
    bars,
  };
}

/**
 * Ranking de leitura: o que precisa de decisão primeiro.
 *
 * Não é ordenação por valor. Uma iniciativa de R$ 900 mil que está indo bem não
 * precisa de ninguém; uma de R$ 90 mil que consome orçamento sem entregar
 * precisa de alguém hoje. Dentro do mesmo veredito, aí sim o dinheiro decide.
 */
const VERDICT_RANK: Record<SignalVerdict, number> = {
  VANITY: 0,
  STOP: 1,
  PROMISE: 2,
  PROVEN: 3,
};

export function rankForDecision(items: PortfolioItem[]): PortfolioItem[] {
  return [...items].sort((a, b) => {
    const byVerdict = VERDICT_RANK[a.verdict] - VERDICT_RANK[b.verdict];
    return byVerdict === 0 ? b.invested - a.invested : byVerdict;
  });
}

/** Posição na matriz adoção × valor, em porcentagem do quadrante. */
export type MatrixPoint = PortfolioItem & {
  /** 0..100 no eixo horizontal (adoção). */
  x: number;
  /** 0..100 no eixo vertical (valor), com a régua no meio. */
  y: number;
  /** Raio proporcional ao investido, 0..1. */
  weight: number;
  label: string;
  tone: string;
};

/**
 * Projeta as iniciativas na matriz.
 *
 * O eixo Y é comprimido em torno da régua de propósito: um 12× e um 4× ficam
 * ambos no topo, porque a decisão que a matriz informa ("escalar ou parar?") é
 * a mesma nos dois casos. Escala linear crua faria o 12× empurrar todo o resto
 * para a base e a matriz perderia a função.
 */
export function toMatrix(
  items: PortfolioItem[],
  bars: VerdictBars
): MatrixPoint[] {
  const maxInvested = Math.max(...items.map((i) => i.invested), 1);
  return items.map((i) => {
    const m = i.multiple ?? 0;
    // Abaixo da régua ocupa a metade de baixo; acima, a de cima — com
    // saturação, para outlier não achatar os demais.
    const y =
      m >= bars.valueBar
        ? 50 + Math.min((m - bars.valueBar) / bars.valueBar, 1) * 50
        : Math.max(m / bars.valueBar, 0) * 50;
    return {
      ...i,
      x: Math.min(Math.max(i.adoptionPct, 0), 100),
      y: Math.min(Math.max(y, 0), 100),
      weight: i.invested / maxInvested,
      label: VERDICT_META[i.verdict].label,
      tone: VERDICT_META[i.verdict].tone,
    };
  });
}
