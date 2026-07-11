# T03 — RAG Contextual na PI Planning — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Copilot durante PI Planning responde com base em contexto vetorial real do PI (risks, objectives, features, epics, OKRs, documents). Threshold de similaridade 0.75. Surface direto na cerimônia (PI Planning workspace).

**Architecture:**
- Indexer job (background) varre entidades SAFe, chunk, embed, upsert em `PIKnowledgeVector`
- Query path: user message → embed → pgvector hybrid search (cosine + FTS via RRF) → top-k chunks → injetar no system prompt do Claude → resposta com citações
- Tenant isolation: filtro `tenantId` em todas as queries
- Re-indexing trigger: entity update ou periodic full reindex

**Tech Stack:** Anthropic Claude + embeddings (Voyage-3 ou OpenAI text-embedding-3-large), pgvector 1536-dim, raw SQL via Prisma, Next.js Server Actions.

**Estado atual:**
- `packages/database/vector-search.ts`: hybrid search RRF já implementado
- `apps/app/app/actions/safe-copilot/indexer.ts`: indexer existe
- `apps/app/app/actions/safe-copilot/tools/`: tools do Copilot
- Falta: indexer triggers em mutations, surface na PI Planning UI, citação no Copilot response

---

## File Structure

```
apps/app/app/actions/safe-copilot/
  indexer.ts                    MODIFY: expandir cobertura + triggers
  tools/
    knowledge-search.ts         NEW: tool RAG do Copilot
    pi-context.ts               NEW: tool para context do PI atual
  embedding-provider.ts         NEW: wrapper de embedding
  reindex-entity.ts             NEW: action server para re-index
  context/
    pi-planning-context.ts      NEW: build context Copilot mode pi_workspace
    citation-formatter.ts       NEW: formata fontes para citação inline

apps/app/app/actions/epics/      MODIFY: trigger reindex em update
apps/app/app/actions/features/   MODIFY: trigger reindex em update
apps/app/app/actions/arts/risks.ts MODIFY: trigger reindex em risk

apps/app/app/(authenticated)/pi-planning/components/
  copilot-pi-panel.tsx          NEW: Copilot embedded na cerimônia
  knowledge-citation.tsx        NEW: componente de citação clicável

apps/app/__tests__/actions/safe-copilot/
  knowledge-search.test.ts      NEW
  indexer.test.ts               NEW
```

---

## Task 1: Embedding provider abstraction

Files:
- Create: `apps/app/app/actions/safe-copilot/embedding-provider.ts`

Step 1: Wrapper que esconde provider (Voyage/OpenAI)

```typescript
const PROVIDER = process.env.EMBEDDING_PROVIDER ?? "voyage";

export async function embed(text: string): Promise<number[]> {
  if (PROVIDER === "voyage") return embedVoyage(text);
  return embedOpenAI(text);
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (PROVIDER === "voyage") return embedBatchVoyage(texts);
  return embedBatchOpenAI(texts);
}

async function embedVoyage(text: string): Promise<number[]> {
  const r = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({ model: "voyage-3", input: [text] }),
  });
  if (!r.ok) throw new Error(`Voyage error: ${await r.text()}`);
  const j = await r.json();
  return j.data[0].embedding;
}

async function embedBatchVoyage(texts: string[]): Promise<number[][]> {
  const r = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.VOYAGE_API_KEY}` },
    body: JSON.stringify({ model: "voyage-3", input: texts }),
  });
  if (!r.ok) throw new Error(`Voyage error: ${await r.text()}`);
  const j = await r.json();
  return j.data.map((d: { embedding: number[] }) => d.embedding);
}

async function embedOpenAI(text: string): Promise<number[]> { throw new Error("not implemented"); }
async function embedBatchOpenAI(texts: string[]): Promise<number[][]> { throw new Error("not implemented"); }
```

Step 2: Commit `feat(copilot): embedding provider abstraction (Voyage/OpenAI)`

---

## Task 2: Chunking utility

Files:
- Create: `apps/app/app/actions/safe-copilot/chunk-text.ts`

Step 1: Failing test

```typescript
import { chunkText } from "@/app/actions/safe-copilot/chunk-text";

describe("chunkText", () => {
  it("returns single chunk if under target size", () => {
    const r = chunkText("short text", { targetChars: 1000 });
    expect(r.length).toBe(1);
  });

  it("splits on paragraph boundaries when possible", () => {
    const t = "p1\n\n" + "x".repeat(500) + "\n\n" + "p3";
    const r = chunkText(t, { targetChars: 200 });
    expect(r.length).toBeGreaterThan(1);
    expect(r.every((c) => c.length <= 600)).toBe(true);
  });
});
```

Step 2: Implement

```typescript
export function chunkText(text: string, opts: { targetChars?: number; overlap?: number } = {}): string[] {
  const target = opts.targetChars ?? 1500;
  const overlap = opts.overlap ?? 150;
  if (text.length <= target) return [text];

  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let buf = "";
  for (const p of paragraphs) {
    if (buf.length + p.length + 2 > target) {
      if (buf) chunks.push(buf);
      buf = (overlap > 0 && chunks.length > 0) ? chunks[chunks.length - 1].slice(-overlap) + "\n\n" + p : p;
    } else {
      buf = buf ? `${buf}\n\n${p}` : p;
    }
  }
  if (buf) chunks.push(buf);
  return chunks;
}
```

Step 3: Commit `feat(copilot): text chunker with paragraph boundary + overlap`

---

## Task 3: Indexer expand cobrir todas as fontes

Files:
- Modify: `apps/app/app/actions/safe-copilot/indexer.ts`

Step 1: Função `indexEntity(sourceType, sourceId, tenantId)`

```typescript
import { database } from "@repo/database";
import { embed } from "./embedding-provider";
import { chunkText } from "./chunk-text";

type SourceType = "risk" | "pi_objective" | "feature" | "epic" | "okr" | "document";

export async function indexEntity(sourceType: SourceType, sourceId: string, tenantId: string) {
  const content = await fetchSourceContent(sourceType, sourceId, tenantId);
  if (!content) return;

  const chunks = chunkText(`${content.title}\n\n${content.body}`);

  await database.pIKnowledgeVector.deleteMany({
    where: { tenantId, sourceType, sourceId },
  });

  for (let i = 0; i < chunks.length; i++) {
    const vec = await embed(chunks[i]);
    const literal = `[${vec.join(",")}]`;
    await database.$executeRawUnsafe(
      `INSERT INTO "PIKnowledgeVector" (id, "tenantId", "sourceType", "sourceId", "chunkIndex", title, "textContent", embedding, "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7::vector, NOW(), NOW())`,
      tenantId, sourceType, sourceId, i, content.title, chunks[i], literal
    );
  }
}

async function fetchSourceContent(sourceType: SourceType, sourceId: string, tenantId: string) {
  switch (sourceType) {
    case "epic": {
      const e = await database.epic.findFirst({ where: { id: sourceId, tenantId }, select: { title: true, descriptionMd: true } });
      return e ? { title: e.title, body: e.descriptionMd ?? "" } : null;
    }
    case "feature": {
      const f = await database.feature.findFirst({ where: { id: sourceId, tenantId }, select: { title: true } });
      return f ? { title: f.title, body: "" } : null;
    }
    case "risk": {
      const r = await database.risk.findFirst({ where: { id: sourceId, tenantId }, select: { description: true, notes: true } });
      return r ? { title: "Risk", body: `${r.description ?? ""}\n\n${r.notes ?? ""}` } : null;
    }
    default: return null;
  }
}
```

Step 2: Commit `feat(copilot): indexer with chunk-then-embed for all SAFe sources`

---

## Task 4: Trigger reindex em mutations

Files:
- Modify: `apps/app/app/actions/epics/update-epic.ts`
- Modify: `apps/app/app/actions/features/update.ts`
- Modify: `apps/app/app/actions/arts/risks.ts`

Step 1: Em cada update, disparar reindex async

```typescript
import { indexEntity } from "@/app/actions/safe-copilot/indexer";

queueMicrotask(() => {
  indexEntity("epic", epic.id, tenantId).catch((err) => {
    console.error("[copilot] reindex epic failed", { id: epic.id, err });
  });
});
```

Aplicar mesmo padrão em feature, risk, pi_objective, okr.

Step 2: Commit `feat(copilot): trigger reindex on entity mutation`

---

## Task 5: Knowledge search tool

Files:
- Create: `apps/app/app/actions/safe-copilot/tools/knowledge-search.ts`

Step 1: Tool exposta ao Copilot

```typescript
import { searchKnowledge } from "@repo/database/vector-search";
import { embed } from "../embedding-provider";

export const knowledgeSearchTool = {
  name: "search_knowledge",
  description: "Search the PI planning knowledge base for relevant risks, features, epics, OKRs, objectives or documents.",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string" },
      sourceTypes: {
        type: "array",
        items: { type: "string", enum: ["risk", "pi_objective", "feature", "epic", "okr", "document"] },
      },
      limit: { type: "number", default: 8 },
    },
    required: ["query"],
  },
  async run(args: { query: string; sourceTypes?: string[]; limit?: number }, ctx: { tenantId: string }) {
    const embedding = await embed(args.query);
    const hits = await searchKnowledge(ctx.tenantId, embedding, args.query, {
      sourceTypes: args.sourceTypes,
      limit: args.limit ?? 8,
      threshold: 0.65,
    });
    return hits.map((h) => ({
      sourceType: h.sourceType,
      sourceId: h.sourceId,
      title: h.title,
      excerpt: h.textContent.slice(0, 400),
      similarity: h.similarity,
    }));
  },
};
```

Step 2: Registrar tool no Copilot tool registry
Step 3: Commit `feat(copilot): knowledge_search tool with hybrid pgvector + FTS`

---

## Task 6: PI Planning context builder

Files:
- Create: `apps/app/app/actions/safe-copilot/context/pi-planning-context.ts`

Step 1: Buildar prelude do system prompt quando mode=pi_workspace

```typescript
import { database } from "@repo/database";

export async function buildPIPlanningContext(tenantId: string, piPlanId: string) {
  const pi = await database.pIPlan.findFirst({
    where: { id: piPlanId, tenantId },
    include: {
      art: { select: { name: true, cadence: true } },
      _count: { select: { features: true, piObjectives: true, risks: true } },
    },
  });
  if (!pi) return "";

  return `## Current PI Planning Context

- PI: **${pi.name}**
- ART: **${pi.art.name}** (cadence: ${pi.art.cadence} weeks)
- Dates: ${pi.startDate?.toISOString().slice(0, 10)} -> ${pi.endDate?.toISOString().slice(0, 10)}
- Committed features: ${pi._count.features}
- Objectives: ${pi._count.piObjectives}
- Open risks: ${pi._count.risks}

When the user asks about features, risks, objectives, call \`search_knowledge\` first with the appropriate sourceTypes.
Cite sources inline using [source: <type>:<id>] format.`;
}
```

Step 2: Commit `feat(copilot): build PI planning context preamble`

---

## Task 7: Citation formatter + UI component

Files:
- Create: `apps/app/app/actions/safe-copilot/context/citation-formatter.ts`
- Create: `apps/app/app/(authenticated)/pi-planning/components/knowledge-citation.tsx`

Step 1: Parser de `[source: type:id]` em texto markdown

```typescript
export type Citation = { type: string; id: string };

export function extractCitations(text: string): Citation[] {
  const re = /\[source:\s*([a-z_]+):([a-zA-Z0-9_-]+)\]/g;
  const out: Citation[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({ type: m[1], id: m[2] });
  }
  return out;
}
```

Step 2: Componente clicável que navega para a entidade

```tsx
import Link from "next/link";

export function KnowledgeCitation({ type, id }: { type: string; id: string }) {
  const href =
    type === "epic" ? `/portfolio/epics/${id}` :
    type === "feature" ? `/features/${id}` :
    type === "risk" ? `/risks/${id}` :
    "#";
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-xs text-blue-600 underline">
      {type}:{id.slice(0, 8)}
    </Link>
  );
}
```

Step 3: Commit `feat(copilot): citation extractor + clickable UI link`

---

## Task 8: Copilot PI Panel embedded

Files:
- Create: `apps/app/app/(authenticated)/pi-planning/components/copilot-pi-panel.tsx`

Step 1: Side panel com Copilot configurado em mode=pi_workspace, surface=pi_workspace
Step 2: Passar piPlanId no contexto inicial da session
Step 3: Mostrar citações renderizadas com KnowledgeCitation
Step 4: Commit `feat(pi-planning): embedded Copilot panel with RAG citations`

---

## Task 9: Full reindex cron

Files:
- Create: `apps/app/app/api/cron/reindex-knowledge/route.ts`

Step 1: Cron diário que re-indexa entities com chunks > 30 dias
Step 2: Skip entities sem mudança (hash check)
Step 3: Commit `feat(copilot): daily reindex cron for stale knowledge vectors`

---

## Done When

- [ ] Indexer cobre risk, pi_objective, feature, epic, okr, document
- [ ] Mutações disparam reindex async sem bloquear API
- [ ] Tool `search_knowledge` retorna chunks com similarity > threshold
- [ ] Copilot em modo pi_workspace recebe contexto + cita fontes
- [ ] UI de PI Planning tem panel Copilot integrado
- [ ] Citações são clicáveis e navegam para entidade fonte
- [ ] Tests passando (chunking, indexer, search com mock)
