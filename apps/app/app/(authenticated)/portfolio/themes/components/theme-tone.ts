// Theme color (freeform hex) → nearest Cosmos accent tone.
// Same 5 swatches offered by the "Novo tema" color picker (new-theme-form.tsx).

export type AccentTone =
  | "blue"
  | "purple"
  | "green"
  | "amber"
  | "red"
  | "accent";

const TONE_BY_HEX: Record<string, AccentTone> = {
  "#2563eb": "blue",
  "#7c3aed": "purple",
  "#16a34a": "green",
  "#d97706": "amber",
  "#e11d48": "red",
};

export function resolveAccentTone(hex: string): AccentTone {
  return TONE_BY_HEX[hex.toLowerCase()] ?? "accent";
}

export function toneSolidVar(tone: AccentTone): string {
  return tone === "accent" ? "var(--accent-c)" : `var(--${tone})`;
}
export function toneTextVar(tone: AccentTone): string {
  return `var(--${tone}-text)`;
}
export function toneSoftVar(tone: AccentTone): string {
  return `var(--${tone}-soft)`;
}
export function toneRgbVar(tone: AccentTone): string {
  return `var(--${tone}-rgb)`;
}
