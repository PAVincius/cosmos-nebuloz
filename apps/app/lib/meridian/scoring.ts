import type { MeridianQuestionType, MeridianScoreStatus } from "@repo/database";

// Motor de scoring do Meridian.
//
// Puro por obrigação contratual, não por estilo: FR-014 e SC-002 exigem que as
// mesmas respostas e a mesma versão de template produzam sempre o mesmo
// resultado. Por isso, nada aqui pode usar `Date.now()`, `Math.random()` nem
// iterar sobre chaves de objeto — a ordem de `Object.keys` não é especificada e
// bastaria para tornar o arredondamento instável entre execuções.
//
// A entrada é sempre a lista de perguntas do eixo, na ordem canônica (`ordinal`)
// da versão congelada, e as respostas normalizadas. O motor não fala com o
// banco: é o chamador que carrega e é o teste que exercita o cálculo.

export type ScoringQuestion = {
  code: string;
  ordinal: number;
  type: MeridianQuestionType;
  weight: number;
  inverted: boolean;
  scaleLabels: string[];
};

export type ScoringAnswer = {
  respondentId: string;
  questionCode: string;
  rawValue: number;
};

export type AxisScoreResult = {
  score: number;
  confidence: number;
  respondentCount: number;
  spread: number;
  status: MeridianScoreStatus;
  note: string | null;
};

const LIKERT_STEPS = 5;

/** Converte a opção escolhida para 0..1, no vocabulário do tipo da pergunta.
 *  `inverted` existe porque em algumas perguntas a faixa mais alta é a pior
 *  resposta ("fração do dado fora do ambiente governado"). */
export function normalizeAnswer(q: ScoringQuestion, rawValue: number): number {
  const value = (() => {
    if (q.type === "YES_NO") {
      // 0 = sim. O índice segue a ordem exibida, e "Sim" vem primeiro.
      return rawValue === 0 ? 1 : 0;
    }
    if (q.type === "LIKERT") {
      return clamp(rawValue, 0, LIKERT_STEPS - 1) / (LIKERT_STEPS - 1);
    }
    const steps = Math.max(2, q.scaleLabels.length);
    return clamp(rawValue, 0, steps - 1) / (steps - 1);
  })();
  return q.inverted ? 1 - value : value;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** Score individual de um respondente: média ponderada das perguntas que ele
 *  respondeu. Um respondente que respondeu metade da bateria não é comparado
 *  com um que respondeu tudo — a lacuna aparece na cobertura, não aqui. */
function respondentScore(
  questions: ScoringQuestion[],
  byCode: Map<string, ScoringAnswer>
): number | null {
  let weighted = 0;
  let totalWeight = 0;
  for (const q of questions) {
    const a = byCode.get(q.code);
    if (!a) {
      continue;
    }
    weighted += q.weight * normalizeAnswer(q, a.rawValue);
    totalWeight += q.weight;
  }
  return totalWeight === 0 ? null : weighted / totalWeight;
}

/**
 * Score, confiança e dispersão de um eixo.
 *
 * `score` é a média ponderada, por pergunta, da média dos respondentes —
 * nesta ordem, e não o contrário: agregar por pergunta primeiro impede que
 * quem respondeu mais perguntas pese mais no eixo.
 *
 * `confidence` é o produto de três fatores, cada um caindo por um motivo
 * distinto e nomeável na UI:
 *   cobertura    — respostas dadas ÷ respostas esperadas;
 *   amostra      — min(1, respondentes ÷ 2), porque um respondente só nunca é
 *                  uma medição, é um depoimento;
 *   concordância — 1 − spread/100.
 */
export function computeAxisScore(
  questions: ScoringQuestion[],
  answers: ScoringAnswer[],
  contestedSpread: number
): AxisScoreResult {
  const ordered = [...questions].sort((a, b) => a.ordinal - b.ordinal);
  const codes = new Set(ordered.map((q) => q.code));
  const relevant = answers.filter((a) => codes.has(a.questionCode));

  const respondentIds = [
    ...new Set(relevant.map((a) => a.respondentId)),
  ].sort();

  if (respondentIds.length === 0 || ordered.length === 0) {
    return {
      score: 0,
      confidence: 0,
      respondentCount: 0,
      spread: 0,
      status: "COMPUTED",
      note: "Nenhuma resposta registrada neste eixo.",
    };
  }

  // Média por pergunta, entre os respondentes que a responderam.
  let weighted = 0;
  let totalWeight = 0;
  for (const q of ordered) {
    const values = relevant
      .filter((a) => a.questionCode === q.code)
      .map((a) => normalizeAnswer(q, a.rawValue));
    if (values.length === 0) {
      continue;
    }
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    weighted += q.weight * mean;
    totalWeight += q.weight;
  }
  const score =
    totalWeight === 0 ? 0 : Math.round((weighted / totalWeight) * 100);

  // Dispersão: maior diferença entre os scores individuais, em pontos.
  const individual = respondentIds
    .map((id) => {
      const byCode = new Map(
        relevant
          .filter((a) => a.respondentId === id)
          .map((a) => [a.questionCode, a] as const)
      );
      return respondentScore(ordered, byCode);
    })
    .filter((v): v is number => v !== null);

  const spread =
    individual.length < 2
      ? 0
      : Math.round((Math.max(...individual) - Math.min(...individual)) * 100);

  const expected = ordered.length * respondentIds.length;
  const coverage = expected === 0 ? 0 : relevant.length / expected;
  const sample = Math.min(1, respondentIds.length / 2);
  const agreement = 1 - spread / 100;
  const confidence =
    Math.round(clamp(coverage * sample * agreement, 0, 1) * 100) / 100;

  const contested = spread >= contestedSpread;
  return {
    score,
    confidence,
    respondentCount: respondentIds.length,
    spread,
    status: contested ? "CONTESTED" : "COMPUTED",
    note: buildNote({
      contested,
      spread,
      contestedSpread,
      confidence,
      respondents: respondentIds.length,
      missing: expected - relevant.length,
    }),
  };
}

/** Texto que o consultor lê antes de decidir. Um eixo contestado sem motivo
 *  legível obriga a pessoa a reconstruir o cálculo de cabeça. */
function buildNote(input: {
  contested: boolean;
  spread: number;
  contestedSpread: number;
  confidence: number;
  respondents: number;
  missing: number;
}): string | null {
  if (input.contested) {
    return `Discordância de ${input.spread} pontos entre respondentes, acima do limiar de ${input.contestedSpread}.`;
  }
  if (input.confidence < 0.5) {
    if (input.respondents < 2) {
      return "Um único respondente neste eixo — confidence limitada por amostra.";
    }
    if (input.missing > 0) {
      return `${input.missing} resposta(s) pendente(s) — confidence baixa até a coleta fechar.`;
    }
  }
  return null;
}
