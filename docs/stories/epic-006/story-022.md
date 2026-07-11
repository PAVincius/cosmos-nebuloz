# Story 022 — Sprint Lifecycle, Board & Async Standup

**Epic:** 006 — Enhanced Portfolio & ART
**Feature:** F-012 Sprint Delivery
**WSJF:** 7.67 (userValue=7, timeValue=5, riskReduction=5, jobSize=2)
**Story Points:** 8
**Priority:** Must Have
**Status:** DEFINED

---

## User Story

**As a** Scrum Master,
**I want** to manage the sprint lifecycle, run a real-time Kanban board with WIP limits, and collect async daily standups with automatic blocker-to-impediment linking,
**so that** my team delivers consistently and blockers are surfaced and tracked before they become impediments.

---

## Acceptance Criteria

### AC-001: One ACTIVE sprint per team
Given a team already has an ACTIVE sprint,
When a second sprint activation is attempted for the same team,
Then:
- HTTP 422 `{code: "ACTIVE_SPRINT_EXISTS", message: "Team already has an active sprint", conflictingSprintId: "..."}`
- New sprint remains in PLANNING state

### AC-002: Overcommitment guard with anomaly
Given a team's velocity average is 40 points over 5 sprints, and the new sprint is activated with 50 points (25% over capacity),
When activation is attempted with override and justification "Holiday adjusted capacity — CTO approved",
Then:
- Sprint activates with `overcommitmentOverride=true`, justification stored
- A MEDIUM `Anomaly` of type `SCOPE_CREEP` is created with `severity=MEDIUM`
- The SM and RTE are notified

### AC-003: Sprint board — real-time card moves
Given a Developer drags Story S-001 from TODO to IN_PROGRESS on the sprint board,
When the card is dropped,
Then:
- A Liveblocks CRDT update moves the card in the shared storage
- All board members see the move within 500ms
- A `StateTransitionHistory` row for the story is written within 500ms

### AC-004: Soft WIP limit on board columns
Given a sprint board column IN_REVIEW has WIP limit 3 and currently holds 3 stories,
When a 4th story is dropped there,
Then:
- The drop is permitted (soft limit — not blocked)
- An orange WIP warning badge appears on the column header
- No 422 error

### AC-005: Blocker → impediment pgvector fuzzy match
Given a standup entry blocker text "Can't proceed — waiting for the payment API from the integration team",
When the standup is submitted,
Then:
- A pgvector similarity search runs against open `Impediment` records for this team/ART
- If similarity >= 0.8: the standup entry is linked to the matching impediment with a `linkedImpedimentId` badge in the team digest
- If similarity < 0.8 and keywords match known patterns: a "Create Impediment?" suggestion card appears (not auto-created)
- If no match: blocker appears in digest without impediment link

### AC-006: Silent member detection
Given a working day (Mon–Fri) passes without a standup entry from Developer D,
When the next morning SM opens the standup digest,
Then:
- Developer D appears in a "Silent Members" section with last-entry date
- SM can send a nudge notification to Developer D from the panel

### AC-007: VELOCITY_DROP anomaly at > 2σ
Given a team's 5-sprint rolling velocity is [40, 42, 39, 41, 38] (mean=40, σ≈1.5),
When sprint closes with velocity 33 (< 40 - 2×1.5 = 37),
Then:
- A HIGH `Anomaly` of type `VELOCITY_DROP` is created for this team
- SM and RTE are notified
- Anomaly appears in the ART flow intelligence dashboard

### AC-008: Mid-sprint re-estimation drift
Given a sprint is ACTIVE and story estimates are revised upward such that total points exceed original by 35%,
When the re-estimation save occurs,
Then:
- An `ESTIMATION_DRIFT` MEDIUM anomaly is created
- SM is notified: "Sprint estimates have drifted 35% from original — consider capacity check"

---

## Technical Notes

### Sprint Board Architecture

```typescript
// Room ID: {orgId}:sprint-board:{sprintId}
type SprintBoardStorage = {
  cards: LiveMap<string, { column: SprintColumn; rank: number }>
}

type SprintBoardPresence = {
  cursor: { x: number; y: number } | null
  dragging: string | null
}
```

### Velocity Anomaly Detection

```typescript
const checkVelocityAnomaly = async (teamId: string, completedVelocity: number, orgId: string) => {
  const recent = await prisma.sprint.findMany({
    where: { teamId, orgId, status: 'CLOSED' },
    orderBy: { closedAt: 'desc' },
    take: 5,
    select: { velocity: true },
  })

  if (recent.length < 3) return // insufficient data

  const velocities = recent.map(s => s.velocity ?? 0)
  const mean = velocities.reduce((a, b) => a + b, 0) / velocities.length
  const stdDev = Math.sqrt(velocities.reduce((sum, v) => sum + (v - mean) ** 2, 0) / velocities.length)

  if (completedVelocity < mean - 2 * stdDev) {
    await createAnomaly({ type: 'VELOCITY_DROP', severity: 'HIGH', teamId, orgId })
  }
}
```

### Blocker → Impediment Vector Match

```typescript
const matchBlockerToImpediment = async (blockerText: string, artId: string, orgId: string) => {
  const embedding = await embed(blockerText)
  const openImpediments = await prisma.$queryRaw<Array<{id: string; similarity: number}>>`
    SELECT i.id, 1 - (kv.embedding <=> ${embedding}::vector) as similarity
    FROM "Impediment" i
    JOIN "PIKnowledgeVector" kv ON kv.entity_id = i.id AND kv.entity_type = 'IMPEDIMENT'
    WHERE i.org_id = ${orgId}
      AND i.art_id = ${artId}
      AND i.status != 'RESOLVED'
      AND 1 - (kv.embedding <=> ${embedding}::vector) >= 0.8
    ORDER BY similarity DESC
    LIMIT 1
  `
  return openImpediments[0] ?? null
}
```

---

## Dependencies

- Story-011 (StateTransitionHistory on story column moves)
- Story-019 (AI infra — pgvector for blocker matching)
- Story-017 (Sprint records created by PI Plan)
- Story-029 (Impediment model — linked from standup blockers)
- `flow-intelligence` anomaly models

---

## Definition of Done

- [ ] Sprint lifecycle: PLANNING → ACTIVE (one/team guard) → REVIEW → CLOSED
- [ ] Sprint board with Liveblocks CRDT (4 columns: TODO/IN_PROGRESS/IN_REVIEW/DONE)
- [ ] Soft WIP limits (warning badge, no block)
- [ ] Overcommitment guard (>20% → override + SCOPE_CREEP anomaly)
- [ ] Async standup: one entry/member/day, prefill, editable until midnight, immutable after
- [ ] Blocker → impediment fuzzy match (pgvector cosine ≥ 0.8)
- [ ] Silent member detection (working days, SM nudge)
- [ ] Velocity computation at sprint close + VELOCITY_DROP anomaly (>2σ)
- [ ] ESTIMATION_DRIFT anomaly at >30% mid-sprint change
- [ ] `StateTransitionHistory` on story moves
- [ ] Task management (estimatedHours 0.5–40, progress bar)
- [ ] Unit tests: one-ACTIVE guard, velocity anomaly, blocker matching
