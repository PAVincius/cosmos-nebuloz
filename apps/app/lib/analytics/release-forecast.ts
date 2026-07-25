import { monteCarloForecast } from "./monte-carlo";

export type Rag = "GREEN" | "AMBER" | "RED" | "GRAY";

export type EpicConfidence = {
  rag: Rag;
  confidenceLabel: string;
  p50Date: Date | null;
  p85Date: Date | null;
  p95Date: Date | null;
  confidencePct: number | null;
  reason?: string;
};

const MS_PER_DAY = 86_400_000;
// ponytail: hardcoded floor; make per-org config only if a customer asks.
const MIN_SPRINTS_HISTORY = 3;

export function sprintsToDate(
  sprints: number,
  cadenceDays: number,
  anchor: Date
): Date {
  const days = Math.ceil(sprints) * cadenceDays;
  return new Date(anchor.getTime() + days * MS_PER_DAY);
}

export function ragFromDates(p50Date: Date, p85Date: Date, dueDate: Date): Rag {
  if (p85Date.getTime() <= dueDate.getTime()) {
    return "GREEN";
  }
  if (p50Date.getTime() <= dueDate.getTime()) {
    return "AMBER";
  }
  return "RED";
}

function fmt(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function epicConfidence(input: {
  historicalThroughput: number[];
  remainingItems: number;
  dueDate: Date | null;
  cadenceDays: number;
  anchor: Date;
}): EpicConfidence {
  const { historicalThroughput, remainingItems, dueDate, cadenceDays, anchor } =
    input;

  const gray = (reason: string): EpicConfidence => ({
    rag: "GRAY",
    confidenceLabel: "Not enough data",
    p50Date: null,
    p85Date: null,
    p95Date: null,
    confidencePct: null,
    reason,
  });

  if (remainingItems <= 0) {
    return {
      rag: "GREEN",
      confidenceLabel: "Complete",
      p50Date: anchor,
      p85Date: anchor,
      p95Date: anchor,
      confidencePct: 100,
    };
  }
  if (historicalThroughput.length < MIN_SPRINTS_HISTORY) {
    return gray("need at least 3 sprints of delivery history");
  }
  if (historicalThroughput.reduce((s, v) => s + v, 0) === 0) {
    return gray("no recent delivery");
  }
  if (!dueDate) {
    return gray("no target date set");
  }

  const f = monteCarloForecast(historicalThroughput, remainingItems);
  const p50Date = sprintsToDate(f.p50, cadenceDays, anchor);
  const p85Date = sprintsToDate(f.p85, cadenceDays, anchor);
  const p95Date = sprintsToDate(f.p95, cadenceDays, anchor);

  const rag = ragFromDates(p50Date, p85Date, dueDate);
  const dates = { p50Date, p85Date, p95Date };

  if (rag === "GREEN") {
    return {
      ...dates,
      rag,
      confidenceLabel: `On track — delivery ~${fmt(p85Date)}`,
      confidencePct: 85,
    };
  }
  if (rag === "AMBER") {
    return {
      ...dates,
      rag,
      confidenceLabel: `At risk — likely ~${fmt(p50Date)}`,
      confidencePct: 50,
    };
  }
  return {
    ...dates,
    rag,
    confidenceLabel: `Likely to slip past ${fmt(dueDate)}`,
    confidencePct: null,
  };
}
