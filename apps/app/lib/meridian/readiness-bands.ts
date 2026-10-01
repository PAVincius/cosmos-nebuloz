import type { MeridianAxis } from "@repo/database";
import { AXIS_IDS } from "./axes";

// Faixas por eixo e arquétipos de prontidão (briefing do Andaime, itens 1 e 2).
//
// O score é instrução de sequência, não nota: a faixa diz por onde começar em
// cada eixo, e o arquétipo — o padrão entre os eixos — diz qual trilha o
// padrão pede. Função pura: entra leitura por eixo, sai perfil. Nada aqui lê
// banco nem formata tela.

// ── Faixas (iguais nos cinco eixos) ───────────────────────────────────────────

export type ReadinessBand = "INITIAL" | "FORMING" | "STRUCTURED" | "MATURE";

export const BAND_LABEL: Record<ReadinessBand, string> = {
  INITIAL: "Inicial",
  FORMING: "Em formação",
  STRUCTURED: "Estruturado",
  MATURE: "Maduro",
};

/** Piso de cada faixa acima da primeira: Em formação 40, Estruturado 60,
 *  Maduro 80. Inicial é tudo abaixo de 40. */
const FORMING_MIN = 40;
const STRUCTURED_MIN = 60;
const MATURE_MIN = 80;

export function bandOf(score: number): ReadinessBand {
  if (score >= MATURE_MIN) {
    return "MATURE";
  }
  if (score >= STRUCTURED_MIN) {
    return "STRUCTURED";
  }
  if (score >= FORMING_MIN) {
    return "FORMING";
  }
  return "INITIAL";
}

/** Confiança abaixo disto: liderança e operação discordam, e a faixa deixa de
 *  valer como leitura — vira "não confiável". */
export const RELIABILITY_MIN = 0.6;
export const UNRELIABLE_LABEL = "Não confiável";

// ── Limiares dos arquétipos ───────────────────────────────────────────────────

/** Piso de Pessoas e Processo no Piloto sem chão (Dados e Infra ficam abaixo de
 *  40). A proposta original era 50; o D-24 do Norte fechou em 40. Constante
 *  única: se a decisão mudar, muda só aqui. */
export const PILOT_FLOOR_MIN = 40;

/** "Baixo" e "alto" dos demais padrões usam os pisos das faixas: baixo é
 *  Inicial (< 40), alto é Estruturado ou mais (≥ 60). */
const LOW_BELOW = FORMING_MIN;
const HIGH_FROM = STRUCTURED_MIN;

// ── Arquétipos ────────────────────────────────────────────────────────────────

export type ArchetypeId =
  | "UNIFORMLY_LOW"
  | "PILOT_NO_GROUND"
  | "DATA_UNUSED"
  | "PAPER_GOVERNANCE"
  | "STALLED_CAUTION"
  | "ISOLATED_CHAMPION"
  | "READY_TO_SCALE";

export const ARCHETYPE_LABEL: Record<ArchetypeId, string> = {
  UNIFORMLY_LOW: "Uniformemente baixo",
  PILOT_NO_GROUND: "Piloto sem chão",
  DATA_UNUSED: "Dado sem uso",
  PAPER_GOVERNANCE: "Governança de papel",
  STALLED_CAUTION: "Cautela travada",
  ISOLATED_CHAMPION: "Campeão isolado",
  READY_TO_SCALE: "Pronto para escalar",
};

/** Uma frase do que o padrão diz, para o relatório. */
export const ARCHETYPE_HINT: Record<ArchetypeId, string> = {
  UNIFORMLY_LOW:
    "Todos os eixos no começo: a fundação vem antes de qualquer piloto.",
  PILOT_NO_GROUND:
    "Há gente e processo para pilotar, mas Dados e Infraestrutura ainda não sustentam: o piloto roda sem chão.",
  DATA_UNUSED:
    "Dados e Infraestrutura prontos, sem processo nem pessoas para usá-los.",
  PAPER_GOVERNANCE:
    "A política existe no papel, mas o comitê e o controle de acesso não a sustentam.",
  STALLED_CAUTION:
    "A governança está à frente e segura o resto: o risco é não sair do lugar.",
  ISOLATED_CHAMPION:
    "O conhecimento de IA está concentrado em poucas pessoas, ou a leitura de Pessoas não é confiável.",
  READY_TO_SCALE: "Todos os eixos Estruturados ou mais: é hora de escalar.",
};

/** Padrões decididos só pelo score dos cinco eixos: mutuamente exclusivos. */
type ScorePattern = Extract<
  ArchetypeId,
  | "UNIFORMLY_LOW"
  | "PILOT_NO_GROUND"
  | "DATA_UNUSED"
  | "STALLED_CAUTION"
  | "READY_TO_SCALE"
>;

/** Traços que dependem de resposta a pergunta específica e, por isso, de sinais
 *  extras. Podem coexistir com qualquer padrão. Ordem = prioridade. */
const TRAIT_PRIORITY = ["ISOLATED_CHAMPION", "PAPER_GOVERNANCE"] as const;
type Trait = (typeof TRAIT_PRIORITY)[number];

// ── Entrada e saída ───────────────────────────────────────────────────────────

export type AxisReading = {
  axis: MeridianAxis;
  /** 0–100 (final, já com override). */
  score: number;
  /** 0–1. */
  confidence: number;
};

/** Códigos da bateria v3.2 que alimentam os sinais (decisão do Norte). Um
 *  template sem esses códigos não produz sinal: o traço não dispara e nada
 *  quebra. */
export const SIGNAL_CODES = {
  peopleDistribution: "Q-E03",
  governancePolicy: "Q-G01",
  governanceCommittee: "Q-G02",
  governanceAccessControl: "Q-G03",
} as const;

/** Sinais de pergunta (0–100), opcionais: sem eles, os traços que dependem de
 *  pergunta específica não disparam. */
export type ReadinessSignals = {
  /** Pergunta de distribuição do conhecimento de IA, no eixo Pessoas. */
  peopleDistribution?: number;
  /** Governança: a política escrita. */
  governancePolicy?: number;
  /** Governança: comitê de IA. */
  governanceCommittee?: number;
  /** Governança: controle de acesso. */
  governanceAccessControl?: number;
};

export type AxisReadiness = {
  axis: MeridianAxis;
  score: number;
  confidence: number;
  /** Faixa calculada pelo score, mesmo quando não é confiável. */
  band: ReadinessBand;
  reliable: boolean;
  /** O que mostrar: o nome da faixa, ou "Não confiável". */
  display: string;
};

export type ReadinessProfile = {
  axes: AxisReadiness[];
  unreliableAxes: MeridianAxis[];
  dominant: ArchetypeId | null;
  /** Traço secundário: o traço de maior prioridade que sobra depois do
   *  dominante. */
  secondary: ArchetypeId | null;
  /** Padrões de score que casaram (no máximo um, por construção). */
  scorePatternMatches: ArchetypeId[];
};

/** Sinais a partir das respostas: para cada código de `SIGNAL_CODES`, a média do
 *  score normalizado (0–1, já com `inverted` aplicado) entre os respondentes,
 *  em 0–100. Código sem resposta não entra no resultado — ausência não é zero. */
export function signalsFromAnswers(
  answers: readonly { questionCode: string; normalized: number }[]
): ReadinessSignals {
  const signals: ReadinessSignals = {};
  for (const [key, code] of Object.entries(SIGNAL_CODES) as [
    keyof ReadinessSignals,
    string,
  ][]) {
    const values = answers
      .filter((a) => a.questionCode === code)
      .map((a) => a.normalized);
    if (values.length > 0) {
      signals[key] =
        (values.reduce((sum, v) => sum + v, 0) / values.length) * 100;
    }
  }
  return signals;
}

// ── Detecção ──────────────────────────────────────────────────────────────────

function scorePatternOf(s: Record<MeridianAxis, number>): ScorePattern[] {
  const { DATA, PROCESS, PEOPLE, GOVERNANCE, INFRASTRUCTURE } = s;
  const all = [DATA, PROCESS, PEOPLE, GOVERNANCE, INFRASTRUCTURE];
  const matches: ScorePattern[] = [];
  if (all.every((v) => v < LOW_BELOW)) {
    matches.push("UNIFORMLY_LOW");
  }
  if (
    PEOPLE >= PILOT_FLOOR_MIN &&
    PROCESS >= PILOT_FLOOR_MIN &&
    DATA < LOW_BELOW &&
    INFRASTRUCTURE < LOW_BELOW
  ) {
    matches.push("PILOT_NO_GROUND");
  }
  if (
    DATA >= HIGH_FROM &&
    INFRASTRUCTURE >= HIGH_FROM &&
    PROCESS < LOW_BELOW &&
    PEOPLE < LOW_BELOW
  ) {
    matches.push("DATA_UNUSED");
  }
  if (
    GOVERNANCE >= HIGH_FROM &&
    [DATA, PROCESS, PEOPLE, INFRASTRUCTURE].every((v) => v < LOW_BELOW)
  ) {
    matches.push("STALLED_CAUTION");
  }
  if (all.every((v) => v >= HIGH_FROM)) {
    matches.push("READY_TO_SCALE");
  }
  return matches;
}

function traitsOf(signals: ReadinessSignals, peopleReliable: boolean): Trait[] {
  const traits: Trait[] = [];
  const distributionLow =
    signals.peopleDistribution !== undefined &&
    signals.peopleDistribution < LOW_BELOW;
  if (distributionLow || !peopleReliable) {
    traits.push("ISOLATED_CHAMPION");
  }
  if (
    signals.governancePolicy !== undefined &&
    signals.governanceCommittee !== undefined &&
    signals.governanceAccessControl !== undefined &&
    signals.governancePolicy >= HIGH_FROM &&
    signals.governanceCommittee < LOW_BELOW &&
    signals.governanceAccessControl < LOW_BELOW
  ) {
    traits.push("PAPER_GOVERNANCE");
  }
  return traits;
}

/**
 * Faixa por eixo, confiança e arquétipo (dominante + traço secundário).
 *
 * Sem os cinco eixos não há padrão entre eles: devolve as faixas dos que
 * existem e nenhum arquétipo. Não muta a entrada.
 */
export function assessReadiness(
  readings: readonly AxisReading[],
  signals: ReadinessSignals = {}
): ReadinessProfile {
  const byAxis = new Map(readings.map((r) => [r.axis, r]));
  const axes: AxisReadiness[] = AXIS_IDS.filter((a) => byAxis.has(a)).map(
    (axis) => {
      const r = byAxis.get(axis) as AxisReading;
      const band = bandOf(r.score);
      const reliable = r.confidence >= RELIABILITY_MIN;
      return {
        axis,
        score: r.score,
        confidence: r.confidence,
        band,
        reliable,
        display: reliable ? BAND_LABEL[band] : UNRELIABLE_LABEL,
      };
    }
  );
  const unreliableAxes = axes.filter((a) => !a.reliable).map((a) => a.axis);

  if (axes.length < AXIS_IDS.length) {
    return {
      axes,
      unreliableAxes,
      dominant: null,
      secondary: null,
      scorePatternMatches: [],
    };
  }

  const scores = Object.fromEntries(
    axes.map((a) => [a.axis, a.score])
  ) as Record<MeridianAxis, number>;
  const peopleReliable = !unreliableAxes.includes("PEOPLE");
  const patterns = scorePatternOf(scores);
  const traits = traitsOf(signals, peopleReliable);

  // Um padrão de score domina; o traço de maior prioridade vira secundário.
  // Sem padrão, o traço de maior prioridade domina e o seguinte é secundário.
  const ordered: ArchetypeId[] = [...patterns, ...traits];
  return {
    axes,
    unreliableAxes,
    dominant: ordered[0] ?? null,
    secondary: ordered[1] ?? null,
    scorePatternMatches: patterns,
  };
}
