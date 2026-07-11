# Story 024 — Defects, Impediments & Anomaly Escalation

**Epic:** 006 — Enhanced Portfolio & ART
**Feature:** F-014 Delivery Quality & Impediment Management
**WSJF:** 6.0 (userValue=6, timeValue=4, riskReduction=4, jobSize=2)
**Story Points:** 5
**Priority:** Must Have
**Status:** DEFINED

---

## User Story

**As a** Scrum Master,
**I want** defect tracking and impediment management with automatic anomaly escalation and PI-Risk linking,
**so that** quality issues and blockers are captured, escalated appropriately, and never lost in the delivery process.

---

## Acceptance Criteria

### AC-001: CRITICAL defect creates anomaly in same transaction
Given a Developer saves a defect with `severity=CRITICAL`,
When the save transaction commits,
Then:
- A `CRITICAL_DEFECT` anomaly is created atomically in the same Prisma transaction
- The SM is notified immediately (< 60s)
- The RTE receives an ART-feed summary within 5 min: "1 new CRITICAL defect reported in {team}"

### AC-002: Defect severity downgrade restricted to SM/PO
Given a Developer attempts to downgrade a defect from CRITICAL to LOW,
When the action is submitted,
Then:
- HTTP 403 `{code: "INSUFFICIENT_ROLE", message: "Only SM or PO can downgrade defect severity"}`
- Severity unchanged

### AC-003: Defect reopen preserves originSprintId
Given a CLOSED defect from Sprint 3,
When a Developer reopens it with reason "Issue reappeared after deploy",
Then:
- `status = OPEN`, `reopenReason` stored
- `originSprintId` remains Sprint 3 (not updated)
- A `StateTransitionHistory` row records the CLOSED → OPEN transition

### AC-004: Impediment escalation creates bidirectional PI Risk link
Given an SM escalates an impediment "Can't access staging environment — DevOps team blocked" with ROAM OWNED + owner + future dueDate,
When escalation is submitted,
Then:
- A `Risk` record is created with `category=IMPEDIMENT`, `roamStatus=OWNED`, linked `impedimentId`
- The impediment `status = ESCALATED`, `linkedRiskId = {new risk id}`
- Both records reference each other (bidirectional)
- The RTE is notified of the new PI Risk

### AC-005: Impediment resolution requires ≥20-char note
Given an impediment in ESCALATED state,
When the SM resolves it with a note < 20 chars ("done"),
Then:
- HTTP 422 `{code: "RESOLUTION_NOTE_TOO_SHORT", minLength: 20, actual: 4}`
- Impediment remains ESCALATED

Given a note >= 20 chars ("Staging access restored by DevOps on 2026-06-09"),
When resolved,
Then:
- `status = RESOLVED`, `resolvedAt` timestamp, `resolutionTime` (hours from createdAt)
- All standup-entry members who referenced this impediment are notified

### AC-006: IMPEDIMENT_AGING cron (CRITICAL, 24h threshold)
Given a CRITICAL impediment has been OPEN for 25 hours without resolution,
When the `IMPEDIMENT_AGING` cron fires,
Then:
- A HIGH `IMPEDIMENT_AGING` anomaly is created
- Owner (if set) and SM are notified
- If CRITICAL + 48h unresolved: RTE is also notified

### AC-007: Defect swimlane excluded from velocity
Given a sprint board with 5 stories (35 pts) and 2 defects,
When the sprint closes,
Then:
- Velocity = points from accepted stories only (defects excluded)
- Defect count is tracked separately in `SprintReview.defectCount`

### AC-008: 48h staleness flag on defects
Given a HIGH defect has been OPEN for 49 hours with no `IN_PROGRESS` status,
When the staleness cron runs,
Then:
- A STALE_DEFECT LOW anomaly is created (if none open)
- The defect card shows a "48h stale" badge on the sprint board

---

## Technical Notes

### Defect Model

```prisma
model Defect {
  id              String   @id @default(cuid())
  orgId           String
  sprintId        String
  teamId          String
  title           String
  description     String?
  severity        String   // LOW|MEDIUM|HIGH|CRITICAL
  reproducible    Boolean  @default(false)
  status          String   @default("OPEN") // OPEN|IN_PROGRESS|IN_REVIEW|CLOSED
  originSprintId  String
  assignedTo      String?
  closedAt        DateTime?
  reopenReason    String?
  linkedStoryId   String?
  createdAt       DateTime @default(now())
  @@index([orgId, sprintId, status])
}
```

### Impediment Model

```prisma
model Impediment {
  id              String   @id @default(cuid())
  orgId           String
  artId           String
  teamId          String?
  title           String
  description     String
  severity        Int      // 1-5
  ownerId         String?  // always required at ESCALATED
  status          String   @default("OPEN") // OPEN|ESCALATED|RESOLVED
  linkedRiskId    String?
  resolvedAt      DateTime?
  resolutionNote  String?
  resolutionTime  Float?   // hours
  createdAt       DateTime @default(now())
  @@index([orgId, artId, status])
}
```

### CRITICAL Defect + Anomaly Transaction

```typescript
export const createDefectAction = withSecureAction(
  { schema: CreateDefectSchema, auditAction: 'defect.created', auditResourceType: 'Defect' },
  async ({ sprintId, title, severity, ... }, ctx) => {
    await prisma.$transaction(async tx => {
      const defect = await tx.defect.create({ data: { orgId: ctx.orgId, sprintId, title, severity, originSprintId: sprintId, ... } })

      if (severity === 'CRITICAL') {
        await tx.anomaly.create({
          data: {
            orgId: ctx.orgId,
            type: 'CRITICAL_DEFECT',
            severity: 'HIGH',
            entityType: 'DEFECT',
            entityId: defect.id,
            message: `Critical defect reported: ${title}`,
          }
        })
      }
    })
    // Post-transaction: notify SM + RTE
  }
)
```

---

## Dependencies

- Story-022 (sprints + standup blocker context for impediment matching)
- Story-019 (ROAM — impediment escalation creates a Risk)
- `flow-intelligence` anomaly types: `CRITICAL_DEFECT`, `IMPEDIMENT_AGING`, `STALE_DEFECT`
- Inngest staleness cron

---

## Definition of Done

- [ ] Defect CRUD: severity LOW–CRITICAL, status lifecycle, separate swimlane
- [ ] CRITICAL defect → `CRITICAL_DEFECT` anomaly in same Prisma transaction
- [ ] Severity downgrade restricted to SM/PO (403 for others)
- [ ] Defect reopen: `originSprintId` preserved, reason required
- [ ] Defects excluded from sprint velocity
- [ ] Impediment CRUD: owner required at ESCALATED, ≥20-char resolution note
- [ ] Escalation: bidirectional `Risk` link + RTE notification
- [ ] IMPEDIMENT_AGING cron at 24h (CRITICAL) + 48h (RTE notification)
- [ ] 48h staleness flag on HIGH defects
- [ ] `StateTransitionHistory` on status changes for both defects and impediments
- [ ] Unit tests: CRITICAL defect transaction, severity downgrade, bidirectional link, staleness
