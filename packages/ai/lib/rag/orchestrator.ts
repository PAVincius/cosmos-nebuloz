import { generateText } from "ai";
import { getActiveProvider, getAIModel } from "../router";
import { QueryCache } from "./query-cache";
import { rewriteQuery } from "./query-rewriter";
import { rerankChunks } from "./reranker";
import type { RagChunk, RagResult, RetrieveFn } from "./types";

// Module-level shared cache (per process / per Next.js worker)
export const sharedCache = new QueryCache();

const SYSTEM_PROMPT = `Você é Cosmos AI — especialista SAFe 6.0 integrado ao Cosmos Platform.
Responda com base APENAS no contexto fornecido abaixo.
Se o contexto não contiver informação suficiente, diga claramente que não encontrou dados.
Seja direto e inclua métricas, fórmulas ou exemplos concretos quando o contexto os tiver.
Termine com "— Cosmos AI".`;

/**
 * Agentic RAG pipeline:
 *   1. Semantic cache check
 *   2. Query rewriting (3 variants)
 *   3. Retrieval via injected `retrieve` fn (storage-agnostic)
 *   4. Re-ranking (topK)
 *   5. LLM answer generation with context
 *   6. Cache the result
 *
 * @param question  - original user question
 * @param retrieve  - injected retrieval fn (LanceDB, pgvector, in-memory, etc.)
 * @param options   - topK (default 5), skipCache (default false), cache instance
 */
export async function ragQuery(
  question: string,
  retrieve: RetrieveFn,
  options: {
    topK?: number;
    skipCache?: boolean;
    cache?: QueryCache;
  } = {}
): Promise<RagResult> {
  const { topK = 5, skipCache = false, cache = sharedCache } = options;

  // ── 1. Cache check ─────────────────────────────────────────────────────────
  if (!skipCache) {
    const hit = await cache.get(question);
    if (hit) {
      return {
        answer: hit.answer,
        chunks: hit.chunks,
        cached: true,
        queriesUsed: [question],
      };
    }
  }

  // ── 2. Query rewriting ─────────────────────────────────────────────────────
  const queries = await rewriteQuery(question);

  // ── 3. Retrieve chunks for all variants ───────────────────────────────────
  const rawChunks = await retrieve(queries);

  // ── 4. Re-rank ─────────────────────────────────────────────────────────────
  const chunks = await rerankChunks(question, rawChunks, topK);

  // ── 5. Generate answer ─────────────────────────────────────────────────────
  const context = chunks
    .map((c: RagChunk, i: number) => `[${i + 1}] ${c.content}`)
    .join("\n\n");

  const { text: answer } = await generateText({
    model: getAIModel(getActiveProvider()),
    system: SYSTEM_PROMPT,
    prompt: `Contexto SAFe 6.0:\n${context}\n\nPergunta: ${question}`,
  });

  // ── 6. Cache result ────────────────────────────────────────────────────────
  if (!skipCache) {
    await cache.set(question, answer, chunks);
  }

  return { answer, chunks, cached: false, queriesUsed: queries };
}
