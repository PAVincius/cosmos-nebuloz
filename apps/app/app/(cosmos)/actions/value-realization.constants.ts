import { z } from "zod";

// EpicValueMetric realization status. Lives outside value-realization.ts
// because that file is "use server": a Server Actions module may only export
// async functions, not plain value constants. Imported by the action (Zod
// schema) and by the Value Realization screen (type).
export const ValueMetricStatus = z.enum([
  "pending",
  "tracking",
  "at-risk",
  "done",
]);
export type ValueMetricStatus = z.infer<typeof ValueMetricStatus>;

/**
 * Status que são uma decisão sobre a hipótese de valor, não uma medição a mais:
 * "done" é confirmá-la, "at-risk" é declarar que ela não está se sustentando.
 * O UC-09 (docs/PRD-v1.0.md:822, passos 5–6) exige que essa decisão fique
 * registrada com o motivo — por isso os dois exigem justificativa, e "pending"
 * e "tracking" não. A lista é lida pelo servidor (recusa) e pelo formulário da
 * tela (campo obrigatório), para não divergirem.
 */
export const TERMINAL_VALUE_STATUSES: readonly ValueMetricStatus[] = [
  "done",
  "at-risk",
];

export function requiresHypothesisRationale(status: string): boolean {
  return (TERMINAL_VALUE_STATUSES as readonly string[]).includes(status);
}
