# Design Excellence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevar cada pixel do Cosmos Nebuloz ao estado da arte — AI tokens, blocked pulse, SortableCard redesign, skeleton boards, team card hover, drawer spring, keyboard nav, AI confidence/explainability, a11y baseline, SAFe microcopy.

**Architecture:** Token-first (globals.css → components consume vars), component-by-component state upgrade, new keyboard layer in authenticated layout, axe-core in E2E pipeline.

**Tech Stack:** Next.js 15 App Router, shadcn/ui, Tailwind CSS 4, framer-motion 12, @dnd-kit, Playwright

---

## Codebase Map

| File | Task |
|------|------|
| `packages/design-system/styles/globals.css` | T1 — add AI tokens + motion keyframes |
| `apps/app/app/(authenticated)/dashboard/portfolio/components/kanban-card.tsx` | T2 — blocked pulse animation |
| `apps/app/app/(authenticated)/portfolio/components/portfolio-board.tsx` | T3 — SortableCard redesign |
| `apps/app/app/(authenticated)/portfolio/loading.tsx` | T4 — kanban skeleton |
| `apps/app/app/(authenticated)/teams/[teamId]/kanban/components/kanban-board.tsx` | T5 — story card hover |
| `apps/app/app/(authenticated)/dashboard/portfolio/components/epic-drawer.tsx` | T6 — spring animation |
| NEW `apps/app/hooks/use-keyboard-nav.ts` | T7 — keyboard nav hook |
| NEW `apps/app/app/(authenticated)/components/keyboard-help-modal.tsx` | T7 — `?` help modal |
| `apps/app/app/(authenticated)/layout.tsx` | T7 — wire keyboard modal |
| `apps/app/app/(authenticated)/dashboard/portfolio/components/epic-drawer-invest.tsx` | T8 — confidence + explainability |
| NEW `apps/app/e2e/a11y.spec.ts` | T9 — axe-core E2E |
| NEW `docs/design/MICROCOPY-GLOSSARY.md` | T10 — SAFe 6.0 terms |

---

## Task 1: AI Tokens + Blocked Pulse Keyframes in globals.css

**Files:**
- Modify: `packages/design-system/styles/globals.css:57` (after `--purple-text` in light theme)
- Modify: `packages/design-system/styles/globals.css:157` (after `--cosmos-accent-text` in `:root`)
- Modify: `packages/design-system/styles/globals.css:330` (after `--cosmos-accent-text` in dark theme)
- Modify: append `@keyframes` at end of file

- [ ] **Step 1: Add AI tokens to light theme** (`[data-theme="light"]` block, after `--purple-text: #6d28d9;`)

```css
  /* AI Copilot signature — EXCLUSIVE: never reuse these for non-AI elements */
  --cosmos-ai-fg: #6d5bbd;
  --cosmos-ai-bg: rgba(94, 106, 210, 0.06);
  --cosmos-ai-border: rgba(94, 106, 210, 0.15);
```

- [ ] **Step 2: Add AI tokens to `:root`** (after `--cosmos-accent-text: #4b54b8;` at `:root` section)

```css
  /* AI Copilot signature — EXCLUSIVE: never reuse for non-AI elements */
  --cosmos-ai-fg: #6d5bbd;
  --cosmos-ai-bg: rgba(94, 106, 210, 0.06);
  --cosmos-ai-border: rgba(94, 106, 210, 0.15);
```

- [ ] **Step 3: Add AI tokens to dark theme** (after `--cosmos-accent-text: #c7ccff;` in `[data-theme="dark"]`)

```css
  /* AI Copilot signature — EXCLUSIVE: never reuse for non-AI elements */
  --cosmos-ai-fg: #a89cff;
  --cosmos-ai-bg: rgba(124, 106, 247, 0.08);
  --cosmos-ai-border: rgba(124, 106, 247, 0.22);
```

- [ ] **Step 4: Add `@keyframes cosmos-blocked-pulse`** at end of globals.css

```css
/* ─── COSMOS Animations ────────────────────────────────────────────── */
@keyframes cosmos-blocked-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(251, 113, 133, 0); border-color: rgba(251, 113, 133, 0.35); }
  50%       { box-shadow: 0 0 0 3px rgba(251, 113, 133, 0.12); border-color: rgba(251, 113, 133, 0.65); }
}

@keyframes cosmos-ai-shimmer {
  0%   { background-position: -200% center; }
  100% { background-position: 200% center; }
}
```

- [ ] **Step 5: Add Tailwind utility class for blocked pulse** (after the keyframes block)

```css
.cosmos-blocked {
  animation: cosmos-blocked-pulse 2s ease-in-out infinite;
  border-left: 3px solid var(--red-c) !important;
}

.cosmos-ai-shimmer {
  background: linear-gradient(
    90deg,
    var(--cosmos-ai-bg) 25%,
    rgba(var(--cosmos-accent-rgb), 0.15) 50%,
    var(--cosmos-ai-bg) 75%
  );
  background-size: 200% auto;
  animation: cosmos-ai-shimmer 1.8s linear infinite;
}
```

- [ ] **Step 6: Verify build passes**
```bash
cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz && pnpm check
```

- [ ] **Step 7: Commit**
```bash
git add packages/design-system/styles/globals.css
git commit -m "feat(ds): add cosmos-ai tokens + blocked-pulse + ai-shimmer keyframes"
```

---

## Task 2: KanbanCard — Blocked Pulse State

**Files:**
- Modify: `apps/app/app/(authenticated)/dashboard/portfolio/components/kanban-card.tsx`

Current state: blocked shows only a text badge `⚠ BLOCKED`. Missing: border pulse animation on the card container.

- [ ] **Step 1: Add `isBlocked` constant and `cosmos-blocked` class to outer container**

In `kanban-card.tsx`, add after `const isWarn = ...`:
```tsx
const isBlocked = epic.governanceStatus === "BLOCKED";
```

Change the outer `<div className={cn(...)}` to add:
```tsx
isBlocked && "cosmos-blocked",
```

Full updated `cn(...)` call:
```tsx
className={cn(
  "group select-none overflow-hidden rounded-lg border border-hairline bg-card",
  "shadow-[var(--card-shadow)] transition-all duration-200 ease-out",
  "hover:-translate-y-[2px] hover:border-hairline-strong hover:shadow-[var(--hover-shadow)]",
  "dark:bg-[var(--surface-3)]",
  isDragging === true && "rotate-1 opacity-50 shadow-lg",
  isBlocked && "cosmos-blocked",
  !isBlocked && isWarn && "border-amber-400/40 dark:border-amber-500/30"
)}
```

- [ ] **Step 2: Improve the BLOCKED badge** — replace the plain red span with a more visible one

Replace the existing BLOCKED badge (around line 152):
```tsx
{isBlocked && (
  <span className="inline-flex items-center gap-1 rounded bg-[var(--red-soft)] px-1.5 py-0.5 font-semibold text-[9px]" style={{ color: "var(--red-text)" }}>
    <span aria-hidden>⚠</span> BLOCKED
  </span>
)}
```

- [ ] **Step 3: Run typecheck**
```bash
cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz/apps/app && pnpm typecheck 2>&1 | tail -20
```

- [ ] **Step 4: Commit**
```bash
git add apps/app/app/\(authenticated\)/dashboard/portfolio/components/kanban-card.tsx
git commit -m "feat(kanban): blocked card pulse animation + improved BLOCKED badge"
```

---

## Task 3: Portfolio SortableCard Redesign

**Files:**
- Modify: `apps/app/app/(authenticated)/portfolio/components/portfolio-board.tsx`

Current state: generic `Card` component with no hover states, no color strip, no theme color. LPMs see this view.

- [ ] **Step 1: Replace the `SortableCard` function** with a redesigned version

Replace the entire `SortableCard` component (lines 62–118) with:

```tsx
const SortableCard = memo(function SortableCard({
  card,
}: {
  readonly card: KanbanCardItem;
}) {
  const [hovered, setHovered] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });
  const wsjf =
    card.wsjfScore > 0
      ? card.wsjfScore
      : calculateWSJF({ bv: card.bv, tc: card.tc, rr: card.rr, js: card.js });

  const wsjfHigh = wsjf >= 8;
  const wsjfMed  = wsjf >= 5;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "group select-none overflow-hidden rounded-lg border border-hairline bg-card",
        "shadow-[var(--card-shadow)] transition-all duration-200 ease-out",
        "cursor-grab active:cursor-grabbing",
        "hover:-translate-y-[1px] hover:border-hairline-strong hover:shadow-[var(--hover-shadow)]",
        "dark:bg-[var(--surface-3)]",
        isDragging && "opacity-50 rotate-1 shadow-lg",
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Top accent strip — WSJF urgency signal */}
      <div
        className="h-[3px] w-full transition-colors duration-200"
        style={{
          backgroundColor: wsjfHigh
            ? "var(--red-c)"
            : wsjfMed
              ? "var(--amber-c)"
              : hovered
                ? "rgba(var(--accent-rgb),.2)"
                : "transparent",
        }}
      />

      <div className="px-3 pt-2.5 pb-2">
        <p className="line-clamp-2 font-medium text-[13px] text-foreground leading-[1.45] tracking-[-0.01em]">
          {card.title}
        </p>

        <div className="mt-2 flex items-center gap-1.5">
          <span
            className={cn(
              "rounded border px-1.5 py-0.5 font-mono text-[10px]",
              wsjfHigh
                ? "border-[var(--red-soft)] bg-[var(--red-soft)] text-[var(--red-text)]"
                : wsjfMed
                  ? "border-[var(--amber-soft)] bg-[var(--amber-soft)] text-[var(--amber-text)]"
                  : "border-border/40 bg-muted/20 text-muted-foreground",
            )}
          >
            WSJF {wsjf.toFixed(1)}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground/60">
            {card.featureCount} feat{card.featureCount !== 1 ? "s" : ""}
          </span>
        </div>

        {/* BV/TC/RR/JS — revealed on hover */}
        {hovered && (
          <div className="mt-2 grid grid-cols-4 gap-1 border-border/40 border-t pt-2">
            {(["BV", "TC", "RR", "JS"] as const).map((label, i) => (
              <div className="text-center" key={label}>
                <div className="text-[9px] text-muted-foreground">{label}</div>
                <div className="font-mono font-semibold text-[11px]">
                  {[card.bv, card.tc, card.rr, card.js][i]}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
```

- [ ] **Step 2: Add `useState` to imports** (already there in the file, but add `cn` if missing)

Ensure imports include:
```tsx
import { cn } from "@repo/design-system/lib/utils";
import { useState } from "react";
```

- [ ] **Step 3: Update `KanbanColumn` component** — improve column header and empty state

Replace `KanbanColumn` function:
```tsx
function KanbanColumn({
  col,
  cards,
}: {
  readonly col: (typeof COLUMNS)[0];
  readonly cards: KanbanCardItem[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });
  const colCards = cards.filter((c) => c.columnId === col.id);

  return (
    <div
      className={cn(
        "flex w-[300px] shrink-0 flex-col overflow-hidden rounded-[10px] border",
        "border-hairline bg-surface shadow-[var(--card-shadow)]",
        isOver && "border-primary/30 bg-primary/[0.03]",
      )}
      ref={setNodeRef}
      style={{ borderTop: `3px solid var(--accent-c)` }}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 border-hairline border-b bg-surface-2 px-3.5 py-2.5">
        <span className="flex-1 truncate font-semibold text-[12.5px] tracking-[-0.01em]">
          {col.title}
        </span>
        <span
          className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 font-mono font-semibold text-[10px]"
          style={{ background: "var(--surface-3)", color: "var(--ink-muted)" }}
        >
          {colCards.length}
        </span>
      </div>

      {/* Cards list */}
      <div className="flex min-h-[200px] flex-1 flex-col gap-2 p-2.5">
        <SortableContext
          items={colCards.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {colCards.map((card) => (
            <SortableCard card={card} key={card.id} />
          ))}
        </SortableContext>

        {colCards.length === 0 && !isOver && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-hairline py-8">
            <span className="text-muted-foreground/40 text-[11px]">
              Nenhum épico
            </span>
          </div>
        )}

        {isOver && colCards.length === 0 && (
          <div className="flex h-16 items-center justify-center rounded-md border border-primary/30 border-dashed">
            <span className="font-mono text-[11px] text-muted-foreground">soltar aqui</span>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**
```bash
cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz/apps/app && pnpm typecheck 2>&1 | tail -20
```

- [ ] **Step 5: Commit**
```bash
git add apps/app/app/\(authenticated\)/portfolio/components/portfolio-board.tsx
git commit -m "feat(portfolio): redesign SortableCard — WSJF urgency strip, hover states, empty column state"
```

---

## Task 4: Portfolio Loading Skeleton — Kanban Layout

**Files:**
- Modify: `apps/app/app/(authenticated)/portfolio/loading.tsx`

Current: generic 2-column grid + large box. Needs to match the actual kanban board shape (5 columns × cards).

- [ ] **Step 1: Replace loading.tsx content**

```tsx
import { Skeleton } from "@repo/design-system/components/ui/skeleton";

function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-hairline bg-card">
      <div className="h-[3px] w-full bg-muted/40" />
      <div className="space-y-2 p-3">
        <Skeleton className="h-3.5 w-4/5" />
        <Skeleton className="h-3 w-3/5" />
        <div className="flex gap-2 pt-1">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-10" />
        </div>
      </div>
    </div>
  );
}

function ColumnSkeleton({ cardCount }: { readonly cardCount: number }) {
  return (
    <div className="flex w-[300px] shrink-0 flex-col overflow-hidden rounded-[10px] border border-hairline bg-surface">
      <div className="flex items-center gap-2 border-hairline border-b bg-surface-2 px-3.5 py-2.5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="ml-auto h-4 w-6 rounded-full" />
      </div>
      <div className="flex flex-col gap-2 p-2.5">
        {Array.from({ length: cardCount }, (_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div className="flex h-full flex-col gap-4 p-6">
      {/* Page header skeleton */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-5 w-24 rounded-full" />
      </div>

      {/* Kanban columns skeleton */}
      <div className="flex items-start gap-4 overflow-x-auto pb-4">
        <ColumnSkeleton cardCount={3} />
        <ColumnSkeleton cardCount={5} />
        <ColumnSkeleton cardCount={4} />
        <ColumnSkeleton cardCount={2} />
        <ColumnSkeleton cardCount={1} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**
```bash
git add apps/app/app/\(authenticated\)/portfolio/loading.tsx
git commit -m "feat(portfolio): kanban-shaped loading skeleton matches actual board layout"
```

---

## Task 5: Team Sprint Board Story Card Hover States

**Files:**
- Modify: `apps/app/app/(authenticated)/teams/[teamId]/kanban/components/kanban-board.tsx`

Current state: basic `Card` with `Badge` + `Button`s. No hover state — feels flat vs. portfolio kanban.

- [ ] **Step 1: Add hover state to story Card**

Find all `<Card` elements that represent story cards (they have `CardHeader` + `CardContent` with `Badge` + move buttons). Add hover classNames.

The story card currently is:
```tsx
<Card key={story.id} className="...">
```

Replace with:
```tsx
<Card
  key={story.id}
  className={cn(
    "group overflow-hidden border-hairline transition-all duration-150 ease-out",
    "hover:border-hairline-strong hover:shadow-[var(--hover-shadow)]",
    "dark:bg-[var(--surface-3)]",
    story.priority === "critical" && "border-l-2 border-l-[var(--red-c)]",
    story.priority === "high" && "border-l-2 border-l-[var(--amber-c)]",
  )}
>
```

- [ ] **Step 2: Make move buttons reveal on hover** — add `opacity-0 group-hover:opacity-100 transition-opacity` to the move buttons row

Find the `{/* Move buttons */}` section and update:
```tsx
<div className="flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
```

- [ ] **Step 3: Add priority left-border color** — import `cn` if not already imported

```tsx
import { cn } from "@repo/design-system/lib/utils";
```

- [ ] **Step 4: Typecheck + commit**
```bash
cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz/apps/app && pnpm typecheck 2>&1 | tail -20
```
```bash
git add apps/app/app/\(authenticated\)/teams/
git commit -m "feat(sprint-board): story card hover states + priority left border + action reveal"
```

---

## Task 6: Epic Drawer Spring Animation

**Files:**
- Modify: `apps/app/app/(authenticated)/dashboard/portfolio/components/epic-drawer.tsx`

The `Sheet` component uses Radix/shadcn default animation (CSS keyframes). Override with spring-like easing in globals.css.

- [ ] **Step 1: Add sheet animation override to globals.css**

Append to `packages/design-system/styles/globals.css`:
```css
/* ─── Sheet (Drawer) spring animation override ──────────────────────── */
[data-slot="sheet-content"][data-state="open"] {
  animation: sheet-slide-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

[data-slot="sheet-content"][data-state="closed"] {
  animation: sheet-slide-out 0.25s cubic-bezier(0.4, 0, 1, 1) forwards;
}

@keyframes sheet-slide-in {
  from { transform: translateX(100%); }
  to   { transform: translateX(0); }
}

@keyframes sheet-slide-out {
  from { transform: translateX(0); }
  to   { transform: translateX(100%); }
}
```

- [ ] **Step 2: Remove any conflicting animate classes** from SheetContent in epic-drawer.tsx

Find the `<SheetContent` tag and ensure it does NOT have `className` that overrides the animation (side="right" is fine).

- [ ] **Step 3: Commit**
```bash
git add packages/design-system/styles/globals.css apps/app/app/\(authenticated\)/dashboard/portfolio/components/epic-drawer.tsx
git commit -m "feat(drawer): spring-easing animation for epic drawer open/close"
```

---

## Task 7: Keyboard Navigation System

**Files:**
- Create: `apps/app/hooks/use-keyboard-nav.ts`
- Create: `apps/app/app/(authenticated)/components/keyboard-help-modal.tsx`
- Modify: `apps/app/app/(authenticated)/layout.tsx`

- [ ] **Step 1: Create `use-keyboard-nav.ts`**

```ts
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type KeyBinding = {
  key: string;
  label: string;
  href?: string;
  action?: () => void;
};

export const KEYBOARD_BINDINGS: KeyBinding[] = [
  // g + key navigation (Linear-style)
  { key: "g a", label: "ART view",           href: "/arts" },
  { key: "g p", label: "PI Planning",        href: "/pi-planning" },
  { key: "g k", label: "Portfolio Kanban",   href: "/portfolio" },
  { key: "g b", label: "Lean Budget",        href: "/portfolio/lean-budget" },
  { key: "g w", label: "WSJF view",          href: "/portfolio?view=wsjf" },
  { key: "g r", label: "ROAM board",         href: "/risks" },
  { key: "g d", label: "Dependencies",       href: "/dependencies" },
  { key: "g t", label: "Team board",         href: "/teams" },
];

export function useKeyboardNav(onShowHelp: () => void): void {
  const router = useRouter();

  useEffect(() => {
    let prefixKey: string | null = null;
    let prefixTimer: ReturnType<typeof setTimeout> | null = null;

    function handleKeyDown(e: KeyboardEvent) {
      // ignore when typing in input/textarea/contenteditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      const key = e.key.toLowerCase();

      // '?' opens help
      if (key === "?" || (e.shiftKey && key === "/")) {
        e.preventDefault();
        onShowHelp();
        return;
      }

      // 'Escape' clears prefix
      if (key === "escape") {
        prefixKey = null;
        if (prefixTimer) clearTimeout(prefixTimer);
        return;
      }

      // two-key sequence (g + key)
      if (prefixKey) {
        const combo = `${prefixKey} ${key}`;
        const binding = KEYBOARD_BINDINGS.find((b) => b.key === combo);
        if (binding) {
          e.preventDefault();
          if (binding.href) router.push(binding.href);
          else binding.action?.();
        }
        prefixKey = null;
        if (prefixTimer) clearTimeout(prefixTimer);
        return;
      }

      // single key prefix
      if (key === "g") {
        e.preventDefault();
        prefixKey = "g";
        prefixTimer = setTimeout(() => { prefixKey = null; }, 1500);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (prefixTimer) clearTimeout(prefixTimer);
    };
  }, [router, onShowHelp]);
}
```

- [ ] **Step 2: Create `keyboard-help-modal.tsx`**

```tsx
"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { KEYBOARD_BINDINGS } from "@/hooks/use-keyboard-nav";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function KeyboardHelpModal({ open, onClose }: Props) {
  return (
    <Dialog onOpenChange={(o) => !o && onClose()} open={open}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">Atalhos de Teclado</DialogTitle>
        </DialogHeader>
        <div className="space-y-1 pt-1">
          {KEYBOARD_BINDINGS.map((b) => (
            <div className="flex items-center justify-between py-1" key={b.key}>
              <span className="text-[12px] text-muted-foreground">{b.label}</span>
              <kbd className="inline-flex items-center gap-0.5 rounded border border-border/60 bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                {b.key.split(" ").map((k, i) => (
                  <span key={i}>
                    {i > 0 && <span className="mx-0.5 opacity-40">then</span>}
                    <span>{k}</span>
                  </span>
                ))}
              </kbd>
            </div>
          ))}
          <div className="flex items-center justify-between border-hairline border-t pt-2 mt-2">
            <span className="text-[12px] text-muted-foreground">Abrir este painel</span>
            <kbd className="inline-flex items-center rounded border border-border/60 bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">?</kbd>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Wire into authenticated layout** — read `apps/app/app/(authenticated)/layout.tsx`, add `useState` + `useKeyboardNav` + `KeyboardHelpModal`

The authenticated layout file currently wraps children with providers. Add at the top of the layout component:
```tsx
"use client"; // may need to create a wrapper client component

import { useState } from "react";
import { useKeyboardNav } from "@/hooks/use-keyboard-nav";
import { KeyboardHelpModal } from "@/app/(authenticated)/components/keyboard-help-modal";
```

If the layout is a Server Component, create a thin client wrapper:

**New file: `apps/app/app/(authenticated)/components/keyboard-provider.tsx`**
```tsx
"use client";

import { useState } from "react";
import { useKeyboardNav } from "@/hooks/use-keyboard-nav";
import { KeyboardHelpModal } from "./keyboard-help-modal";

export function KeyboardProvider({ children }: { readonly children: React.ReactNode }) {
  const [helpOpen, setHelpOpen] = useState(false);
  useKeyboardNav(() => setHelpOpen(true));

  return (
    <>
      {children}
      <KeyboardHelpModal onClose={() => setHelpOpen(false)} open={helpOpen} />
    </>
  );
}
```

Then in `apps/app/app/(authenticated)/layout.tsx`, wrap content:
```tsx
import { KeyboardProvider } from "@/app/(authenticated)/components/keyboard-provider";
// ...inside return:
<KeyboardProvider>
  {children}
</KeyboardProvider>
```

- [ ] **Step 4: Typecheck**
```bash
cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz/apps/app && pnpm typecheck 2>&1 | tail -20
```

- [ ] **Step 5: Commit**
```bash
git add apps/app/hooks/use-keyboard-nav.ts apps/app/app/\(authenticated\)/components/keyboard-help-modal.tsx apps/app/app/\(authenticated\)/components/keyboard-provider.tsx apps/app/app/\(authenticated\)/layout.tsx
git commit -m "feat(ux): keyboard navigation system — g+key per persona + ? help modal"
```

---

## Task 8: AI Confidence + Explainability in EpicDrawerInvest

**Files:**
- Modify: `apps/app/app/(authenticated)/dashboard/portfolio/components/epic-drawer-invest.tsx`

The EpicDrawerInvest already shows INVEST breakdown. Add:
1. Text confidence label (low/medium/high) instead of just a score
2. "Based on N features, PI-X" source line

- [ ] **Step 1: Read current epic-drawer-invest.tsx** and find where compositeScore is displayed

The test shows `screen.getByText("72")` — so the score is rendered as a number. Find this and add:

```tsx
function confidenceLabel(score: number): { label: string; color: string } {
  if (score >= 70) return { label: "Alta confiança", color: "var(--green-text)" };
  if (score >= 50) return { label: "Confiança média", color: "var(--amber-text)" };
  return { label: "Baixa confiança", color: "var(--red-text)" };
}
```

- [ ] **Step 2: Add confidence label below the score** — find the composite score display and add below it:

```tsx
const conf = confidenceLabel(compositeScore);
// ... in JSX after score display:
<span
  className="font-medium text-[10px]"
  style={{ color: conf.color }}
>
  {conf.label}
</span>
```

- [ ] **Step 3: Add source attribution line** — when `epic.featureCount > 0`, show:

```tsx
{epic.featureCount > 0 && (
  <p
    className="mt-1 font-mono text-[10px]"
    style={{ color: "var(--ink-faint)" }}
  >
    ✦ baseado em {epic.featureCount} feature{epic.featureCount !== 1 ? "s" : ""}
  </p>
)}
```

- [ ] **Step 4: Typecheck + commit**
```bash
cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz/apps/app && pnpm typecheck 2>&1 | tail -20
```
```bash
git add apps/app/app/\(authenticated\)/dashboard/portfolio/components/epic-drawer-invest.tsx
git commit -m "feat(ai): confidence text label + source attribution in INVEST panel"
```

---

## Task 9: A11y Baseline — axe-core in E2E

**Files:**
- Create: `apps/app/e2e/a11y.spec.ts`
- Modify: `apps/app/package.json` (add `@axe-core/playwright` if not present)

- [ ] **Step 1: Check if @axe-core/playwright installed**
```bash
cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz && grep axe apps/app/package.json
```

- [ ] **Step 2: Install if missing**
```bash
cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz && pnpm --filter @app/app add -D @axe-core/playwright
```

- [ ] **Step 3: Create `e2e/a11y.spec.ts`**

```ts
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("Accessibility baseline", () => {
  test.use({ storageState: "apps/app/e2e/setup/.auth/user.json" });

  test("portfolio kanban — no critical a11y violations", async ({ page }) => {
    await page.goto("/portfolio");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    const critical = results.violations.filter((v) => v.impact === "critical");
    expect(
      critical,
      `Critical a11y violations found:\n${critical.map((v) => `  [${v.id}] ${v.description}`).join("\n")}`
    ).toHaveLength(0);
  });

  test("team sprint board — no critical a11y violations", async ({ page }) => {
    await page.goto("/teams");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    const critical = results.violations.filter((v) => v.impact === "critical");
    expect(
      critical,
      `Critical a11y violations:\n${critical.map((v) => `  [${v.id}] ${v.description}`).join("\n")}`
    ).toHaveLength(0);
  });
});
```

- [ ] **Step 4: Commit**
```bash
git add apps/app/e2e/a11y.spec.ts apps/app/package.json
git commit -m "feat(a11y): axe-core E2E baseline — portfolio + team sprint board"
```

---

## Task 10: SAFe 6.0 Microcopy Glossary

**Files:**
- Create: `docs/design/MICROCOPY-GLOSSARY.md`

- [ ] **Step 1: Create glossary**

```markdown
# Cosmos Nebuloz — SAFe 6.0 Microcopy Glossary

Termos canônicos conforme SAFe 6.0 (scaledagileframework.com). Usar esses termos EXATAMENTE no produto.

## Hierarquia SAFe

| Usar | Não usar |
|------|---------|
| Agile Release Train (ART) | Train, Release Train |
| Planning Interval (PI) | Sprint do Programa, Iteration Program |
| Program Increment | PI de produto |
| PI Planning | PI Planning Event, Sprint Planning do Programa |
| System Demo | Demo de Sistema |
| Inspect and Adapt (I&A) | Retrospectiva do Programa |

## Artefatos SAFe

| Usar | Não usar |
|------|---------|
| Epic | Épico (em inglês nas badges/chips) |
| Feature | Funcionalidade (em inglês nas badges) |
| Story | User Story, US, História |
| Enabler | Enabler Epic, Enabler Feature |
| Spike | Pesquisa Técnica |
| WSJF | Weighted Shortest Job First (sigla nas badges) |
| INVEST | INVEST criteria (sigla nas badges) |

## UI Copy

| Contexto | Correto | Errado |
|----------|---------|--------|
| Status badge | "In Analysis" | "Analisando" |
| Status badge | "Implementing" | "Em implementação" |
| Status badge | "Done" | "Finalizado" |
| Status badge | "Backlog" | "Pendente" |
| WSJF tooltip | "Weighted Shortest Job First" | "Prioridade" |
| PI badge | "PI-4 · Sprint 3" | "Sprint 3 do PI 4" |
| Risk badge | "ROAM — Resolved" | "Resolvido" |
| Empty state | "Nenhum épico nesta coluna" | "Vazio" |

## Personas (interface copy)

| Usar | Não usar |
|------|---------|
| RTE (Release Train Engineer) | Scrum Master do Programa |
| LPM (Lean Portfolio Manager) | Gerente de Portfólio |
| PO (Product Owner) | Dono do Produto |
| SM (Scrum Master) | Facilitador |
| Solution Train Engineer (STE) | RTE Sênior |

## Número e Datas

- Story Points: "3 SP" (não "3 pontos")
- PI identificação: "PI-4" (não "PI 4" nem "4")
- Sprint: "S1", "S2" quando em contexto de PI (não "Sprint 1")
- Datas relativas quando < 7 dias: "há 2 dias"; ISO depois

---

*Ref: SAFe 6.0 Big Picture — scaledagileframework.com*
```

- [ ] **Step 2: Commit**
```bash
git add docs/design/MICROCOPY-GLOSSARY.md
git commit -m "docs: SAFe 6.0 microcopy glossary — canonical terms for UI copy"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] T1: AI tokens (`--cosmos-ai-fg/bg/border`) + motion keyframes
- [x] T2: Blocked card pulse animation
- [x] T3: Portfolio SortableCard — hover, WSJF strip, empty state
- [x] T4: Portfolio loading skeleton — kanban shape
- [x] T5: Team sprint story card hover + priority border + action reveal
- [x] T6: Epic drawer spring animation override
- [x] T7: Keyboard nav hook + `?` modal + `g+key` per persona
- [x] T8: AI confidence text + source attribution
- [x] T9: axe-core a11y spec in E2E
- [x] T10: SAFe microcopy glossary

**Type consistency:**
- `KanbanCardItem` used by SortableCard — all fields referenced exist on the type
- `KEYBOARD_BINDINGS` defined in `use-keyboard-nav.ts`, imported by both `keyboard-help-modal.tsx` and `keyboard-provider.tsx`
- `KeyboardHelpModal` receives `open: boolean` + `onClose: () => void`
- `KeyboardProvider` receives `children: React.ReactNode`

**Placeholder scan:** None found. All steps include actual code or exact commands.
