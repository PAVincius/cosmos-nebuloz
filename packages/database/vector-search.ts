import { database } from "./index";

/**
 * Interface representing a similar PI Risk from the vector database
 */
export interface SimilarRisk {
  id: string;
  textContent: string;
  similarity: number;
}

/**
 * Performs a vector cosine similarity search on the PIKnowledgeVector table.
 * 
 * @param tenantId The current tenant ID to ensure strict data isolation
 * @param embedding The generated OpenAI embedding vector (number array of length 1536)
 * @param limit Maximum number of results to return
 * @param threshold Minimum cosine similarity threshold (0 to 1, where 1 is exact match)
 * @returns Array of similar risks sorted by highest similarity
 */
export async function findSimilarRisks(
  tenantId: string,
  embedding: number[],
  limit: number = 3,
  threshold: number = 0.75
): Promise<SimilarRisk[]> {
  // pgvector expects vector literal as a string: '[0.1, 0.2, ...]'
  const embeddingLiteral = `[${embedding.join(",")}]`;

  // `<=>` is the cosine distance operator in pgvector.
  // 1 - (embedding <=> target) gives the cosine similarity.
  const results = await database.$queryRaw<SimilarRisk[]>`
    SELECT 
      id,
      "textContent",
      1 - (embedding <=> ${embeddingLiteral}::vector) AS similarity
    FROM "PIKnowledgeVector"
    WHERE "tenantId" = ${tenantId}
      AND 1 - (embedding <=> ${embeddingLiteral}::vector) > ${threshold}
    ORDER BY embedding <=> ${embeddingLiteral}::vector
    LIMIT ${limit};
  `;

  return results;
}
