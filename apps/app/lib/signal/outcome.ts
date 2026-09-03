// Resultado — o que mudou no negócio, contra o baseline.
//
// A outra metade que não anda sozinha. "Tempo por caso: 46 min → 31 min" só
// significa alguma coisa ao lado de quantas pessoas de fato usam.
//
// NOTA sobre o tom (verde/âmbar/vermelho): o protótipo trazia o tom escrito à
// mão em cada iniciativa, e ele não é reproduzível por regra — a IN-027 caiu 7%
// e ficou vermelha, a IN-021 caiu 8% e ficou âmbar. Era cor de narrativa, não
// campo calculado. Aqui o tom sai de uma regra declarada (abaixo), que é
// defensável em comitê; onde ela discorda do mock, a regra ganha.

export type OutcomeDirection = "LOWER_IS_BETTER" | "HIGHER_IS_BETTER";

export type OutcomeSnapshotInput = {
  periodStart: Date;
  metricLabel: string;
  baselineValue: string;
  currentValue: string;
  numericBaseline?: number | null;
  numericCurrent?: number | null;
  isSecondary?: boolean;
  direction?: OutcomeDirection;
};

export type OutcomeComputation = {
  metricLabel: string;
  baselineValue: string;
  currentValue: string;
  /** Variação percentual assinada contra o baseline. Nulo quando falta número
   *  limpo dos dois lados — "8,2% de retrabalho" pode ser texto puro. */
  deltaPct: number | null;
  improved: boolean | null;
  tone: "green" | "amber" | "red" | "neutral";
  isSecondary: boolean;
  direction: OutcomeDirection;
  trend: number[];
};

/** Abaixo disto a melhora não se distingue de ruído de medição. */
const MEANINGFUL_CHANGE_PCT = 10;

/**
 * Tom do resultado.
 *
 * - piorou, em qualquer magnitude → vermelho. Uma métrica que anda para trás é
 *   notícia, mesmo pequena.
 * - melhorou menos que 10% → âmbar. Existe, mas não sustenta uma decisão de
 *   escalar sozinha.
 * - melhorou 10% ou mais → verde.
 * - sem número comparável → neutro. Nunca verde por omissão.
 */
export function outcomeTone(
  deltaPct: number | null,
  direction: OutcomeDirection
): OutcomeComputation["tone"] {
  if (deltaPct === null) {
    return "neutral";
  }
  const improvement = direction === "LOWER_IS_BETTER" ? -deltaPct : deltaPct;
  if (improvement <= 0) {
    return "red";
  }
  return improvement >= MEANINGFUL_CHANGE_PCT ? "green" : "amber";
}

export function deltaPctOf(
  baseline: number | null | undefined,
  current: number | null | undefined
): number | null {
  if (
    baseline === null ||
    baseline === undefined ||
    current === null ||
    current === undefined ||
    baseline === 0
  ) {
    return null;
  }
  return ((current - baseline) / baseline) * 100;
}

export function computeOutcome(
  snapshots: OutcomeSnapshotInput[]
): OutcomeComputation | null {
  if (snapshots.length === 0) {
    return null;
  }

  const ordered = [...snapshots].sort(
    (a, b) => a.periodStart.getTime() - b.periodStart.getTime()
  );
  const latest = ordered.at(-1) as OutcomeSnapshotInput;
  const direction = latest.direction ?? "LOWER_IS_BETTER";
  const deltaPct = deltaPctOf(latest.numericBaseline, latest.numericCurrent);
  const improvement =
    deltaPct === null
      ? null
      : direction === "LOWER_IS_BETTER"
        ? -deltaPct
        : deltaPct;

  return {
    metricLabel: latest.metricLabel,
    baselineValue: latest.baselineValue,
    currentValue: latest.currentValue,
    deltaPct,
    improved: improvement === null ? null : improvement > 0,
    tone: outcomeTone(deltaPct, direction),
    isSecondary: latest.isSecondary ?? false,
    direction,
    trend: ordered
      .map((s) => s.numericCurrent)
      .filter((n): n is number => typeof n === "number"),
  };
}

/** "−33%" com sinal explícito. O menos é U+2212, não hífen: em fonte tabular o
 *  hífen fica curto demais e some ao lado do número. */
export function fmtDelta(deltaPct: number | null): string {
  if (deltaPct === null) {
    return "—";
  }
  const rounded = Math.round(deltaPct);
  return rounded < 0 ? `−${Math.abs(rounded)}%` : `+${rounded}%`;
}
