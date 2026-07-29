// apps/app/app/(authenticated)/portfolio/horizons/[id]/types.ts
//
// Shapes mirror the prototype's `DB.investmentHorizons` / `DB.valueStreams` /
// `DB.epics` entries (design_handoff_cosmos_platform/prototype/data.js) so
// that `getInvestmentHorizonDetail` can be swapped for a real Prisma-backed
// server action without touching the UI layer.

export type HorizonTone =
  | "blue"
  | "green"
  | "amber"
  | "purple"
  | "red"
  | "accent";

export type InvestmentHorizonEpicSummary = {
  id: string;
  title: string;
  tone: HorizonTone;
  lifecycle: string;
  wsjf: number;
  featuresDone: number;
  featuresTotal: number;
};

export type InvestmentHorizonValueStream = {
  id: string;
  name: string;
  tone: HorizonTone;
  type: "development" | "operational";
  owner: string;
  budgetAlloc: number;
  budgetSpent: number;
  cycleTimeDays: number;
  flowEfficiency: number;
  epics: InvestmentHorizonEpicSummary[];
};

export type InvestmentHorizonKpi = {
  label: string;
  value: string;
};

export type InvestmentHorizonDetail = {
  id: string;
  name: string;
  label: string;
  tone: HorizonTone;
  desc: string;
  returnProfile: string;
  pct: number;
  guardrails: { min: number; max: number };
  kpis: InvestmentHorizonKpi[];
  valueStreams: InvestmentHorizonValueStream[];
};
