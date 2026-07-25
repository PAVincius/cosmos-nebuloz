"use server";

import { models } from "@repo/ai/lib/models";
import { requireTenantSession } from "@repo/auth/server";
import { upsertKnowledgeChunk } from "@repo/database/vector-search";
import { embedMany } from "ai";
import { headers } from "next/headers";
import { SAFE_KNOWLEDGE_PAIRS } from "./safe-knowledge-data";

const BATCH_SIZE = 20;

type KnowledgeChunk = {
  tenantId: string;
  sourceType: string;
  sourceId: string;
  chunkIndex: number;
  title: string;
  textContent: string;
  metadata?: Record<string, unknown>;
};

async function embedAndUpsertBatch(chunks: KnowledgeChunk[]): Promise<void> {
  if (chunks.length === 0) {
    return;
  }
  const texts = chunks.map((c) => `${c.title}\n${c.textContent}`);
  const { embeddings } = await embedMany({
    model: models.embeddings,
    values: texts,
  });
  await Promise.all(
    chunks.map((c, i) =>
      upsertKnowledgeChunk({ ...c, embedding: embeddings[i] ?? [] })
    )
  );
}

/**
 * Index 127 SAFe 6.0 Q&A pairs into PIKnowledgeVector for a tenant.
 * sourceType = "safe_framework" — idempotent on (tenantId, safe_framework, safe_q_{i}, 0).
 * Call once per tenant or after SAFE_KNOWLEDGE_PAIRS is updated.
 */
export async function syncSafeFrameworkKnowledge(): Promise<{
  indexed: number;
}> {
  const { tenantId } = await requireTenantSession(await headers());

  const chunks: KnowledgeChunk[] = SAFE_KNOWLEDGE_PAIRS.map((pair, i) => ({
    tenantId,
    sourceType: "safe_framework",
    sourceId: `safe_q_${i}`,
    chunkIndex: 0,
    title: pair.question.slice(0, 200),
    textContent: `Pergunta: ${pair.question}\n\nResposta: ${pair.answer}`,
    metadata: { pairIndex: i },
  }));

  let indexed = 0;
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    await embedAndUpsertBatch(chunks.slice(i, i + BATCH_SIZE));
    indexed += Math.min(BATCH_SIZE, chunks.length - i);
  }

  return { indexed };
}
