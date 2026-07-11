# Story 040 — Enterprise Governance Controls

**Epic:** 008 — Enterprise & Scale
**Feature:** F-008-010 Enterprise Governance
**WSJF:** 8.5 (userValue=7, timeValue=6, riskReduction=7, jobSize=2)
**Story Points:** 8
**Priority:** Must Have
**Status:** DEFINED

---

## User Story

**As a** Portfolio Manager,
**I want** configurable approval workflow templates, governed Epic SLA tracking, a decision log governance dashboard, and portfolio Kanban governance gates,
**so that** enterprise-level governance is enforced consistently across all Epics and tracked for audit purposes.

---

## Acceptance Criteria

### AC-001: Approval workflow template creation
Given a Portfolio Manager creates an approval template "Enterprise Epic Approval" with steps:
  1. PM Review (requires: PM role, SLA: 48h)
  2. Architecture Review (requires: Enterprise Architect role, SLA: 72h)
  3. Executive Sponsor Approval (requires: BUSINESS_OWNER role, SLA: 24h)
When the template is applied to an Epic,
Then:
- The Epic enters the governance workflow with all 3 steps in sequence
- Current step is highlighted; subsequent steps are locked
- Step 1 approver receives an in-app + email notification immediately

### AC-002: SLA breach triggers escalation
Given a governed Epic has an approval step with SLA=48h,
When 48 hours pass without action from the required approver,
Then:
- A `GovernanceEscalation` event is created
- The step's backup approver (if configured) is notified
- The step's SLA status changes to `BREACHED`
- An `AuditLog` entry: `action=governance.sla.breached`, `epicId`, `step`, `assignedTo`
- The Portfolio Kanban shows a red SLA badge on the Epic card

### AC-003: Portfolio Kanban governance gate
Given an Epic in ANALYZING state with `requiresGovernanceApproval=true`,
When a Drag-and-drop moves it to PORTFOLIO_BACKLOG,
Then:
- The move is blocked: "This Epic requires governance approval before advancing"
- The Epic snaps back to ANALYZING
- A "Start Approval Workflow" CTA appears on the Epic card
- The governance gate override (RTE only) is logged to `AuditLog`

### AC-004: Decision log governance dashboard
Given the governance dashboard is opened,
When viewing the "Pending Approvals" tab,
Then:
- All Epics with pending approval steps are listed
- Sorted by SLA urgency (most overdue first)
- Filter: by approver role, by ART, by Epic state, by SLA status
- Export: CSV of all pending + completed approvals in a date range

### AC-005: Parallel approval steps
Given an approval template has steps 2A (Architecture) and 2B (Security) configured as parallel,
When step 1 (PM Review) completes,
Then:
- Both step 2A and 2B are activated simultaneously
- Each approver receives notification independently
- Step 3 is only unlocked when BOTH 2A AND 2B are approved
- If either 2A or 2B is rejected, the Epic moves to a `REQUIRES_REVISION` sub-state

### AC-006: RTE governance bypass with mandatory justification
Given an Epic is stuck in SLA breach with no approver available,
When an RTE invokes the governance bypass,
Then:
- A mandatory reason input (≥50 chars) is required
- The bypass is recorded as a `DecisionLogEntry` with `bypassedBy`, `justification`, `timestamp`
- The Epic advances to the next state
- No bypass is possible without the justification — the submit button is disabled until ≥50 chars

### AC-007: Approval step rejection with revision comments
Given an Architecture Review approver rejects an Epic approval step,
When they submit rejection with comment "Missing non-functional requirements",
Then:
- The Epic enters `REQUIRES_REVISION` state
- The Epic author receives: "Architecture Review rejected: Missing non-functional requirements"
- The rejection comment is saved as a `DecisionLogEntry`
- The Epic author can address feedback and resubmit — resetting the governance workflow

### AC-008: Bulk governance action
Given a Portfolio Manager selects 5 Epics with identical approval requirements,
When bulk-approving step 1,
Then:
- All 5 step-1 approvals execute in a single action
- 5 `DecisionLogEntry` records are created (one per Epic)
- 5 approvers for step 2 are notified in parallel
- If 1 of 5 fails (e.g. already approved): partial success response `{succeeded: 4, failed: 1, errors: [...]}`

---

## Technical Notes

### Approval Workflow State Machine

```typescript
// packages/governance/src/approval-machine.ts
import { createMachine, assign } from 'xstate'

const approvalMachine = createMachine({
  id: 'governanceApproval',
  initial: 'PENDING',
  states: {
    PENDING: {
      on: {
        APPROVE: { target: 'CHECKING_NEXT' },
        REJECT: { target: 'REQUIRES_REVISION', actions: assign({ rejectionReason: ({event}) => event.reason }) },
        SLA_BREACH: { target: 'ESCALATED' },
      }
    },
    CHECKING_NEXT: {
      always: [
        { target: 'PENDING', guard: 'hasMoreSteps', actions: 'advanceToNextStep' },
        { target: 'APPROVED' },
      ]
    },
    ESCALATED: {
      on: {
        APPROVE: 'CHECKING_NEXT',
        REJECT: 'REQUIRES_REVISION',
        BYPASS: { target: 'CHECKING_NEXT', guard: 'isRTE', actions: 'logBypass' },
      }
    },
    REQUIRES_REVISION: { on: { RESUBMIT: 'PENDING' } },
    APPROVED: { type: 'final' },
  }
})
```

### SLA Breach Cron

```typescript
// Inngest cron: runs every 30 minutes
export const checkGovernanceSLA = inngest.createFunction(
  { id: 'governance-sla-check', concurrency: { limit: 1 } },
  { cron: '*/30 * * * *' },
  async ({ step }) => {
    const breachedSteps = await step.run('find-breached', () =>
      prisma.approvalStep.findMany({
        where: {
          status: 'PENDING',
          slaDeadline: { lt: new Date() },
          slaStatus: { not: 'BREACHED' },
        },
        include: { epic: true, template: true },
      })
    )

    for (const s of breachedSteps) {
      await step.run(`escalate-${s.id}`, async () => {
        await prisma.$transaction([
          prisma.approvalStep.update({ where: { id: s.id }, data: { slaStatus: 'BREACHED' } }),
          prisma.governanceEscalation.create({ data: { approvalStepId: s.id, epicId: s.epicId } }),
        ])
        await writeAuditLog({ action: 'governance.sla.breached', resourceId: s.epicId })
        await notifyBackupApprover(s)
      })
    }
  }
)
```

---

## Dependencies

- `ApprovalTemplate`, `ApprovalStep`, `GovernanceEscalation`, `DecisionLogEntry` models
- XState 5 (approval workflow machine)
- Inngest (SLA breach cron, 30-min interval)
- `@repo/notifications`
- `@repo/audit`

---

## Definition of Done

- [ ] Approval workflow template builder (sequential + parallel steps)
- [ ] Per-step SLA, role requirement, and backup approver config
- [ ] SLA breach: cron every 30min → `GovernanceEscalation` + backup notif + `AuditLog`
- [ ] Portfolio Kanban governance gate: transition blocked until workflow complete
- [ ] RTE bypass: ≥50-char justification required + `DecisionLogEntry`
- [ ] Rejection → `REQUIRES_REVISION` + author notified + revision resubmit flow
- [ ] Parallel steps: both must approve before next step unlocks
- [ ] Decision log dashboard: pending approvals sorted by SLA urgency + filters + CSV export
- [ ] Bulk approval: partial success response with per-Epic error detail
- [ ] Unit tests: SLA breach detection, bypass justification guard, parallel step gate, bulk partial failure
