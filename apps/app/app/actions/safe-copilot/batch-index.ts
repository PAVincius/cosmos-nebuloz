import { models } from "@repo/ai/lib/models";
import { upsertKnowledgeChunk } from "@repo/database/vector-search";
import { embedMany } from "ai";

const BATCH_SIZE = 20;

export type Chunk = {
  tenantId: string;
  sourceType: string;
  sourceId: string;
  chunkIndex: number;
  title: string;
  textContent: string;
  metadata?: Record<string, unknown>;
};

async function embedAndUpsertBatch(chunks: Chunk[]): Promise<void> {
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

export async function runInBatches(chunks: Chunk[]): Promise<number> {
  let indexed = 0;
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    await embedAndUpsertBatch(chunks.slice(i, i + BATCH_SIZE));
    indexed += Math.min(BATCH_SIZE, chunks.length - i);
  }
  return indexed;
}
