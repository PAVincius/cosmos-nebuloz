# Story 012 — Portfolio Kanban Board with Real-Time Drag & WIP Limits

**Epic:** 006 — Enhanced Portfolio & ART
**Feature:** F-002 Portfolio Visibility
**WSJF:** 8.0 (userValue=8, timeValue=5, riskReduction=3, jobSize=2)
**Story Points:** 8
**Priority:** Must Have
**Status:** DEFINED

---

## User Story

**As a** Portfolio Manager,
**I want** a real-time, drag-and-drop six-column Portfolio Kanban with configurable WIP limits and live multi-user presence,
**so that** I can visualize and manage portfolio flow across the epic lifecycle with my team simultaneously.

---

## Acceptance Criteria

### AC-001: All epics render in correct columns
Given a portfolio with 12 epics distributed across 4 lifecycle states,
When a user with `portfolio:read` loads the board,
Then:
- All 12 epics render in their correct state columns
- WIP header counts match actual epic counts per column
- Page renders within 2s (p95)
- Columns with `null` WIP limit show no count indicator

### AC-002: WIP limit violation with override permission
Given a column with WIP limit 5 currently holding 5 epics,
When a 6th epic is dragged into it,
Then:
- A WIP violation modal appears: "Moving this epic will exceed the WIP limit of 5 for this column. Do you want to proceed?"
- If the user has `portfolio:wip-override`, a "Proceed Anyway" button is enabled
- If the user lacks the permission, the modal shows "You don't have permission to override WIP limits" and no proceed button
- On confirmation, the drag completes and a `DecisionLogEntry` is created noting the WIP override

### AC-003: Real-time state propagation between users
Given two users viewing the same Portfolio Kanban,
When User A moves an epic from FUNNEL to ANALYZING,
Then:
- User B sees the epic in the ANALYZING column within 1s without refreshing
- Both users see the WIP counts update immediately
- No flash/flicker of the card during remote update

### AC-004: URL-persisted filter state
Given a Portfolio Manager filters by ART "Platform ART" and theme "Customer Growth",
When they copy and share the URL with another user who opens it,
Then:
- The same ART + theme filters are active for the second user
- Active filter chips are visible in the filter bar
- Clearing filters removes the params from the URL

### AC-005: REJECTED transition requires reason
Given any epic being dragged to the REJECTED column,
When the drop occurs,
Then:
- A "Rejection Reason" modal opens before the move is committed
- If the user submits < 20 chars, inline validation blocks submission
- On valid reason submission, the epic moves and a `StateTransitionHistory` row is written
- On dismiss/cancel, the epic snaps back to its original column

### AC-006: WIP limit edit (Org Admin/RTE only)
Given an RTE opens the WIP limit settings for a column,
When they set a new limit and save,
Then:
- The column header updates immediately with the new limit
- The change is persisted to `Tenant.boardConfig.wipLimits`
- Attempting to edit WIP limits as a VIEWER returns 403

### AC-007: Strategic theme badges on cards
Given an epic linked to the "Security & Compliance" strategic theme (color #E53E3E),
When it renders on the kanban,
Then:
- A badge with the theme name and color appears on the card
- Epics with no theme show a grey "No Theme" placeholder badge
- Clicking the badge opens the theme filter for that theme

### AC-008: PT-BR and ES localization
Given the org locale is set to `pt-BR`,
When the Portfolio Kanban renders,
Then:
- All column headers, filter labels, and modal text are in Portuguese (BR)
- ROAM/WSJF/INVEST terms remain as-is (SAFe convention not translated)
- WIP violation modal shows "Exceder o limite WIP de {n}"

---

## Technical Notes

### Liveblocks Integration

Room ID: `{orgId}:portfolio-kanban:{orgId}`

```typescript
// packages/collaboration/src/rooms.ts
export const getPortfolioRoom = (orgId: string) =>
  `${orgId}:portfolio-kanban:${orgId}`

// Presence schema
type PortfolioPresence = {
  cursor: { x: number; y: number } | null
  dragging: string | null // epicId being dragged
}

// Storage schema (CRDT)
type PortfolioStorage = LiveMap<string, { column: string; rank: number }>
```

### DND-Kit Setup

```typescript
// apps/app/app/(authenticated)/portfolio/_components/kanban-board.tsx
'use client'
import { DndContext, DragOverlay, closestCorners } from '@dnd-kit/core'
import { useRoom, useStorage, useMutation } from '@liveblocks/react'

export function PortfolioKanban({ initialEpics }: { initialEpics: Epic[] }) {
  // Optimistic local state + Liveblocks CRDT for multi-user sync
  const [activeEpic, setActiveEpic] = useState<Epic | null>(null)

  const handleDragEnd = useMutation(({ storage }, event) => {
    if (!event.over) return
    const newColumn = event.over.id as EpicStatus
    // WIP check before mutation
    // If WIP violation: show modal, await user decision
    // On confirm: storage.get('epicPositions').set(epicId, { column: newColumn, rank: ... })
    // Then: call server action to persist + transition state machine
  }, [])
}
```

### Server Action

```typescript
// apps/app/app/actions/portfolio-kanban/index.ts
export const moveEpicAction = withSecureAction(
  { schema: MoveEpicSchema, auditAction: 'epic.moved', auditResourceType: 'Epic' },
  async ({ epicId, toStatus, wipOverrideReason }, ctx) => {
    // Re-validate WIP limit on server (client check is cosmetic)
    // Execute state machine transition
    // If wipOverride: write DecisionLogEntry
    // Return updated epic
  }
)
```

### get-portfolio API

```typescript
// apps/app/app/api/portfolio/route.ts
// Composed payload (epics + themes + budgets + WIP counts)
// RLS: orgId filter on Epic
// Performance: join with strategic_themes, lean_budgets, feature counts
// Pagination: 50/column/page via cursor
// Cache: Upstash Redis 30s for column counts
```

---

## Dependencies

- Story-011 (state machine) — moves use the transition action
- Liveblocks `@liveblocks/react ^3.11.0` + `@liveblocks/node`
- DND-Kit `@dnd-kit/core ^6.1.0`
- `@repo/collaboration` auth handler
- Strategic themes model (Story-025 sets up themes; this story uses existing)

---

## Definition of Done

- [ ] Six-column Kanban renders all epics in correct columns < 2s
- [ ] Liveblocks room auth restricted to orgId-scoped rooms
- [ ] DND-Kit drag with WIP validation (client + server)
- [ ] WIP override modal with permission check + `DecisionLogEntry`
- [ ] REJECTED drop triggers reason modal (min 20 chars)
- [ ] Real-time: remote move visible < 1s
- [ ] URL-persisted filter state (ART, theme, owner, horizon, WSJF range)
- [ ] Strategic theme badges with correct colors
- [ ] PT-BR + ES localization of all UI strings
- [ ] `pnpm lint` passes, `pnpm typecheck` passes
