import { generateObject } from "ai";
import { z } from "zod";
import { getActiveProvider, getAIModel } from "../router";
import type { RagChunk } from "./types";

const ScoreSchema = z.object({
  score: z.number().min(0).max(1),
});

/**
 * Rerank retrieved chunks by relevance to the original query.
 * Each chunk scored 0–1 via LLM; returns topK highest scored.
 * Falls back to original order + score 0 on error.
 */
export async function rerankChunks(
  query: string,
  chunks: RagChunk[],
  topK = 5
): Promise<RagChunk[]> {
  if (chunks.length === 0) {
    return [];
  }
  if (chunks.length <= topK) {
    return chunks;
  }

  const model = getAIModel(getActiveProvider());

  const scored = await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const { object } = await generateObject({
          model,
          schema: ScoreSchema,
          prompt: `Avalie a relevância deste trecho para responder à pergunta.
Retorne score de 0.0 (irrelevante) a 1.0 (diretamente responde à pergunta).

Pergunta: "${query.slice(0, 500).replace(/[<>]/g, "")}"
Trecho: "${chunk.content.slice(0, 500).replace(/[<>]/g, "")}"`,
        });
        return { ...chunk, score: object.score };
      } catch {
        return { ...chunk, score: chunk.score ?? 0 };
      }
    })
  );

  return scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, topK);
}
