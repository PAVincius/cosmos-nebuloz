# Story 021 — Feature Backlog, Readiness Gate & Story Decomposition

**Epic:** 006 — Enhanced Portfolio & ART
**Feature:** F-011 ART Feature Management
**WSJF:** 7.33 (userValue=7, timeValue=5, riskReduction=4, jobSize=2)
**Story Points:** 8
**Priority:** Must Have
**Status:** DEFINED

---

## User Story

**As a** Product Manager,
**I want** to manage an ART-scoped feature backlog with WSJF-ranked items, a readiness checklist gate, and AI-powered story decomposition,
**so that** only ready features enter PI Planning and development teams have clear, well-defined stories to execute.

---

## Acceptance Criteria

### AC-001: Feature creation with ART-scoped ID
Given a PM submits a valid feature (Title + Description + Epic link),
When the feature is created,
Then:
- Feature persists with an ART-scoped immutable ID (e.g., "F-042")
- `status = DEFINED`, `wsjfScore = null`
- `Epic.features[]` is updated (the linked epic shows the new feature)
- Epic owner is notified: "A new feature '{title}' has been added to your epic"

### AC-002: Feature without Epic link blocked
Given a PM submits a feature without a `epicId`,
When validation runs,
Then:
- HTTP 422 `{code: "EPIC_LINK_REQUIRED", message: "Feature must be linked to an Epic"}`
- No feature record is created

### AC-003: Readiness checklist with fix hints
Given a Feature missing WSJF confidence + no team assigned,
When the readiness check is triggered,
Then:
- Exactly 2 required criteria fail:
  - "WSJF score present with confidence ≥ MEDIUM" — hint: "Go to WSJF tab to add a score"
  - "Team assigned" — hint: "Assign this feature to a team in the Details tab"
- "Ready for PI Planning" button is disabled

Given all required criteria pass,
When readiness check completes,
Then:
- `feature.status = READY`
- Feature appears in the "Ready" swimlane of the ART feature backlog

### AC-004: Required readiness criteria
The following criteria are required (feature cannot be READY without all):
1. `wsjfScore != null && wsjfConfidence in [MEDIUM, HIGH]`
2. `acceptanceCriteria.length >= 3`
3. `epicId != null` (guaranteed by AC-002)
4. `assignedTeamId != null`
5. No open `DependencyLink` where this feature is blocked and `status = IDENTIFIED`
6. No open `Risk` with severity >= 4 linked to this feature

### AC-005: RTE readiness override
Given a Feature failing 1 required criterion (team not assigned),
When an RTE with `feature:readiness-override` submits an override with justification,
Then:
- Feature status = READY with `readinessOverridden=true`
- A `DecisionLogEntry` is created with type `READINESS_OVERRIDE`

### AC-006: Story decomposition with Copilot
Given a PM selects "Decompose with AI" on a Feature,
When the Copilot generates story drafts (≥3 stories),
Then:
- 3–8 story drafts are returned as `origin=COPILOT_SUGGESTION` cards
- Each draft shows suggested title, description ("As a / I want / so that"), and point estimate
- PM can accept individual stories (creates Story with `origin=COPILOT_SUGGESTION`) or all at once
- Rejected drafts are discarded (not persisted)

### AC-007: Split Wizard archives original and creates ≥2 stories
Given a READY Story selected for splitting,
When the Split Wizard completes with a "Workflow Steps" strategy yielding 3 stories,
Then:
- Original story `status = SPLIT_INTO`, `splitIntoStoryIds = [id1, id2, id3]`
- 3 new stories created with `originStoryId = originalStoryId`
- New stories inherit `featureId`, `teamId`, `epicId` from original
- DONE stories cannot be split (422 `TERMINAL_STATE`)

### AC-008: Auto-INVEST check on story save
Given any story is saved (created or updated),
When the INVEST check runs synchronously,
Then:
- INVEST result attaches to the story within 200ms
- GREEN/AMBER/RED badge renders immediately
- ERROR-level failures block `status = READY`

---

## Technical Notes

### ART-Scoped Feature ID Generation

```typescript
// Immutable, sequential per ART
const generateFeatureId = async (artId: string, orgId: string, tx: PrismaClient) => {
  const counter = await tx.artSequenceCounter.upsert({
    where: { artId_type: { artId, type: 'FEATURE' } },
    update: { next: { increment: 1 } },
    create: { artId, orgId, type: 'FEATURE', next: 2 },
  })
  return `F-${counter.next - 1}`
}
```

### Readiness Checklist Evaluation

```typescript
const evaluateReadiness = async (featureId: string, orgId: string): Promise<ReadinessResult> => {
  const feature = await prisma.feature.findUniqueOrThrow({
    where: { id: featureId, orgId },
    include: { acceptanceCriteria: true, risks: true, dependencies: { where: { status: 'IDENTIFIED' } } }
  })

  const criteria = [
    { key: 'wsjf', pass: feature.wsjfScore != null && feature.wsjfConfidence !== 'LOW', hint: 'Go to WSJF tab' },
    { key: 'ac', pass: feature.acceptanceCriteria.length >= 3, hint: 'Add at least 3 acceptance criteria' },
    { key: 'team', pass: feature.assignedTeamId != null, hint: 'Assign to a team in Details tab' },
    { key: 'deps', pass: feature.dependencies.length === 0, hint: 'Resolve open blocking dependencies' },
    { key: 'risks', pass: !feature.risks.some(r => r.severity >= 4 && r.roamStatus === 'UNCLASSIFIED'), hint: 'ROAM high-severity risks' },
  ]

  return { pass: criteria.every(c => c.pass), criteria }
}
```

### Split Wizard

```typescript
type SplitStrategy = 'WORKFLOW_STEPS' | 'PERSONAS' | 'HAPPY_PATH_VS_EDGE' | 'DATA_VARIATIONS'

const splitStory = async (storyId: string, strategy: SplitStrategy, newStories: StoryInput[], ctx: ActionContext) => {
  if (newStories.length < 2) throw new ValidationError('Must create at least 2 stories from a split')

  await prisma.$transaction(async tx => {
    // Archive original
    await tx.story.update({ where: { id: storyId }, data: { status: 'SPLIT_INTO', splitIntoStoryIds: newStories.map(s => s.tempId) } })

    // Create new stories
    for (const s of newStories) {
      await tx.story.create({ data: { ...inheritedContext, ...s, originStoryId: storyId, origin: 'MANUAL' } })
    }
  })
}
```

---

## Dependencies

- Story-011 (State machine for feature status)
- Story-015 (WSJF readiness criterion)
- Story-019 (Risk readiness criterion)
- Story-020 (DependencyLink readiness criterion)
- Story-022 (AI infra for Copilot decomposition)
- Story-011 + Story-014 (auto-INVEST on story save)

---

## Definition of Done

- [ ] Feature CRUD with ART-scoped immutable ID
- [ ] Epic link required (422 without)
- [ ] Readiness checklist with all 5 criteria + fix hints
- [ ] `status = READY` only when all criteria pass
- [ ] RTE readiness override + `DecisionLogEntry`
- [ ] Copilot story decomposition (3–8 drafts, `origin=COPILOT_SUGGESTION`)
- [ ] Split Wizard: archive original as `SPLIT_INTO`, create ≥2 stories with lineage
- [ ] Auto-INVEST on story save < 200ms
- [ ] DONE story split blocked (422)
- [ ] WSJF-ranked backlog table + manual rank override (scoped to piPlanId)
- [ ] Unit tests: readiness criteria, split lineage, ID generation
