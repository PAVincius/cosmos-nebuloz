import { Prisma } from "./generated/client";
import { database } from "./index";

export type KnowledgeHit = {
  id: string;
  sourceType: string;
  sourceId: string | null;
  title: string | null;
  textContent: string;
  similarity: number;
};

export type SimilarRisk = {
  id: string;
  textContent: string;
  similarity: number;
};

/**
 * Hybrid semantic + keyword search over PIKnowledgeVector.
 * Combines cosine similarity (pgvector <=> operator) with PostgreSQL
 * full-text search via plainto_tsquery, fused with Reciprocal Rank Fusion.
 */
export async function searchKnowledge(
  tenantId: string,
  embedding: number[],
  query: string,
  options: {
    sourceTypes?: string[];
    limit?: number;
    threshold?: number;
  } = {}
): Promise<KnowledgeHit[]> {
  const { sourceTypes, limit = 8, threshold = 0.65 } = options;

  if (!embedding.every((v) => typeof v === "number" && Number.isFinite(v))) {
    throw new Error("embedding contains non-finite values");
  }
  const embeddingLiteral = Prisma.raw(`'[${embedding.join(",")}]'::vector`);

  const sourceFilter =
    sourceTypes && sourceTypes.length > 0
      ? Prisma.sql`AND "sourceType" = ANY(ARRAY[${Prisma.join(sourceTypes)}])`
      : Prisma.empty;

  // Vector-only search (pgvector cosine similarity)
  // We do two ranked lists then merge with RRF at application level.
  // The SQL below returns cosine similarity hits + FTS rank in one pass.
  const hits = await database.$queryRaw<
    Array<{
      id: string;
      sourceType: string;
      sourceId: string | null;
      title: string | null;
      textContent: string;
      sim: number;
      tsRank: number;
    }>
  >`
    SELECT
      id,
      "sourceType",
      "sourceId",
      title,
      "textContent",
      1 - (embedding <=> ${embeddingLiteral}) AS sim,
      COALESCE(
        ts_rank(
          to_tsvector('portuguese', COALESCE(title, '') || ' ' || "textContent"),
          plainto_tsquery('portuguese', ${query})
        ),
        0
      ) AS "tsRank"
    FROM "PIKnowledgeVector"
    WHERE "tenantId" = ${tenantId}
      AND 1 - (embedding <=> ${embeddingLiteral}) > ${threshold}
      ${sourceFilter}
    ORDER BY sim DESC
    LIMIT ${limit * 2}
  `;

  // RRF: score = 1/(k + rank_vector) + 1/(k + rank_fts)
  // rank by sim descending, rank by tsRank descending separately, then fuse
  const k = 60;
  const sorted = [...hits]
    .map((h, i) => {
      const vectorRank = i + 1;
      const ftsRank =
        hits
          .slice()
          .sort((a, b) => b.tsRank - a.tsRank)
          .findIndex((x) => x.id === h.id) + 1;
      const rrfScore = 1 / (k + vectorRank) + 1 / (k + ftsRank);
      return { ...h, rrfScore };
    })
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .slice(0, limit);

  return sorted.map((h) => ({
    id: h.id,
    sourceType: h.sourceType,
    sourceId: h.sourceId,
    title: h.title,
    textContent: h.textContent,
    similarity: h.sim,
  }));
}

/** Legacy shim — kept for backward compat; delegates to searchKnowledge */
export async function findSimilarRisks(
  tenantId: string,
  embedding: number[],
  limit = 5,
  threshold = 0.75
): Promise<SimilarRisk[]> {
  const hits = await searchKnowledge(tenantId, embedding, "", {
    sourceTypes: ["risk"],
    limit,
    threshold,
  });
  return hits.map((h) => ({
    id: h.id,
    textContent: h.textContent,
    similarity: h.similarity,
  }));
}

/** Delete all knowledge vectors for a session (called when session is cleared). */
export async function deleteSessionVectors(
  tenantId: string,
  sessionId: string
): Promise<void> {
  await database.$executeRaw`
    DELETE FROM "PIKnowledgeVector"
    WHERE "tenantId" = ${tenantId} AND "sessionId" = ${sessionId}
  `;
}

/** Upsert a single knowledge chunk — idempotent on (tenantId, sourceType, sourceId, chunkIndex). */
export async function upsertKnowledgeChunk(chunk: {
  tenantId: string;
  sourceType: string;
  sourceId: string;
  chunkIndex: number;
  title: string;
  textContent: string;
  metadata?: Record<string, unknown>;
  embedding: number[];
}): Promise<void> {
  const embeddingLiteral = `[${chunk.embedding.join(",")}]`;
  const metadataJson = chunk.metadata ? JSON.stringify(chunk.metadata) : null;
  await database.$executeRaw`
    INSERT INTO "PIKnowledgeVector"
      ("id", "tenantId", "sourceType", "sourceId", "chunkIndex", "title", "textContent", "metadata", "embedding")
    VALUES
      (gen_random_uuid()::text, ${chunk.tenantId}, ${chunk.sourceType}, ${chunk.sourceId}, ${chunk.chunkIndex},
       ${chunk.title}, ${chunk.textContent}, ${metadataJson}::jsonb, ${embeddingLiteral}::vector)
    ON CONFLICT ON CONSTRAINT "PIKnowledgeVector_source_unique"
    DO UPDATE SET
      "title"       = EXCLUDED."title",
      "textContent" = EXCLUDED."textContent",
      "metadata"    = EXCLUDED."metadata",
      "embedding"   = EXCLUDED."embedding",
      "updatedAt"   = CURRENT_TIMESTAMP
  `;
}
