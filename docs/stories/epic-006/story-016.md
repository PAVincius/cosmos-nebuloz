# Story 016 — Epic Governance, Approval Workflows & Decision Log

**Epic:** 006 — Enhanced Portfolio & ART
**Feature:** F-006 Governance & Compliance
**WSJF:** 8.0 (userValue=8, timeValue=5, riskReduction=5, jobSize=2)
**Story Points:** 8
**Priority:** Must Have
**Status:** DEFINED

---

## User Story

**As an** Org Admin,
**I want** to configure multi-step approval workflows for governed epics, with SLA tracking, immutable decision logs, and an RTE bypass option,
**so that** strategic epics receive appropriate oversight with full audit trail for compliance.

---

## Acceptance Criteria

### AC-001: Approval workflow creates step instances
Given an Org Admin saves a 3-step workflow with valid config (approverRole, requiresAll, slaHours per step),
When the workflow is created,
Then:
- 3 `ApprovalStepDefinition` rows are created with `order=0,1,2`
- Workflow `status=DRAFT`, not yet immutable
- The workflow appears in the governance settings with step summary

### AC-002: GovernedEpic submission creates step-0 requests
Given a GovernedEpic submitted against a 3-step workflow,
When submission is processed,
Then:
- `GovernedEpic.status` = PENDING, `currentStepIndex=0`
- `ApprovalRequest` rows are created only for step 0 approvers
- Step 1 and step 2 requests are NOT created yet
- Epic owner and step-0 approvers receive notifications within 30s

### AC-003: requiresAll=true waits for all approvers
Given step 0 has `requiresAll=true` with 2 assigned approvers (Approver A, Approver B),
When only Approver A approves,
Then:
- `GovernedEpic.currentStepIndex` remains 0
- Step 1 `ApprovalRequest` rows are not created
- Approver B still has a pending notification

Given Approver B also approves,
Then:
- `currentStepIndex` advances to 1
- Step 1 `ApprovalRequest` rows are created
- Step-1 approvers are notified within 30s

### AC-004: Rejection terminates workflow at any step
Given a GovernedEpic at step 1 of a 3-step workflow,
When a step-1 approver rejects with reason "Business case insufficient — needs market validation",
Then:
- `GovernedEpic.status` = REJECTED
- Step 2 `ApprovalRequest` rows are never created
- A `DecisionLogEntry` is written with type REJECTED, the rejection reason, approver userId, timestamp
- Epic owner is notified with the rejection reason

### AC-005: DecisionLogEntry immutability (405 on DELETE, DB trigger)
Given any `DecisionLogEntry` record in the database,
When a DELETE is attempted via the API or direct DB `DELETE` statement,
Then:
- API returns 405 (no DELETE route exists)
- DB INSERT trigger blocks direct `DELETE` with exception: "Decision log entries are immutable"

### AC-006: Workflow immutable after first use
Given a governance workflow is first used (a GovernedEpic submits against it),
When any user attempts to edit the workflow steps,
Then:
- All edit controls are disabled
- A banner shows: "This workflow is in use — fork to modify"
- A "Fork Workflow" button creates a copy as a new DRAFT workflow

### AC-007: RTE emergency bypass
Given `allowApprovalBypass=true` on the org,
When an RTE submits a bypass with justification >= 100 characters,
Then:
- `GovernedEpic.status` = BYPASSED
- A `DecisionLogEntry` with type BYPASS, full justification, RTE userId, and timestamp is created
- All pending `ApprovalRequest` rows are CANCELLED
- All approvers + org admin are notified of the bypass

Given `allowApprovalBypass=false`,
When bypass is attempted,
Then:
- The bypass button is hidden in the UI
- API returns 403 "Approval bypass is not enabled for this organization"

### AC-008: Self-approval prevention
Given Approver A is both an approver in step 0 AND the epic owner who submitted the GovernedEpic,
When Approver A tries to approve step 0,
Then:
- HTTP 422 with `{code: "SELF_APPROVAL_NOT_ALLOWED"}`
- The approval is not recorded

---

## Technical Notes

### Models

```prisma
model GovernedEpic {
  id                   String   @id @default(cuid())
  orgId                String
  epicId               String   @unique
  workflowId           String
  status               String   @default("PENDING") // PENDING|IN_REVIEW|APPROVED|REJECTED|BYPASSED
  currentStepIndex     Int      @default(0)
  submittedAt          DateTime @default(now())
  submittedBy          String
  currentStepStartedAt DateTime?
  slaBreachAt          DateTime?
  solutionEpicId       String?
}

model ApprovalRequest {
  id                String   @id @default(cuid())
  orgId             String
  governedEpicId    String
  stepIndex         Int
  assignedTo        String   // userId
  status            String   @default("PENDING") // PENDING|APPROVED|REJECTED|CANCELLED
  decision          String?
  reason            String?
  decidedAt         DateTime?
  slaBreachedAt     DateTime?
  stepType          String?  // SINGLE_APPROVER|GROUP_ANY|GROUP_ALL
}

model DecisionLogEntry {
  id                String   @id @default(cuid())
  orgId             String
  governedEpicId    String
  type              String   // SUBMITTED|APPROVED|REJECTED|BYPASS|INVEST_OVERRIDE|RESUBMITTED|RECONSIDERED
  actorId           String?
  decision          String?
  reason            String?
  metadata          Json?
  createdAt         DateTime @default(now())
  tombstone         Boolean  @default(false) // for soft-delete of parent epic
}
```

### DB Trigger (decision log immutability)

```sql
CREATE OR REPLACE FUNCTION prevent_decision_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Decision log entries are immutable. Type: %, Entry ID: %', TG_OP, OLD.id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER decision_log_immutable
BEFORE UPDATE OR DELETE ON "DecisionLogEntry"
FOR EACH ROW EXECUTE FUNCTION prevent_decision_log_mutation();
```

### Workflow Step Advancement Logic

```typescript
const advanceWorkflowStep = async (governedEpicId: string, tx: PrismaClient) => {
  const epic = await tx.governedEpic.findUniqueOrThrow({ where: { id: governedEpicId } })
  const workflow = await tx.approvalWorkflow.findUniqueOrThrow({ where: { id: epic.workflowId } })
  const steps = workflow.steps as ApprovalStepDefinition[]
  const currentStep = steps[epic.currentStepIndex]

  const pendingRequests = await tx.approvalRequest.count({
    where: { governedEpicId, stepIndex: epic.currentStepIndex, status: 'PENDING' }
  })

  const shouldAdvance = currentStep.requiresAll ? pendingRequests === 0
    : await tx.approvalRequest.count({ where: { governedEpicId, stepIndex: epic.currentStepIndex, status: 'APPROVED' } }) > 0

  if (!shouldAdvance) return

  const nextStepIndex = epic.currentStepIndex + 1
  if (nextStepIndex >= steps.length) {
    // Workflow complete — approve epic
    await tx.governedEpic.update({ where: { id: governedEpicId }, data: { status: 'APPROVED' } })
    await tx.decisionLogEntry.create({ data: { orgId: epic.orgId, governedEpicId, type: 'APPROVED', actorId: null } })
  } else {
    // Create next step requests
    await tx.governedEpic.update({ where: { id: governedEpicId }, data: { currentStepIndex: nextStepIndex } })
    // Create ApprovalRequests for nextStep approvers + notify
  }
}
```

---

## Dependencies

- Story-011 (PORTFOLIO_BACKLOG → IMPLEMENTING guard checks GovernedEpic.status)
- Story-010 — DecisionLogEntry model created here, exported read endpoint
- `@repo/notifications`
- Inngest SLA reminder jobs

---

## Definition of Done

- [ ] Approval workflow CRUD (≤10 steps, DND ordering, requiresAll, slaHours)
- [ ] Workflow immutability after first GovernedEpic submission
- [ ] GovernedEpic submission: step 0 requests created + notifications
- [ ] requiresAll fan-out logic with step advancement
- [ ] Rejection terminates workflow and notifies owner
- [ ] DecisionLogEntry INSERT-only (DB trigger + 405 API)
- [ ] RTE bypass (gated by `allowApprovalBypass`) with 100-char justification
- [ ] Self-approval prevention (422)
- [ ] Tombstone on parent epic deletion
- [ ] Inngest SLA reminder at 80% + breach
- [ ] RLS on all governance models (orgId-scoped)
- [ ] Unit tests: step advancement, rejection, bypass, immutability
