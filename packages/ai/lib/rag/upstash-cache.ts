import type { RagChunk } from "./types";

type CachedEntry = {
  answer: string;
  chunks: RagChunk[];
};

const CACHE_PREFIX = "cosmos:rag:v1:";
const TTL_SECONDS = 60 * 60; // 1 hour

function normalizeKey(query: string): string {
  return CACHE_PREFIX + query.toLowerCase().trim().replace(/\s+/g, " ");
}

async function getRedisClient() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!(url && token)) {
    return null;
  }
  try {
    const { Redis } = await import("@upstash/redis");
    return new Redis({ url, token });
  } catch {
    return null;
  }
}

/**
 * Redis-backed RAG cache for multi-instance production.
 * Uses exact-match by normalized query text + 1h TTL.
 * Complements the in-process semantic QueryCache — both can be used together:
 *   1. Check UpstashRagCache (cross-instance exact match)
 *   2. Check QueryCache (in-process semantic similarity)
 *   3. Run full pipeline, write to both caches.
 *
 * No-ops gracefully when UPSTASH_REDIS_REST_URL / TOKEN env vars are absent.
 */
export class UpstashRagCache {
  async get(query: string): Promise<CachedEntry | null> {
    const redis = await getRedisClient();
    if (!redis) {
      return null;
    }
    try {
      const result = await redis.get<CachedEntry>(normalizeKey(query));
      return result ?? null;
    } catch {
      return null;
    }
  }

  async set(query: string, answer: string, chunks: RagChunk[]): Promise<void> {
    const redis = await getRedisClient();
    if (!redis) {
      return;
    }
    try {
      await redis.set(
        normalizeKey(query),
        { answer, chunks } satisfies CachedEntry,
        { ex: TTL_SECONDS }
      );
    } catch {
      // no-op — cache write failure must never break the pipeline
    }
  }

  async invalidate(query: string): Promise<void> {
    const redis = await getRedisClient();
    if (!redis) {
      return;
    }
    try {
      await redis.del(normalizeKey(query));
    } catch {
      // no-op
    }
  }
}

export const upstashRagCache = new UpstashRagCache();
