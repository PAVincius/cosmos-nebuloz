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
