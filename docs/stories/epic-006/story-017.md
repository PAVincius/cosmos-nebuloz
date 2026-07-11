# Story 017 — ART Setup & PI Plan Lifecycle

**Epic:** 006 — Enhanced Portfolio & ART
**Feature:** F-007 ART Configuration
**WSJF:** 8.67 (userValue=8, timeValue=6, riskReduction=5, jobSize=2)
**Story Points:** 8
**Priority:** Must Have
**Status:** DEFINED

---

## User Story

**As an** RTE,
**I want** to create and configure an ART with teams, PI cadence, and sprint settings, and manage the PI Plan through its full lifecycle from DRAFT to CLOSED,
**so that** the ART has a structured execution context that drives all downstream PI Planning activities.

---

## Acceptance Criteria

### AC-001: ART creation with unique name
Given an RTE submits a valid ART form (name, PI cadence 10 weeks, sprint length 2 weeks, IP sprint enabled),
When the form is submitted,
Then:
- ART is created with `status=INACTIVE`
- Redirect to ART detail page
- IP sprint toggle = true yields `derivedSprintCount = floor(PI / sprint) - 1`

Given the same name (case-insensitive) already exists in the org,
Then:
- 409 "An ART with this name already exists in your organization"

### AC-002: Cadence modification blocked on active PI
Given an ART with a COMMITTED or EXECUTING PI Plan,
When cadence or sprint length change is attempted,
Then:
- HTTP 422 `{code: "ACTIVE_PI_PLAN", message: "Cannot modify cadence while a PI Plan is active"}`

### AC-003: PI Plan creation with auto-sprint generation
Given a valid PI Plan creation (ART with ≥1 team, PI cadence 10 weeks, sprint length 2 weeks, IP sprint enabled),
When the PI Plan is created,
Then:
- Sprint records are auto-created: 4 regular sprints + 1 IP sprint = 5 total
- Sprint names default to "Sprint 1" through "Sprint 5" (IP = "IP Sprint")
- `PIPlan.status = DRAFT`
- `startDate` and `endDate` derived from `PI cadence`

### AC-004: DRAFT → PLANNING transition
Given a PI Plan in DRAFT status with participants added and all preconditions met,
When the RTE clicks "Open for Planning",
Then:
- Status transitions to `PLANNING`
- All participants receive a "PI Planning has started" notification within 30s
- A PISession room is created in Liveblocks

### AC-005: PLANNING → COMMITTED commitment gate
Given a PI Plan in PLANNING with some objectives having no `plannedValue`, some risks not ROAMed, and confidence score 2.4,
When commit is attempted,
Then:
- HTTP 422 with structured validation errors listing all unmet requirements:
  - Missing plannedValue on objectives
  - Un-ROAMed risks
  - `{confidenceScore: 2.4, required: 3.0, message: "Confidence score 2.4 is below the required 3.0 threshold"}`

Given all requirements met but confidence 2.4,
When commit is attempted with override (≥20-char reason),
Then:
- PI Plan transitions to COMMITTED
- Override reason stored in `PIPlan.commitmentOverrideReason`
- `StateTransitionHistory` row written with the override reason

### AC-006: Force-commit override (≥20 chars)
Given all objectives have plannedValue and all risks are ROAMed, but confidence = 2.4,
When commit override is submitted with "Escalated via emergency business need — CTO authorized" (>20 chars),
Then:
- PI Plan commits with `commitmentOverride=true`
- `StateTransitionHistory` records `reason = "FORCE_COMMIT: [reason text]"`

### AC-007: Auto EXECUTING transition
Given a COMMITTED PI Plan whose `startDate` is reached,
When the Inngest `pi-plan-auto-activate` cron fires,
Then:
- PI Plan transitions to EXECUTING
- All participants notified "PI {name} has started"

### AC-008: PI Plan CLOSED — achieved values computed
Given an EXECUTING PI Plan whose `endDate` is reached or the RTE manually closes it,
When the PI Plan transitions to CLOSED,
Then:
- `achievedValue` for each team objective is computed from `SprintReview.acceptedPoints` of sprints in this PI
- `PIPlan.velocity` = sum of all team sprint velocities in this PI
- `PIPlan.status = CLOSED`

---

## Technical Notes

### PI Plan XState Machine

```typescript
export const piPlanMachine = setup({
  types: {
    context: {} as {
      confidenceThreshold: number
      hasAllObjectivePlannedValues: boolean
      hasAllRisksRoamed: boolean
      confidenceScore: number | null
    },
  },
  guards: {
    canCommit: ({ context }) =>
      context.hasAllObjectivePlannedValues &&
      context.hasAllRisksRoamed &&
      (context.confidenceScore ?? 0) >= context.confidenceThreshold,
    forceCommitAllowed: ({ context }) =>
      context.hasAllObjectivePlannedValues && context.hasAllRisksRoamed,
  },
}).createMachine({
  id: 'piPlanLifecycle',
  initial: 'DRAFT',
  states: {
    DRAFT: { on: { OPEN_PLANNING: 'PLANNING' } },
    PLANNING: {
      on: {
        COMMIT: { target: 'COMMITTED', guard: 'canCommit' },
        FORCE_COMMIT: { target: 'COMMITTED', guard: 'forceCommitAllowed' },
      },
    },
    COMMITTED: { on: { START_EXECUTING: 'EXECUTING' } },
    EXECUTING: { on: { CLOSE: 'CLOSED' } },
    CLOSED: { type: 'final' },
  },
})
```

### Sprint Auto-Generation

```typescript
const generateSprints = (piPlan: PIPlan, art: ART) => {
  const totalSprints = art.ipSprintEnabled
    ? Math.floor(art.piCadenceWeeks / art.sprintLengthWeeks) - 1
    : Math.floor(art.piCadenceWeeks / art.sprintLengthWeeks)

  const sprints = Array.from({ length: totalSprints }, (_, i) => ({
    orgId: piPlan.orgId,
    piPlanId: piPlan.id,
    teamIds: art.teams.map(t => t.id),
    name: `Sprint ${i + 1}`,
    number: i + 1,
    startDate: addWeeks(piPlan.startDate, i * art.sprintLengthWeeks),
    endDate: addWeeks(piPlan.startDate, (i + 1) * art.sprintLengthWeeks - 1),
    status: 'PLANNING',
  }))

  if (art.ipSprintEnabled) {
    sprints.push({
      name: 'IP Sprint',
      number: totalSprints + 1,
      isIpSprint: true,
      // ...dates
    })
  }

  return sprints
}
```

---

## Dependencies

- Story-011 (StateTransitionHistory for PIPlan transitions)
- Story-017 creates the context for Stories 018 (Confidence Vote), 019 (ROAM), 020 (Program Board)
- `@repo/notifications` for participant notifications
- Inngest cron for auto-transition COMMITTED → EXECUTING

---

## Definition of Done

- [ ] ART CRUD with unique name validation and cadence config
- [ ] Team management (add/remove, SM assignment, default velocity)
- [ ] Cadence modification blocked on active PI Plan
- [ ] PI Plan creation with auto sprint generation (regular + IP)
- [ ] XState PIPlan machine: DRAFT → PLANNING → COMMITTED → EXECUTING → CLOSED
- [ ] Commitment gate: objectives planValues + risks ROAMed + confidence threshold
- [ ] Force-commit override with ≥20-char reason + audit log
- [ ] Inngest auto-transition COMMITTED → EXECUTING at startDate
- [ ] achievedValue computation at CLOSED
- [ ] `StateTransitionHistory` on all PI Plan transitions
- [ ] RLS: ART and PIPlan scoped to orgId
- [ ] Unit tests: auto-sprint generation, commitment gates, force-commit
