// Per-anomaly AI narrative for cost anomalies — mirrors the
// @repo/ai pattern used by app/actions/flow-intelligence/narrative-generator.ts
// (getActiveProvider/getAIModel + generateText). Deliberately deviates from
// that module's fallback: instead of returning a canned placeholder string
// ("No AI provider configured.") that could be mistaken for a real
// narrative, this returns `degraded: true` with `narrative: null` so the
// caller renders the real BillingEntry-derived metrics instead of any
// AI-shaped text — never a fabricated narrative.
import { getActiveProvider, getAIModel } from "@repo/ai/lib/models";
import { generateText } from "ai";

const SYSTEM =
  "You are a FinOps assistant. Explain a cloud cost anomaly to an engineering leader in 2-3 plain-English sentences, then give 1-2 specific next actions. Never give generic advice. Return valid JSON only.";

const JSON_OBJECT_PATTERN = /\{[\s\S]*\}/;
const MAX_INTERPOLATED_FIELD_LENGTH = 200;
const MIN_PRINTABLE_CODE_POINT = 0x20;

// Light guard on values interpolated into the LLM prompt — caps length and
// drops non-printable/control characters. Not a full injection defense
// (narrative renders as plain text, no tool/exec surface), just cheap
// hardening on service/accountId strings sourced from BillingEntry.
function sanitizeForPrompt(value: string): string {
  let out = "";
  for (const ch of value.slice(0, MAX_INTERPOLATED_FIELD_LENGTH)) {
    const codePoint = ch.codePointAt(0) ?? 0;
    if (codePoint >= MIN_PRINTABLE_CODE_POINT) {
      out += ch;
    }
  }
  return out;
}

export type CostAnomalyNarrativeInput = {
  service: string | null;
  accountId: string | null;
  actualAmount: number;
  baselineMedian: number;
  deltaPct: number;
  modifiedZScore: number;
  severity: string;
};

export type CostAnomalyNarrativeResult = {
  narrative: string | null;
  actions: string[];
  degraded: boolean;
};

function buildPrompt(data: CostAnomalyNarrativeInput): string {
  const service = data.service
    ? sanitizeForPrompt(data.service)
    : "desconhecido";
  const accountId = data.accountId
    ? sanitizeForPrompt(data.accountId)
    : "desconhecida";
  return `Cloud cost for service "${service}" (account ${accountId}) is $${data.actualAmount.toFixed(2)}, versus a historical baseline (median) of $${data.baselineMedian.toFixed(
    2
  )} — a ${data.deltaPct.toFixed(1)}% change (modified z-score ${data.modifiedZScore.toFixed(
    2
  )}, severity ${data.severity}).
Explain the likely FinOps causes and recommend 1-2 specific next actions.
Return JSON: { "narrative": "...", "actions": ["...", "..."] }`;
}

export async function generateCostAnomalyNarrative(
  data: CostAnomalyNarrativeInput
): Promise<CostAnomalyNarrativeResult> {
  const provider = getActiveProvider();
  if (provider === "none") {
    return { narrative: null, actions: [], degraded: true };
  }

  try {
    const { text } = await generateText({
      model: getAIModel(provider),
      system: SYSTEM,
      prompt: buildPrompt(data),
    });

    const match = text.match(JSON_OBJECT_PATTERN);
    if (match) {
      const parsed = JSON.parse(match[0]) as {
        narrative?: unknown;
        actions?: unknown;
      };
      return {
        narrative: String(parsed.narrative ?? ""),
        actions: Array.isArray(parsed.actions)
          ? parsed.actions.map(String)
          : [],
        degraded: false,
      };
    }
    return { narrative: text.slice(0, 600), actions: [], degraded: false };
  } catch {
    return { narrative: null, actions: [], degraded: true };
  }
}
