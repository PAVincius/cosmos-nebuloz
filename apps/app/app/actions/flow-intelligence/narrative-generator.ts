import { generateText } from "ai";
import { getAIModel, getActiveProvider } from "@repo/ai/lib/models";
import { RULE_PROMPTS, type AnomalyData } from "./anomaly-prompts";
import type { RecurrenceKind } from "./suppression-filter";

const SYSTEM = `You are a SAFe Release Train Engineer assistant. Explain flow anomalies to RTEs and SMs in 2-3 plain-English sentences, then give 1-2 specific next-sprint actions. Never give generic advice. Return valid JSON only.`;

export async function generateNarrative(args: {
  rule: string;
  data: AnomalyData;
  recurrence: { kind: RecurrenceKind; priorCount: number };
}): Promise<{ narrative: string; actions: string[] }> {
  const buildPrompt = RULE_PROMPTS[args.rule];
  if (!buildPrompt) {
    return { narrative: "Anomaly detected.", actions: [] };
  }

  const recurrenceNote =
    args.recurrence.kind === "chronic"
      ? `\n\nNote: Chronic pattern — seen ${args.recurrence.priorCount} times in 90 days.`
      : args.recurrence.kind === "recurring"
        ? `\n\nNote: Recurring — seen ${args.recurrence.priorCount} times in 90 days.`
        : "";

  const prompt = buildPrompt(args.data) + recurrenceNote;

  const provider = getActiveProvider();
  if (provider === "none") {
    return { narrative: "No AI provider configured.", actions: [] };
  }

  try {
    const { text } = await generateText({
      model: getAIModel(provider),
      system: SYSTEM,
      prompt,
    });

    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]) as { narrative?: unknown; actions?: unknown };
      return {
        narrative: String(parsed.narrative ?? ""),
        actions: Array.isArray(parsed.actions) ? parsed.actions.map(String) : [],
      };
    }
    return { narrative: text.slice(0, 600), actions: [] };
  } catch {
    return { narrative: "Narrative generation failed.", actions: [] };
  }
}
