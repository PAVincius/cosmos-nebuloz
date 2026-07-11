# Story 041 — Presence, Cursors & Cross-Surface Real-Time Rooms

**Epic:** 008 — Enterprise & Scale
**Feature:** F-008-001 Liveblocks Enterprise Hardening
**WSJF:** 9.0 (userValue=8, timeValue=7, riskReduction=6, jobSize=2)
**Story Points:** 5
**Priority:** Must Have
**Status:** DEFINED

---

## User Story

**As a** Platform Engineer,
**I want** Liveblocks presence and cursor broadcasting across all collaborative surfaces (Program Board, Kanban, Sprint Board, Retro), with consistent orgId-scoped room IDs and cross-surface presence awareness,
**so that** users collaborating on any surface see who else is there in real time without cross-tenant leakage.

---

## Acceptance Criteria

### AC-001: Presence visible within 500ms of joining a room
Given 3 users open the Program Board simultaneously,
When each user joins the room `{orgId}:program-board:{piPlanId}`,
Then:
- Each user sees the other 2 users' avatars in the presence bar within 500ms
- Presence includes: `{userId, name, color, cursor: {x, y} | null}`
- Total presence broadcast latency p95 < 500ms (Liveblocks SLA)

### AC-002: Cursor position broadcast at 60fps
Given 2 users are on the Program Board,
When User A moves their mouse,
Then:
- User B sees User A's cursor move in real time (no debounce — broadcast on every mousemove)
- Cursor is rendered as a colored SVG arrow with User A's name label
- When User A leaves the room: cursor disappears within 2s (presence timeout)

### AC-003: Room ID format enforced
Given any Liveblocks room creation,
When the room ID is constructed,
Then:
- Format must match: `{orgId}:{surface}:{entityId}`
- Surface values: `program-board`, `pi-kanban`, `sprint-board`, `retro`, `bpmn-canvas`, `portfolio-kanban`, `solution-board`
- Cross-surface: users on `org1:program-board:plan1` CANNOT access `org2:program-board:plan1`
- Room creation with malformed ID returns 400

### AC-004: Cross-tenant room access denied
Given user U from `orgId=org_A`,
When U attempts to join room `org_B:program-board:plan_B1` (a different org's room),
Then:
- Liveblocks auth token is denied (room orgId !== session orgId)
- HTTP 403 from the `/api/liveblocks-auth` endpoint
- `AuditLog`: `action=liveblocks.room.access_denied`, `attemptedRoom`, `actorId`

### AC-005: Presence cleanup on disconnect
Given a user's browser tab closes ungracefully (no WebSocket close frame),
When Liveblocks detects the disconnect,
Then:
- The user's presence is removed from the room within 2s (Liveblocks heartbeat timeout)
- Their cursor disappears from all other users' views
- No stale cursors remain after 2s

### AC-006: Cross-surface presence awareness
Given a user is on the Portfolio Kanban (`{orgId}:portfolio-kanban:{orgId}`) and another is on the Program Board (`{orgId}:program-board:{piPlanId}`),
When both surfaces are open,
Then:
- A "Who's online" indicator in the nav shows all users in any org room (aggregate presence)
- Clicking a user's avatar in "Who's online" shows which surface they're on
- This global presence uses a single `{orgId}:org-presence:{orgId}` room (broadcast only, no CRDT)

### AC-007: Presence scales to 50 concurrent users
Given 50 users join the same Portfolio Kanban room simultaneously,
When all 50 are active,
Then:
- All 50 see each other's presence without degradation
- UI renders presence avatars with "+N" overflow after 8 visible (e.g., "+42")
- Cursor broadcast continues without visible lag (Liveblocks handles fan-out)

### AC-008: Liveblocks auth token scoped to one room
Given a user requests a Liveblocks auth token for room `org_A:program-board:plan_1`,
When the token is issued,
Then:
- The token grants access ONLY to `org_A:program-board:plan_1` — not to any other room
- Token TTL = 1h (Liveblocks default)
- Token cannot be used to authenticate a different room

---

## Technical Notes

### Liveblocks Auth (room-scoped tokens)

```typescript
// apps/app/app/api/liveblocks-auth/route.ts
import { Liveblocks } from '@liveblocks/node'

const liveblocks = new Liveblocks({ secret: process.env.LIVEBLOCKS_SECRET! })

export async function POST(req: Request) {
  const session = await requireSession(req)
  const { room } = await req.json()

  // Validate room format: {orgId}:{surface}:{entityId}
  const ROOM_PATTERN = /^[a-z0-9_]+:(program-board|pi-kanban|sprint-board|retro|bpmn-canvas|portfolio-kanban|solution-board|org-presence):[a-z0-9_]+$/i
  if (!ROOM_PATTERN.test(room)) {
    return Response.json({ error: 'Invalid room ID format' }, { status: 400 })
  }

  // Cross-tenant check: room must start with session orgId
  const roomOrgId = room.split(':')[0]
  if (roomOrgId !== session.orgId) {
    await writeAuditLog({ action: 'liveblocks.room.access_denied', actorId: session.userId, meta: { attemptedRoom: room } })
    return Response.json({ error: 'Cross-tenant room access denied' }, { status: 403 })
  }

  const { status, body } = await liveblocks.identifyUser(
    { userId: session.userId, groupIds: [session.orgId] },
    {
      userInfo: {
        name: session.user.name,
        color: generateUserColor(session.userId),
        avatar: session.user.avatarUrl ?? null,
      },
      roomAccesses: {
        [room]: ['room:write'] as const, // scoped to exactly this room
      },
    }
  )

  return new Response(body, { status })
}
```

### Presence Hook Pattern

```typescript
// packages/collaboration/src/hooks/use-presence.ts
import { useOthers, useUpdateMyPresence } from '@liveblocks/react'
import { useCallback, useEffect } from 'react'

type Presence = {
  cursor: { x: number; y: number } | null
  surface: string
  userId: string
}

export const useRoomPresence = (surface: string) => {
  const updatePresence = useUpdateMyPresence<Presence>()
  const others = useOthers()

  const broadcastCursor = useCallback((e: MouseEvent) => {
    updatePresence({ cursor: { x: e.clientX, y: e.clientY }, surface })
  }, [surface, updatePresence])

  useEffect(() => {
    window.addEventListener('mousemove', broadcastCursor)
    return () => {
      window.removeEventListener('mousemove', broadcastCursor)
      updatePresence({ cursor: null })
    }
  }, [broadcastCursor, updatePresence])

  return { others }
}
```

### Global Org Presence (broadcast only, no CRDT)

```typescript
// packages/collaboration/src/org-presence.ts
// Room: {orgId}:org-presence:{orgId}
// Broadcast (not CRDT storage) — no persistent state
// Used only for "Who's online" nav indicator

export const broadcastJoinedSurface = (room: string) => {
  const surface = room.split(':')[1]
  broadcastEvent({ type: 'user.joined.surface', surface })
}
```

---

## Dependencies

- `@liveblocks/react ^3.11` + `@liveblocks/node ^3.11`
- `@repo/auth` (session for token issuance)
- `@repo/audit` (cross-tenant access logging)
- All collaborative surfaces (program-board, portfolio-kanban, sprint-board, retro, bpmn-canvas)

---

## Definition of Done

- [ ] Liveblocks auth: room-scoped token with orgId cross-tenant check
- [ ] Room ID format enforcement: `{orgId}:{surface}:{entityId}` regex guard
- [ ] Cross-tenant access → 403 + `AuditLog`
- [ ] Cursor broadcast: mousemove → updateMyPresence (no debounce)
- [ ] Cursor rendering: colored SVG arrow + name label
- [ ] Presence cleanup: stale cursors removed within 2s on disconnect
- [ ] All 7 collaborative surfaces using room ID convention
- [ ] Global org presence: `{orgId}:org-presence:{orgId}` broadcast room for nav "Who's online"
- [ ] Presence bar: up to 8 avatars + "+N" overflow
- [ ] Auth token scoped to exactly one room
- [ ] Unit tests: room ID validation, cross-tenant rejection, presence cleanup timing
