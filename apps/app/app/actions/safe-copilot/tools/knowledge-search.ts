import { models } from "@repo/ai/lib/models";
import { searchKnowledge } from "@repo/database/vector-search";
import { embed } from "ai";

type KnowledgeSearchResult = {
  sourceType: string;
  sourceId: string | null;
  title: string | null;
  excerpt: string;
  similarity: number;
};

export async function runKnowledgeSearch(
  query: string,
  tenantId: string,
  sourceTypes?: string[],
  limit = 8
): Promise<KnowledgeSearchResult[]> {
  const { embedding } = await embed({ model: models.embeddings, value: query });
  const hits = await searchKnowledge(tenantId, embedding, query, {
    sourceTypes,
    limit,
    threshold: 0.65,
  });
  return hits.map((h) => ({
    sourceType: h.sourceType,
    sourceId: h.sourceId,
    title: h.title,
    excerpt: h.textContent.slice(0, 400),
    similarity: h.similarity,
  }));
}
