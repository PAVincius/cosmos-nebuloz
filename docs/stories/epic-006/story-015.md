# Story 015 — WSJF Scoring Engine

**Epic:** 006 — Enhanced Portfolio & ART
**Feature:** F-005 Portfolio Prioritization
**WSJF:** 5.5 (userValue=6, timeValue=4, riskReduction=3, jobSize=2)
**Story Points:** 5
**Priority:** Must Have
**Status:** DEFINED

---

## User Story

**As a** Product Manager,
**I want** a WSJF calculator for epics and features with immutable scoring history, AI score suggestions, and automatic normalized backlog re-ranking,
**so that** our portfolio and ART backlogs are objectively prioritized and every scoring decision is auditable.

---

## Acceptance Criteria

### AC-001: WSJF formula computed correctly
Given userValue=8, timeValue=5, riskReduction=3, jobSize=5,
When WSJF is saved,
Then:
- `costOfDelay = 8 + 5 + 3 = 16`
- `wsjfScore = 16 / 5 = 3.20`
- `normalizedScore` is computed as `(wsjfScore / maxInSet) × 100` across the full ART feature backlog

### AC-002: jobSize=0 validation
Given any WSJF form with `jobSize=0`,
When save is attempted,
Then:
- HTTP 422 with `{code: "INVALID_WSJF", field: "jobSize", message: "Job Size must be at least 1"}`
- `wsjfScore` and `normalizedScore` are not updated

### AC-003: Immutable ScoringEvent appended on change
Given a feature's WSJF is updated from (userValue=5, jobSize=3) to (userValue=8, jobSize=5),
When the update is saved,
Then:
- A `ScoringEvent` row is inserted (never updated) with: previous and new component values, `userId`, `timestamp`, `source=MANUAL`
- The prior event is not modified
- `Feature.wsjfScore` and `normalizedScore` are updated

### AC-004: Backlog re-sort within 500ms
Given an ART backlog with 500 features,
When one feature's WSJF is updated,
Then:
- All `normalizedScore` values are recomputed (new max may change)
- Re-sorted backlog is available via the feature backlog API within 500ms
- No full-page reload required (optimistic update + server confirm)

### AC-005: Confidence level required for PORTFOLIO_BACKLOG
Given a feature with no `wsjfConfidence` set,
When the readiness check runs (Story-021),
Then:
- The WSJF criterion of the readiness checklist fails: "WSJF score present with confidence ≥ MEDIUM required"
- Feature cannot be marked READY without confidence set

### AC-006: AI score suggestion with COPILOT badge
Given a PM clicks "AI Suggest" on a WSJF panel,
When the suggestion completes,
Then:
- A 3-chip row appears: suggested userValue/timeValue/riskReduction values each with a "COPILOT" badge
- The PM can apply individual chips or all at once
- Applied values create a `ScoringEvent` with `source=COPILOT`
- The "Pending INVEST re-analysis" banner appears after COPILOT application

### AC-007: SA job-size lock
Given a System Architect with `wsjf:lock-job-size` permission locks the jobSize on Feature F-001,
When a PM attempts to edit the jobSize field,
Then:
- The field renders as read-only with a lock icon
- Tooltip: "Job size locked by {SA name} on {date}. Request unlock to change."
- A "Request Unlock" button sends a notification to the SA

### AC-008: Modified Fibonacci validation
Given a component value input,
When a value not in [1,2,3,5,8,13,20] is submitted,
Then:
- HTTP 422 with `{code: "INVALID_WSJF_VALUE", field: "userValue", allowed: [1,2,3,5,8,13,20]}`

---

## Technical Notes

### WSJF Schema (Feature)

```prisma
model Feature {
  wsjfUserValue          Float?
  wsjfTimeValue          Float?
  wsjfRiskReduction      Float?
  wsjfJobSize            Float?
  wsjfCostOfDelay        Float?   // computed: userValue + timeValue + riskReduction
  wsjfScore              Float?   // costOfDelay / jobSize
  wsjfNormalizedScore    Float?   // wsjfScore / maxInBacklog * 100
  wsjfConfidence         String?  // LOW|MEDIUM|HIGH
  wsjfScoredBy           String?
  wsjfScoredAt           DateTime?
  wsjfJobSizeLockedBy    String?
}

model ScoringEvent {
  id              String   @id @default(cuid())
  orgId           String
  epicId          String?
  featureId       String?
  userValue       Float?
  timeValue       Float?
  riskReduction   Float?
  jobSize         Float?
  wsjfScore       Float?
  normalizedScore Float?
  source          String   // MANUAL|COPILOT
  userId          String?
  timestamp       DateTime @default(now())
  justification   String?
}
```

### Normalization

```typescript
// Re-normalize all features in an ART backlog after any score change
const normalizeBacklog = async (artId: string, orgId: string) => {
  const features = await prisma.feature.findMany({
    where: { artId, orgId, wsjfScore: { not: null } },
    select: { id: true, wsjfScore: true },
  })
  const max = Math.max(...features.map(f => f.wsjfScore!))
  if (max === 0) return

  // Batch update in a single transaction
  await prisma.$transaction(
    features.map(f =>
      prisma.feature.update({
        where: { id: f.id },
        data: { wsjfNormalizedScore: (f.wsjfScore! / max) * 100 },
      })
    )
  )
}
```

### Server Action

```typescript
// apps/app/app/actions/wsjf/index.ts
export const scoreWsjfAction = withSecureAction(
  { schema: WsjfScoreSchema, auditAction: 'wsjf.scored', auditResourceType: 'Feature' },
  async ({ featureId, userValue, timeValue, riskReduction, jobSize, confidence, justification }, ctx) => {
    if (jobSize === 0) throw new ValidationError('jobSize', 'Job Size must be at least 1')
    const FIBONACCI = [1, 2, 3, 5, 8, 13, 20]
    for (const [field, val] of Object.entries({ userValue, timeValue, riskReduction, jobSize })) {
      if (!FIBONACCI.includes(val)) throw new ValidationError(field, `Must be Fibonacci value`)
    }
    const costOfDelay = userValue + timeValue + riskReduction
    const wsjfScore = costOfDelay / jobSize

    await prisma.$transaction(async tx => {
      await tx.feature.update({ where: { id: featureId }, data: { wsjfUserValue: userValue, /* ... */ } })
      await tx.scoringEvent.create({ data: { orgId: ctx.orgId, featureId, userValue, /* ... */, source: 'MANUAL', userId: ctx.userId } })
    })

    // Background: normalize backlog
    await inngest.send({ name: 'wsjf/normalize-backlog', data: { artId: feature.artId, orgId: ctx.orgId } })
  }
)
```

---

## Dependencies

- Story-011 (ScoringEvent model in migration)
- Story-019 (Feature backlog — WSJF feeds readiness)
- `@repo/ai` (AI suggest endpoint)

---

## Definition of Done

- [ ] WSJF formula: CoD = userValue+timeValue+riskReduction, wsjfScore = CoD/jobSize
- [ ] Modified Fibonacci validation on all components
- [ ] jobSize=0 → 422 INVALID_WSJF
- [ ] `ScoringEvent` append-only (INSERT only, no UPDATE/DELETE route)
- [ ] Background normalization < 500ms for ≤500 features
- [ ] Confidence field (LOW/MEDIUM/HIGH) required for readiness
- [ ] SA job-size lock + request-unlock notification
- [ ] AI suggest with COPILOT badge + source tracking
- [ ] Unit tests: formula, validation, normalization, immutability
