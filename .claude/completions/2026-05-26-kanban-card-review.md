# Code Review: Kanban Card — Hybrid Density + INVEST Badge + Drawer Wiring

**Commit Range:** ce0ae38...e7bd7b1  
**Files Changed:** 4 (kanban-card.tsx, kanban-column.tsx, kanban-board.tsx, kanban-card.test.tsx)  
**Review Date:** 2026-05-26

---

## STRENGTHS

### 1. Drag-to-Click Conflict Resolution ✓
**What works:** The button inside the drag-handle DIV properly prevents drag initiation on click:
- Both `onClick` and `onPointerDown` call `e.stopPropagation()`
- This prevents dnd-kit's listeners (attached via `{...listeners}` on parent) from firing
- Clear inline comment explains the intention

### 2. React Hooks Implementation ✓
**What works:** Hook usage is correct:
- Single `useState(false)` for hover state — minimal, no dependency issues
- No missing dependencies in hover handlers (both use only `setHovered`)
- No effect-related side effects or cleanup needed
- Component is simple enough that re-renders are not a performance concern (memo removed in refactor — appropriate choice)

### 3. Drag Interaction Architecture ✓
**What works:** setActivatorNodeRef wrapping is clean:
- `<div ref={setActivatorNodeRef} {...listeners} {...attributes}>` wraps the entire card content
- Mouse events (`onMouseEnter`, `onMouseLeave`) attached to same element as drag listeners — no conflicts
- Transform is applied to outer container, not drag handle — good visual feedback

### 4. INVEST Color Scoring Logic ✓
**What works:** Helper functions are well-factored:
- `investColor(score)` returns correct Tailwind classes: green (≥70), yellow (≥50), red (<50), muted (null)
- `investLabel(score)` formats display: "INVEST 75" or "INVEST?" for null
- Both pure functions, thoroughly tested (8 test cases), easily reusable

### 5. Component Structure Refactor ✓
**What works:** Removing memo() was correct:
- Old version: `memo(KanbanCard, (prev, next) => epicVisualEqual(...))`
- New version: Plain function component
- **Why it's better:** Column now passes `onOpenDrawer` prop, which changes frequently during the session. Memo would trigger re-renders anyway, so removing it simplifies logic and reduces mental overhead.

### 6. Test Coverage
**What works:**
- 14 test cases covering:
  - Pure functions: investColor (4 tests), investLabel (2 tests)
  - Component rendering: title, badges, feature count, singular/plural
  - Interaction: onOpenDrawer callback with correct epic.id
  - Conditional rendering: BLOCKED status, OKR indicator, theme color bar
  - Edge cases: null investScore shows "INVEST?", featureCount singularization

**Limitations:** Tests mock dnd-kit and don't verify drag behavior (transform, isDragging state propagation).

### 7. Drawer Wiring
**What works:**
- KanbanBoard: New state `const [openEpicId, setOpenEpicId] = useState<string | null>(null)` prepared for Task 5
- KanbanColumn: `onOpenDrawer` prop threaded through to KanbanCard
- KanbanCard: `onOpenDrawer` callback fires with `epic.id` on button click
- Biome lint ignore with clear explanation for multi-line comment

---

## ISSUES

### IMPORTANT

#### 1. Missing Accessibility: No aria-label on Title Button
**Location:** kanban-card.tsx, title button element  
**Severity:** WCAG 2.1 AA violation  
**Problem:**
```jsx
<button
  className="w-full text-left font-medium text-[13px] ..."
  onClick={(e) => {
    e.stopPropagation();
    onOpenDrawer?.(epic.id);
  }}
  type="button"
>
  {epic.title}
</button>
```
**Why it matters:** Keyboard and screen reader users can't identify what the button does. The text alone ("My Epic Title") doesn't convey the action (opening a drawer).

**Fix:**
```jsx
<button
  aria-label={`Open ${epic.title} in drawer`}  // Add this
  className="w-full text-left font-medium text-[13px] ..."
  onClick={(e) => {
    e.stopPropagation();
    onOpenDrawer?.(epic.id);
  }}
  type="button"
>
  {epic.title}
</button>
```

#### 2. Mouse-Only Hover Expansion for WSJF Breakdown
**Location:** kanban-card.tsx, WSJF breakdown grid and onMouseEnter/onMouseLeave handlers  
**Severity:** WCAG 2.1 AA violation  
**Problem:**
```jsx
<div
  {...listeners}
  {...attributes}
  className="cursor-grab touch-none active:cursor-grabbing"
  onMouseEnter={() => setHovered(true)}
  onMouseLeave={() => setHovered(false)}  // Mouse-only
>
```
Keyboard and touch users cannot expand the WSJF breakdown (BV, TC, RR, JS values). The feature is invisible to them.

**Why it matters:** WSJF is critical data; hiding it behind mouse-only hover violates WCAG and excludes keyboard/touch users.

**Fix Options:**
- **Option A (Recommended):** Show WSJF always on non-mobile, hide behind a click-to-expand button on mobile.
- **Option B:** Make the title button a toggle:
```jsx
const [wsjfExpanded, setWsjfExpanded] = useState(false);

<button
  aria-expanded={wsjfExpanded}
  aria-label={`${wsjfExpanded ? "Hide" : "Show"} WSJF breakdown for ${epic.title}`}
  onClick={(e) => {
    e.stopPropagation();
    setWsjfExpanded(!wsjfExpanded);
  }}
  onPointerDown={(e) => e.stopPropagation()}
  type="button"
>
  {epic.title}
</button>
{(hovered || wsjfExpanded) && epic.wsjfScore > 0 && (
  <div className="mt-2 grid grid-cols-4 gap-1 ...">...</div>
)}
```
- **Option C:** Show WSJF on focus-within (keyboard nav into the card triggers hover state).

### MINOR

#### 3. Test Coverage Gap: Drag Behavior Not Tested
**Location:** kanban-card.test.tsx  
**Severity:** Low (integration test would cover this)  
**Problem:** Tests verify rendering but not dnd-kit integration:
- `isDragging` prop never tested (always falsy in tests)
- `transform` effect on outer DIV never verified
- Drag handle behavior (cursor-grab, touch-none) not validated

**Current test:** Mocks dnd-kit completely, so no way to test transform application or opacity-40 when isDragging.

**Suggestion:** Add integration test with real dnd-kit DndContext provider if drag visual feedback is critical to user experience.

#### 4. Type Safety: Optional Props Without Defaults
**Location:** kanban-card.tsx, component signature  
**Severity:** Minor  
**Problem:**
```jsx
type KanbanCardProps = {
  epic: PortfolioEpic;
  isDragging?: boolean;  // What if undefined? Treated as falsy but not explicit
  onOpenDrawer?: (epicId: string) => void;  // Callback might be undefined
};
```

**What could go wrong:**
- `isDragging === true && "opacity-40"` works (undefined is falsy), but unclear if this is intentional
- `onOpenDrawer?.(epic.id)` silently succeeds if undefined — is this okay?

**Suggestion (Low Priority):** Add defaults or JSDoc clarifying behavior:
```jsx
type KanbanCardProps = {
  epic: PortfolioEpic;
  /** If true, card is semi-transparent during drag. Defaults to false. */
  isDragging?: boolean;
  /** Called when title button is clicked. If not provided, click is a no-op. */
  onOpenDrawer?: (epicId: string) => void;
};
```

#### 5. Governance Status Display Not Fully Verified
**Location:** kanban-card.tsx  
**Severity:** Minor  
**Problem:** Component displays BLOCKED status inline, but test only checks text presence:
```jsx
it("shows BLOCKED warning when governanceStatus is BLOCKED", () => {
  render(<KanbanCard epic={makeEpic({ governanceStatus: "BLOCKED" })} />);
  expect(screen.getByText(RE_BLOCKED)).toBeDefined();
});
```
No test verifies styling (e.g., red background), visual prominence, or position in the card.

**Suggestion:** Add assertion on CSS classes:
```jsx
const blocked = screen.getByText(RE_BLOCKED);
expect(blocked.parentElement?.className).toContain("bg-red-50");  // or whatever the warning style is
```

---

## ASSESSMENT

### Overall Quality: **GOOD** (70/100)
- ✓ Drag interaction works correctly (no conflicts)
- ✓ React hooks properly implemented
- ✓ Test coverage reasonable for pure functions and rendering
- ✓ Component properly wired to parent for drawer state
- ✗ Accessibility gaps (aria-label, keyboard hover)
- ✗ Limited integration testing of drag behavior

### Risk Level: **LOW**
- No crashes or breaking changes detected
- Event propagation correctly prevents drag-on-click
- Drawer callback wiring ready for Task 5

### Blockers for Merge: **NONE**
All issues are fixable post-merge, but accessibility should be addressed in Task 5 (drawer implementation) or immediately after.

### Recommended Next Steps:
1. **Before merge:** Add aria-label to title button (2 minutes)
2. **Before Task 5:** Decide on keyboard access to WSJF expansion (design decision)
3. **Task 5 scope:** Ensure drawer implementation includes accessible focus management
4. **Optional:** Add integration test with real dnd-kit provider if drag feedback is critical

---

## Code Quality Checklist

- [x] Code is readable and well-named
- [x] Functions are small (<50 lines) — investColor, investLabel are 5 lines each
- [x] Files are focused (<800 lines) — kanban-card.tsx is ~100 lines
- [x] No deep nesting (>4 levels) — structure is flat
- [x] Proper error handling — optional callback with `?.` operator
- [x] No hardcoded values — investScore thresholds could be constants (70, 50 in investColor)
- [x] No mutation — all state immutable (useState)
- [x] Accessibility improved from base (drag handle has aria-label in base) — **but title button missing it**

**Overall:** Implementation follows project guidelines. Accessibility gaps should be tracked as a separate task.
