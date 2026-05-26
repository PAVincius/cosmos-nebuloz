"use server";

import { models } from "@repo/ai/lib/models";
import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { upsertKnowledgeChunk } from "@repo/database/vector-search";
import { embed, embedMany } from "ai";
import { headers } from "next/headers";
import { sanitizeForPrompt } from "@/lib/prompt-sanitize";
import { chunkText } from "./chunk-text";

const BATCH_SIZE = 20;

type Chunk = {
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

async function runInBatches(chunks: Chunk[]): Promise<number> {
  let indexed = 0;
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    await embedAndUpsertBatch(chunks.slice(i, i + BATCH_SIZE));
    indexed += Math.min(BATCH_SIZE, chunks.length - i);
  }
  return indexed;
}

/**
 * Full re-index of tenant knowledge into PIKnowledgeVector.
 * Idempotent — upserts on (tenantId, sourceType, sourceId, chunkIndex).
 * Returns counts per source type.
 */
export async function syncTenantKnowledge(): Promise<{
  indexed: Record<string, number>;
  total: number;
}> {
  const { tenantId } = await requireTenantSession(await headers());
  const counts: Record<string, number> = {};

  // ── Risks ────────────────────────────────────────────────────────────────
  const risks = await database.risk.findMany({
    where: { tenantId },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      category: true,
      impact: true,
      piPlanId: true,
    },
    take: 300,
  });
  const riskChunks: Chunk[] = risks.map((r) => ({
    tenantId,
    sourceType: "risk",
    sourceId: r.id,
    chunkIndex: 0,
    title: sanitizeForPrompt(r.title),
    textContent: [
      `Risco: ${sanitizeForPrompt(r.title)}`,
      r.description ? `Descrição: ${sanitizeForPrompt(r.description)}` : "",
      `Status ROAM: ${r.status ?? "IDENTIFIED"}`,
      r.category ? `Categoria: ${r.category}` : "",
      r.impact ? `Impacto: ${r.impact}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    metadata: { piPlanId: r.piPlanId, status: r.status, impact: r.impact },
  }));
  counts.risk = await runInBatches(riskChunks);

  // ── PI Objectives ────────────────────────────────────────────────────────
  const objectives = await database.pIObjective.findMany({
    where: { tenantId },
    select: {
      id: true,
      title: true,
      businessValue: true,
      status: true,
      isStretch: true,
      piPlanId: true,
    },
    take: 300,
  });
  const objChunks: Chunk[] = objectives.map((o) => ({
    tenantId,
    sourceType: "pi_objective",
    sourceId: o.id,
    chunkIndex: 0,
    title: sanitizeForPrompt(o.title),
    textContent: [
      `Objetivo de PI: ${sanitizeForPrompt(o.title)}`,
      `Business Value: ${o.businessValue ?? "?"}`,
      `Status: ${o.status ?? "?"}`,
      o.isStretch ? "Tipo: Stretch" : "Tipo: Comprometido",
    ].join("\n"),
    metadata: {
      piPlanId: o.piPlanId,
      businessValue: o.businessValue,
      isStretch: o.isStretch,
    },
  }));
  counts.pi_objective = await runInBatches(objChunks);

  // ── Features ─────────────────────────────────────────────────────────────
  const features = await database.feature.findMany({
    where: { tenantId },
    select: {
      id: true,
      title: true,
      statusId: true,
      wsjfScore: true,
      epicId: true,
      piPlanId: true,
    },
    take: 400,
  });
  const featChunks: Chunk[] = features.map((f) => ({
    tenantId,
    sourceType: "feature",
    sourceId: f.id,
    chunkIndex: 0,
    title: sanitizeForPrompt(f.title),
    textContent: [
      `Feature: ${sanitizeForPrompt(f.title)}`,
      `Status: ${f.statusId ?? "BACKLOG"}`,
      f.wsjfScore !== null ? `WSJF: ${f.wsjfScore}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    metadata: {
      epicId: f.epicId,
      piPlanId: f.piPlanId,
      statusId: f.statusId,
      wsjfScore: f.wsjfScore,
    },
  }));
  counts.feature = await runInBatches(featChunks);

  // ── Epics ─────────────────────────────────────────────────────────────────
  const epics = await database.epic.findMany({
    where: { tenantId },
    select: { id: true, title: true, statusId: true, strategicThemeId: true },
    take: 200,
  });
  const epicChunks: Chunk[] = epics.map((e) => ({
    tenantId,
    sourceType: "epic",
    sourceId: e.id,
    chunkIndex: 0,
    title: sanitizeForPrompt(e.title),
    textContent: [
      `Épico: ${sanitizeForPrompt(e.title)}`,
      `Status: ${e.statusId ?? "BACKLOG"}`,
    ].join("\n"),
    metadata: { statusId: e.statusId, strategicThemeId: e.strategicThemeId },
  }));
  counts.epic = await runInBatches(epicChunks);

  // ── OKRs ──────────────────────────────────────────────────────────────────
  const okrs = await database.oKR.findMany({
    where: { tenantId },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      type: true,
      keyResults: {
        select: { title: true, current: true, target: true, unit: true },
      },
    },
    take: 200,
  });
  const okrChunks: Chunk[] = okrs.map((o) => ({
    tenantId,
    sourceType: "okr",
    sourceId: o.id,
    chunkIndex: 0,
    title: sanitizeForPrompt(o.title),
    textContent: [
      `OKR: ${sanitizeForPrompt(o.title)}`,
      o.description ? `Descrição: ${sanitizeForPrompt(o.description)}` : "",
      `Status: ${o.status ?? "?"}`,
      `Tipo: ${o.type ?? "?"}`,
      ...o.keyResults.map(
        (kr) =>
          `KR: ${sanitizeForPrompt(kr.title)} — ${kr.current ?? 0}/${kr.target ?? "?"} ${kr.unit ?? ""}`
      ),
    ]
      .filter(Boolean)
      .join("\n"),
    metadata: { status: o.status, type: o.type },
  }));
  counts.okr = await runInBatches(okrChunks);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return { indexed: counts, total };
}

type SourceType = "risk" | "pi_objective" | "feature" | "epic" | "okr";

type EntityContent = { title: string; body: string };

async function fetchEntityContent(
  sourceType: SourceType,
  sourceId: string,
  tenantId: string,
): Promise<EntityContent | null> {
  switch (sourceType) {
    case "epic": {
      const e = await database.epic.findFirst({
        where: { id: sourceId, tenantId },
        select: { title: true, descriptionMd: true },
      });
      return e ? { title: e.title, body: e.descriptionMd ?? "" } : null;
    }
    case "feature": {
      const f = await database.feature.findFirst({
        where: { id: sourceId, tenantId },
        select: { title: true },
      });
      return f ? { title: f.title, body: "" } : null;
    }
    case "risk": {
      const r = await database.risk.findFirst({
        where: { id: sourceId, tenantId },
        select: { title: true, description: true, notes: true },
      });
      return r
        ? {
            title: r.title,
            body: [r.description, r.notes].filter(Boolean).join("\n\n"),
          }
        : null;
    }
    case "pi_objective": {
      const o = await database.pIObjective.findFirst({
        where: { id: sourceId, tenantId },
        select: { title: true },
      });
      return o ? { title: o.title, body: "" } : null;
    }
    default:
      return null;
  }
}

/**
 * Re-index a single entity after create/update.
 * Takes tenantId directly — safe for fire-and-forget via queueMicrotask.
 */
export async function indexEntity(
  sourceType: SourceType,
  sourceId: string,
  tenantId: string,
): Promise<void> {
  const content = await fetchEntityContent(sourceType, sourceId, tenantId);
  if (!content) {
    return;
  }

  const fullText = [content.title, content.body].filter(Boolean).join("\n\n");
  const chunks = chunkText(fullText);

  const chunkObjs: Chunk[] = chunks.map((text, i) => ({
    tenantId,
    sourceType,
    sourceId,
    chunkIndex: i,
    title: content.title,
    textContent: text,
  }));

  await runInBatches(chunkObjs);
}

/**
 * Embed and upsert a single document chunk (for PDF/document uploads).
 * Returns the inserted vector ID.
 */
export async function indexDocumentChunk(
  sessionId: string,
  fileName: string,
  chunkIndex: number,
  textContent: string
): Promise<void> {
  const { tenantId } = await requireTenantSession(await headers());

  const { embedding } = await embed({
    model: models.embeddings,
    value: `${fileName} (chunk ${chunkIndex + 1})\n${textContent}`,
  });

  await upsertKnowledgeChunk({
    tenantId,
    sourceType: "document",
    sourceId: `${sessionId}:${fileName}`,
    chunkIndex,
    title: fileName,
    textContent,
    metadata: { sessionId, fileName },
    embedding,
  });
}
