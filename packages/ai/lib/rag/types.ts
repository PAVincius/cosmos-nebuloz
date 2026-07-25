// ─── Shared RAG types ─────────────────────────────────────────────────────────

export type RagChunk = {
  id: string;
  content: string;
  source?: string;
  score?: number;
  metadata?: Record<string, unknown>;
};

export type RagResult = {
  answer: string;
  chunks: RagChunk[];
  cached: boolean;
  queriesUsed: string[];
};

/** Injected retrieval function — storage-agnostic (LanceDB, pgvector, in-memory…) */
export type RetrieveFn = (queries: string[]) => Promise<RagChunk[]>;
