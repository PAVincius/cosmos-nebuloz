// Formulário do caso de negócio — puro, sem servidor.
//
// Converte o que a pessoa digita (texto, reais, vírgula decimal) no que
// `saveDraft` aceita, e recusa antes de o servidor recusar, dizendo qual campo.
// O número que sai daqui é o que o patrocinador assina e o Signal apura: por
// isso a meta tem de apontar para o lado da direção, e o dinheiro não passa por
// ponto flutuante até virar centavos.

export type MetricForm = {
  label: string;
  unit: string;
  baseValue: string;
  targetValue: string;
  direction: "DOWN" | "UP";
  confidence: "MEASURED" | "ESTIMATED" | "DECLARED";
  sourceLabel: string;
  sampleLabel: string;
};

export type CaseForm = {
  metrics: MetricForm[];
  windowMonths: string;
  cadence: "monthly" | "quarterly";
  benefitKind: "COST_AVOIDED" | "REVENUE_PROTECTED" | "REVENUE_NEW";
  benefitHard: boolean;
  /** Reais, como a pessoa digita ("1.234,56"). Vira centavos no envio. */
  benefitAnnual: string;
  benefitBasis: string;
};

export type SaveDraftPayload = {
  metrics: {
    key: string;
    label: string;
    unit: string;
    baseValue: string;
    targetValue: string;
    direction: "DOWN" | "UP";
    confidence: "MEASURED" | "ESTIMATED" | "DECLARED";
    sourceLabel: string;
    sampleLabel: string;
  }[];
  windowMonths: number;
  cadence: "monthly" | "quarterly";
  benefitKind: CaseForm["benefitKind"];
  benefitHard: boolean;
  benefitAnnualCents?: number;
  benefitBasis: string;
};

export type FormResult =
  | { ok: true; input: SaveDraftPayload }
  | { ok: false; errors: string[] };

const MAX_METRICS = 20;

const DECIMAL = /^-?\d+(\.\d+)?$/;
const UNSIGNED_DECIMAL = /^\d+(\.\d+)?$/;
const DOTS = /\./g;
const ACCENTS = /[\u0300-\u036f]/g;
const NOT_ALNUM = /[^a-z0-9]+/g;
const EDGE_DASHES = /^-+|-+$/g;

export const blankMetric = (): MetricForm => ({
  label: "",
  unit: "",
  baseValue: "",
  targetValue: "",
  direction: "DOWN",
  confidence: "DECLARED",
  sourceLabel: "",
  sampleLabel: "",
});

/** "4,5" → "4.5". Nulo quando não é número. O servidor exige ponto decimal. */
function decimal(raw: string): string | null {
  const s = raw.trim().replace(",", ".");
  return DECIMAL.test(s) ? s : null;
}

/** "1.234,56" → 123456 centavos. Nulo quando não é dinheiro. */
function toCents(raw: string): number | null {
  const s = raw.trim();
  const normalized = s.includes(",")
    ? s.replace(DOTS, "").replace(",", ".")
    : s;
  if (!UNSIGNED_DECIMAL.test(normalized)) {
    return null;
  }
  const [int = "0", frac = ""] = normalized.split(".");
  const cents = Math.round(Number(`0.${frac || "0"}`) * 100);
  return Number(int) * 100 + cents;
}

function slug(label: string): string {
  const s = label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(NOT_ALNUM, "-")
    .replace(EDGE_DASHES, "")
    .slice(0, 60);
  return s || "metrica";
}

/** Chave estável e única dentro da versão: a chave é o que o Signal lê. */
function uniqueKeys(labels: string[]): string[] {
  const seen = new Map<string, number>();
  return labels.map((label) => {
    const base = slug(label);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  });
}

export function toSaveDraftInput(form: CaseForm): FormResult {
  const errors: string[] = [];

  if (form.metrics.length === 0) {
    errors.push("Inclua ao menos uma métrica.");
  }
  if (form.metrics.length > MAX_METRICS) {
    errors.push(`No máximo ${MAX_METRICS} métricas por versão.`);
  }

  const metrics: SaveDraftPayload["metrics"] = [];
  const keys = uniqueKeys(form.metrics.map((m) => m.label));
  form.metrics.forEach((m, i) => {
    const at = `Métrica ${i + 1}`;
    const required: [string, string][] = [
      ["o rótulo", m.label],
      ["a unidade", m.unit],
      ["a fonte", m.sourceLabel],
      ["a amostra", m.sampleLabel],
    ];
    for (const [what, value] of required) {
      if (!value.trim()) {
        errors.push(`${at}: preencha ${what}.`);
      }
    }
    const base = decimal(m.baseValue);
    const target = decimal(m.targetValue);
    if (base === null) {
      errors.push(`${at}: a linha de base precisa ser um número.`);
    }
    if (target === null) {
      errors.push(`${at}: a meta precisa ser um número.`);
    }
    if (base !== null && target !== null) {
      const b = Number(base);
      const t = Number(target);
      if (m.direction === "DOWN" && !(t < b)) {
        errors.push(
          `${at}: para cair, a meta precisa ser menor que a linha de base.`
        );
      }
      if (m.direction === "UP" && !(t > b)) {
        errors.push(
          `${at}: para subir, a meta precisa ser maior que a linha de base.`
        );
      }
    }
    metrics.push({
      key: keys[i] as string,
      label: m.label.trim(),
      unit: m.unit.trim(),
      baseValue: base ?? "",
      targetValue: target ?? "",
      direction: m.direction,
      confidence: m.confidence,
      sourceLabel: m.sourceLabel.trim(),
      sampleLabel: m.sampleLabel.trim(),
    });
  });

  const months = Number(form.windowMonths);
  if (
    form.windowMonths.trim() === "" ||
    !Number.isInteger(months) ||
    months < 1 ||
    months > 36
  ) {
    errors.push("A janela de apuração vai de 1 a 36 meses, em número inteiro.");
  }
  if (!form.benefitBasis.trim()) {
    errors.push("Escreva a base do benefício: de onde vem o ganho.");
  }
  let cents: number | undefined;
  if (form.benefitAnnual.trim() !== "") {
    const c = toCents(form.benefitAnnual);
    if (c === null) {
      errors.push("O benefício anual precisa ser um valor em reais.");
    } else {
      cents = c;
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    input: {
      metrics,
      windowMonths: months,
      cadence: form.cadence,
      benefitKind: form.benefitKind,
      benefitHard: form.benefitHard,
      ...(cents === undefined ? {} : { benefitAnnualCents: cents }),
      benefitBasis: form.benefitBasis.trim(),
    },
  };
}

type DetailForForm = {
  metrics: {
    key: string;
    label: string;
    unit: string;
    baseValue: string;
    targetValue: string;
    direction: string;
    confidence: string;
    sourceLabel: string;
    sampleLabel: string;
  }[];
  windowMonths: number | null;
  cadence: string | null;
  benefitKind: string;
  benefitHard: boolean;
  benefitAnnualCents: number | null;
  benefitBasis: string;
};

/** Decimal do Postgres vem com zeros de escala ("46.0000"). */
const plain = (v: string) => String(Number(v));

function reais(cents: number): string {
  const int = Math.floor(cents / 100);
  const rest = cents % 100;
  return rest === 0 ? String(int) : `${int},${String(rest).padStart(2, "0")}`;
}

/** O caso salvo, de volta no formulário. */
export function fromDetail(d: DetailForForm): CaseForm {
  return {
    metrics:
      d.metrics.length > 0
        ? d.metrics.map((m) => ({
            label: m.label,
            unit: m.unit,
            baseValue: plain(m.baseValue),
            targetValue: plain(m.targetValue),
            direction: m.direction as MetricForm["direction"],
            confidence: m.confidence as MetricForm["confidence"],
            sourceLabel: m.sourceLabel,
            sampleLabel: m.sampleLabel,
          }))
        : [blankMetric()],
    windowMonths: String(d.windowMonths ?? 6),
    cadence: (d.cadence as CaseForm["cadence"]) ?? "monthly",
    benefitKind: d.benefitKind as CaseForm["benefitKind"],
    benefitHard: d.benefitHard,
    benefitAnnual:
      d.benefitAnnualCents === null ? "" : reais(d.benefitAnnualCents),
    benefitBasis: d.benefitBasis,
  };
}
