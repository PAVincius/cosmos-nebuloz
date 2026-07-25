# Story 031 — Liveblocks Security Hardening & CRDT PI Planning Board

**Epic:** 008 — Enterprise & Scale
**Feature:** F-008-001 Real-Time Collaboration Infrastructure
**WSJF:** 13.0 (userValue=8, timeValue=8, riskReduction=7, jobSize=2)
**Story Points:** 13
**Priority:** Must Have
**Status:** DEFINED

---

## User Story

**As a** Platform Engineer,
**I want** hardened Liveblocks authentication with orgId-scoped rooms, CRDT-backed PI Planning board with dual-write consistency, and automatic board reconciliation,
**so that** multi-user collaboration on the PI Planning board is conflict-free and always consistent with the database.

---

## Acceptance Criteria

### AC-001: Auth handshake returns token within 300ms
Given a valid Better Auth session for Org A,
When `POST /api/collaboration/auth` is called for room `orgA:pi-planning-board:{piPlanId}`,
Then:
- A Liveblocks token is returned with correct permissions within 300ms
- Token metadata includes `userId`, `orgId`, `role`, `displayName`

### AC-002: Cross-tenant room access blocked
Given User from Org A,
When they attempt to access room `orgB:pi-planning-board:{piPlanId}` (a different org's room),
Then:
- Auth returns HTTP 403 before any Liveblocks token is issued
- `AuditLog` entry: `action=collaboration.cross_tenant_attempt`

### AC-003: VIEWER gets read-only Liveblocks token
Given a VIEWER-role user accesses a PI planning room,
When auth is called,
Then:
- Liveblocks token grants `canWrite: false`
- Any drag mutation attempted by the client is server-rejected
- VIEWER can see the board but DND handles are hidden

### AC-004: Concurrent drop resolves to single final position
Given User A and User B both drag the same feature F-001 simultaneously (A→Sprint 2 Team Alpha, B→Sprint 3 Team Beta),
When both drops resolve,
Then:
- Exactly one final position is persisted in both Liveblocks CRDT and Prisma
- Both clients converge to the same position within 2s
- No orphaned `PIPlanFeatureAssignment` records exist

### AC-005: Dual-write completes within 500ms
Given a feature is dragged to Sprint 2 Team Alpha,
When the Liveblocks `storageUpdated` webhook fires,
Then:
- `PIPlanFeatureAssignment` is upserted in Prisma within 500ms
- `BoardReconciliationLog` shows no divergence for this event

### AC-006: Divergence detection and auto-reconciliation
Given a network partition caused Liveblocks to have 45 assignments and Prisma to have 43 (diverged),
When the 15-min reconciliation job runs,
Then:
- Divergence is detected via checksum comparison
- Prisma state is applied to Liveblocks (Prisma wins)
- A `BoardReconciliationLog` entry is created with the divergence details
- RTE is notified if divergence count > 5

### AC-007: DB write failure — client snap-back
Given a Liveblocks CRDT drop is optimistically shown,
When the Prisma write fails (e.g., DB constraint violation),
Then:
- The feature card snaps back to its prior position via a Liveblocks patch
- A toast appears: "Move failed — please try again"
- `BoardReconciliationLog.resolution = LIVEBLOCKS_WINS` (Liveblocks reverted to Prisma state)

### AC-008: 20 concurrent users without deadlocks
Given 20 users simultaneously on the PI Planning board, all dragging features,
When all drags are processed,
Then:
- No DB deadlocks occur
- All assignments settle within 5s
- No duplicate `PIPlanFeatureAssignment` records for the same feature

---

## Technical Notes

### PIPlanFeatureAssignment Model

```prisma
model PIPlanFeatureAssignment {
  id          String   @id @default(cuid())
  orgId       String
  piPlanId    String
  featureId   String
  teamId      String
  sprintId    String
  rank        Int      @default(0)
  updatedAt   DateTime @updatedAt
  updatedBy   String?
  @@unique([piPlanId, featureId]) // one assignment per feature per PI
  @@index([orgId, piPlanId, teamId, sprintId])
}
```

### Liveblocks Auth Handler

```typescript
// apps/app/app/api/collaboration/auth/route.ts
import { Liveblocks } from '@liveblocks/node'

const liveblocks = new Liveblocks({ secret: process.env.LIVEBLOCKS_SECRET_KEY! })

export async function POST(req: Request) {
  const session = await requireSession(req) // throws on invalid
  const { room } = await req.json()

  // Validate orgId scoping: room must start with session.orgId
  const [roomOrgId, surface, entityId] = room.split(':')
  if (roomOrgId !== session.orgId) {
    await writeAuditLog('collaboration.cross_tenant_attempt', { actorId: session.userId, room })
    return Response.json({ error: 'Cross-tenant access denied' }, { status: 403 })
  }

  // Permission check based on surface + entityId
  const canWrite = await checkRoomPermissions(session, surface, entityId)

  const { status, body } = await liveblocks.identifyUser(
    { userId: session.userId, groupIds: [session.orgId] },
    {
      userInfo: {
        name: session.displayName,
        orgId: session.orgId,
        role: session.role,
      },
    }
  )

  return new Response(body, { status })
}
```

### Dual-Write Reconciliation

```typescript
// packages/collaboration/src/reconciliation.ts
export const reconcileBoard = async (piPlanId: string, orgId: string) => {
  // 1. Get Liveblocks CRDT state
  const room = await liveblocks.getRoom(`${orgId}:pi-planning-board:${piPlanId}`)
  const storage = await room.getStorage()
  const liveblocksAssignments = storage.data?.assignments ?? {}

  // 2. Get Prisma state
  const dbAssignments = await prisma.pIPlanFeatureAssignment.findMany({ where: { piPlanId, orgId } })

  // 3. Compare checksums
  const lbHash = hash(liveblocksAssignments)
  const dbHash = hash(Object.fromEntries(dbAssignments.map(a => [a.featureId, { teamId: a.teamId, sprintId: a.sprintId }])))

  if (lbHash === dbHash) return

  // 4. Prisma wins — patch Liveblocks
  await room.updateStorage({ assignments: dbAssignments.reduce((acc, a) => ({ ...acc, [a.featureId]: { teamId: a.teamId, sprintId: a.sprintId, rank: a.rank } }), {}) })

  await prisma.boardReconciliationLog.create({
    data: { orgId, surface: 'pi-planning', entityId: piPlanId, divergenceDetails: { lbCount: Object.keys(liveblocksAssignments).length, dbCount: dbAssignments.length }, resolution: 'PRISMA_WINS' }
  })
}
```

---

## Dependencies

- `@liveblocks/node ^3.11.0`, `@liveblocks/react ^3.11.0`
- Better Auth session validation
- `PIPlanFeatureAssignment`, `BoardReconciliationLog` models
- Inngest (reconciliation job every 15 min)
- `@repo/audit`
- DND-Kit (client-side drag)
- Epic 006 PI Planning context

---

## Definition of Done

- [ ] Auth handler: session validation + orgId scope check + cross-tenant 403
- [ ] VIEWER token: `canWrite=false` + server-side mutation rejection
- [ ] `PIPlanFeatureAssignment` with `@@unique([piPlanId, featureId])`
- [ ] Dual-write: Liveblocks → Inngest → Prisma within 500ms
- [ ] Conflict resolution: Prisma wins on concurrent drops
- [ ] Snap-back on DB write failure + toast
- [ ] 15-min reconciliation job with `BoardReconciliationLog`
- [ ] 20 concurrent users without deadlocks
- [ ] Room connection limits (PI planning ≤200) with 429 graceful degradation
- [ ] `AuditLog` on cross-tenant attempt
- [ ] Unit tests: cross-tenant block, CRDT conflict resolution, snap-back, reconciliation
