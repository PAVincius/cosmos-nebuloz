# Story 019 — ROAM Risk Management

**Epic:** 006 — Enhanced Portfolio & ART
**Feature:** F-009 Risk Intelligence
**WSJF:** 6.25 (userValue=6, timeValue=4, riskReduction=5, jobSize=2)
**Story Points:** 5
**Priority:** Must Have
**Status:** DEFINED

---

## User Story

**As an** RTE,
**I want** a ROAM risk register with a 4-lane Kanban, AI-assisted risk surfacing from standup and retro data, and staleness escalation to the portfolio,
**so that** all PI-level risks are visible, classified, owned, and resolved before commitment.

---

## Acceptance Criteria

### AC-001: Risk creation with category and severity
Given an RTE creates a risk with category "Dependency", severity 3, description >= 20 chars, and optional sprint link,
When saved,
Then:
- Risk record persists with `roamStatus=UNCLASSIFIED`, `orgId`, `artId`, `piPlanId`
- Risk appears in the "Unclassified" lane of the ROAM board
- SM is notified if the risk is linked to their team's sprint

### AC-002: ROAM transitions with guards
Given a risk in UNCLASSIFIED,
When moved to OWNED,
Then:
- Guard requires `ownerId` to be set — if not, 422 `{guard: "ownerRequired"}`
- On success, `roamStatus=OWNED`, `ownedAt` timestamp recorded

Given a risk in OWNED,
When moved to MITIGATED,
Then:
- Guard requires `mitigationPlan.length >= 30` — if not, 422 `{guard: "mitigationPlanRequired", minLength: 30}`

Given a risk in any status,
When moved to RESOLVED,
Then:
- Guard requires `resolutionNote.length > 0` — if not, 422 `{guard: "resolutionNoteRequired"}`

### AC-003: COMMITTED PI Plan blocks unROAMed risks
Given a PI Plan with 2 UNCLASSIFIED risks remaining,
When commit is attempted (Story-017),
Then:
- Commitment gate returns 422 listing the 2 unclassified risks by title
- `allRisksRoamed=false` prevents transition

### AC-004: AI risk surfacing from standup/retro data
Given the RTE clicks "AI Suggest Risks" on the ROAM board,
When the suggestion runs (pgvector cosine similarity search against recent standup blockers and retro items),
Then:
- Up to 5 suggested risks are returned with `source=AI_SUGGESTED`, confidence score (0–1.0), and justification text
- Each suggestion has an "Add to Register" button
- Added risks are created with `source=AI_SUGGESTED` and appear in UNCLASSIFIED lane

### AC-005: Staleness cron escalation to portfolio
Given a risk in OWNED status with a `dueDate` that has passed,
When the daily staleness cron runs,
Then:
- Risk is flagged `overdue=true` and `staleness` badge appears on the ROAM board
- Owner and RTE are notified: "Risk '{title}' is overdue and needs classification update"
- If severity >= 4 (HIGH/CRITICAL): the risk is escalated to portfolio (`escalatedToPortfolio=true`) and a Portfolio Manager notification fires

### AC-006: Quick-poll classification in session
Given the RTE opens a quick-poll for an UNCLASSIFIED risk during PI Session,
When 6 participants vote: 4 OWNED, 2 ACCEPTED (within 60s timer),
Then:
- Majority (OWNED) is applied as suggested classification
- RTE can confirm or override before final save
- If timer expires with no majority, RTE must choose manually

### AC-007: AI-suggested risks from pgvector
Given the vector KB has standup blockers from the last 3 sprints indexed,
When AI risk surfacing runs,
Then:
- `cosine_similarity >= 0.7` threshold for inclusion in suggestions
- Results are ranked by similarity score descending
- Suggestions with `similarity < 0.7` are excluded

---

## Technical Notes

### Risk Model Extensions

```prisma
model Risk {
  // existing fields +
  roamStatus       String  @default("UNCLASSIFIED") // UNCLASSIFIED|RESOLVED|OWNED|ACCEPTED|MITIGATED
  ownerId          String?
  ownedAt          DateTime?
  mitigationPlan   String?
  resolutionNote   String?
  resolvedAt       DateTime?
  source           String  @default("MANUAL") // MANUAL|AI_SUGGESTED
  aiConfidence     Float?
  aiJustification  String?
  overdue          Boolean @default(false)
  escalatedToPortfolio Boolean @default(false)
  dueDate          DateTime?
  piPlanId         String?
  category         String  // TECHNICAL|BUSINESS|DEPENDENCY|EXTERNAL|COMPLIANCE|CAPACITY
  severity         Int     // 1-5
}
```

### ROAM State Guards

```typescript
const roamGuards: Record<string, (risk: Risk, update: RoamUpdate) => boolean | string> = {
  OWNED: (risk, update) => update.ownerId ? true : 'ownerRequired',
  MITIGATED: (risk, update) => (update.mitigationPlan?.length ?? 0) >= 30 ? true : 'mitigationPlanRequired',
  RESOLVED: (risk, update) => (update.resolutionNote?.length ?? 0) > 0 ? true : 'resolutionNoteRequired',
}
```

### AI Risk Surfacing (pgvector)

```typescript
// packages/ai/src/rag/risk-surfacing.ts
const surfaceRisks = async (artId: string, piPlanId: string, orgId: string) => {
  // Get embedding for recent standup blockers + retro improve items
  const recentText = await getRecentBlockersAndRetroItems(artId, piPlanId)
  const embedding = await embed(recentText)

  // pgvector similarity search
  const candidates = await prisma.$queryRaw<Array<{id: string, content: string, similarity: number}>>`
    SELECT id, content, 1 - (embedding <=> ${embedding}::vector) as similarity
    FROM "PIKnowledgeVector"
    WHERE org_id = ${orgId}
      AND entity_type IN ('STANDUP_BLOCKER', 'RETRO_ITEM')
      AND 1 - (embedding <=> ${embedding}::vector) >= 0.7
    ORDER BY similarity DESC
    LIMIT 5
  `

  return candidates.map(c => ({
    title: extractRiskTitle(c.content),
    description: c.content,
    aiConfidence: c.similarity,
    source: 'AI_SUGGESTED',
  }))
}
```

---

## Dependencies

- Story-017 (PI Plan commitment gate — allRisksRoamed)
- Story-029 (Impediment escalation creates a Risk)
- Story-022 (AI infra — pgvector)
- Story-027 (standup blockers indexed for AI surfacing)

---

## Definition of Done

- [ ] 5-lane ROAM Kanban (Unclassified + R/O/A/M)
- [ ] Risk creation with category, severity, optional sprint link
- [ ] ROAM transition guards (owner, mitigation plan, resolution note)
- [ ] COMMITTED PI Plan gate: all risks must be ROAMed
- [ ] AI risk surfacing (pgvector cosine ≥ 0.7, top-5 suggestions)
- [ ] Quick-poll 60s timer with majority vote and RTE confirm/override
- [ ] Staleness cron: overdue flag + notifications + severity≥4 portfolio escalation
- [ ] `source=AI_SUGGESTED` with confidence score on suggestions
- [ ] RLS: risks scoped to orgId
- [ ] Unit tests: ROAM guards, staleness logic, AI surfacing threshold
