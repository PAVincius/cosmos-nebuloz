// Regras de alerta — US5. Puro: nenhuma consulta, nenhum acesso a sessão.
//
// São três, e cada uma existe para uma pergunta diferente:
//
//   LOW   — "compramos e ninguém usa"       → adoção baixa e SUSTENTADA
//   WEAK  — "usam e não rende"              → adoção alta e ROI abaixo do break-even
//   STALE — "não sei mais se o número vale" → fonte parada
//
// Nenhuma delas dispara sem dizer o próximo passo. Um alerta que só informa
// que algo está ruim transfere a ansiedade sem transferir a ação — e a fila
// vira um mural que as pessoas aprendem a ignorar.

export type AlertKind = "LOW" | "WEAK" | "STALE";

export type AlertThresholds = {
  /** % a partir da qual "o time usa". */
  adoptionBar: number;
  /** % abaixo da qual a adoção conta como baixa. */
  lowAdoptionPct: number;
  /** Por quantas semanas a adoção precisa ficar baixa antes de virar alerta. */
  lowAdoptionWeeks: number;
  /** Múltiplo abaixo do qual o retorno não paga o custo. */
  weakRoi: number;
};

export type AlertSnapshot = {
  periodStart: Date;
  periodEnd: Date;
  pct: number;
};

export type AlertSource = {
  code: string;
  name: string;
  health: "HEALTHY" | "STALE" | "DOWN";
};

export type AlertRuleInput = {
  initiativeName: string;
  /** Do mais recente para o mais antigo. */
  adoption: AlertSnapshot[];
  /** Nulo = sem ROI medido. Sem medida não há acusação de "não rende". */
  multiple: number | null;
  sources: AlertSource[];
};

export type AlertFinding = {
  kind: AlertKind;
  what: string;
  nextStep: string;
};

export const ALERT_META: Record<
  AlertKind,
  { label: string; tone: "red" | "amber"; icon: string; question: string }
> = {
  WEAK: {
    label: "Usam e não rende",
    tone: "red",
    icon: "trendingDown",
    // Único vermelho: os outros dois pedem atenção, este pede decisão.
    question: "O time adotou e o retorno não apareceu. Continua ou para?",
  },
  LOW: {
    label: "Adoção baixa",
    tone: "amber",
    icon: "users",
    question: "Foi comprado e quase ninguém usa. Falta treino, acesso ou caso?",
  },
  STALE: {
    label: "Dado parado",
    tone: "amber",
    icon: "clock",
    question: "A fonte parou. O número na tela é do passado.",
  },
};

/** Fila: decisão antes de atenção; dentro do mesmo tom, dado antes de gente. */
export const ALERT_RANK: Record<AlertKind, number> = {
  WEAK: 0,
  LOW: 1,
  STALE: 2,
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Adoção baixa e sustentada.
 *
 * Sustentada é a palavra: um mês ruim é ruído, e alertar nele ensina o time a
 * ignorar a fila. Exige que a série cubra a janela inteira — uma iniciativa de
 * duas semanas não pode disparar um alerta de oito.
 */
function lowAdoption(
  adoption: AlertSnapshot[],
  t: AlertThresholds,
  now: Date
): boolean {
  if (adoption.length === 0) {
    return false;
  }
  const cutoff = new Date(now.getTime() - t.lowAdoptionWeeks * WEEK_MS);
  const window = adoption.filter((s) => s.periodEnd >= cutoff);
  if (window.length === 0) {
    return false;
  }
  // A série precisa começar antes do corte, senão a janela não está coberta.
  const oldest = window.at(-1);
  if (!oldest || oldest.periodStart > cutoff) {
    return false;
  }
  return window.every((s) => s.pct < t.lowAdoptionPct);
}

function lowFinding(input: AlertRuleInput, t: AlertThresholds): AlertFinding {
  const latest = input.adoption[0];
  return {
    kind: "LOW",
    what: `A adoção está em ${latest ? Math.round(latest.pct) : 0}% há ${t.lowAdoptionWeeks} semanas, abaixo dos ${t.lowAdoptionPct}% que esta organização considera uso real.`,
    nextStep:
      "Falar com quem tem licença e não usa antes de renovar. O motivo costuma ser um dos três: não sabem, não conseguem acessar, ou o caso de uso não é o deles.",
  };
}

function weakFinding(
  input: AlertRuleInput,
  t: AlertThresholds,
  multiple: number
): AlertFinding {
  const latest = input.adoption[0];
  return {
    kind: "WEAK",
    what: `O time adotou (${latest ? Math.round(latest.pct) : 0}%, acima da barra de ${t.adoptionBar}%) e o retorno é de ${multiple.toFixed(1)}× — abaixo do break-even de ${t.weakRoi.toFixed(1)}×. Isto não é problema de uso.`,
    nextStep:
      "Rever a hipótese de valor com o dono antes do próximo ciclo: ou a métrica de retorno não é a que importa, ou a iniciativa entregou menos do que prometeu. As duas respostas mudam a decisão de renovar.",
  };
}

function staleFinding(broken: AlertSource[]): AlertFinding {
  const names = broken.map((s) => s.name).join(", ");
  return {
    kind: "STALE",
    what: `${broken.length === 1 ? "A fonte" : "As fontes"} ${names} parou de entregar dado. Os números desta iniciativa estão congelados na última medição.`,
    nextStep: `Reconectar ${broken.map((s) => s.code).join(", ")}. Até lá, não use este ROI para decidir renovação — ele está desatualizado, não errado.`,
  };
}

/**
 * As três regras contra uma iniciativa. Devolve o que DEVERIA estar aberto
 * agora; quem chama compara com o que já está e abre ou resolve a diferença.
 */
export function evaluateAlertRules(
  input: AlertRuleInput,
  t: AlertThresholds,
  now: Date = new Date()
): AlertFinding[] {
  const findings: AlertFinding[] = [];
  const latest = input.adoption[0];

  if (lowAdoption(input.adoption, t, now)) {
    findings.push(lowFinding(input, t));
  }

  // Sem múltiplo não há WEAK: "não rende" é uma acusação, e acusar sem medida
  // é exatamente o que o Signal existe para impedir.
  if (
    latest &&
    input.multiple !== null &&
    latest.pct >= t.adoptionBar &&
    input.multiple < t.weakRoi
  ) {
    findings.push(weakFinding(input, t, input.multiple));
  }

  const broken = input.sources.filter((s) => s.health !== "HEALTHY");
  if (broken.length > 0) {
    findings.push(staleFinding(broken));
  }

  return findings.sort((a, b) => ALERT_RANK[a.kind] - ALERT_RANK[b.kind]);
}
