import { embed } from "ai";
import { models } from "../models";
import type { RagChunk } from "./types";

type CacheEntry = {
  queryEmbedding: number[];
  answer: string;
  chunks: RagChunk[];
  createdAt: number;
};

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * In-process semantic cache.
 * Uses text-embedding-3-small (OpenAI) for similarity comparison.
 * No-ops gracefully when embedding model is unavailable.
 *
 * Default: 1h TTL, 0.92 cosine similarity threshold.
 */
export class QueryCache {
  private entries: CacheEntry[] = [];
  private readonly ttlMs: number;
  private readonly threshold: number;

  constructor({
    ttlMs = 60 * 60 * 1000,
    threshold = 0.92,
  }: { ttlMs?: number; threshold?: number } = {}) {
    this.ttlMs = ttlMs;
    this.threshold = threshold;
  }

  private async embedQuery(query: string): Promise<number[] | null> {
    try {
      const { embedding } = await embed({
        model: models.embeddings,
        value: query,
      });
      return embedding;
    } catch {
      return null; // no-op when OpenAI key missing
    }
  }

  async get(
    query: string
  ): Promise<{ answer: string; chunks: RagChunk[] } | null> {
    const qEmbedding = await this.embedQuery(query);
    if (!qEmbedding) {
      return null;
    }

    const now = Date.now();
    for (const entry of this.entries) {
      if (now - entry.createdAt > this.ttlMs) {
        continue;
      }
      const sim = cosineSimilarity(qEmbedding, entry.queryEmbedding);
      if (sim >= this.threshold) {
        return { answer: entry.answer, chunks: entry.chunks };
      }
    }
    return null;
  }

  async set(query: string, answer: string, chunks: RagChunk[]): Promise<void> {
    const qEmbedding = await this.embedQuery(query);
    if (!qEmbedding) {
      return;
    }

    this.entries.push({
      queryEmbedding: qEmbedding,
      answer,
      chunks,
      createdAt: Date.now(),
    });
  }

  evictExpired(): void {
    const now = Date.now();
    this.entries = this.entries.filter((e) => now - e.createdAt <= this.ttlMs);
  }

  get size(): number {
    return this.entries.length;
  }
}
