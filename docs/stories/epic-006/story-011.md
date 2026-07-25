# Story 011 — Schema Migrations & Epic Lifecycle State Machine

**Epic:** 006 — Enhanced Portfolio & ART
**Feature:** F-001 Epic Lifecycle Management
**WSJF:** 14.0 (userValue=8, timeValue=5, riskReduction=8, jobSize=3)
**Story Points:** 13
**Priority:** Must Have — foundation for all Epic 006 stories
**Status:** DEFINED

---

## User Story

**As a** RTE,
**I want** all state transitions on epics to be enforced by an XState 5 machine with guard validation and an immutable audit trail,
**so that** only valid role-permitted transitions occur and every status change is traceable for compliance.

---

## Background

This story delivers the foundational schema migration and state machine that all downstream Epic 006 stories depend on. Without this, no INVEST gate (Story-014), governance gate (Story-016), or PI Planning lifecycle (Story-017) can function correctly.

Key design decisions:
- XState 5 (not 4) — actor model, `createMachine`, `setup()` with typed context
- All transitions execute in a Prisma transaction that writes `StateTransitionHistory` (append-only)
- HTTP 422 for invalid transitions (not 400, not 403) — allows client to distinguish from auth failures
- DB trigger as second line of defense (no bypass via raw SQL)
- `userId=null` for system/AI-initiated transitions

---

## Acceptance Criteria

### AC-001: Valid transition persists state + history
Given an RTE calls `POST /api/epics/{id}/transition` with `{toStatus: "ANALYZING"}` on a FUNNEL epic,
When the XState machine evaluates the transition as valid,
Then:
- `Epic.status` is updated to `ANALYZING`
- A `StateTransitionHistory` row is inserted with `fromStatus=FUNNEL`, `toStatus=ANALYZING`, `transitionedAt` within 1s, and the RTE's `userId`
- HTTP 200 is returned with the updated epic object
- An `epic/status.changed` event is published via Inngest

### AC-002: Invalid transition returns 422 INVALID_TRANSITION
Given a FUNNEL epic,
When any actor calls `POST /api/epics/{id}/transition` with `{toStatus: "DONE"}`,
Then:
- HTTP 422 is returned with `{code: "INVALID_TRANSITION", from: "FUNNEL", to: "DONE", allowedTransitions: [...]}`
- `Epic.status` remains `FUNNEL`
- No `StateTransitionHistory` row is written

### AC-003: Guard failure returns 422 GUARD_FAILED
Given an ANALYZING epic with `investScore=null`,
When an RTE calls transition to `PORTFOLIO_BACKLOG`,
Then:
- HTTP 422 is returned with `{code: "GUARD_FAILED", guard: "investScore", message: "INVEST score required before moving to Portfolio Backlog"}`
- Status unchanged, no history row

### AC-004: Terminal state blocks all outbound transitions
Given a DONE epic,
When any actor attempts any transition,
Then:
- HTTP 422 is returned with `{code: "TERMINAL_STATE", status: "DONE"}`

### AC-005: REJECTED transition requires reason
Given a PORTFOLIO_BACKLOG epic,
When transition to REJECTED with no `reason` (or `reason.length < 20`),
Then:
- HTTP 422 with `{code: "GUARD_FAILED", guard: "rejectionReason", message: "Rejection reason must be at least 20 characters"}`

### AC-006: DB trigger prevents status bypass
Given a direct Prisma `update` bypassing the state machine (e.g., in a test migration),
When it sets `status` to a non-allowed transition pair,
Then:
- PostgreSQL trigger raises an exception
- No row is updated

### AC-007: CONTRIBUTOR role blocked from elevated transitions
Given a CONTRIBUTOR (DEVELOPER) role user,
When they call transition `PORTFOLIO_BACKLOG → IMPLEMENTING`,
Then:
- HTTP 403 `INSUFFICIENT_ROLE` is returned before the machine evaluates
- Status unchanged

### AC-008: System/AI transition with userId=null
Given an Inngest background job auto-transitions an ANALYZING epic to PORTFOLIO_BACKLOG (after INVEST completes),
When the `StateTransitionHistory` row is written,
Then:
- `userId` is `null`
- `reason` contains `"AUTO: INVEST score threshold met"`

---

## State Machine Definition (XState 5)

```typescript
// packages/art-core/src/machines/epic-lifecycle.ts
import { setup, assign } from 'xstate'

type EpicStatus = 'FUNNEL' | 'ANALYZING' | 'PORTFOLIO_BACKLOG' | 'IMPLEMENTING' | 'DONE' | 'REJECTED'

export const epicLifecycleMachine = setup({
  types: {
    context: {} as {
      investScore: number | null
      hypothesis: string | null
      leanBudgetAllocation: number | null
      hasGovernanceApproval: boolean
      rejectionReason: string | null
      role: string
    },
    events: {} as
      | { type: 'ANALYZE' }
      | { type: 'MOVE_TO_BACKLOG' }
      | { type: 'START_IMPLEMENTING' }
      | { type: 'COMPLETE' }
      | { type: 'REJECT'; reason: string }
  },
  guards: {
    hasInvestScore: ({ context }) => (context.investScore ?? 0) >= 40,
    hasHypothesis: ({ context }) => (context.hypothesis?.length ?? 0) >= 50,
    hasGovernanceApproval: ({ context }) => context.hasGovernanceApproval,
    hasBudgetAllocation: ({ context }) => (context.leanBudgetAllocation ?? 0) > 0,
    hasValidRejectionReason: ({ event }) =>
      event.type === 'REJECT' && event.reason.length >= 20,
    canTransitionToImplementing: ({ context }) =>
      context.hasGovernanceApproval && (context.leanBudgetAllocation ?? 0) > 0,
  },
}).createMachine({
  id: 'epicLifecycle',
  initial: 'FUNNEL',
  states: {
    FUNNEL: {
      on: { ANALYZE: 'ANALYZING', REJECT: { target: 'REJECTED', guard: 'hasValidRejectionReason' } },
    },
    ANALYZING: {
      on: {
        MOVE_TO_BACKLOG: {
          target: 'PORTFOLIO_BACKLOG',
          guard: ({ context }) =>
            (context.investScore ?? 0) >= 40 && (context.hypothesis?.length ?? 0) >= 50,
        },
        REJECT: { target: 'REJECTED', guard: 'hasValidRejectionReason' },
      },
    },
    PORTFOLIO_BACKLOG: {
      on: {
        START_IMPLEMENTING: {
          target: 'IMPLEMENTING',
          guard: 'canTransitionToImplementing',
        },
        REJECT: { target: 'REJECTED', guard: 'hasValidRejectionReason' },
      },
    },
    IMPLEMENTING: {
      on: { COMPLETE: 'DONE', REJECT: { target: 'REJECTED', guard: 'hasValidRejectionReason' } },
    },
    DONE: { type: 'final' },
    REJECTED: { type: 'final' },
  },
})
```

---

## Schema Migration

```prisma
// packages/database/prisma/schema/art-core.prisma additions
model Epic {
  // ... existing ...
  investScore            Int?
  investScoreOverridden  Boolean  @default(false)
  investScoreOutdated    Boolean  @default(false)
  hypothesis             String?
  rejectionReason        String?
  hypothesisResolution   String?
}

model StateTransitionHistory {
  id              String   @id @default(cuid())
  orgId           String
  epicId          String?
  entityType      String
  fromStatus      String
  toStatus        String
  transitionedAt  DateTime @default(now())
  userId          String?
  reason          String?
  externalRef     String?

  @@index([orgId, epicId, transitionedAt])
}
```

```sql
-- DB trigger: allowed_transitions.sql
CREATE OR REPLACE FUNCTION check_epic_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;
  IF (OLD.status, NEW.status) NOT IN (
    ('FUNNEL','ANALYZING'), ('FUNNEL','REJECTED'),
    ('ANALYZING','PORTFOLIO_BACKLOG'), ('ANALYZING','REJECTED'),
    ('PORTFOLIO_BACKLOG','IMPLEMENTING'), ('PORTFOLIO_BACKLOG','REJECTED'),
    ('IMPLEMENTING','DONE'), ('IMPLEMENTING','REJECTED')
  ) THEN
    RAISE EXCEPTION 'INVALID_EPIC_TRANSITION: % -> %', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER epic_status_guard
BEFORE UPDATE OF status ON "Epic"
FOR EACH ROW EXECUTE FUNCTION check_epic_transition();
```

---

## Server Action

```typescript
// apps/app/app/actions/epics/transitions.ts
export const transitionEpicAction = withSecureAction(
  {
    schema: TransitionEpicSchema,
    auditAction: 'epic.transition',
    auditResourceType: 'Epic',
  },
  async ({ epicId, toStatus, reason, forceOverride, overrideReason }, ctx) => {
    const epic = await prisma.epic.findUniqueOrThrow({ where: { id: epicId, orgId: ctx.orgId } })

    // Reconstruct machine state from DB
    const actor = createActor(epicLifecycleMachine, {
      input: {
        investScore: epic.investScore,
        hypothesis: epic.hypothesis,
        leanBudgetAllocation: epic.leanBudgetAllocation,
        hasGovernanceApproval: await getGovernanceApproval(epicId),
        rejectionReason: reason ?? null,
        role: ctx.role,
      },
    })
    actor.start()
    // Fast-forward to current state
    const snapshot = actor.getSnapshot()
    // ... validate transition, execute in Prisma transaction
  }
)
```

---

## Dependencies

- XState 5 (`xstate@^5.0.0`) installed in `packages/art-core`
- `withSecureAction` HOF from `@repo/security` (prerequisite)
- Prisma migration applied before any Epic-006 story
- Inngest `epic/status.changed` event handler registered

## Test Cases

```typescript
// apps/app/__tests__/epic-lifecycle.test.ts
describe('Epic Lifecycle State Machine', () => {
  it('FUNNEL → ANALYZING valid', ...)
  it('FUNNEL → DONE invalid → 422 INVALID_TRANSITION', ...)
  it('ANALYZING → PORTFOLIO_BACKLOG without investScore → 422 GUARD_FAILED', ...)
  it('DONE → any → 422 TERMINAL_STATE', ...)
  it('REJECTED → any → 422 TERMINAL_STATE', ...)
  it('StateTransitionHistory row written on valid transition', ...)
  it('userId=null for system transition', ...)
  it('DB trigger blocks direct bypass', ...)
})
```

---

## Definition of Done

- [ ] XState 5 machine defined with all 6 states and guards
- [ ] Prisma migration with `StateTransitionHistory` + `Epic` field extensions
- [ ] DB trigger blocking invalid status pairs
- [ ] `POST /api/epics/[id]/transition` route returning correct 4xx codes
- [ ] `withSecureAction` wrapper applied
- [ ] RLS on `StateTransitionHistory` (orgId-scoped)
- [ ] Unit tests: all transition paths (valid + each error code)
- [ ] Inngest `epic/status.changed` event firing on success
- [ ] `pnpm lint` passes (no bare mutations)
