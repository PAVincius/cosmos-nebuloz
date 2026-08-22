// Capacity adjustment note tones. Lives outside capacity.ts because that file
// is "use server": a Server Actions module may only export async functions, not
// plain value constants. Imported by both the action (Zod validation) and the
// capacity screen (rendering the tone options).
export const CAPACITY_NOTE_TONES = [
  "green",
  "amber",
  "red",
  "neutral",
] as const;
export type CapacityNoteTone = (typeof CAPACITY_NOTE_TONES)[number];

// story-032 AC-002 — faixas do heatmap de utilização de capacidade:
// "< 80%: green · 80–100%: yellow · > 100%: red (always red, non-configurable)".
// Fixas de propósito: o AC diz explicitamente que a faixa vermelha não é
// configurável por org, então isto não é candidato a linha de configuração.
const CAPACITY_UTIL_AMBER_PCT = 80;
const CAPACITY_UTIL_RED_PCT = 100;

export type CapacityBand = "green" | "amber" | "red";

export const CAPACITY_BAND_LABEL: Record<CapacityBand, string> = {
  green: "dentro da capacidade",
  amber: "no limite da capacidade",
  red: "acima da capacidade",
};

/**
 * Faixa de utilização de capacidade. `null` quando não há snapshot — faixa é
 * leitura de um número que existe, nunca inferência de denominador ausente.
 * Derivada uma vez na action e consumida pela tela: o segundo limiar escrito no
 * componente era o "terceiro campo divergente" que o audit de 2026-07-23
 * encontrou em outras telas.
 */
export function capacityBand(
  utilizationPct: number | null
): CapacityBand | null {
  if (utilizationPct === null) {
    return null;
  }
  if (utilizationPct > CAPACITY_UTIL_RED_PCT) {
    return "red";
  }
  if (utilizationPct >= CAPACITY_UTIL_AMBER_PCT) {
    return "amber";
  }
  return "green";
}
