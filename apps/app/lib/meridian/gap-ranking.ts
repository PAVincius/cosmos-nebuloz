import type {
  MeridianAxis,
  MeridianConfidence,
  MeridianEffort,
  MeridianGapState,
  MeridianPromotionTarget,
  MeridianSeverity,
} from "@repo/database";

// Ranqueamento de gaps para leitura por outros produtos (X-03).
//
// Função pura: o Meridian é dono do gap e da escala de confiança; quem lê só
// recebe a projeção ordenada. Ordem total e determinística — sem desempate por
// ordem de chegada do banco, que o Postgres não garante.

/** Gap como sai do banco, já reduzido aos campos que o contrato expõe. */
export type RankableGap = {
  id: string;
  code: string;
  assessmentId: string;
  assessmentCode: string;
  axis: MeridianAxis;
  statement: string;
  severity: MeridianSeverity;
  effort: MeridianEffort;
  costOfDelay: number;
  confidence: MeridianConfidence;
  state: MeridianGapState;
  promotion: {
    id: string;
    targetProduct: MeridianPromotionTarget;
    targetEntityId: string | null;
  } | null;
};

/**
 * Contrato de leitura do Meridian para o Scaffold ("Nova trilha"). Sem dado de
 * respondente, resposta, evidência nem nome da organização avaliada.
 */
export type RankedGap = {
  /** Posição a partir de 1 na ordem do ranking. */
  rank: number;
  id: string;
  /** Código legível, ex. "G-01". */
  code: string;
  statement: string;
  axis: MeridianAxis;
  severity: MeridianSeverity;
  effort: MeridianEffort;
  /** Custo de atraso, 0–100. */
  costOfDelay: number;
  /** Escala da suíte; vocabulário do Meridian, sem tradução. */
  confidence: MeridianConfidence;
  state: MeridianGapState;
  assessmentId: string;
  assessmentCode: string;
  /** Promoção ativa (não revogada). `landed`: o destino já criou a entidade. */
  promotion: {
    id: string;
    product: MeridianPromotionTarget;
    landed: boolean;
  } | null;
};

// Maior valor = mais urgente.
const SEVERITY_WEIGHT: Record<MeridianSeverity, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};
const CONFIDENCE_WEIGHT: Record<MeridianConfidence, number> = {
  MEASURED: 3,
  ESTIMATED: 2,
  DECLARED: 1,
};
// Maior valor = mais barato de fazer.
const EFFORT_WEIGHT: Record<MeridianEffort, number> = { S: 3, M: 2, L: 1 };

const collator = new Intl.Collator("pt-BR", { numeric: true });

/**
 * Ordem: custo de atraso ↓, severidade ↓, confiança ↓ (medido antes de
 * declarado), esforço ↑, código em ordem natural (G-2 antes de G-10).
 */
function compare(a: RankableGap, b: RankableGap): number {
  return (
    b.costOfDelay - a.costOfDelay ||
    SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity] ||
    CONFIDENCE_WEIGHT[b.confidence] - CONFIDENCE_WEIGHT[a.confidence] ||
    EFFORT_WEIGHT[b.effort] - EFFORT_WEIGHT[a.effort] ||
    collator.compare(a.code, b.code)
  );
}

export function rankGaps(gaps: readonly RankableGap[]): RankedGap[] {
  return [...gaps].sort(compare).map(
    (g, i): RankedGap => ({
      rank: i + 1,
      id: g.id,
      code: g.code,
      statement: g.statement,
      axis: g.axis,
      severity: g.severity,
      effort: g.effort,
      costOfDelay: g.costOfDelay,
      confidence: g.confidence,
      state: g.state,
      assessmentId: g.assessmentId,
      assessmentCode: g.assessmentCode,
      promotion: g.promotion
        ? {
            id: g.promotion.id,
            product: g.promotion.targetProduct,
            landed: g.promotion.targetEntityId !== null,
          }
        : null,
    })
  );
}
