# Story 039 — Solution Train & LACE Management

**Epic:** 008 — Enterprise & Scale
**Feature:** F-008-009 Large Solution SAFe
**WSJF:** 7.0 (userValue=6, timeValue=5, riskReduction=4, jobSize=2)
**Story Points:** 8
**Priority:** Should Have
**Status:** DEFINED

---

## User Story

**As a** Solution Train Engineer (STE),
**I want** Solution Train management with LACE team administration, Solution Epics, Supplier tracking, and Solution-level PI Planning,
**so that** multi-ART coordination is managed within SAFe Large Solution level constructs.

---

## Acceptance Criteria

### AC-001: Solution Train with multiple ARTs
Given a Solution Train "Enterprise Payments" contains ART-A and ART-B,
When a Solution Epic is created under the Solution Train,
Then:
- The Solution Epic appears in both ART-A and ART-B's portfolio view (read-only)
- The Solution Epic has its own lifecycle (FUNNEL→ANALYZING→BACKLOG→IMPLEMENTING→DONE)
- ART-level Epics can be linked to the Solution Epic with `solutionEpicId`

### AC-002: LACE team membership management
Given the LACE (Lean Agile Center of Excellence) team has members: STE Alice, Business Owner Bob, EA Carol,
When Alice changes Bob's LACE role from "Business Owner" to "Enterprise Architect",
Then:
- Bob's LACE role updates immediately
- `AuditLog`: `action=lace.member.roleChanged`, `actorId=Alice`, `targetId=Bob`
- The LACE team page reflects the new role

### AC-003: Solution-level Capabilities mapped to ARTs
Given a Capability "Real-Time Payments API" belongs to Solution Train "Enterprise Payments",
When the Capability is decomposed,
Then:
- It breaks down into ≥2 Features, each assigned to an ART
- The Capability tracker shows which ART owns each Feature
- Dependency links between Features in different ARTs are surfaced on the Solution Program Board

### AC-004: Supplier integration tracking
Given Supplier "Stripe" is registered under Solution Train "Enterprise Payments",
When a Feature depends on a Stripe API delivery,
Then:
- A SupplierDeliverable record is created: `{supplierId, featureId, expectedDate, status}`
- Delays (expectedDate passed + status != DELIVERED) trigger a `SUPPLIER_DELAY` alert
- The Solution Program Board shows supplier dependencies in a dedicated swim lane

### AC-005: Solution-level PI Planning session
Given a Solution PI Planning session is initiated for Q3-2026,
When ART-A and ART-B both complete their PI Planning,
Then:
- Solution Train PI Objectives are aggregated from both ARTs
- Cross-ART dependencies are visible on the Solution Program Board
- The Solution Train Confidence Vote aggregates votes from both ARTs (weighted average)

### AC-006: Solution Train STE-only admin operations
Given user with TEAM_MEMBER role in ART-A,
When they attempt to modify the Solution Train configuration or LACE membership,
Then:
- HTTP 403 `{code: "INSUFFICIENT_ROLE", required: "SOLUTION_TRAIN_ENGINEER"}`
- No modification occurs

### AC-007: Cross-ART dependency visualization
Given Feature F1 in ART-A depends on Feature F2 in ART-B,
When the Solution Program Board renders,
Then:
- A dependency line connects F1's sprint cell to F2's sprint cell across the ART rows
- If F2 is behind schedule (not completed by the sprint F1 depends on): dependency line turns red
- Circular dependency detection runs and prevents cycles (DFS guard)

### AC-008: Solution Kanban board
Given a Solution Train has 8 Solution Epics in various states,
When the Solution Kanban renders,
Then:
- Epics are grouped by state (FUNNEL/ANALYZING/BACKLOG/IMPLEMENTING/DONE)
- Each card shows: contributing ART count, aggregate WSJF, progress %
- WIP limits apply at Solution-level (configurable per Solution Train)

---

## Technical Notes

### Prisma Schema (large-solution.prisma)

```prisma
model SolutionTrain {
  id          String   @id @default(cuid())
  orgId       String
  name        String
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  arts            ART[]
  laceMembers     LACEMember[]
  solutionEpics   SolutionEpic[]
  suppliers       Supplier[]
  capabilities    Capability[]

  @@index([orgId])
}

model LACEMember {
  id              String      @id @default(cuid())
  solutionTrainId String
  userId          String
  laceRole        LACERole    // STE | BUSINESS_OWNER | ENTERPRISE_ARCHITECT | SYSTEM_ARCHITECT | PRODUCT_MANAGER
  joinedAt        DateTime    @default(now())

  solutionTrain   SolutionTrain @relation(fields: [solutionTrainId], references: [id])
  @@unique([solutionTrainId, userId])
}

model SolutionEpic {
  id              String            @id @default(cuid())
  orgId           String
  solutionTrainId String
  title           String
  hypothesis      String?
  state           EpicState         @default(FUNNEL)
  wsjf            Float?

  solutionTrain   SolutionTrain     @relation(fields: [solutionTrainId], references: [id])
  linkedEpics     Epic[]            // ART-level epics
  capabilities    Capability[]

  @@index([solutionTrainId, state])
}

model Capability {
  id              String      @id @default(cuid())
  solutionTrainId String
  title           String
  state           String      @default("FUNNEL")

  features        Feature[]   // ART-level features implementing this capability
  solutionTrain   SolutionTrain @relation(fields: [solutionTrainId], references: [id])
}

model Supplier {
  id              String      @id @default(cuid())
  solutionTrainId String
  name            String
  contactInfo     Json?

  deliverables    SupplierDeliverable[]
  solutionTrain   SolutionTrain @relation(fields: [solutionTrainId], references: [id])
}

model SupplierDeliverable {
  id           String             @id @default(cuid())
  supplierId   String
  featureId    String
  expectedDate DateTime
  actualDate   DateTime?
  status       DeliverableStatus  @default(PENDING)

  supplier     Supplier @relation(fields: [supplierId], references: [id])
  feature      Feature  @relation(fields: [featureId], references: [id])

  @@index([supplierId, status])
}

enum LACERole {
  SOLUTION_TRAIN_ENGINEER
  BUSINESS_OWNER
  ENTERPRISE_ARCHITECT
  SYSTEM_ARCHITECT
  PRODUCT_MANAGER
}

enum DeliverableStatus {
  PENDING
  IN_PROGRESS
  DELIVERED
  DELAYED
}
```

### Solution Confidence Vote Aggregation

```typescript
// packages/planning/src/solution-confidence.ts
export const aggregateSolutionConfidence = async (solutionPiPlanId: string): Promise<number> => {
  const artConfidenceScores = await prisma.artConfidenceVoteTally.findMany({
    where: { solutionPiPlanId }
  })

  // Weighted average by ART team count
  const totalWeight = artConfidenceScores.reduce((sum, s) => sum + s.teamCount, 0)
  const weightedSum = artConfidenceScores.reduce((sum, s) => sum + (s.averageScore * s.teamCount), 0)
  return totalWeight > 0 ? weightedSum / totalWeight : 0
}
```

---

## Dependencies

- `large-solution.prisma` (SolutionTrain, LACEMember, SolutionEpic, Capability, Supplier, SupplierDeliverable)
- `@repo/rbac` (SOLUTION_TRAIN_ENGINEER role check)
- Liveblocks (Solution Program Board real-time co-editing)
- `@repo/audit`

---

## Definition of Done

- [ ] Solution Train CRUD with multi-ART membership
- [ ] LACE team management (roles: STE, Business Owner, EA, System Architect, PM)
- [ ] Solution Epic lifecycle (FUNNEL→DONE) with ART Epic linkage
- [ ] Capability → Feature decomposition with ART assignment
- [ ] Supplier registration + SupplierDeliverable tracking + SUPPLIER_DELAY alert
- [ ] Solution Kanban with WIP limits
- [ ] Solution-level Confidence Vote (weighted aggregation from ARTs)
- [ ] Solution Program Board with cross-ART dependency lines (circular detection)
- [ ] STE-only admin guard (403 for lower roles)
- [ ] `AuditLog` on all LACE/Solution Train admin operations
- [ ] Unit tests: supplier delay detection, confidence aggregation, cross-ART dependency DFS, STE role guard
