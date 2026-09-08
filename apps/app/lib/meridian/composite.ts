import type { MeridianAxis } from "@repo/database";
import { AXIS_IDS } from "./axes";

// Derivações de leitura. Nenhuma vira coluna: composite muda quando um override
// entra, e uma coluna cacheada aqui seria drift silencioso no relatório.

export type AxisScoreLike = {
  axis: MeridianAxis;
  computed: number;
  final: number | null;
};

/** Score que vale: o override quando existe, o computado caso contrário. */
export const finalOf = (s: AxisScoreLike): number => s.final ?? s.computed;

/** Média dos cinco eixos. Null quando o scoring ainda não rodou — nunca zero:
 *  "0" e "ainda não medido" são coisas diferentes e o relatório não pode
 *  confundir as duas. */
export function compositeOf(scores: AxisScoreLike[]): number | null {
  if (scores.length < AXIS_IDS.length) {
    return null;
  }
  const byAxis = new Map(scores.map((s) => [s.axis, s]));
  const values = AXIS_IDS.map((a) => byAxis.get(a));
  if (values.some((v) => v === undefined)) {
    return null;
  }
  const sum = values.reduce((acc, v) => acc + finalOf(v as AxisScoreLike), 0);
  return Math.round(sum / AXIS_IDS.length);
}

export type Tone = "green" | "amber" | "red";

/** ≥70 pronto · 50–69 em construção · <50 crítico. */
export const scoreTone = (s: number): Tone =>
  s >= 70 ? "green" : s >= 50 ? "amber" : "red";

/** ≥75% confiável · 50–74% frágil · <50% insuficiente. */
export const confTone = (c: number): Tone =>
  c >= 0.75 ? "green" : c >= 0.5 ? "amber" : "red";
