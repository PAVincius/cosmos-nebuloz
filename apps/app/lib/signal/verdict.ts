// Veredito — o cruzamento adoção × valor.
//
// É a linguagem de decisão do produto: o CFO não pergunta "qual o ROI", ele
// pergunta "escalo, investigo, destravo ou paro". As quatro respostas saem de
// dois limiares do tenant, e não de julgamento caso a caso.
//
// Por que não é coluna no banco: os limiares vivem em `SignalSettings` e mudam.
// Um veredito persistido continuaria dizendo "Provado" depois de o comitê
// subir a régua de 1,5× para 2,0× — e a tela mentiria com aparência de dado.

export type SignalVerdict = "PROVEN" | "VANITY" | "PROMISE" | "STOP";

export type VerdictBars = {
  /** % de adoção a partir da qual "o time usa". */
  adoptionBar: number;
  /** Múltiplo de ROI a partir do qual "vale escalar". */
  valueBar: number;
};

export const DEFAULT_BARS: VerdictBars = { adoptionBar: 60, valueBar: 1.5 };

export type VerdictMeta = {
  label: string;
  tone: "green" | "red" | "amber" | "neutral";
  icon: string;
  /** O que fazer a seguir. Veredito sem encaminhamento é diagnóstico ocioso. */
  action: string;
  why: string;
};

export const VERDICT_META: Record<SignalVerdict, VerdictMeta> = {
  PROVEN: {
    label: "Provado",
    tone: "green",
    icon: "check",
    action: "Escalar orçamento",
    why: "O time usa e o retorno se sustenta acima do limiar de escala.",
  },
  VANITY: {
    label: "Uso sem valor",
    tone: "red",
    icon: "alert",
    action: "Investigar método",
    why: "Adoção alta sem retorno correspondente — ou a métrica está errada, ou o ganho não é econômico.",
  },
  PROMISE: {
    label: "Promessa parada",
    tone: "amber",
    icon: "trendingUp",
    action: "Destravar adoção",
    why: "Quem usa colhe retorno, mas a base de usuários não acompanhou.",
  },
  STOP: {
    label: "Candidata a parada",
    tone: "neutral",
    icon: "ban",
    action: "Levar ao comitê",
    why: "Nem adoção nem retorno. Sem hipótese nova, o dinheiro rende mais em outra iniciativa.",
  },
};

/**
 * Veredito de uma iniciativa.
 *
 * `multiple` nulo (custo não informado, ver `computeRoi`) conta como abaixo da
 * régua: não dá para afirmar que vale escalar sem saber o que custou. Tratar
 * nulo como "acima" seria conceder o benefício da dúvida justamente onde falta
 * o dado.
 *
 * As comparações usam `>=` e valores CRUS, nunca arredondados: uma adoção de
 * 59,96% arredonda para 60,0 na tela, e deixá-la passar da régua por causa da
 * apresentação faria a mesma iniciativa ter vereditos diferentes conforme a
 * casa decimal exibida.
 */
export function verdictOf(
  input: { adoptionPct: number; multiple: number | null },
  bars: VerdictBars = DEFAULT_BARS
): SignalVerdict {
  const used = input.adoptionPct >= bars.adoptionBar;
  const worth = input.multiple !== null && input.multiple >= bars.valueBar;
  if (used) {
    return worth ? "PROVEN" : "VANITY";
  }
  return worth ? "PROMISE" : "STOP";
}

/** Veredito + rótulo, tom e ação — o que a tela precisa de uma vez só. */
export function verdictWithMeta(
  input: { adoptionPct: number; multiple: number | null },
  bars: VerdictBars = DEFAULT_BARS
): { verdict: SignalVerdict } & VerdictMeta {
  const verdict = verdictOf(input, bars);
  return { verdict, ...VERDICT_META[verdict] };
}

/** Vereditos que caracterizam investimento em risco, para o agregado da casca. */
export const AT_RISK_VERDICTS: readonly SignalVerdict[] = ["VANITY", "STOP"];

export function isAtRisk(verdict: SignalVerdict): boolean {
  return AT_RISK_VERDICTS.includes(verdict);
}
