import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { keys } from "../keys";

export type AIProvider = "anthropic" | "google" | "openai" | "none";

export function getActiveProvider(): AIProvider {
  const k = keys();
  if (k.ANTHROPIC_API_KEY) return "anthropic";
  if (k.GOOGLE_GENERATIVE_AI_API_KEY) return "google";
  if (k.OPENAI_API_KEY) return "openai";
  return "none";
}

export function getAIModel(provider?: AIProvider): LanguageModel {
  const k = keys();
  const active = provider ?? getActiveProvider();

  switch (active) {
    case "anthropic": {
      const anthropic = createAnthropic({ apiKey: k.ANTHROPIC_API_KEY });
      return anthropic("claude-haiku-4-5-20251001") as unknown as LanguageModel;
    }
    case "google": {
      const google = createGoogleGenerativeAI({
        apiKey: k.GOOGLE_GENERATIVE_AI_API_KEY,
      });
      return google("gemini-2.0-flash") as unknown as LanguageModel;
    }
    case "openai": {
      const openai = createOpenAI({ apiKey: k.OPENAI_API_KEY });
      return openai("gpt-4o-mini") as unknown as LanguageModel;
    }
    default:
      throw new Error(
        "Nenhuma chave de IA configurada. Configure ANTHROPIC_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY ou OPENAI_API_KEY."
      );
  }
}
