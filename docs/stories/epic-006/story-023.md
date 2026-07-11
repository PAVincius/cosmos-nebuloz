# Story 023 — Sprint Review, Retrospective & PI Objectives PPM

**Epic:** 006 — Enhanced Portfolio & ART
**Feature:** F-013 PI Value Delivery
**WSJF:** 5.25 (userValue=5, timeValue=4, riskReduction=3, jobSize=2)
**Story Points:** 5
**Priority:** Must Have
**Status:** DEFINED

---

## User Story

**As a** Product Owner,
**I want** to run sprint reviews, retrospectives, and track PI objectives with PPM computation,
**so that** delivery quality is measured, team improvements are captured, and portfolio can track PI predictability.

---

## Acceptance Criteria

### AC-001: Sprint Review — accepted points ≤ completed
Given a sprint with 40 completed story points,
When a PO attempts to accept 45 points,
Then:
- HTTP 422 `{code: "ACCEPTED_EXCEEDS_COMPLETED", accepted: 45, completed: 40}`
- SprintReview is not saved with that value

Given PO accepts 30 of 40 completed points,
When saved,
Then:
- `SprintReview.acceptedPoints = 30`
- `SprintReview.completedPoints = 40`
- Sprint velocity = 30 (accepted, not completed)

### AC-002: PI Objective achieved value updated (no double-count)
Given a PI Objective for Team Alpha already has `achievedValue = 6`,
When Sprint 3 closes with 3 more points accepted toward that objective,
Then:
- `achievedValue` is additively updated to 9
- The update is idempotent for the same sprint (no double-count if sprint review is re-saved)

### AC-003: Retrospective — anonymous input phase
Given the SM configures "anonymous input" for the retro and the reveal timer has not fired,
When a team member adds an improve item "We need better test coverage",
Then:
- The item text is visible to all participants (for dot-voting context)
- The author is hidden from all participants including the SM
- No author name, avatar, or userId is shown

### AC-004: Dot voting (default 3 per member)
Given 5 team members each have 3 votes to cast,
When voting phase opens,
Then:
- Each member sees a counter "3 votes remaining"
- After using 2 votes on item A, counter shows "1 vote remaining"
- Attempting to cast a 4th vote is blocked: "You've used all your votes"
- Item vote totals are shown in real time to all participants

### AC-005: Action items require owner + future due date
Given a retro action item "Set up automated integration tests",
When submitted with no `ownerId` or `dueDate` in the past,
Then:
- HTTP 422 listing: "Owner required" and/or "Due date must be in the future"
- Item not persisted

### AC-006: Carried-forward incomplete actions
Given a prior retro for Team Alpha had 2 open action items (incomplete),
When the next retro for Team Alpha opens,
Then:
- Both prior items appear in a "Carried Forward" section with original owner, due date, and status
- SM can mark them complete, reassign, or add to current retro discussion

### AC-007: Copilot pattern analysis (≥3 retros)
Given Team Alpha has completed 5 retros,
When the SM requests Copilot retro pattern analysis,
Then:
- Response includes ≥3 recurring themes (items appearing in ≥2 retros)
- At least 1 hypothesised root cause per theme
- A list of actions appearing in ≥2 retros as "uncompleted"
- One-click "Promote to Action Item" button for each Copilot suggestion

Given fewer than 3 completed retros,
When analysis is requested,
Then:
- Response: "Insufficient data — at least 3 completed retrospectives are needed for pattern analysis"

### AC-008: PPM calculation (stretch excluded)
Given a PI closes with:
- Team Alpha: Objective A (plannedValue=8, achievedValue=7, businessValue=10, stretch=false)
- Team Alpha: Objective B (plannedValue=5, achievedValue=5, businessValue=8, stretch=false)
- Team Alpha: Objective C (stretch=true)
When PPM is computed,
Then:
- PPM = [((7/8)×10) + ((5/5)×8)] / [10 + 8] = [8.75 + 8.0] / 18 = 0.931 ≈ 93.1%
- Stretch objective C excluded from numerator and denominator
- Result stored on `PIPlan.ppm`

---

## Technical Notes

### PPM Formula

```typescript
const computePPM = (objectives: PIObjective[]): number => {
  const committed = objectives.filter(o => !o.stretch && o.plannedValue > 0)
  const numerator = committed.reduce((sum, o) => sum + (o.achievedValue / o.plannedValue) * o.businessValue, 0)
  const denominator = committed.reduce((sum, o) => sum + o.businessValue, 0)
  return denominator === 0 ? 0 : numerator / denominator
}
```

### Retrospective Anonymous Phase

```typescript
// Retro phases: INPUT → VOTING → ACTION_PLANNING → CLOSED
// In INPUT phase: items visible (for voting context), authors hidden
// Author stored in DB (for SM audit trail) but not returned in API response during INPUT phase

// Query for INPUT phase: omit authorId from SELECT
const getRetroItems = async (retroId: string, phase: RetroPhase, userId: string) => {
  const items = await prisma.retroItem.findMany({ where: { retroId } })
  if (phase === 'INPUT') {
    return items.map(i => ({ ...i, authorId: undefined, authorName: undefined }))
  }
  return items // reveal after voting phase
}
```

### Retro Action Item Carry-Forward

```typescript
// On retro creation: find incomplete actions from prior retro (same team)
const carryForwardActions = async (teamId: string, newRetroId: string) => {
  const priorRetro = await prisma.retrospective.findFirst({
    where: { teamId, status: 'CLOSED' },
    orderBy: { closedAt: 'desc' },
    include: { actionItems: { where: { status: { not: 'COMPLETE' } } } }
  })

  if (!priorRetro) return

  for (const item of priorRetro.actionItems) {
    await prisma.retroActionItem.create({
      data: { ...item, retroId: newRetroId, carriedFrom: priorRetro.id, id: undefined }
    })
  }
}
```

---

## Dependencies

- Story-022 (Sprint lifecycle feeds SprintReview)
- Story-017 (PI Objectives context)
- Story-018 (PISession phases for facilitation)
- Story-022 (AI infra for Copilot retro analysis)
- pgvector for retro pattern analysis

---

## Definition of Done

- [ ] SprintReview CRUD (one per sprint, acceptedPoints≤completedPoints guard)
- [ ] velocity = acceptedPoints at sprint close
- [ ] PI Objective `achievedValue` additive update (idempotent per sprint)
- [ ] Retrospective phases (INPUT/VOTING/ACTION_PLANNING/CLOSED)
- [ ] Anonymous input phase (no author in API response until reveal)
- [ ] Dot voting (3/member default, configurable, real-time counts)
- [ ] Action items: required owner + future dueDate
- [ ] Carried-forward incomplete actions from prior retro
- [ ] 14-day read-only lock after CLOSED
- [ ] Copilot pattern analysis (≥3 retros gate, recurring themes, promote-to-action)
- [ ] PPM formula with stretch excluded, stored on PIPlan
- [ ] Unit tests: acceptedPoints guard, PPM formula, anonymous phase, carry-forward
