# Story 043 — Solution-Level Program Board, ROAM & Large Solution RBAC

**Epic:** 008 — Enterprise & Scale
**Feature:** F-008-009 Large Solution SAFe
**WSJF:** 6.5 (userValue=6, timeValue=5, riskReduction=4, jobSize=2)
**Story Points:** 8
**Priority:** Should Have
**Status:** DEFINED

---

## User Story

**As a** Solution Train Engineer,
**I want** a Solution-level Program Board showing cross-ART feature assignments with Liveblocks real-time co-editing, a Solution ROAM board for risks spanning multiple ARTs, and RBAC that distinguishes Solution Train roles from ART roles,
**so that** large-solution coordination is visible and controlled at the right organizational level.

---

## Acceptance Criteria

### AC-001: Solution Program Board shows all ART features
Given Solution Train "Enterprise Payments" contains ART-A (3 teams) and ART-B (2 teams),
When the Solution Program Board renders,
Then:
- Rows: one row per ART (ART-A, ART-B)
- Columns: sprints (PI sprints, shared timeline)
- Each cell shows Features assigned to that ART in that sprint
- Cross-ART dependency lines (F-A1 → F-B2) rendered across rows

### AC-002: Cross-ART dependency line with delay indicator
Given Feature F-B2 is scheduled for Sprint 3 but Feature F-A1 depends on it and is in Sprint 3 as well,
When F-B2 is moved to Sprint 4 (delayed),
Then:
- The dependency line from F-A1 to F-B2 turns red
- A warning badge appears on F-A1: "Dependency delayed — F-B2 moved to Sprint 4"
- The STE receives a notification: "Cross-ART dependency risk: F-A1 NEEDS F-B2 (ART-B, Sprint 4)"

### AC-003: Solution ROAM board — 4-lane kanban
Given a risk "Payment Regulatory Compliance" spans ART-A and ART-B,
When the STE creates the risk on the Solution ROAM board,
Then:
- Risk is placed in ROAM lane: RESOLVED | OWNED | ACCEPTED | MITIGATED
- Both ART-A and ART-B are tagged as `affectedArts`
- ART-level ROAM boards show this risk in a "Solution Risk" section (read-only for ART members)

### AC-004: Risk AI-suggest from pgvector (cosine ≥ 0.7)
Given the STE types a new risk description "Cross-vendor API rate limiting under load",
When AI-suggest is invoked,
Then:
- pgvector hybrid search finds similar past risks (cosine similarity ≥ 0.7)
- Top-3 suggestions shown: "Suggested similar risks from previous PIs"
- Each suggestion has: risk title, original PI, original resolution
- STE can "Import Resolution" from a suggestion to pre-fill mitigation strategy

### AC-005: Solution Train RBAC — STE vs ART roles
Given a user is SCRUM_MASTER in ART-A but not a Solution Train member,
When they attempt to edit the Solution Program Board or create a Solution Epic,
Then:
- HTTP 403 `{code: "SOLUTION_TRAIN_ACCESS_REQUIRED"}`
- They can VIEW solution-level artifacts but not modify them
- Read-only access to Solution Board + ROAM

### AC-006: Solution Program Board Liveblocks co-editing
Given 2 STEs are editing the Solution Program Board simultaneously,
When STE-1 moves Feature F-A1 to Sprint 4,
Then:
- STE-2 sees the feature move within 500ms
- Both STEs' cursors are visible with name labels
- Concurrent moves to the same sprint cell are CRDT-merged (both features appear in the cell)

### AC-007: ROAM risk cross-ART ownership
Given a Solution risk is in ACCEPTED lane,
When an ART Lead assigns ownership to ART-A's RTE,
Then:
- Risk `owner` field updates to the assigned RTE
- The assigned RTE receives an in-app notification
- ART-A's ROAM board shows the risk in ACCEPTED with "Solution-level" badge
- The assignment is logged: `AuditLog action=roam.risk.assigned`

### AC-008: Solution Program Board staleness detection
Given a Solution PI Plan enters EXECUTING phase,
When a Feature has not been updated in 14 days,
Then:
- The Feature card on the Solution Board shows a yellow "Stale" badge
- The STE is notified: "Feature F-B2 has not been updated in 14 days"
- A bulk "Check for stale features" sweep runs nightly via Inngest cron

---

## Technical Notes

### Solution Program Board Room ID

```
{orgId}:solution-board:{solutionPiPlanId}
```

All STEs across ART-A and ART-B join this single room for the solution-level board.

### CRDT Storage for Solution Board

```typescript
type SolutionBoardStorage = {
  featureAssignments: LiveMap<string, {
    featureId: string
    artId: string
    sprintId: string
    assignedBy: string
    updatedAt: string
  }>
  crossArtDependencies: LiveMap<string, {
    id: string
    sourceFeatureId: string
    targetFeatureId: string
    sourceArtId: string
    targetArtId: string
    type: 'PROVIDES' | 'NEEDS' | 'BLOCKS'
  }>
}
```

### Solution ROAM Model Extensions

```prisma
// Extends existing Risk model
model SolutionRisk {
  id              String      @id @default(cuid())
  solutionTrainId String
  title           String
  description     String?
  roamStatus      ROAMStatus  @default(RESOLVED)
  owner           String?     // userId of assigned RTE
  affectedArtIds  String[]    // array of ART IDs

  solutionTrain   SolutionTrain @relation(fields: [solutionTrainId], references: [id])

  @@index([solutionTrainId, roamStatus])
}
```

### Cross-ART Delay Detection

```typescript
// packages/planning/src/cross-art-delay-detector.ts
export const detectCrossArtDelays = async (solutionPiPlanId: string): Promise<DelayAlert[]> => {
  const deps = await prisma.crossArtDependency.findMany({
    where: { solutionPiPlanId },
    include: { sourceFeature: { include: { sprint: true } }, targetFeature: { include: { sprint: true } } }
  })

  return deps
    .filter(d => {
      const sourceSprintIdx = getSprintIndex(d.sourceFeature.sprint)
      const targetSprintIdx = getSprintIndex(d.targetFeature.sprint)
      return targetSprintIdx > sourceSprintIdx && d.type === 'NEEDS'
    })
    .map(d => ({
      dependencyId: d.id,
      sourceFeatureId: d.sourceFeatureId,
      targetFeatureId: d.targetFeatureId,
      delayedBy: getSprintIndex(d.targetFeature.sprint) - getSprintIndex(d.sourceFeature.sprint),
    }))
}
```

---

## Dependencies

- `SolutionTrain`, `SolutionRisk`, `CrossArtDependency` models
- `@liveblocks/react ^3.11` (solution-board room)
- `@repo/rbac` (SOLUTION_TRAIN_ENGINEER role check)
- pgvector (ROAM risk AI-suggest)
- Inngest (staleness cron)
- `@repo/notifications`

---

## Definition of Done

- [ ] Solution Program Board: team×sprint grid for multi-ART (one row per ART)
- [ ] Cross-ART dependency lines: colored by type, red on delay, hover tooltip
- [ ] Liveblocks co-editing: `{orgId}:solution-board:{solutionPiPlanId}` room
- [ ] Solution ROAM board: 4-lane kanban with `affectedArtIds` and AI-suggest (cosine ≥ 0.7)
- [ ] ART-level ROAM: Solution risks appear as read-only "Solution Risk" section
- [ ] Solution Train RBAC: VIEW-only for non-STE roles, 403 on mutations
- [ ] ROAM risk cross-ART ownership assignment + notification + `AuditLog`
- [ ] 14-day staleness detection via nightly Inngest cron
- [ ] Delay detection: `NEEDS` dependency where target sprint > source sprint
- [ ] Unit tests: cross-ART delay detection, ROAM AI-suggest threshold, STE role guard, staleness cron
