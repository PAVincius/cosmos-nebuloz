# Story 042 — Program Board Dependency Collaboration & Confidence Vote Overlay

**Epic:** 008 — Enterprise & Scale
**Feature:** F-008-001 Liveblocks Enterprise Hardening
**WSJF:** 8.0 (userValue=7, timeValue=6, riskReduction=6, jobSize=2)
**Story Points:** 8
**Priority:** Must Have
**Status:** DEFINED

---

## User Story

**As a** Release Train Engineer,
**I want** the Program Board to support real-time dependency editing by multiple RTEs simultaneously, with live dependency line rendering and a Confidence Vote overlay that aggregates votes from all teams without exposing individual votes,
**so that** PI Planning facilitation is collaborative and the vote is trustworthy.

---

## Acceptance Criteria

### AC-001: Concurrent dependency creation — no conflicts
Given 2 RTEs simultaneously drag a dependency arrow on the Program Board,
When both operations complete,
Then:
- Both dependency links are created without data loss
- CRDT merge resolves any ordering conflict automatically
- No "Last writer wins" data loss occurs
- Both dependencies are visible to all users within 500ms

### AC-002: Dependency link persisted to DB within 500ms
Given RTE creates a dependency link (F-A → F-B, sprint constraint),
When the drag-and-drop operation completes,
Then:
- The link is stored in Liveblocks CRDT (immediate visual feedback)
- Within 500ms: `DependencyLink` record is written to PostgreSQL
- If DB write fails: snap-back (remove from CRDT) + error toast + `AuditLog`

### AC-003: Circular dependency detection on DependencyLink creation
Given Feature F-A → F-B → F-C already exists,
When a user tries to create F-C → F-A,
Then:
- DFS circular detection runs on the CRDT graph
- Creation is blocked: "Circular dependency detected: F-A → F-B → F-C → F-A"
- The arrow snap-back animation plays
- No `DependencyLink` record is created

### AC-004: Dependency lines color by type
Given the Program Board has dependencies of type PROVIDES/NEEDS/BLOCKS,
When the board renders,
Then:
- PROVIDES: green dashed line
- NEEDS: blue solid line
- BLOCKS: red solid line (thicker stroke)
- Each line has a direction arrow (source → target)
- Hovering a line shows tooltip: "F-A [BLOCKS] F-B — Sprint 3 → Sprint 4"

### AC-005: Confidence Vote overlay — anonymous tally
Given PI Planning is in COMMIT phase and the RTE opens the Confidence Vote overlay,
When team members vote (1–5 scale via broadcast event),
Then:
- Individual votes are broadcast-only (never stored in CRDT or DB with userId)
- `ConfidenceVoteTally` stores only `{round, averageScore, voteCount, breakdown: {1:N, 2:N, ...}}`
- No user-vote mapping exists anywhere in the system

### AC-006: Vote reveal only when ≥50% of expected voters have voted
Given a team of 10 members is expected to vote,
When 4 have voted,
Then:
- The aggregate is hidden: "4/10 voted — waiting..."
- When 5 vote (50% threshold): aggregate is revealed: "Confidence: 3.8 avg (5 votes)"
- Late votes update the aggregate in real time after reveal

### AC-007: Cross-PI confidence trend chart
Given 4 PIs of confidence vote data exist,
When the RTE views the Confidence Trend panel,
Then:
- Line chart shows average confidence score per PI (PI-1 through PI-4)
- Color bands: <3 = red zone, 3–4 = yellow, >4 = green
- Each PI data point is clickable → shows the distribution breakdown for that PI

### AC-008: Program Board read-only enforcement after COMMITTED
Given a PI Plan state transitions to COMMITTED,
When any user tries to create/move/delete a dependency on the Program Board,
Then:
- The operation is rejected with: "Program Board is read-only — PI Plan is COMMITTED"
- The CRDT is not modified
- `withSecureAction` and Liveblocks room permissions both enforce read-only
- An RTE can override to PLANNING_IN_PROGRESS state to re-enable editing

---

## Technical Notes

### CRDT Dependency Map (Liveblocks)

```typescript
// packages/collaboration/src/program-board-storage.ts
import { createClient } from '@liveblocks/react'

// Liveblocks CRDT storage type
type ProgramBoardStorage = {
  dependencyLinks: LiveMap<string, {
    id: string
    sourceFeatureId: string
    targetFeatureId: string
    type: 'PROVIDES' | 'NEEDS' | 'BLOCKS'
    sprintConstraint?: string
    createdBy: string
    createdAt: string
  }>
  features: LiveMap<string, { id: string; title: string; sprintId: string; teamId: string }>
}
```

### DFS Circular Detection

```typescript
// packages/planning/src/dependency-cycle-detector.ts
export const wouldCreateCycle = (
  existingLinks: Map<string, string[]>, // sourceId → [targetIds]
  newSource: string,
  newTarget: string
): boolean => {
  // Check if newTarget can reach newSource via existing links
  const visited = new Set<string>()
  const stack = [newTarget]

  while (stack.length > 0) {
    const current = stack.pop()!
    if (current === newSource) return true
    if (visited.has(current)) continue
    visited.add(current)
    const targets = existingLinks.get(current) ?? []
    stack.push(...targets)
  }

  return false
}
```

### Confidence Vote Broadcast (no userId storage)

```typescript
// packages/collaboration/src/confidence-vote.ts
import { useBroadcastEvent, useEventListener } from '@liveblocks/react'

// Vote is broadcast only — never stored with user identity
export const useConfidenceVote = (piPlanId: string, round: number) => {
  const broadcast = useBroadcastEvent()
  const [tally, setTally] = useState<VoteTally>({ votes: {}, count: 0 })

  const submitVote = (score: 1 | 2 | 3 | 4 | 5) => {
    broadcast({ type: 'CONFIDENCE_VOTE', score, round })
    // No userId included in broadcast
  }

  useEventListener(({ event }) => {
    if (event.type === 'CONFIDENCE_VOTE' && event.round === round) {
      setTally(prev => ({
        votes: { ...prev.votes, [event.score]: (prev.votes[event.score] ?? 0) + 1 },
        count: prev.count + 1,
      }))
    }
  })

  // Persist aggregate to DB when round closes (RTE action)
  const closeVoting = async () => {
    const avg = computeAverage(tally)
    await persistConfidenceTally({ piPlanId, round, averageScore: avg, voteCount: tally.count, breakdown: tally.votes })
  }

  return { submitVote, closeVoting, tally }
}
```

### Read-Only Enforcement (COMMITTED state)

```typescript
// packages/collaboration/src/read-only-guard.ts
export const useProgramBoardReadOnly = (piPlanState: PIState) => {
  const isReadOnly = piPlanState === 'COMMITTED' || piPlanState === 'CLOSED'

  const guardedAction = useCallback((action: () => void) => {
    if (isReadOnly) {
      toast.error('Program Board is read-only — PI Plan is COMMITTED')
      return
    }
    action()
  }, [isReadOnly])

  return { isReadOnly, guardedAction }
}
```

---

## Dependencies

- `@liveblocks/react ^3.11` (CRDT LiveMap, broadcast events)
- `DependencyLink`, `ConfidenceVoteTally` models
- `@repo/planning` (DFS cycle detector)
- `@repo/audit`

---

## Definition of Done

- [ ] Concurrent dependency creation: CRDT merge, no data loss
- [ ] DB dual-write within 500ms with snap-back on DB failure
- [ ] DFS circular dependency detection on creation
- [ ] Dependency line rendering: 3 types × color/stroke style + direction arrows + hover tooltip
- [ ] Confidence Vote: broadcast-only anonymous tally (no userId storage)
- [ ] Vote reveal at ≥50% threshold
- [ ] `ConfidenceVoteTally` persisted (aggregate only, no user-vote mapping)
- [ ] Cross-PI confidence trend chart with zone coloring
- [ ] Program Board read-only after COMMITTED (CRDT + `withSecureAction`)
- [ ] RTE override to unlock COMMITTED board
- [ ] Unit tests: DFS cycle detection, concurrent CRDT merge, confidence avg computation, read-only guard
