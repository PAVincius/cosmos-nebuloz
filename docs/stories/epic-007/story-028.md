# Story 028 — BPMN Workflow Modeling & XState Runtime

**Epic:** 007 — Solution Train & Advanced Features
**Feature:** F-007-008 Workflow Automation
**WSJF:** 6.0 (userValue=5, timeValue=4, riskReduction=5, jobSize=2)
**Story Points:** 8
**Priority:** Should Have
**Status:** DEFINED

---

## User Story

**As a** Scrum Master,
**I want** to define custom story/feature workflows using a BPMN canvas, activate them for my team, and have the XState runtime enforce transitions,
**so that** our team-specific process (e.g., security review lane, compliance gate) is automated and consistent.

---

## Acceptance Criteria

### AC-001: BpmnDefinition created from valid BPMN XML
Given a SM with `WORKFLOW_WRITE` permission submits unique-named, valid BPMN XML,
When saved,
Then:
- A `BpmnDefinition` is created with `active=false`, `version=1`, correct `entityType`, `ownerId`
- The XML is gzip-compressed before storage (max 2MB raw)
- Redirect to the definition detail page

### AC-002: Disconnected gateway blocked
Given a BPMN diagram with a gateway not connected to any sequence flows,
When the definition is saved,
Then:
- HTTP 422 with `{code: "BPMN_VALIDATION_ERROR", elements: [{id: "gw-01", error: "Gateway has no outgoing flows"}]}`
- Nothing is persisted

### AC-003: Co-editing: presence cursor reposition
Given User A and User B are co-editing the same BpmnDefinition in the canvas,
When User A moves a task node,
Then:
- User B sees User A's cursor reposition within 500ms
- User A's name/avatar appears on the canvas with a role-colored badge

### AC-004: Diff against active definition
Given an active definition (v1) and a draft adding 1 node/removing 1 flow,
When "Diff Against Active" is triggered on the draft,
Then:
- The added node is highlighted green in the diff panel
- The removed flow is highlighted red
- The side panel lists exactly 2 changes (1 added node, 1 removed flow)

### AC-005: Compiled XState machine from BPMN
Given a BPMN with: StartEvent → Task (Review) → ExclusiveGateway → [Approved: Task (Implement)] → [Rejected: Task (Revise)] → EndEvent,
When compiled,
Then:
- A valid XState v5 config is produced with `initial: "Review"` and 5 named states
- The gateway conditions appear as `guard` functions
- Machine validates successfully via `createMachine()` without errors

### AC-006: Guarded transition on runtime
Given a story in "Awaiting Review" state (from an activated BPMN workflow) and a guard requiring `assignees.length > 0`,
When transition is triggered with no assignees,
Then:
- HTTP 403 `{code: "WORKFLOW_GUARD_FAILED", guard: "hasAssignee"}`
- `workflowState` unchanged

### AC-007: Wait-state webhook release (idempotent)
Given a story in `cosmos:waitEvent="github.pr.merged"` wait-state with a specific `prId`,
When the GitHub PR merged webhook fires with matching `prId`,
Then:
- The story transitions out of the wait-state to the next workflow state
- A `StateTransitionHistory` row is created with `externalRef=<prId>`
- If the same webhook fires again: no second transition (idempotent via Redis SETNX)

### AC-008: SLA breach escalation
Given a story in "Awaiting Review" with `cosmos:slaHours=48` that has been in that state for 72h,
When the staleness-check cron runs,
Then:
- The story transitions to the configured escalation state
- A HIGH anomaly `WORKFLOW_SLA_BREACH` is created
- The SM is notified with story title, elapsed hours, and configured SLA

---

## Technical Notes

### BpmnDefinition Schema

```prisma
model BpmnDefinition {
  id              String   @id @default(cuid())
  orgId           String
  name            String
  entityType      String   // STORY|FEATURE|EPIC|CUSTOM
  ownerType       String   // ORG|TEAM|ART
  ownerId         String
  xmlGzip         Bytes
  compiledMachine Json?
  version         Int      @default(1)
  active          Boolean  @default(false)
  parentId        String?
  lockedNodes     String[]
  activatedAt     DateTime?
  activatedBy     String?
  createdAt       DateTime @default(now())
  @@unique([orgId, name, ownerType, ownerId])
  @@index([orgId, entityType, ownerId, active])
}
```

### BPMN→XState Compiler

```typescript
// packages/workflow/src/compiler.ts
export const compileBpmnToXState = (xmlString: string): MachineConfig => {
  const moddle = new BpmnModdle([cosmosModdle])
  const { elementsById } = moddle.fromXML(xmlString)

  // Only catalogue-supported elements
  const ALLOWED_ELEMENTS = ['bpmn:StartEvent', 'bpmn:EndEvent', 'bpmn:Task', 'bpmn:ExclusiveGateway', 'bpmn:SequenceFlow']

  const states: Record<string, StateConfig> = {}
  const initial = findStartState(elementsById)

  for (const [id, element] of Object.entries(elementsById)) {
    if (!ALLOWED_ELEMENTS.includes(element.$type)) {
      if (element.$type.startsWith('bpmn:')) throw new Error(`Unsupported element: ${element.$type}`)
      continue // cosmos:* extensions allowed
    }
    // Build XState state config from element
    states[toStateName(element)] = buildStateConfig(element, elementsById)
  }

  return { id: 'custom-workflow', initial, states }
}
```

### Cosmos Moddle Extension

```json
{
  "name": "Cosmos",
  "uri": "https://cosmos-nebuloz.io/bpmn/schema",
  "prefix": "cosmos",
  "xml": { "tagAlias": "lowerCase" },
  "types": [
    { "name": "WaitEvent", "extends": ["bpmn:Task"], "properties": [
      { "name": "waitEvent", "type": "String" },
      { "name": "slaHours", "type": "Integer" },
      { "name": "locked", "type": "Boolean", "default": false }
    ]}
  ]
}
```

---

## Dependencies

- `bpmn-js@18`, `camunda-bpmn-moddle` (canvas rendering)
- XState 5 (runtime machine)
- Liveblocks (co-editing presence)
- Epic 006 `StateTransitionHistory` (runtime writes)
- Inngest staleness-check (SLA enforcement)
- Epic 007 Story-025 (GitHub webhook for wait-state release)

---

## Definition of Done

- [ ] `BpmnDefinition` model with gzip XML storage
- [ ] BPMN-js 18 canvas with `cosmos:*` moddle extension
- [ ] Validation: disconnected gateway, unreachable states → 422
- [ ] Co-editing presence with Liveblocks (cursors < 500ms)
- [ ] Diff against active definition (added=green, removed=red)
- [ ] BPMN→XState compiler (catalogue-only elements, sandboxed validation)
- [ ] Runtime: guarded transitions, wait-state (webhook), SLA escalation
- [ ] Idempotent webhook release (Redis SETNX)
- [ ] HIGH anomaly on SLA breach + SM notification
- [ ] `workflowState`/`workflowContext`/`workflowVersion` on Story/Feature
- [ ] Unit tests: compiler output, guard enforcement, idempotent webhook, SLA breach
