import type { BoardTone } from "../../components/board-primitives";

// screen-risks.jsx (RISKS mock, ROAM_TONE) — mesma ordem/tons do board anterior
// (roam-board.tsx COLUMNS), preservados para não regredir o significado visual
// já validado no resto do app.
export const ROAM_STATUSES = [
  "IDENTIFIED",
  "OWNED",
  "ACCEPTED",
  "MITIGATED",
  "RESOLVED",
] as const;

export type RoamStatus = (typeof ROAM_STATUSES)[number];

export const ROAM_LABELS: Record<RoamStatus, string> = {
  IDENTIFIED: "Identificado",
  OWNED: "Atribuído",
  ACCEPTED: "Aceito",
  MITIGATED: "Mitigado",
  RESOLVED: "Resolvido",
};

export const ROAM_TONE: Record<RoamStatus, BoardTone> = {
  IDENTIFIED: "red",
  OWNED: "blue",
  ACCEPTED: "amber",
  MITIGATED: "purple",
  RESOLVED: "green",
};

export const IMPACT_LABELS: Record<string, string> = {
  low: "Baixo",
  medium: "Médio",
  high: "Alto",
  critical: "Crítico",
};

export const IMPACT_TONE: Record<string, BoardTone> = {
  low: "green",
  medium: "amber",
  high: "red",
  critical: "red",
};

// screen-risks.jsx usa impacto 1..5 numérico; o schema real persiste 4 níveis
// categóricos — mapeados para a mesma escala de severidade (score = prob × impact).
export const IMPACT_VALUE: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 4,
  critical: 5,
};

export const PROBABILITY_LABELS: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
};

// schema real persiste 3 níveis (não 1..5); mapeados na mesma escala de severidade.
export const PROBABILITY_VALUE: Record<string, number> = {
  low: 1,
  medium: 3,
  high: 5,
};

export const CATEGORY_LABELS: Record<string, string> = {
  technical: "Técnico",
  business: "Negócio",
  organizational: "Organizacional",
  external: "Externo",
};

export const CATEGORY_TONE: Record<string, BoardTone> = {
  technical: "blue",
  business: "purple",
  organizational: "neutral",
  external: "amber",
};

/** screen-risks.jsx cellTone — mesmos cortes de cor por score de severidade. */
export function severityTone(score: number): BoardTone {
  if (score >= 16) {
    return "red";
  }
  if (score >= 9) {
    return "amber";
  }
  if (score >= 4) {
    return "blue";
  }
  return "green";
}

/** Mesmas variáveis de tom usadas por Badge (@repo/design-system/components/cosmos/badge). */
export function toneStyleVars(tone: BoardTone): {
  bg: string;
  text: string;
  border: string;
} {
  if (tone === "neutral") {
    return { bg: "var(--chip-bg)", text: "var(--ink-muted)", border: "var(--hairline)" };
  }
  return {
    bg: `var(--${tone}-soft)`,
    text: `var(--${tone}-text)`,
    border: `rgba(var(--${tone}-rgb),.22)`,
  };
}
