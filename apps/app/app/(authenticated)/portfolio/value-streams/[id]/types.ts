// apps/app/app/(authenticated)/portfolio/value-streams/[id]/types.ts
//
// Shapes mirror the prototype's `DB.valueStreams` / `DB.arts` / `DB.epics` /
// `DB.investmentHorizons` entries (design_handoff_cosmos_platform/prototype/
// data.js) so that `getValueStreamDetail` can be swapped for a real
// Prisma-backed server action without touching the UI layer.

export type ValueStreamTone =
  | "blue"
  | "green"
  | "amber"
  | "purple"
  | "red"
  | "accent";

export type ValueStreamEpicSummary = {
  id: string;
  title: string;
  tone: ValueStreamTone;
  lifecycle: string;
  wsjf: number;
  featuresDone: number;
  featuresTotal: number;
};

export type ValueStreamArtSummary = {
  id: string;
  name: string;
  tone: ValueStreamTone;
  status: string;
  teams: number;
  members: number;
  confidence: number;
  budgetAlloc: number;
  budgetSpent: number;
};

export type ValueStreamKpi = {
  label: string;
  value: string;
  note?: string;
};

export type ValueStreamDetail = {
  id: string;
  name: string;
  tone: ValueStreamTone;
  type: "development" | "operational";
  mission: string;
  description: string;
  owner: string;
  horizonId: string;
  horizonLabel: string;
  horizonTone: ValueStreamTone;
  budgetAlloc: number;
  budgetSpent: number;
  metrics: {
    cycleTimeDays: number;
    flowEfficiency: number;
    throughput: number;
    wip: number;
    weeklyThroughput: number[];
  };
  kpis: ValueStreamKpi[];
  arts: ValueStreamArtSummary[];
  epics: ValueStreamEpicSummary[];
};
