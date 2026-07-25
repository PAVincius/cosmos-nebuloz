# Story 026 — SAFe Copilot RAG Infrastructure

**Epic:** 007 — Solution Train & Advanced Features
**Feature:** F-007-006 AI Copilot Intelligence
**WSJF:** 11.0 (userValue=8, timeValue=7, riskReduction=7, jobSize=2)
**Story Points:** 13
**Priority:** Must Have
**Status:** DEFINED

---

## User Story

**As an** RTE,
**I want** an AI copilot grounded in our PI and team data via RAG, with role-aware context assembly and confirmation-gated tool calling,
**so that** I get answers and can take actions that are specific to our actual work context, not generic SAFe advice.

---

## Acceptance Criteria

### AC-001: Session window: last 20 turns
Given a session with 25 prior turns,
When a new message is sent,
Then:
- The model receives the last 20 turns + current message (not 25 turns)
- Turns beyond 20 are summarized and included as a system context block (not truncated silently)

### AC-002: Incremental reindex within 60s
Given a Risk's ROAM status changes from OWNED to RESOLVED,
When the incremental reindex fires within 60s,
Then:
- The next copilot query reflecting the resolved risk returns the updated status
- The `PIKnowledgeVector` chunk for that risk has updated content

### AC-003: Full reindex (500 entities) ≤ 10 min
Given a tenant with 500 entities (epics, features, stories, risks, standups, retros),
When a full reindex is triggered,
Then:
- All chunks are upserted to `PIKnowledgeVector` with correct `orgId`, `entityType`, `entityId`, `chunkIndex`
- Completion within 10 min
- No data from other tenants included (orgId-scoped query)

### AC-004: Cross-tenant isolation at vector query level
Given two tenants with indexed objectives,
When Org A's copilot queries for objectives,
Then:
- `PIKnowledgeVector` records for Org B are never returned
- Verified by EXPLAIN plan showing RLS filter on `org_id`

### AC-005: Hybrid retrieval RRF k=60
Given a query "What's blocking the payments team?",
When retrieval runs,
Then:
- Vector search (top-20) + BM25/trgm search (top-20) are combined via RRF with k=60
- Final result returns top-8 chunks (non-admin) or top-12 (RTE/admin)
- Non-primary entity types for the requester's role are down-ranked by 0.5×

### AC-006: Role-specific context assembly < 800ms
Given an SM queries from the Sprint Board context,
When context assembly runs,
Then:
- Context includes team's current sprint data, standup blockers, open impediments, recent INVEST scores
- Context assembly P95 < 800ms
- A cached fallback is served on assembly miss (stale-while-revalidate)

### AC-007: Confirmation-gated tool calling
Given a PO asks "Create a story for mobile login",
When the copilot proposes the `create_story` tool call,
Then:
- A confirmation card is shown with: proposed title, feature link, team, estimate
- The PO must click "Confirm" before the story is created
- After confirmation: story is created with `source=copilot` audit tag and appears in the backlog

### AC-008: VIEWER cannot trigger mutating tools
Given a VIEWER asks the copilot to create an epic,
When the model evaluates the request,
Then:
- No confirmation card is shown
- No `create_epic` tool call is attempted
- The model responds: "Your role (Viewer) doesn't have permission to create epics. Contact your RTE to request access."

---

## Technical Notes

### pgvector Index

```sql
CREATE INDEX idx_knowledge_vector_embedding ON "PIKnowledgeVector"
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Composite for org-scoped filtered search
CREATE INDEX idx_knowledge_vector_org_type ON "PIKnowledgeVector"
  (org_id, entity_type, indexed_at);
```

### Hybrid Retrieval (RRF k=60)

```typescript
// packages/ai/src/rag/hybrid-retrieval.ts
export const hybridRetrieve = async (query: string, orgId: string, role: string): Promise<Chunk[]> => {
  const embedding = await embed(query)

  const [vectorResults, bm25Results] = await Promise.all([
    // Vector search
    prisma.$queryRaw<Array<{id: string; score: number}>>`
      SELECT id, 1 - (embedding <=> ${embedding}::vector) as score
      FROM "PIKnowledgeVector"
      WHERE org_id = ${orgId}
      ORDER BY embedding <=> ${embedding}::vector
      LIMIT 20
    `,
    // BM25 via pg_trgm similarity
    prisma.$queryRaw<Array<{id: string; score: number}>>`
      SELECT id, similarity(content, ${query}) as score
      FROM "PIKnowledgeVector"
      WHERE org_id = ${orgId}
        AND content % ${query}
      ORDER BY score DESC
      LIMIT 20
    `,
  ])

  // RRF fusion k=60
  const rrfScore = (rank: number, k = 60) => 1 / (k + rank)
  const scores = new Map<string, number>()

  vectorResults.forEach((r, i) => scores.set(r.id, (scores.get(r.id) ?? 0) + rrfScore(i + 1)))
  bm25Results.forEach((r, i) => scores.set(r.id, (scores.get(r.id) ?? 0) + rrfScore(i + 1)))

  const topK = isAdminOrRTE(role) ? 12 : 8
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topK)
    .map(([id]) => id)
    .then(ids => prisma.pIKnowledgeVector.findMany({ where: { id: { in: ids } } }))
}
```

### Session Context Window

```typescript
// packages/ai/src/copilot/session-manager.ts
const buildContextWindow = (session: CopilotSession): Message[] => {
  const messages = session.messages
  if (messages.length <= 20) return messages.map(toAIMessage)

  // Summarize older messages
  const olderMessages = messages.slice(0, messages.length - 20)
  const summary = `[Session context: ${olderMessages.length} earlier messages covered: ${extractTopics(olderMessages)}]`

  return [
    { role: 'system', content: summary },
    ...messages.slice(-20).map(toAIMessage),
  ]
}
```

### Tool Registry

```typescript
// Read-only tools (no confirmation needed)
export const READ_ONLY_TOOLS = ['search_knowledge', 'summarize_entity', 'compare_sprints', 'calculate_capacity']

// Mutating tools (confirmation required + role check)
export const MUTATING_TOOLS: Record<string, string[]> = {
  create_story: ['SCRUM_MASTER', 'PRODUCT_OWNER', 'RTE', 'PRODUCT_MANAGER'],
  create_risk: ['SCRUM_MASTER', 'RTE', 'SYSTEM_ARCHITECT'],
  score_wsjf: ['PRODUCT_MANAGER', 'RTE'],
  update_roam_status: ['RTE', 'SCRUM_MASTER'],
}
```

---

## Dependencies

- pgvector extension (already in Prisma schema)
- `@vercel/ai` SDK v5.0 (`streamText`, tool calling)
- `PIKnowledgeVector` model
- `CopilotSession`/`CopilotMessage` models
- Epic 006 RAG data sources (standups, retros, risks indexed by Epic 006 stories)

---

## Definition of Done

- [ ] `PIKnowledgeVector` with pgvector (1536-dim, 512-token chunks/64 overlap)
- [ ] IVFFlat index on embedding column
- [ ] Hybrid retrieval: vector + BM25 → RRF k=60, top-8/top-12 by role
- [ ] Session context window: last 20 turns + summarization
- [ ] Nightly + incremental + manual reindex with Upstash lock (15-min TTL)
- [ ] Role-aware context assembly P95 < 800ms + stale-while-revalidate cache
- [ ] Mutating tools with confirmation cards + role-gate
- [ ] VIEWER read-only enforcement (no confirmation cards, model explains)
- [ ] Cross-tenant isolation at DB query level (RLS + app-level check)
- [ ] All tool calls audited with `source=copilot`
- [ ] Unit tests: RRF fusion, session windowing, role gate, tenant isolation
