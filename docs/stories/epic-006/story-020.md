# Story 020 — Program Board

**Epic:** 006 — Enhanced Portfolio & ART
**Feature:** F-010 PI Execution Visibility
**WSJF:** 8.0 (userValue=8, timeValue=5, riskReduction=5, jobSize=2)
**Story Points:** 8
**Priority:** Must Have
**Status:** DEFINED

---

## User Story

**As an** RTE,
**I want** a real-time collaborative Program Board where teams and PMs can assign features to sprints, visualize cross-team dependencies, and see capacity warnings,
**so that** the PI plan is coordinated across all teams during the planning session.

---

## Acceptance Criteria

### AC-001: Grid renders within 3s
Given a PI Plan with 6 teams × 5 sprints and 50+ features with 20+ dependency lines,
When the Program Board is opened during a PLANNING session,
Then:
- The team×sprint grid renders within 3s on standard broadband
- All assigned features appear in the correct cells
- Dependency connector lines render with correct color coding
- ROAM risk badges appear on relevant feature cards

### AC-002: Drag-and-drop with capacity validation
Given User A drags Feature F-001 to Team Alpha / Sprint 3 which currently has 35 points (team capacity 40),
When F-001 (8 points) is dropped,
Then:
- Feature is assigned to Team Alpha / Sprint 3 immediately (optimistic UI)
- Capacity bar for that cell turns amber (43/40 = 107% over capacity)
- No blocking error — drag completes with warning
- An orange capacity warning badge appears on the cell

### AC-003: Remote drag visible to other users within 500ms
Given User A drags Feature F-002 to Sprint 2 Team Beta,
When the drop completes,
Then:
- User B (on the same board) sees the feature card in Sprint 2 Team Beta within 500ms
- No page refresh required
- User A's cursor/presence icon is visible during the drag

### AC-004: Read-only in COMMITTED and CLOSED states
Given a PI Plan in COMMITTED or CLOSED state,
When a user opens the Program Board,
Then:
- DND-Kit drag is disabled (no drag handles shown)
- Feature cards are read-only
- A banner: "This PI Plan is {state} — the Program Board is read-only"
- Dependency lines and capacity bars are still visible

### AC-005: Circular dependency prevention
Given Feature A depends on Feature B, Feature B depends on Feature C,
When a "C depends on A" link creation is attempted,
Then:
- Server-side DFS traversal detects the cycle: A→B→C→A
- HTTP 422 `{code: "CIRCULAR_DEPENDENCY", chain: ["A", "B", "C", "A"]}`
- No connector line is drawn

### AC-006: Dependency line color coding by status
Given feature pairs with different `DependencyLink.status` values,
When the board renders,
Then:
- IDENTIFIED links render as yellow connector lines
- IN_PROGRESS links render as blue connector lines
- RESOLVED links render as green connector lines
- Critical path links have a dashed pattern + bold stroke

### AC-007: Capacity bars with points/business-days toggle
Given Team Alpha has estimated 36 story points capacity (8 members × 4.5 focus days),
When a PM toggles from "Story Points" to "Business Days" view,
Then:
- Capacity bars recalculate using `TeamCapacitySnapshot.availablePersonDays`
- Feature card sizes change to show duration instead of points
- Toggle persists in URL params

### AC-008: Liveblocks presence — cursors and users
Given 15 users are simultaneously editing the Program Board,
When any user moves their cursor,
Then:
- All other users see the cursor move with a name tooltip within 500ms
- The presence panel shows 15 avatars (+ overflow if > 20)

---

## Technical Notes

### CRDT Architecture

```typescript
// Liveblocks Storage: program board assignments
// Room ID: {orgId}:program-board:{piPlanId}
type ProgramBoardStorage = {
  assignments: LiveMap<string, FeatureAssignment> // featureId → {teamId, sprintId, rank}
}

type ProgramBoardPresence = {
  cursor: { x: number; y: number } | null
  dragging: string | null
}
```

### Capacity Calculation

```typescript
const computeCapacity = (teamId: string, sprintId: string, assignments: FeatureAssignment[]) => {
  const assignedPoints = assignments
    .filter(a => a.teamId === teamId && a.sprintId === sprintId)
    .reduce((sum, a) => sum + (a.storyPoints ?? 0), 0)

  const capacity = teamCapacitySnapshots.find(s => s.teamId === teamId && s.sprintId === sprintId)
  const utilization = assignedPoints / (capacity?.totalPoints ?? 1)

  return {
    assignedPoints,
    totalCapacity: capacity?.totalPoints ?? 0,
    utilization,
    status: utilization > 1.0 ? 'OVER' : utilization > 0.8 ? 'WARNING' : 'OK',
  }
}
```

### DFS Circular Dependency Detection

```typescript
// apps/app/app/actions/features/dependencies.ts
const detectCircular = async (fromId: string, toId: string, orgId: string): Promise<string[] | null> => {
  const visited = new Set<string>()
  const path: string[] = []

  const dfs = async (nodeId: string): Promise<boolean> => {
    if (nodeId === fromId) {
      path.push(nodeId)
      return true // cycle found
    }
    if (visited.has(nodeId)) return false
    visited.add(nodeId)
    path.push(nodeId)

    const deps = await prisma.dependencyLink.findMany({
      where: { orgId, fromFeatureId: nodeId, status: { not: 'RESOLVED' } },
      select: { toFeatureId: true }
    })

    for (const dep of deps) {
      if (await dfs(dep.toFeatureId)) return true
    }
    path.pop()
    return false
  }

  const hasCycle = await dfs(toId)
  return hasCycle ? path : null
}
```

---

## Dependencies

- Story-017 (PI Plan phases — read-only in COMMITTED/CLOSED)
- Story-019 (ROAM risk badges from Risk model)
- Story-024 (DependencyLink model and circular detection)
- Liveblocks CRDT + DND-Kit
- `TeamCapacitySnapshot` model

---

## Definition of Done

- [ ] Team×sprint grid renders all features within 3s
- [ ] DND-Kit drag with server-side capacity validation (soft warning, no block)
- [ ] Liveblocks CRDT: optimistic UI + dual-write within 500ms
- [ ] Remote drag visible to collaborators within 500ms
- [ ] Read-only mode for COMMITTED/CLOSED (DND disabled)
- [ ] Circular dependency DFS detection (422 with chain)
- [ ] Dependency line color by status (yellow/blue/green)
- [ ] Critical-path line styling
- [ ] Capacity bars with points/business-days toggle
- [ ] Presence: cursors + avatars for all connected users
- [ ] `DependencyLink` model with status tracking
- [ ] Unit tests: circular detection, capacity computation, read-only enforcement
