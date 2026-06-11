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

const ELEVATED_ROLES = new Set(["RTE", "ADMIN", "SOLUTION_TRAIN_ENGINEER"]);

type KnowledgeSearchOptions = {
  sourceTypes?: string[];
  limit?: number;
  role?: string;
};

export async function runKnowledgeSearch(
  query: string,
  tenantId: string,
  opts: KnowledgeSearchOptions = {}
): Promise<KnowledgeSearchResult[]> {
  const { sourceTypes, limit, role } = opts;
  const resolvedLimit = limit ?? (role && ELEVATED_ROLES.has(role) ? 12 : 8);
  const { embedding } = await embed({ model: models.embeddings, value: query });
  const hits = await searchKnowledge(tenantId, embedding, query, {
    sourceTypes,
    limit: resolvedLimit,
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
