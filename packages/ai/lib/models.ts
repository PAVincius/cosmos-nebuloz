import { createOpenAI } from "@ai-sdk/openai";
import type { EmbeddingModel, LanguageModel } from "ai";
import { keys } from "../keys";

const openai = createOpenAI({
  apiKey: keys().OPENAI_API_KEY,
});

export const models: {
  chat: LanguageModel;
  embeddings: EmbeddingModel<string>;
} = {
  chat: openai("gpt-4o-mini") as LanguageModel,
  embeddings: openai.textEmbeddingModel("text-embedding-3-small"),
};

export type { AIProvider } from "./router";
export { getActiveProvider, getAIModel } from "./router";
