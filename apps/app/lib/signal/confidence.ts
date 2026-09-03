// Confiança — quanto o número de ROI merece crédito.
//
// É o contrapeso do produto inteiro: sem ele, o Signal seria mais um painel que
// afirma retorno sem dizer o que sustenta a afirmação. O score não mede se a
// iniciativa é boa; mede se dá para confiar na medição dela.
//
// Score = soma dos `got`. NÃO é coluna, pelo mesmo motivo do ROI: o protótipo
// guardava 86 para a IN-014 enquanto os fatores somavam 93, e nenhum dos dois
// números sabia do outro.

export type ConfidenceBand = "HIGH" | "MEDIUM" | "LOW" | "NONE";

export type ConfidenceFactorInput = {
  key: string;
  label: string;
  /** Peso do fator no total. A soma dos pesos do tenant é 100. */
  weight: number;
  /** Quanto o fator obteve, de 0 a `weight`. */
  got: number;
  /** Por que perdeu ponto. Sem isto o score não tem apelação. */
  note?: string | null;
};

export type ConfidenceComputation = {
  score: number;
  band: ConfidenceBand;
  bandLabel: string;
  tone: "green" | "amber" | "red" | "neutral";
  factors: (ConfidenceFactorInput & { lost: number })[];
};

const BAND_META: Record<
  ConfidenceBand,
  { label: string; tone: ConfidenceComputation["tone"] }
> = {
  HIGH: { label: "Alta", tone: "green" },
  MEDIUM: { label: "Média", tone: "amber" },
  LOW: { label: "Baixa", tone: "red" },
  NONE: { label: "Sem dado", tone: "neutral" },
};

export function bandOf(score: number): ConfidenceBand {
  if (score >= 80) {
    return "HIGH";
  }
  if (score >= 65) {
    return "MEDIUM";
  }
  if (score > 0) {
    return "LOW";
  }
  return "NONE";
}

/**
 * Erro de configuração do catálogo de fatores.
 *
 * Separado de erro de dado porque o conserto é outro: pesos que não somam 100
 * são problema de quem configurou o tenant, não de quem preencheu a avaliação.
 */
export class ConfidenceConfigError extends Error {
  readonly rule: string;

  constructor(rule: string, message: string) {
    super(message);
    this.name = "ConfidenceConfigError";
    this.rule = rule;
  }
}

/** Pesos precisam somar 100 — senão "score 70" não quer dizer nada. */
export function assertWeightsSumTo100(
  factors: Pick<ConfidenceFactorInput, "weight">[]
): void {
  const sum = factors.reduce((a, f) => a + f.weight, 0);
  if (sum !== 100) {
    throw new ConfidenceConfigError(
      "confidence.weights.sum",
      `Os pesos dos fatores de confiança somam ${sum}, e precisam somar 100.`
    );
  }
}

export function computeConfidence(
  factors: ConfidenceFactorInput[]
): ConfidenceComputation {
  if (factors.length > 0) {
    assertWeightsSumTo100(factors);
  }

  for (const f of factors) {
    if (f.got < 0 || f.got > f.weight) {
      // Um fator acima do próprio peso é bug do avaliador, não dado ruim:
      // silenciar com clamp esconderia o bug e inflaria o score.
      throw new ConfidenceConfigError(
        "confidence.got.range",
        `O fator "${f.label}" obteve ${f.got} de um peso de ${f.weight}.`
      );
    }
  }

  const score = factors.reduce((a, f) => a + f.got, 0);
  const band = bandOf(score);
  return {
    score,
    band,
    bandLabel: BAND_META[band].label,
    tone: BAND_META[band].tone,
    factors: factors.map((f) => ({ ...f, lost: f.weight - f.got })),
  };
}

/** Catálogo padrão, semeado por tenant. Os pesos vêm do handoff. */
export const DEFAULT_CONFIDENCE_RULES = [
  {
    key: "baseline.signed",
    label: "Baseline assinado pelo dono do processo",
    weight: 30,
    order: 0,
  },
  {
    key: "sources.fresh",
    label: "Fontes sincronizando (≤ 24 h)",
    weight: 25,
    order: 1,
  },
  {
    key: "formula.reviewed",
    label: "Fórmula versionada e revisada",
    weight: 20,
    order: 2,
  },
  {
    key: "sample.size",
    label: "Amostra ≥ 4 semanas pós-adoção",
    weight: 25,
    order: 3,
  },
] as const;
