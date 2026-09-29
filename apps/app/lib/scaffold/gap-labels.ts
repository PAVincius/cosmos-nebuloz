import type { RankedGap } from "@/lib/meridian/gap-ranking";

// Como a "Nova trilha" fala dos gaps do Meridian, e quando um gap vira trilha.

const SEVERITY: Record<string, string> = {
  HIGH: "Gravidade alta",
  MEDIUM: "Gravidade média",
  LOW: "Gravidade baixa",
};
const EFFORT: Record<string, string> = {
  S: "Esforço pequeno",
  M: "Esforço médio",
  L: "Esforço grande",
};
const CONFIDENCE: Record<string, string> = {
  MEASURED: "Confiança medida",
  ESTIMATED: "Confiança estimada",
  DECLARED: "Confiança declarada",
};

export function gapLabels(g: RankedGap) {
  return {
    severity: SEVERITY[g.severity] ?? g.severity,
    effort: EFFORT[g.effort] ?? g.effort,
    confidence: CONFIDENCE[g.confidence] ?? g.confidence,
    costOfDelay: `Custo de atraso ${g.costOfDelay}`,
  };
}

export type GapEligibility =
  | { eligible: true; promotionId: string; reason: null }
  | { eligible: false; promotionId: null; reason: string };

/**
 * Só vira trilha o gap que o Meridian já promoveu para o Scaffold e que ainda
 * não tem trilha. A promoção é a intenção registrada pelo dono do gap (o
 * Meridian); o Scaffold não a cria, e por isso a razão de quem não pode aponta
 * onde resolver.
 */
export function gapEligibility(g: RankedGap): GapEligibility {
  const p = g.promotion;
  if (!p) {
    return {
      eligible: false,
      promotionId: null,
      reason:
        "Ainda não promovido: promova este gap para o Scaffold no Meridian.",
    };
  }
  if (p.product !== "SCAFFOLD") {
    return {
      eligible: false,
      promotionId: null,
      reason: "Promovido para outro produto.",
    };
  }
  if (p.landed) {
    return { eligible: false, promotionId: null, reason: "Já tem trilha." };
  }
  return { eligible: true, promotionId: p.id, reason: null };
}
