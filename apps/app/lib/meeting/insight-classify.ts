// Pure insight-classification helpers — zod only, no @repo/* imports so they
// stay unit-testable without triggering env validation.

import { z } from "zod";

export type InsightType = "ACTION" | "RISK" | "DECISION";

export type ClassifiedInsight = {
  type: InsightType;
  text: string;
  proposedTarget: "Task" | "Risk" | "DecisionLog";
};

// Schema the LLM must return.
export const InsightClassificationSchema = z.object({
  insights: z
    .array(
      z.object({
        type: z.enum(["ACTION", "RISK", "DECISION"]),
        text: z.string().min(1).max(500),
      })
    )
    .max(50),
});

export type InsightClassification = z.infer<typeof InsightClassificationSchema>;

const TARGET_BY_TYPE: Record<InsightType, ClassifiedInsight["proposedTarget"]> =
  {
    ACTION: "Task",
    RISK: "Risk",
    DECISION: "DecisionLog",
  };

export function proposedTargetFor(
  type: InsightType
): ClassifiedInsight["proposedTarget"] {
  return TARGET_BY_TYPE[type];
}

const LINE_SPLIT_RE = /\r?\n/;
const BULLET_PREFIX_RE = /^\s*(?:[-*•]|\d+[.)])\s*/;

/**
 * Deterministic fallback when the LLM is unavailable or errors.
 * Splits the Fireflies `action_items` blob into ACTION insights — one per
 * non-empty line. Strips common bullet/numbering prefixes. Never throws.
 */
export function parseActionItemsFallback(
  actionItems: string | null | undefined
): ClassifiedInsight[] {
  if (!actionItems) {
    return [];
  }
  return actionItems
    .split(LINE_SPLIT_RE)
    .map((line) => line.replace(BULLET_PREFIX_RE, "").trim())
    .filter((line) => line.length > 0)
    .map((text) => ({
      type: "ACTION" as const,
      text: text.slice(0, 500),
      proposedTarget: "Task" as const,
    }));
}

export function buildClassifyPrompt(summary: {
  overview: string | null;
  actionItems: string | null;
  outline: string | null;
}): string {
  return `Você é assistente SAFe 6.0 que extrai itens acionáveis de cerimônias.
A partir do resumo de uma reunião, classifique cada ponto relevante em:
- ACTION: tarefa/ação a executar
- RISK: risco ou impedimento
- DECISION: decisão tomada

Retorne APENAS JSON no schema { insights: [{ type, text }] }. Sem explicações.
Texto curto e objetivo por insight (máx 500 chars). Ignore conversa irrelevante.

Overview: ${summary.overview ?? "(vazio)"}
Action items: ${summary.actionItems ?? "(vazio)"}
Outline: ${summary.outline ?? "(vazio)"}`;
}

/** Maps validated LLM output to ClassifiedInsight[] with proposed targets. */
export function toClassifiedInsights(
  classification: InsightClassification
): ClassifiedInsight[] {
  return classification.insights.map((i) => ({
    type: i.type,
    text: i.text,
    proposedTarget: proposedTargetFor(i.type),
  }));
}
