# Modular Platypus Agent — Planning Document

**Session Date:** 2026-05-31  
**Status:** PLANNING (READ-ONLY ANALYSIS — No changes yet)

---

## Overview

Planning 4 feature branches + 1 effort assessment for a SAFe/Agile backoffice:

1. **C1: "My Work" Widget** — Home dashboard widget showing user's assigned tasks/stories
2. **C2: Kanban Assignee Filter + Null Fix** — Team kanban board improvements
3. **F3: "Convert Blocker to Impediment" CTA** — Standup form integration
4. **C5: Copilot Markdown + Copy Button** — Assistant message improvements
5. **Search: Command Palette (⌘K)** — Effort assessment

---

## Discovery Findings

### Key File Paths & Structures

#### Home Dashboard (C1 "My Work")
- **File:** `apps/app/app/(authenticated)/components/home-dashboard.tsx`
- **Current Structure:**
  - Imports from `@/app/actions/arts` (getARTs, etc.)
  - Shows activation checklist, quick links (QUICK_LINKS array)
  - No "My Work" widget yet
  - Uses `appDesign` theme object for styling
- **Required Actions:**
  - ✓ `listStories` action supports `assigneeUserId` filter (in `/app/actions/stories/index.ts`)
  - **Action Signature:** `listStories(raw)` where raw can include `{ assigneeUserId, ... }`
  - Returns: `Result<Page<Story>>`

#### Kanban Board (C2)
- **File:** `apps/app/app/(authenticated)/teams/[teamId]/kanban/components/kanban-board.tsx`
- **Current State:**
  - Props: `KanbanBoardProps { stories: Story[]; sprintId: string }`
  - Story type includes: `id, title, storyPoints, status, priority, assigneeUserId | null`
  - CreateStoryDialog exists but **NOT collecting assignee on create** ✓ ISSUE FOUND
  - **Form fields missing:** `assigneeUserId` in handleSubmit
  - No assignee filter dropdown on board header
  - **Team members NOT passed to component** (verified in kanban/page.tsx)
  
- **Required Changes:**
  1. Add assignee filter dropdown above columns
  2. Fix createStory call to include assigneeUserId (currently missing)
  3. Fetch and pass team members from page.tsx → component

#### Standup Form (F3)
- **File:** `apps/app/app/(authenticated)/teams/[teamId]/standup/components/standup-form.tsx`
- **Current Blockers Field:**
  - Simple textarea: `blockers` state
  - Saved via `upsertStandupEntry({ teamId, date, yesterday, today, blockers })`
  - No action to convert blocker → impediment
  
- **createImpediment Action:**
  - **File:** `/app/actions/impediments/index.ts`
  - **Signature:** `createImpediment(raw: unknown) → Promise<Result<any>>`
  - **Required Fields:** `teamId`, `title`, `description?`, `ownerUserId?`, `status?`

#### Copilot Markdown (C5)
- **File:** `apps/app/app/(authenticated)/components/copilot/copilot-markdown.tsx`
- Emoji stripping is intentional — no changes needed
- Copy button: Must add to `copilot-thread-item.tsx` (not here)

#### Search Component
- **File:** `apps/app/app/(authenticated)/components/search.tsx`
- Simple form, posts to `/search` route
- Command Palette (⌘K): NOT implemented, would be 4-6 hours (new library + modal + fuzzy search)

---

## Detailed Planning per Feature

### C1: "My Work" Widget — Home Dashboard

**Files to Modify:** `home-dashboard.tsx`

**Implementation:**
1. Get current user ID from auth context
2. Call `listStories({ assigneeUserId: userId, limit: 10, page: 1 })`
3. Filter for not "DONE" status
4. Render grid of story cards with: title, sprint, status, SP, priority
5. Add section after activation checklist, before Atalhos

**Estimated Effort:** LOW (1-2 hours)

---

### C2: Kanban Assignee Filter + Fix Null assignee on Create

**Files to Modify:** 
- `kanban/page.tsx` (fetch team members)
- `kanban/components/kanban-board.tsx` (add filter + fix create)

**Implementation:**

1. **page.tsx:** Fetch team members (via getTeamById or separate query)
2. **kanban-board.tsx:**
   - Add `members` prop
   - Add `assigneeFilter` state
   - Add Select dropdown for filter above columns
   - Filter stories before rendering
   - In CreateStoryDialog: add assignee Select field
   - Fix createStory call to include `assigneeUserId`

**Estimated Effort:** MEDIUM (2-3 hours)

---

### F3: "Convert Blocker to Impediment" CTA

**Files to Modify:** `standup-form.tsx`

**Implementation:**
1. Import `createImpediment` action
2. Add state: `showConvertCTA` (show when blockers non-empty)
3. Add button below blockers textarea
4. onClick: call createImpediment with blockers text as title/description
5. Get currentUserId from session

**Estimated Effort:** LOW-MEDIUM (1-2 hours)

---

### C5: Copilot Markdown + Copy Button

**Files to Modify:** `copilot-thread-item.tsx`

**Implementation:**
1. Add state: `copySuccess`
2. Add handler: `handleCopyMessage` → `clipboard.writeText(stripReportTags(message))`
3. Render button in assistant message card (top-right)
4. Show checkmark feedback 2 seconds

**Estimated Effort:** LOW (30 mins - 1 hour)

---

### Search: Command Palette (⌘K) — Effort Assessment

**Objective:** Global ⌘K shortcut for search

**Approach:**
- Use cmdk or shadcn/ui command component
- Global keyboard listener
- Fuzzy search across entities (teams, sprints, stories, impediments)
- Modal dialog with results

**Estimated Effort:** MEDIUM-HIGH (4-6 hours)
- Library: 1 hour
- Keyboard listener: 30 mins
- Fuzzy search: 1-2 hours
- UI: 1-2 hours
- Testing: 30 mins

**Recommendation:** Phase 2 if timeline tight

---

## Implementation Order

```
Priority 1 (Independent, Low Risk):
├─ C5: Copy button (30 mins - 1 hour)
└─ F3: Convert blocker (1-2 hours)

Priority 2 (Medium Complexity):
├─ C1: My Work widget (1-2 hours)
└─ C2: Kanban assignee filter (2-3 hours)
   └─ Depends on: Team members query

Priority 3 (High Effort, Deferred):
└─ Search: Command palette (4-6 hours)
```

---

## Action Signatures (Verified)

```typescript
// Stories
listStories(raw: {
  page?: number,
  limit?: number,
  sprintId?: string,
  status?: string,
  assigneeUserId?: string,
  search?: string,
}) → Promise<Result<Page<Story>>>

createStory(raw: {
  sprintId: string,
  title: string,
  storyPoints: number,
  priority: string,
  status: string,
  assigneeUserId?: string,  // ⚠️ MISSING IN CODE — NEEDS FIX
}) → Promise<Result<Story>>

// Impediments
createImpediment(raw: {
  teamId: string,
  title: string,
  description?: string,
  ownerUserId?: string,
  status?: string,
}) → Promise<Result<Impediment>>

// Standup
upsertStandupEntry(raw: {
  teamId: string,
  date: Date,
  yesterday?: string,
  today?: string,
  blockers?: string,
}) → Promise<Result<StandupEntry>>
```

---

## Open Questions for Team

1. **C1 — My Work Widget**
   - [ ] Show stories only, or tasks/features too?
   - [ ] All open items, or current sprint only?
   - [ ] How many to show (limit vs. pagination)?

2. **C2 — Kanban Filter**
   - [ ] How to fetch team members? (getTeamById or separate query?)
   - [ ] Persist filter (localStorage)?
   - [ ] Should create dialog respect active filter?

3. **F3 — Convert Blocker**
   - [ ] Single impediment or parse blockers as list?
   - [ ] Clear textarea after convert?
   - [ ] Show confirmation/toast?

4. **C5 — Copy Button**
   - [ ] Copy stripped (no report tags) or full?
   - [ ] Disable while streaming?
   - [ ] Toast or icon feedback?

5. **Search — Command Palette**
   - [ ] Which library? (cmdk, shadcn/ui, custom)
   - [ ] Scope: teams/sprints/stories/impediments/features?
   - [ ] Fuzzy or simple search?
   - [ ] Phase 1 or Phase 2?

---

## Discovery Gaps (To Verify)

- [ ] Does `getTeamById(teamId)` return members?
- [ ] Does `listTeamMembers(teamId)` action exist?
- [ ] `stripReportTags()` function location?
- [ ] Current user context: useSession()? or props?
- [ ] Impediment schema exact requirements?

---

**Status:** Planning complete. Ready for implementation with team review.

**Total Estimated Effort (all features):**
- C1: 1-2 hours
- C2: 2-3 hours
- F3: 1-2 hours
- C5: 30 mins - 1 hour
- Search (phase 2): 4-6 hours

**Total Phase 1:** ~6-8 hours
**Total with Phase 2:** ~10-14 hours
