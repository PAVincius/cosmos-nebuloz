import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import type { ErrorType, ParsedError } from "./error-parser.js";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const JSON_FENCE_START = /^```(?:json)?\n?/;
const JSON_FENCE_END = /\n?```$/;

export type FixResult = {
  fixedContent: string;
  confidence: number;
  reason: string;
  modelUsed: string;
};

const MODELS = {
  fast: "claude-haiku-4-5-20251001",
  smart: "claude-sonnet-4-6",
} as const;

const TYPE_LABELS: Record<ErrorType, string> = {
  biome: "Biome",
  typescript: "TypeScript",
  build: "Build",
};

function buildPrompt(error: ParsedError, repoRoot: string): string {
  const relPath = path.relative(repoRoot, error.file);
  return `Error type: ${TYPE_LABELS[error.type]}
Error: ${error.rule}: ${error.message}
File: ${relPath}

${error.fileContent.slice(0, 4000)}`;
}

type ApiResponse = { fix: string; confidence: number; reason: string };

async function callModel(
  model: string,
  prompt: string
): Promise<ApiResponse | null> {
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      system: `You are a TypeScript/Biome expert. Fix the exact error reported.
Return JSON only: { "fix": "<full patched file content>", "confidence": 0.0-1.0, "reason": "..." }
confidence = 1.0 if fix is unambiguous.
confidence = 0.5 if multiple valid approaches exist.
confidence = 0.2 if fix requires broader context not provided.
Do NOT refactor beyond fixing the error. Minimal diff only.`,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const json = text
      .replace(JSON_FENCE_START, "")
      .replace(JSON_FENCE_END, "")
      .trim();
    const parsed = JSON.parse(json) as ApiResponse;
    if (
      typeof parsed.fix === "string" &&
      typeof parsed.confidence === "number"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export async function generateFix(
  error: ParsedError,
  repoRoot: string
): Promise<FixResult | null> {
  const prompt = buildPrompt(error, repoRoot);

  const haiku = await callModel(MODELS.fast, prompt);
  if (haiku !== null && haiku.confidence >= 0.8) {
    return {
      fixedContent: haiku.fix,
      confidence: haiku.confidence,
      reason: haiku.reason,
      modelUsed: MODELS.fast,
    };
  }

  const sonnet = await callModel(MODELS.smart, prompt);
  if (sonnet === null) {
    return null;
  }
  return {
    fixedContent: sonnet.fix,
    confidence: sonnet.confidence,
    reason: sonnet.reason,
    modelUsed: MODELS.smart,
  };
}
