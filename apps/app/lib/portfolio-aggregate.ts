import { calculateWSJF } from "@repo/safe-engine";

export type FeatureWsjfFields = {
  bv: number;
  tc: number;
  rr: number;
  js: number;
  wsjfScore: number;
};

export type AggregatedPortfolioEpic = {
  id: string;
  title: string;
  statusId: string;
  order: number;
  wsjfScore: number;
  bv: number;
  tc: number;
  rr: number;
  js: number;
  featureCount: number;
  strategicThemeId: string | null;
  themeTitle: string | null;
  themeColor: string | null;
  linkedOKRCount: number;
  governanceStatus: string | null;
};

/** WSJF efetivo: score persistido ou recalculado a partir dos parâmetros. */
export function effectiveFeatureWsjf(f: FeatureWsjfFields): number {
  return f.wsjfScore > 0
    ? f.wsjfScore
    : calculateWSJF({ bv: f.bv, tc: f.tc, rr: f.rr, js: f.js });
}

export function aggregateEpicRow(
  epic: {
    id: string;
    title: string;
    statusId: string;
    order: number;
    features: FeatureWsjfFields[];
    featureCount: number;
    strategicThemeId?: string | null;
    themeTitle?: string | null;
    themeColor?: string | null;
    linkedOKRCount?: number;
    governanceStatus?: string | null;
  }
): AggregatedPortfolioEpic {
  const { features } = epic;
  const n = features.length;
  const sumBv = features.reduce((s, f) => s + f.bv, 0);
  const sumTc = features.reduce((s, f) => s + f.tc, 0);
  const sumRr = features.reduce((s, f) => s + f.rr, 0);
  const sumJs = features.reduce((s, f) => s + f.js, 0);

  const wsjfSum = features.reduce((s, f) => s + effectiveFeatureWsjf(f), 0);
  const wsjfAvg = n > 0 ? Math.round((wsjfSum / n) * 100) / 100 : 0;

  return {
    id: epic.id,
    title: epic.title,
    statusId: epic.statusId,
    order: epic.order,
    wsjfScore: wsjfAvg,
    bv: sumBv,
    tc: sumTc,
    rr: sumRr,
    js: sumJs > 0 ? sumJs : 1,
    featureCount: epic.featureCount,
    strategicThemeId: epic.strategicThemeId ?? null,
    themeTitle:       epic.themeTitle ?? null,
    themeColor:       epic.themeColor ?? null,
    linkedOKRCount:   epic.linkedOKRCount ?? 0,
    governanceStatus: epic.governanceStatus ?? null,
  };
}
