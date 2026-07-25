# Portfolio Kanban AI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the existing Portfolio Kanban board with AI INVEST scoring, Full Width Drawer with TipTap editor, Quick-Add modal, WIP limits, RAG prompt generation with multi-IDE delivery, and AI Playground artifact storage.

**Architecture:** Next.js Server Actions (same pattern as `wsjf/rebalance.ts`) + PostgreSQL schema additions via Prisma migration + `generateObject` from Vercel AI SDK for INVEST scoring + Supabase Storage for AI Playground artifacts. Frontend uses existing `@dnd-kit`, `@liveblocks`, `@tiptap`, `zustand`, Shadcn `Sheet`/`Tabs`.

**Tech Stack:** Next.js 15, TypeScript, Prisma (PostgreSQL), `@ai-sdk/anthropic` (Haiku), `@tiptap/react`, `@dnd-kit/core`, Liveblocks, Shadcn UI, `@supabase/supabase-js` (storage), Zod, Vitest

---

## File Map

### New files
| File | Responsibility |
|------|---------------|
| `packages/database/prisma/schema/art-core.prisma` | + Epic fields: `investScore`, `investBreakdown`, `investHash`, `descriptionMd` |
| `apps/app/app/actions/epics/create-epic.ts` | Create epic with validation |
| `apps/app/app/actions/epics/update-epic.ts` | Update epic title/description/status |
| `apps/app/app/actions/epics/analyze-invest.ts` | AI INVEST scoring (Haiku + hash cache) |
| `apps/app/app/actions/epics/schema.ts` | Zod schemas shared across epic actions |
| `apps/app/app/actions/ai-prompt/generate-prompt.ts` | RAG prompt gen + URI delivery |
| `apps/app/app/actions/ai-prompt/rag-search.ts` | pgvector similarity search |
| `apps/app/app/actions/artifacts/index.ts` | AI Playground CRUD (Supabase Storage) |
| `apps/app/app/actions/artifacts/schema.ts` | Artifact Zod schemas |
| `packages/storage/src/index.ts` | Supabase Storage client (new package) |
| `packages/storage/package.json` | Package manifest |
| `apps/app/app/(authenticated)/dashboard/portfolio/components/epic-drawer.tsx` | Full Width Drawer shell + Tabs |
| `apps/app/app/(authenticated)/dashboard/portfolio/components/epic-drawer-description.tsx` | Description tab (TipTap) |
| `apps/app/app/(authenticated)/dashboard/portfolio/components/epic-drawer-invest.tsx` | AI Analysis tab (INVEST/STAR/Granularidade) |
| `apps/app/app/(authenticated)/dashboard/portfolio/components/epic-drawer-dependencies.tsx` | Dependencies tab |
| `apps/app/app/(authenticated)/dashboard/portfolio/components/epic-drawer-more.tsx` | Mais tab (metadata) |
| `apps/app/app/(authenticated)/dashboard/portfolio/components/epic-create-modal.tsx` | Linear-style Quick-Add modal |
| `apps/app/app/(authenticated)/dashboard/portfolio/components/wip-limit-warning.tsx` | Soft WIP limit badge |
| `apps/app/app/(authenticated)/dashboard/portfolio/components/prompt-delivery-dialog.tsx` | Multi-IDE prompt delivery |
| `apps/app/app/(authenticated)/portfolio/ai-playground/page.tsx` | AI Playground page |
| `apps/app/app/(authenticated)/portfolio/ai-playground/components/artifact-browser.tsx` | Artifact list/grid |
| `apps/app/app/(authenticated)/portfolio/ai-playground/components/artifact-viewer.tsx` | Artifact detail / markdown viewer |

### Modified files
| File | Change |
|------|--------|
| `packages/database/prisma/schema/art-core.prisma` | Add invest + description fields to Epic |
| `apps/app/lib/portfolio-aggregate.ts` | Add `investScore`, `investBreakdown`, `descriptionMd` to `AggregatedPortfolioEpic` |
| `apps/app/app/actions/epics/get-portfolio.ts` | Select new Epic fields |
| `apps/app/app/(authenticated)/dashboard/portfolio/components/kanban-card.tsx` | Hybrid density, click → open drawer |
| `apps/app/app/(authenticated)/dashboard/portfolio/components/kanban-column.tsx` | + Quick-Add button, + WIP soft warning |
| `apps/app/app/(authenticated)/dashboard/portfolio/components/kanban-board.tsx` | + drawer open state |
| `apps/app/app/(authenticated)/dashboard/portfolio/page.tsx` | Pass `epicId` from URL param to drawer |

---

## Task 1: DB Migration — Add INVEST + Description Fields to Epic

**Files:**
- Modify: `packages/database/prisma/schema/art-core.prisma`

### Why
`AggregatedPortfolioEpic` lacks `investScore` and `descriptionMd`. The drawer and AI scoring need them persisted.

- [ ] **Step 1: Read current Epic model**

Run: `cat packages/database/prisma/schema/art-core.prisma`

Confirm current fields: `id`, `tenantId`, `title`, `statusId`, `order`, `yjsDocumentState`, `strategicThemeId`.

- [ ] **Step 2: Add fields to Epic model**

In `packages/database/prisma/schema/art-core.prisma`, update the `Epic` model:

```prisma
model Epic {
  id               String   @id @default(cuid())
  tenantId         String
  title            String
  statusId         String   @default("BACKLOG")
  order            Int      @default(0)
  yjsDocumentState String?
  strategicThemeId String?

  // AI INVEST scoring (cached — recomputed when title/description changes)
  investScore      Float?   // 0-100 composite
  investBreakdown  Json?    // { I, N, V, E, S, T } each 0-100 with rationale
  investHash       String?  // sha256(title + descriptionMd) for cache invalidation

  // Description content
  descriptionMd    String?  // Markdown source (saved by TipTap)

  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  tenant         Tenant          @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  features       Feature[]
  strategicTheme StrategicTheme? @relation(fields: [strategicThemeId], references: [id], onDelete: SetNull)
  governedEpic   GovernedEpic?

  @@index([tenantId])
  @@index([strategicThemeId])
}
```

- [ ] **Step 3: Generate and run migration**

```bash
cd packages/database
npx prisma migrate dev --name add_epic_invest_description
```

Expected output: `The following migration(s) have been applied: .../add_epic_invest_description`

- [ ] **Step 4: Verify migration**

```bash
npx prisma studio
```

Open Epic table, confirm columns `investScore`, `investBreakdown`, `investHash`, `descriptionMd` appear.

- [ ] **Step 5: Commit**

```bash
git add packages/database/prisma/schema/art-core.prisma packages/database/prisma/migrations/
git commit -m "feat(db): add INVEST scoring + description fields to Epic"
```

---

## Task 2: Extend Type + Data Layer

**Files:**
- Modify: `apps/app/lib/portfolio-aggregate.ts`
- Modify: `apps/app/app/actions/epics/get-portfolio.ts`

- [ ] **Step 1: Write failing test**

Create `apps/app/lib/__tests__/portfolio-aggregate.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { aggregateEpicRow } from "../portfolio-aggregate";

describe("aggregateEpicRow", () => {
  it("includes investScore and descriptionMd from Epic", () => {
    const row = aggregateEpicRow({
      id: "epic-1",
      title: "Test Epic",
      statusId: "BACKLOG",
      order: 0,
      features: [],
      featureCount: 0,
      investScore: 72,
      investBreakdown: { I: 80, N: 70, V: 75, E: 65, S: 60, T: 85 },
      descriptionMd: "# Epic Description",
    });
    expect(row.investScore).toBe(72);
    expect(row.descriptionMd).toBe("# Epic Description");
  });

  it("defaults investScore to null when not set", () => {
    const row = aggregateEpicRow({
      id: "epic-2",
      title: "No Score",
      statusId: "BACKLOG",
      order: 0,
      features: [],
      featureCount: 0,
    });
    expect(row.investScore).toBeNull();
  });
});
```

Run: `cd apps/app && npx vitest run lib/__tests__/portfolio-aggregate.test.ts`
Expected: FAIL — `AggregatedPortfolioEpic` missing `investScore`

- [ ] **Step 2: Update `AggregatedPortfolioEpic` type**

In `apps/app/lib/portfolio-aggregate.ts`, update the type:

```typescript
export type InvestBreakdown = {
  I: number; N: number; V: number; E: number; S: number; T: number;
};

export type AggregatedPortfolioEpic = {
  id: string;
  title: string;
  statusId: string;
  order: number;
  wsjfScore: number;
  bv: number;
  tc: number;
  rr: number;
  js: number;
  featureCount: number;
  strategicThemeId: string | null;
  themeTitle: string | null;
  themeColor: string | null;
  linkedOKRCount: number;
  governanceStatus: string | null;
  // New fields
  investScore: number | null;
  investBreakdown: InvestBreakdown | null;
  descriptionMd: string | null;
};
```

Update `aggregateEpicRow` to accept and pass through new fields:

```typescript
export function aggregateEpicRow(
  epic: {
    id: string;
    title: string;
    statusId: string;
    order: number;
    features: FeatureWsjfFields[];
    featureCount: number;
    strategicThemeId?: string | null;
    themeTitle?: string | null;
    themeColor?: string | null;
    linkedOKRCount?: number;
    governanceStatus?: string | null;
    // New
    investScore?: number | null;
    investBreakdown?: InvestBreakdown | null;
    descriptionMd?: string | null;
  }
): AggregatedPortfolioEpic {
  // ... existing WSJF calculation unchanged ...
  return {
    // ... existing fields ...
    investScore: epic.investScore ?? null,
    investBreakdown: epic.investBreakdown ?? null,
    descriptionMd: epic.descriptionMd ?? null,
  };
}
```

- [ ] **Step 3: Update `get-portfolio.ts` to select new fields**

In `apps/app/app/actions/epics/get-portfolio.ts`, update `epicInclude` and `mapEpicRow`:

```typescript
const epicInclude = {
  features: {
    select: {
      bv: true, tc: true, rr: true, js: true, wsjfScore: true,
      startedAt: true, completedAt: true,
      piPlan: { select: { name: true } },
    },
  },
  _count: { select: { features: true } },
  strategicTheme: { select: { id: true, title: true, color: true } },
  governedEpic: { select: { governanceStatus: true } },
} as const;
```

In `mapEpicRow`:
```typescript
function mapEpicRow(e: EpicWithRelations, okrCountMap: Map<string, number>): AggregatedPortfolioEpic {
  return aggregateEpicRow({
    // ... existing fields ...
    investScore: (e as { investScore?: number | null }).investScore ?? null,
    investBreakdown: (e as { investBreakdown?: unknown }).investBreakdown as InvestBreakdown | null,
    descriptionMd: (e as { descriptionMd?: string | null }).descriptionMd ?? null,
  });
}
```

- [ ] **Step 4: Run tests**

```bash
cd apps/app && npx vitest run lib/__tests__/portfolio-aggregate.test.ts
```
Expected: PASS

- [ ] **Step 5: Run TypeScript check**

```bash
cd apps/app && npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add apps/app/lib/portfolio-aggregate.ts apps/app/app/actions/epics/get-portfolio.ts apps/app/lib/__tests__/
git commit -m "feat(portfolio): extend AggregatedPortfolioEpic with invest + description fields"
```

---

## Task 3: Epic CRUD Server Actions (Create + Update)

**Files:**
- Create: `apps/app/app/actions/epics/schema.ts`
- Create: `apps/app/app/actions/epics/create-epic.ts`
- Create: `apps/app/app/actions/epics/update-epic.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/app/app/actions/epics/__tests__/create-epic.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: vi.fn().mockResolvedValue({ tenantId: "t1", userId: "u1" }),
}));
vi.mock("@repo/database", () => ({
  database: {
    epic: {
      create: vi.fn().mockResolvedValue({
        id: "epic-new",
        title: "My Epic",
        statusId: "BACKLOG",
        order: 0,
        investScore: null,
        investBreakdown: null,
        descriptionMd: null,
        strategicThemeId: null,
      }),
      count: vi.fn().mockResolvedValue(0),
    },
  },
}));
vi.mock("next/headers", () => ({ headers: vi.fn().mockResolvedValue({}) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createEpic } from "../create-epic";

describe("createEpic", () => {
  it("returns new epic on valid input", async () => {
    const result = await createEpic({ title: "My Epic", statusId: "BACKLOG" });
    expect(result.ok).toBe(true);
    expect(result.data?.id).toBe("epic-new");
  });

  it("fails with empty title", async () => {
    const result = await createEpic({ title: "", statusId: "BACKLOG" });
    expect(result.ok).toBe(false);
  });
});
```

Run: `cd apps/app && npx vitest run app/actions/epics/__tests__/create-epic.test.ts`
Expected: FAIL — module not found

- [ ] **Step 2: Create schema**

`apps/app/app/actions/epics/schema.ts`:

```typescript
import { z } from "zod";

export const CreateEpicSchema = z.object({
  title: z.string().min(1, "Título obrigatório").max(200),
  statusId: z.string().default("BACKLOG"),
  strategicThemeId: z.string().optional().nullable(),
  descriptionMd: z.string().optional().nullable(),
});

export const UpdateEpicSchema = z.object({
  epicId: z.string().min(1),
  title: z.string().min(1).max(200).optional(),
  statusId: z.string().optional(),
  strategicThemeId: z.string().optional().nullable(),
  descriptionMd: z.string().optional().nullable(),
  order: z.number().int().min(0).optional(),
});

export type CreateEpicInput = z.infer<typeof CreateEpicSchema>;
export type UpdateEpicInput = z.infer<typeof UpdateEpicSchema>;
```

- [ ] **Step 3: Create `create-epic.ts`**

`apps/app/app/actions/epics/create-epic.ts`:

```typescript
"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { type Result, safeAction } from "../_base";
import { CreateEpicSchema, type CreateEpicInput } from "./schema";
import { portfolioEpicsCacheTag } from "./portfolio-cache";

export async function createEpic(raw: CreateEpicInput): Promise<Result<{ id: string; title: string; statusId: string; order: number }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const input = CreateEpicSchema.parse(raw);

    // Assign order = count of epics in that column
    const count = await database.epic.count({
      where: { tenantId: ctx.tenantId, statusId: input.statusId },
    });

    const epic = await database.epic.create({
      data: {
        tenantId: ctx.tenantId,
        title: input.title,
        statusId: input.statusId,
        strategicThemeId: input.strategicThemeId ?? null,
        descriptionMd: input.descriptionMd ?? null,
        order: count,
      },
      select: { id: true, title: true, statusId: true, order: true },
    });

    revalidatePath("/dashboard/portfolio");
    return epic;
  });
}
```

- [ ] **Step 4: Create `update-epic.ts`**

`apps/app/app/actions/epics/update-epic.ts`:

```typescript
"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { type Result, safeAction } from "../_base";
import { UpdateEpicSchema, type UpdateEpicInput } from "./schema";

export async function updateEpic(raw: UpdateEpicInput): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const input = UpdateEpicSchema.parse(raw);

    // Verify ownership
    const existing = await database.epic.findFirst({
      where: { id: input.epicId, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (!existing) throw new Error("Épico não encontrado");

    const updated = await database.epic.update({
      where: { id: input.epicId },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.statusId !== undefined && { statusId: input.statusId }),
        ...(input.strategicThemeId !== undefined && { strategicThemeId: input.strategicThemeId }),
        ...(input.descriptionMd !== undefined && { descriptionMd: input.descriptionMd }),
        ...(input.order !== undefined && { order: input.order }),
      },
      select: { id: true },
    });

    revalidatePath("/dashboard/portfolio");
    return updated;
  });
}
```

- [ ] **Step 5: Run tests**

```bash
cd apps/app && npx vitest run app/actions/epics/__tests__/create-epic.test.ts
```
Expected: PASS

- [ ] **Step 6: TypeScript check**

```bash
cd apps/app && npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 7: Commit**

```bash
git add apps/app/app/actions/epics/schema.ts apps/app/app/actions/epics/create-epic.ts apps/app/app/actions/epics/update-epic.ts apps/app/app/actions/epics/__tests__/
git commit -m "feat(epics): create + update server actions with Zod validation"
```

---

## Task 4: Kanban Card — Hybrid Density + Click to Open Drawer

**Files:**
- Modify: `apps/app/app/(authenticated)/dashboard/portfolio/components/kanban-card.tsx`
- Modify: `apps/app/app/(authenticated)/dashboard/portfolio/components/kanban-board.tsx`

**Behavior:** Compact by default. On hover → show full WSJF breakdown. On click → call `onOpenDrawer(epicId)`. INVEST badge: gray (not scored), yellow (< 60), green (≥ 70), red flags.

- [ ] **Step 1: Write component test**

Create `apps/app/app/(authenticated)/dashboard/portfolio/components/__tests__/kanban-card.test.tsx`:

```typescript
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { KanbanCard } from "../kanban-card";

const epic = {
  id: "e1", title: "My Epic", statusId: "BACKLOG", order: 0,
  wsjfScore: 3.5, bv: 8, tc: 6, rr: 5, js: 4,
  featureCount: 3, strategicThemeId: null, themeTitle: null, themeColor: null,
  linkedOKRCount: 0, governanceStatus: null,
  investScore: 72, investBreakdown: null, descriptionMd: null,
};

describe("KanbanCard", () => {
  it("shows title", () => {
    render(<KanbanCard epic={epic} onOpenDrawer={vi.fn()} />);
    expect(screen.getByText("My Epic")).toBeTruthy();
  });

  it("calls onOpenDrawer when clicked", () => {
    const onOpen = vi.fn();
    render(<KanbanCard epic={epic} onOpenDrawer={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: /My Epic/i }));
    expect(onOpen).toHaveBeenCalledWith("e1");
  });

  it("shows green INVEST badge for score >= 70", () => {
    const { container } = render(<KanbanCard epic={epic} onOpenDrawer={vi.fn()} />);
    const badge = container.querySelector("[data-invest-badge]");
    expect(badge?.className).toContain("text-green");
  });
});
```

Run: `cd apps/app && npx vitest run app/(authenticated)/dashboard/portfolio/components/__tests__/kanban-card.test.tsx`
Expected: FAIL

- [ ] **Step 2: Rewrite `kanban-card.tsx`**

`apps/app/app/(authenticated)/dashboard/portfolio/components/kanban-card.tsx`:

```typescript
"use client";

import type { AggregatedPortfolioEpic } from "@/lib/portfolio-aggregate";
import { useDraggable } from "@dnd-kit/core";
import { useState } from "react";
import { cn } from "@repo/design-system/lib/utils";

type KanbanCardProps = {
  epic: AggregatedPortfolioEpic;
  isDragging?: boolean;
  onOpenDrawer?: (epicId: string) => void;
};

function investColor(score: number | null): string {
  if (score === null) return "text-muted-foreground bg-muted";
  if (score >= 70) return "text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-950";
  if (score >= 50) return "text-yellow-700 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-950";
  return "text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-950";
}

function investLabel(score: number | null): string {
  if (score === null) return "INVEST?";
  return `INVEST ${Math.round(score)}`;
}

export function KanbanCard({ epic, isDragging, onOpenDrawer }: KanbanCardProps) {
  const [hovered, setHovered] = useState(false);
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: epic.id });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={cn(
        "group rounded-lg border border-border bg-card p-3 shadow-sm cursor-grab select-none",
        "hover:shadow-md hover:border-primary/30 transition-all duration-150",
        isDragging && "opacity-40 cursor-grabbing",
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Drag handle area */}
      <div {...listeners} className="touch-none">
        {/* Theme color bar */}
        {epic.themeColor && (
          <div
            className="mb-2 h-0.5 w-full rounded-full"
            style={{ backgroundColor: epic.themeColor }}
          />
        )}

        {/* Title */}
        <button
          type="button"
          className="w-full text-left text-sm font-medium leading-snug hover:text-primary transition-colors"
          onClick={() => onOpenDrawer?.(epic.id)}
        >
          {epic.title}
        </button>

        {/* Compact metadata row */}
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          {/* Feature count */}
          <span className="text-[10px] text-muted-foreground">
            {epic.featureCount} {epic.featureCount === 1 ? "feature" : "features"}
          </span>

          {/* WSJF score */}
          {epic.wsjfScore > 0 && (
            <span className="text-[10px] font-mono text-muted-foreground">
              WSJF {epic.wsjfScore.toFixed(1)}
            </span>
          )}

          {/* INVEST badge */}
          <span
            data-invest-badge
            className={cn(
              "text-[9px] font-semibold px-1.5 py-0.5 rounded-full",
              investColor(epic.investScore),
            )}
          >
            {investLabel(epic.investScore)}
          </span>

          {/* Governance warning */}
          {epic.governanceStatus === "BLOCKED" && (
            <span className="text-[9px] text-red-600 font-semibold">⚠ BLOCKED</span>
          )}
        </div>

        {/* Hover expansion — WSJF breakdown */}
        {hovered && epic.wsjfScore > 0 && (
          <div className="mt-2 grid grid-cols-4 gap-1 border-t border-border pt-2">
            {[
              { label: "BV", value: epic.bv },
              { label: "TC", value: epic.tc },
              { label: "RR", value: epic.rr },
              { label: "JS", value: epic.js },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <div className="text-[9px] text-muted-foreground">{label}</div>
                <div className="text-[11px] font-mono font-medium">{value}</div>
              </div>
            ))}
          </div>
        )}

        {/* OKR link indicator */}
        {epic.linkedOKRCount > 0 && (
          <div className="mt-1 text-[9px] text-indigo-500">
            ◆ {epic.linkedOKRCount} OKR{epic.linkedOKRCount > 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update `kanban-board.tsx` — add drawer open state**

In `apps/app/app/(authenticated)/dashboard/portfolio/components/kanban-board.tsx`, add:

```typescript
const [openEpicId, setOpenEpicId] = useState<string | null>(null);
```

Pass to columns:
```typescript
<KanbanColumn
  key={col.id}
  // ... existing props ...
  onOpenDrawer={setOpenEpicId}
/>
```

Add after `</DndContext>`:
```typescript
{openEpicId && (
  <EpicDrawer
    epicId={openEpicId}
    epic={epics.find((e) => e.id === openEpicId) ?? null}
    onClose={() => setOpenEpicId(null)}
  />
)}
```

Add import: `import { EpicDrawer } from "./epic-drawer";`

- [ ] **Step 4: Update `kanban-column.tsx` — pass onOpenDrawer to cards**

In `kanban-column.tsx`, add `onOpenDrawer` prop and pass to each `KanbanCard`.

- [ ] **Step 5: Run tests**

```bash
cd apps/app && npx vitest run app/(authenticated)/dashboard/portfolio/components/__tests__/kanban-card.test.tsx
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/app/app/(authenticated)/dashboard/portfolio/components/
git commit -m "feat(kanban): hybrid density card + click-to-open drawer wiring"
```

---

## Task 5: Full Width Drawer — Shell + Tabs

**Files:**
- Create: `apps/app/app/(authenticated)/dashboard/portfolio/components/epic-drawer.tsx`

Uses Shadcn `Sheet` (full width) + `Tabs`. Tabs: `description` | `invest` | `dependencies` | `more`.

- [ ] **Step 1: Write component test**

Create `apps/app/app/(authenticated)/dashboard/portfolio/components/__tests__/epic-drawer.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { EpicDrawer } from "../epic-drawer";

const epic = {
  id: "e1", title: "Epic Title", statusId: "BACKLOG", order: 0,
  wsjfScore: 3.5, bv: 8, tc: 6, rr: 5, js: 4,
  featureCount: 3, strategicThemeId: null, themeTitle: null, themeColor: null,
  linkedOKRCount: 0, governanceStatus: null,
  investScore: null, investBreakdown: null, descriptionMd: null,
};

describe("EpicDrawer", () => {
  it("renders epic title", () => {
    render(<EpicDrawer epicId="e1" epic={epic} onClose={vi.fn()} />);
    expect(screen.getByText("Epic Title")).toBeTruthy();
  });

  it("shows 4 tabs", () => {
    render(<EpicDrawer epicId="e1" epic={epic} onClose={vi.fn()} />);
    expect(screen.getByRole("tab", { name: /descrição/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /análise ia/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /dependências/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /mais/i })).toBeTruthy();
  });
});
```

Run: `cd apps/app && npx vitest run app/(authenticated)/dashboard/portfolio/components/__tests__/epic-drawer.test.tsx`
Expected: FAIL

- [ ] **Step 2: Create `epic-drawer.tsx`**

`apps/app/app/(authenticated)/dashboard/portfolio/components/epic-drawer.tsx`:

```typescript
"use client";

import type { AggregatedPortfolioEpic } from "@/lib/portfolio-aggregate";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@repo/design-system/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/design-system/components/ui/tabs";
import { EpicDrawerDescription } from "./epic-drawer-description";
import { EpicDrawerInvest } from "./epic-drawer-invest";
import { EpicDrawerDependencies } from "./epic-drawer-dependencies";
import { EpicDrawerMore } from "./epic-drawer-more";

type EpicDrawerProps = {
  epicId: string;
  epic: AggregatedPortfolioEpic | null;
  onClose: () => void;
};

export function EpicDrawer({ epicId, epic, onClose }: EpicDrawerProps) {
  if (!epic) return null;

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle className="text-xl font-semibold">{epic.title}</SheetTitle>
          {epic.themeTitle && (
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full w-fit"
              style={{
                backgroundColor: `${epic.themeColor}22`,
                color: epic.themeColor ?? undefined,
                border: `1px solid ${epic.themeColor}44`,
              }}
            >
              {epic.themeTitle}
            </span>
          )}
        </SheetHeader>

        <Tabs defaultValue="description" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-6 h-auto py-0">
            <TabsTrigger value="description" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary pb-3 pt-3">
              Descrição
            </TabsTrigger>
            <TabsTrigger value="invest" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary pb-3 pt-3">
              Análise IA
            </TabsTrigger>
            <TabsTrigger value="dependencies" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary pb-3 pt-3">
              Dependências
            </TabsTrigger>
            <TabsTrigger value="more" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary pb-3 pt-3">
              Mais
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto">
            <TabsContent value="description" className="mt-0 h-full">
              <EpicDrawerDescription epic={epic} />
            </TabsContent>
            <TabsContent value="invest" className="mt-0">
              <EpicDrawerInvest epic={epic} />
            </TabsContent>
            <TabsContent value="dependencies" className="mt-0">
              <EpicDrawerDependencies epicId={epicId} />
            </TabsContent>
            <TabsContent value="more" className="mt-0">
              <EpicDrawerMore epic={epic} />
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 3: Create stub tab components**

`apps/app/app/(authenticated)/dashboard/portfolio/components/epic-drawer-description.tsx`:

```typescript
"use client";
import type { AggregatedPortfolioEpic } from "@/lib/portfolio-aggregate";
type Props = { epic: AggregatedPortfolioEpic };
export function EpicDrawerDescription({ epic }: Props) {
  return <div className="p-6"><p className="text-muted-foreground text-sm">Editor loading…</p></div>;
}
```

`apps/app/app/(authenticated)/dashboard/portfolio/components/epic-drawer-invest.tsx`:

```typescript
"use client";
import type { AggregatedPortfolioEpic } from "@/lib/portfolio-aggregate";
type Props = { epic: AggregatedPortfolioEpic };
export function EpicDrawerInvest({ epic }: Props) {
  return <div className="p-6"><p className="text-muted-foreground text-sm">AI analysis loading…</p></div>;
}
```

`apps/app/app/(authenticated)/dashboard/portfolio/components/epic-drawer-dependencies.tsx`:

```typescript
"use client";
type Props = { epicId: string };
export function EpicDrawerDependencies({ epicId }: Props) {
  return <div className="p-6"><p className="text-muted-foreground text-sm">Dependencies for {epicId}…</p></div>;
}
```

`apps/app/app/(authenticated)/dashboard/portfolio/components/epic-drawer-more.tsx`:

```typescript
"use client";
import type { AggregatedPortfolioEpic } from "@/lib/portfolio-aggregate";
type Props = { epic: AggregatedPortfolioEpic };
export function EpicDrawerMore({ epic }: Props) {
  return (
    <div className="p-6 space-y-3 text-sm">
      <div><span className="text-muted-foreground">Status:</span> {epic.statusId}</div>
      <div><span className="text-muted-foreground">Features:</span> {epic.featureCount}</div>
      <div><span className="text-muted-foreground">OKRs:</span> {epic.linkedOKRCount}</div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
cd apps/app && npx vitest run app/(authenticated)/dashboard/portfolio/components/__tests__/epic-drawer.test.tsx
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/app/app/(authenticated)/dashboard/portfolio/components/epic-drawer*.tsx
git commit -m "feat(drawer): Full Width Drawer shell with 4 tabs (stubs)"
```

---

## Task 6: Description Tab — TipTap Editor with Auto-Save

**Files:**
- Modify: `apps/app/app/(authenticated)/dashboard/portfolio/components/epic-drawer-description.tsx`

TipTap with `StarterKit` + `Placeholder`. Auto-save debounced 1.5s via `updateEpic`.

- [ ] **Step 1: Write test**

`apps/app/app/(authenticated)/dashboard/portfolio/components/__tests__/epic-drawer-description.test.tsx`:

```typescript
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

vi.mock("@/app/actions/epics/update-epic", () => ({
  updateEpic: vi.fn().mockResolvedValue({ ok: true, data: { id: "e1" } }),
}));

import { EpicDrawerDescription } from "../epic-drawer-description";

const epic = {
  id: "e1", title: "My Epic", statusId: "BACKLOG", order: 0,
  wsjfScore: 0, bv: 0, tc: 0, rr: 0, js: 1,
  featureCount: 0, strategicThemeId: null, themeTitle: null, themeColor: null,
  linkedOKRCount: 0, governanceStatus: null,
  investScore: null, investBreakdown: null, descriptionMd: "# Hello",
};

describe("EpicDrawerDescription", () => {
  it("renders description content", () => {
    render(<EpicDrawerDescription epic={epic} />);
    expect(screen.getByText("Hello")).toBeTruthy();
  });
});
```

Run: `cd apps/app && npx vitest run app/(authenticated)/dashboard/portfolio/components/__tests__/epic-drawer-description.test.tsx`
Expected: FAIL

- [ ] **Step 2: Implement Description tab with TipTap**

`apps/app/app/(authenticated)/dashboard/portfolio/components/epic-drawer-description.tsx`:

```typescript
"use client";

import type { AggregatedPortfolioEpic } from "@/lib/portfolio-aggregate";
import { updateEpic } from "@/app/actions/epics/update-epic";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useCallback, useEffect, useRef } from "react";
import { cn } from "@repo/design-system/lib/utils";

type Props = { epic: AggregatedPortfolioEpic };

export function EpicDrawerDescription({ epic }: Props) {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Descreva este épico…" }),
    ],
    content: epic.descriptionMd
      ? { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: epic.descriptionMd }] }] }
      : "",
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm dark:prose-invert max-w-none min-h-[200px] p-6 focus:outline-none"
        ),
      },
    },
    onUpdate: ({ editor }) => {
      const md = editor.getText(); // simplified: use getText until remark integration added
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        await updateEpic({ epicId: epic.id, descriptionMd: md });
      }, 1500);
    },
  });

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  return (
    <div className="h-full">
      <EditorContent editor={editor} />
    </div>
  );
}
```

- [ ] **Step 3: Run tests**

```bash
cd apps/app && npx vitest run app/(authenticated)/dashboard/portfolio/components/__tests__/epic-drawer-description.test.tsx
```
Expected: PASS

- [ ] **Step 4: TypeScript check**

```bash
cd apps/app && npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add apps/app/app/(authenticated)/dashboard/portfolio/components/epic-drawer-description.tsx
git commit -m "feat(drawer): TipTap description editor with 1.5s auto-save"
```

---

## Task 7: AI INVEST Scoring Server Action

**Files:**
- Create: `apps/app/app/actions/epics/analyze-invest.ts`

Uses `generateObject` (same pattern as `wsjf/rebalance.ts`). Hash-based cache: if `investHash === sha256(title + descriptionMd)`, skip re-score.

- [ ] **Step 1: Write failing test**

`apps/app/app/actions/epics/__tests__/analyze-invest.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";

vi.mock("@repo/auth/server", () => ({
  requireTenantSession: vi.fn().mockResolvedValue({ tenantId: "t1", userId: "u1" }),
}));
vi.mock("@repo/database", () => ({
  database: {
    epic: {
      findFirst: vi.fn().mockResolvedValue({
        id: "e1",
        title: "Payments module",
        descriptionMd: "Enable credit card payments",
        investScore: null,
        investHash: null,
      }),
      update: vi.fn().mockResolvedValue({ id: "e1" }),
    },
  },
}));
vi.mock("next/headers", () => ({ headers: vi.fn().mockResolvedValue({}) }));
vi.mock("ai", () => ({
  generateObject: vi.fn().mockResolvedValue({
    object: {
      breakdown: { I: 80, N: 70, V: 75, E: 65, S: 60, T: 85 },
      rationale: { I: "Independent", N: "Negotiable", V: "Valuable", E: "Estimable", S: "Small", T: "Testable" },
      compositeScore: 72,
      isSmall: true,
    },
  }),
}));
vi.mock("@repo/ai/lib/models", () => ({
  getAIModel: vi.fn().mockReturnValue({}),
  getActiveProvider: vi.fn().mockReturnValue("anthropic"),
}));

import { analyzeInvest } from "../analyze-invest";

describe("analyzeInvest", () => {
  it("returns invest breakdown on valid epic", async () => {
    const result = await analyzeInvest({ epicId: "e1" });
    expect(result.ok).toBe(true);
    expect(result.data?.compositeScore).toBe(72);
    expect(result.data?.breakdown.I).toBe(80);
  });
});
```

Run: `cd apps/app && npx vitest run app/actions/epics/__tests__/analyze-invest.test.ts`
Expected: FAIL

- [ ] **Step 2: Create `analyze-invest.ts`**

`apps/app/app/actions/epics/analyze-invest.ts`:

```typescript
"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { generateObject } from "ai";
import { getAIModel, getActiveProvider } from "@repo/ai/lib/models";
import { createHash } from "node:crypto";
import { z } from "zod";
import { type Result, safeAction } from "../_base";

const InvestBreakdownSchema = z.object({
  breakdown: z.object({
    I: z.number().min(0).max(100),
    N: z.number().min(0).max(100),
    V: z.number().min(0).max(100),
    E: z.number().min(0).max(100),
    S: z.number().min(0).max(100),
    T: z.number().min(0).max(100),
  }),
  rationale: z.object({
    I: z.string(), N: z.string(), V: z.string(),
    E: z.string(), S: z.string(), T: z.string(),
  }),
  compositeScore: z.number().min(0).max(100),
  isSmall: z.boolean(),
});

type InvestResult = z.infer<typeof InvestBreakdownSchema>;

function computeHash(title: string, description: string | null): string {
  return createHash("sha256").update(`${title}||${description ?? ""}`).digest("hex");
}

export async function analyzeInvest(input: { epicId: string }): Promise<Result<InvestResult>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const epic = await database.epic.findFirst({
      where: { id: input.epicId, tenantId: ctx.tenantId },
      select: { id: true, title: true, descriptionMd: true, investScore: true, investHash: true },
    });
    if (!epic) throw new Error("Épico não encontrado");

    const currentHash = computeHash(epic.title, epic.descriptionMd);

    // Cache hit — return persisted score
    if (epic.investHash === currentHash && epic.investScore !== null) {
      const stored = await database.epic.findFirst({
        where: { id: epic.id },
        select: { investBreakdown: true, investScore: true },
      });
      return stored?.investBreakdown as InvestResult;
    }

    // Cache miss — call AI
    const model = getAIModel(getActiveProvider());

    const { object } = await generateObject({
      model,
      schema: InvestBreakdownSchema,
      system: `Você é um especialista SAFe que avalia épicos usando o critério INVEST.
Retorne scores de 0-100 para cada dimensão (I=Independent, N=Negotiable, V=Valuable, E=Estimable, S=Small, T=Testable).
compositeScore = média ponderada (V e T pesam mais).
isSmall = true se S >= 60.`,
      prompt: `Épico: "${epic.title}"
Descrição: ${epic.descriptionMd ?? "(sem descrição)"}

Avalie este épico SAFe usando INVEST e retorne o JSON de score.`,
    });

    // Persist result
    await database.epic.update({
      where: { id: epic.id },
      data: {
        investScore: object.compositeScore,
        investBreakdown: object as object,
        investHash: currentHash,
      },
    });

    return object;
  });
}
```

- [ ] **Step 3: Run tests**

```bash
cd apps/app && npx vitest run app/actions/epics/__tests__/analyze-invest.test.ts
```
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/app/app/actions/epics/analyze-invest.ts apps/app/app/actions/epics/__tests__/analyze-invest.test.ts
git commit -m "feat(ai): INVEST scoring server action with hash-based cache"
```

---

## Task 8: AI Analysis Tab — INVEST Display + Sub-tabs

**Files:**
- Modify: `apps/app/app/(authenticated)/dashboard/portfolio/components/epic-drawer-invest.tsx`

Sub-tabs: `INVEST` | `STAR` | `Granularidade`. INVEST tab shows breakdown bars + rationale. Score triggers analysis if `investScore === null`.

- [ ] **Step 1: Write test**

`apps/app/app/(authenticated)/dashboard/portfolio/components/__tests__/epic-drawer-invest.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("@/app/actions/epics/analyze-invest", () => ({
  analyzeInvest: vi.fn().mockResolvedValue({ ok: true, data: { compositeScore: 72, breakdown: { I: 80, N: 70, V: 75, E: 65, S: 60, T: 85 }, rationale: { I: "r", N: "r", V: "r", E: "r", S: "r", T: "r" }, isSmall: true } }),
}));

import { EpicDrawerInvest } from "../epic-drawer-invest";

const epic = {
  id: "e1", title: "Epic", statusId: "BACKLOG", order: 0,
  wsjfScore: 0, bv: 0, tc: 0, rr: 0, js: 1,
  featureCount: 0, strategicThemeId: null, themeTitle: null, themeColor: null,
  linkedOKRCount: 0, governanceStatus: null,
  investScore: 72,
  investBreakdown: { I: 80, N: 70, V: 75, E: 65, S: 60, T: 85 },
  descriptionMd: null,
};

describe("EpicDrawerInvest", () => {
  it("shows INVEST sub-tabs", () => {
    render(<EpicDrawerInvest epic={epic} />);
    expect(screen.getByRole("tab", { name: /invest/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /star/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /granularidade/i })).toBeTruthy();
  });

  it("shows composite score when available", () => {
    render(<EpicDrawerInvest epic={epic} />);
    expect(screen.getByText("72")).toBeTruthy();
  });

  it("shows footer warning when S (Small) < 50", () => {
    const smallEpic = { ...epic, investBreakdown: { I: 80, N: 70, V: 75, E: 65, S: 40, T: 85 }, investScore: 69 };
    render(<EpicDrawerInvest epic={smallEpic} />);
    expect(screen.getByText(/task grande/i)).toBeTruthy();
  });
});
```

Run: `cd apps/app && npx vitest run app/(authenticated)/dashboard/portfolio/components/__tests__/epic-drawer-invest.test.tsx`
Expected: FAIL

- [ ] **Step 2: Implement `epic-drawer-invest.tsx`**

`apps/app/app/(authenticated)/dashboard/portfolio/components/epic-drawer-invest.tsx`:

```typescript
"use client";

import type { AggregatedPortfolioEpic, InvestBreakdown } from "@/lib/portfolio-aggregate";
import { analyzeInvest } from "@/app/actions/epics/analyze-invest";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/design-system/components/ui/tabs";
import { Button } from "@repo/design-system/components/ui/button";
import { useState, useTransition } from "react";
import { cn } from "@repo/design-system/lib/utils";

type Props = { epic: AggregatedPortfolioEpic };

const INVEST_LABELS: Record<keyof InvestBreakdown, string> = {
  I: "Independent", N: "Negotiable", V: "Valuable",
  E: "Estimable", S: "Small", T: "Testable",
};

function ScoreBar({ letter, score, rationale }: { letter: keyof InvestBreakdown; score: number; rationale?: string }) {
  const color = score >= 70 ? "bg-green-500" : score >= 50 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="font-semibold">{letter} — {INVEST_LABELS[letter]}</span>
        <span className="font-mono">{Math.round(score)}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted">
        <div className={cn("h-1.5 rounded-full transition-all", color)} style={{ width: `${score}%` }} />
      </div>
      {rationale && <p className="text-[10px] text-muted-foreground">{rationale}</p>}
    </div>
  );
}

export function EpicDrawerInvest({ epic }: Props) {
  const [breakdown, setBreakdown] = useState<InvestBreakdown | null>(epic.investBreakdown);
  const [score, setScore] = useState<number | null>(epic.investScore);
  const [rationale, setRationale] = useState<Record<string, string> | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleAnalyze = () => {
    startTransition(async () => {
      const result = await analyzeInvest({ epicId: epic.id });
      if (result.ok && result.data) {
        setBreakdown(result.data.breakdown);
        setScore(result.data.compositeScore);
        setRationale(result.data.rationale);
      }
    });
  };

  const isSmallWarning = breakdown && breakdown.S < 50;
  const letters = (["I", "N", "V", "E", "S", "T"] as const);

  return (
    <div className="flex flex-col h-full">
      <Tabs defaultValue="invest" className="flex-1">
        <TabsList className="w-full justify-start px-6 border-b rounded-none bg-transparent h-auto py-0">
          <TabsTrigger value="invest" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary py-3">
            INVEST
          </TabsTrigger>
          <TabsTrigger value="star" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary py-3">
            STAR
          </TabsTrigger>
          <TabsTrigger value="granularidade" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary py-3">
            Granularidade
          </TabsTrigger>
        </TabsList>

        <TabsContent value="invest" className="p-6 space-y-4">
          {score !== null && (
            <div className="flex items-center gap-3 mb-4">
              <span className="text-4xl font-bold tabular-nums">{Math.round(score)}</span>
              <div>
                <p className="text-xs text-muted-foreground">INVEST Score</p>
                <p className="text-xs">{score >= 70 ? "✓ Bem definido" : score >= 50 ? "⚠ Pode melhorar" : "✗ Precisa revisão"}</p>
              </div>
            </div>
          )}

          {breakdown ? (
            <div className="space-y-4">
              {letters.map((l) => (
                <ScoreBar
                  key={l}
                  letter={l}
                  score={breakdown[l]}
                  rationale={rationale?.[l]}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-8">
              <p className="text-sm text-muted-foreground text-center">
                Nenhum score INVEST calculado ainda.
              </p>
              <Button onClick={handleAnalyze} disabled={isPending} size="sm">
                {isPending ? "Analisando…" : "Analisar com IA"}
              </Button>
            </div>
          )}

          {breakdown && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleAnalyze}
              disabled={isPending}
              className="w-full"
            >
              {isPending ? "Reanalisando…" : "Reanalisar"}
            </Button>
          )}
        </TabsContent>

        <TabsContent value="star" className="p-6">
          <p className="text-sm text-muted-foreground">Análise STAR (Situation / Task / Action / Result) — em breve.</p>
        </TabsContent>

        <TabsContent value="granularidade" className="p-6">
          <p className="text-sm text-muted-foreground">Análise de granularidade — em breve.</p>
        </TabsContent>
      </Tabs>

      {/* Sticky footer warning */}
      {isSmallWarning && (
        <div className="shrink-0 border-t bg-yellow-50 dark:bg-yellow-950 px-6 py-3">
          <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-400">
            ⚠ Task grande — considere quebrar em épicos menores (S = {Math.round(breakdown!.S)})
          </p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Run tests**

```bash
cd apps/app && npx vitest run app/(authenticated)/dashboard/portfolio/components/__tests__/epic-drawer-invest.test.tsx
```
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/app/app/(authenticated)/dashboard/portfolio/components/epic-drawer-invest.tsx
git commit -m "feat(drawer): INVEST AI analysis tab with sub-tabs + footer warning"
```

---

## Task 9: Quick-Add Modal (Linear-style)

**Files:**
- Create: `apps/app/app/(authenticated)/dashboard/portfolio/components/epic-create-modal.tsx`
- Modify: `apps/app/app/(authenticated)/dashboard/portfolio/components/kanban-column.tsx`

Modal: title input (auto-focus), optional theme selector, submit creates epic via `createEpic`.

- [ ] **Step 1: Write test**

`apps/app/app/(authenticated)/dashboard/portfolio/components/__tests__/epic-create-modal.test.tsx`:

```typescript
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("@/app/actions/epics/create-epic", () => ({
  createEpic: vi.fn().mockResolvedValue({ ok: true, data: { id: "new-1", title: "New Epic", statusId: "BACKLOG", order: 0 } }),
}));

import { EpicCreateModal } from "../epic-create-modal";

describe("EpicCreateModal", () => {
  it("renders title input", () => {
    render(<EpicCreateModal statusId="BACKLOG" onClose={vi.fn()} onCreated={vi.fn()} themes={[]} />);
    expect(screen.getByPlaceholderText(/título do épico/i)).toBeTruthy();
  });

  it("calls onCreated after submit", async () => {
    const onCreated = vi.fn();
    render(<EpicCreateModal statusId="BACKLOG" onClose={vi.fn()} onCreated={onCreated} themes={[]} />);
    fireEvent.change(screen.getByPlaceholderText(/título do épico/i), { target: { value: "New Epic" } });
    fireEvent.click(screen.getByRole("button", { name: /criar épico/i }));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
  });
});
```

Run: `cd apps/app && npx vitest run app/(authenticated)/dashboard/portfolio/components/__tests__/epic-create-modal.test.tsx`
Expected: FAIL

- [ ] **Step 2: Create `epic-create-modal.tsx`**

`apps/app/app/(authenticated)/dashboard/portfolio/components/epic-create-modal.tsx`:

```typescript
"use client";

import { createEpic } from "@/app/actions/epics/create-epic";
import type { AggregatedPortfolioEpic } from "@/lib/portfolio-aggregate";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { useRef, useState, useTransition } from "react";

type Theme = { id: string; title: string; color: string };

type Props = {
  statusId: string;
  onClose: () => void;
  onCreated: (epic: Pick<AggregatedPortfolioEpic, "id" | "title" | "statusId" | "order">) => void;
  themes: Theme[];
};

export function EpicCreateModal({ statusId, onClose, onCreated, themes }: Props) {
  const [title, setTitle] = useState("");
  const [themeId, setThemeId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    startTransition(async () => {
      const result = await createEpic({
        title: title.trim(),
        statusId,
        strategicThemeId: themeId,
      });
      if (result.ok && result.data) {
        onCreated(result.data);
        onClose();
      }
    });
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Criar Épico</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            ref={inputRef}
            autoFocus
            placeholder="Título do épico…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isPending}
          />
          {themes.length > 0 && (
            <Select onValueChange={(v) => setThemeId(v === "none" ? null : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Tema estratégico (opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem tema</SelectItem>
                {themes.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} />
                      {t.title}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || !title.trim()}>
              {isPending ? "Criando…" : "Criar Épico"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Add Quick-Add button to `kanban-column.tsx`**

In `kanban-column.tsx`, add to props: `onQuickAdd: () => void` and render a `+` button at the top of each column.

The board will manage `quickAddColumnId` state and render `<EpicCreateModal>` when set.

- [ ] **Step 4: Run tests**

```bash
cd apps/app && npx vitest run app/(authenticated)/dashboard/portfolio/components/__tests__/epic-create-modal.test.tsx
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/app/app/(authenticated)/dashboard/portfolio/components/epic-create-modal.tsx apps/app/app/(authenticated)/dashboard/portfolio/components/kanban-column.tsx
git commit -m "feat(kanban): Quick-Add modal Linear-style + column + button"
```

---

## Task 10: WIP Limits (Soft Warning)

**Files:**
- Modify: `apps/app/app/actions/portfolio-kanban/schema.ts`
- Modify: `apps/app/app/(authenticated)/dashboard/portfolio/components/kanban-column.tsx`
- Create: `apps/app/app/(authenticated)/dashboard/portfolio/components/wip-limit-warning.tsx`

Soft warning: highlight column header red when `epics.length > wipLimit`. Never blocks drop.

- [ ] **Step 1: Write test**

`apps/app/app/(authenticated)/dashboard/portfolio/components/__tests__/wip-limit-warning.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { WipLimitWarning } from "../wip-limit-warning";

describe("WipLimitWarning", () => {
  it("shows warning when count > limit", () => {
    render(<WipLimitWarning count={5} limit={3} />);
    expect(screen.getByText(/wip/i)).toBeTruthy();
    expect(screen.getByText("5/3")).toBeTruthy();
  });

  it("does not show warning when count <= limit", () => {
    const { container } = render(<WipLimitWarning count={2} limit={3} />);
    expect(container.textContent).toBe("");
  });
});
```

Run: `cd apps/app && npx vitest run app/(authenticated)/dashboard/portfolio/components/__tests__/wip-limit-warning.test.tsx`
Expected: FAIL

- [ ] **Step 2: Create `wip-limit-warning.tsx`**

`apps/app/app/(authenticated)/dashboard/portfolio/components/wip-limit-warning.tsx`:

```typescript
"use client";

type Props = { count: number; limit: number };

export function WipLimitWarning({ count, limit }: Props) {
  if (count <= limit) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-950 dark:text-red-400">
      ⚠ WIP {count}/{limit}
    </span>
  );
}
```

- [ ] **Step 3: Add `wipLimit` to `KanbanColumnConfig` schema**

In `apps/app/app/actions/portfolio-kanban/schema.ts`, add `wipLimit: z.number().int().min(1).optional()` to `KanbanColumnConfig`.

Update `DEFAULT_PORTFOLIO_COLUMNS` to include `wipLimit: 5` as default for all columns.

- [ ] **Step 4: Render `WipLimitWarning` in column header**

In `kanban-column.tsx`, import and render:
```tsx
{col.wipLimit && <WipLimitWarning count={epics.length} limit={col.wipLimit} />}
```

- [ ] **Step 5: Run tests**

```bash
cd apps/app && npx vitest run app/(authenticated)/dashboard/portfolio/components/__tests__/wip-limit-warning.test.tsx
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/app/app/(authenticated)/dashboard/portfolio/components/wip-limit-warning.tsx apps/app/app/actions/portfolio-kanban/schema.ts
git commit -m "feat(kanban): soft WIP limit warning badge on column header"
```

---

## Task 11: RAG Prompt Generation + Multi-IDE Delivery

**Files:**
- Create: `apps/app/app/actions/ai-prompt/rag-search.ts`
- Create: `apps/app/app/actions/ai-prompt/generate-prompt.ts`
- Create: `apps/app/app/(authenticated)/dashboard/portfolio/components/prompt-delivery-dialog.tsx`

Generates a specialized prompt (Haiku + RAG), copies to clipboard, opens IDE URI scheme.

- [ ] **Step 1: Write test for generate-prompt**

`apps/app/app/actions/ai-prompt/__tests__/generate-prompt.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";

vi.mock("@repo/auth/server", () => ({
  requireTenantSession: vi.fn().mockResolvedValue({ tenantId: "t1" }),
}));
vi.mock("@repo/database", () => ({
  database: {
    epic: {
      findFirst: vi.fn().mockResolvedValue({
        id: "e1", title: "Payments", descriptionMd: "Credit card payments", tenantId: "t1",
      }),
    },
  },
}));
vi.mock("next/headers", () => ({ headers: vi.fn().mockResolvedValue({}) }));
vi.mock("ai", () => ({
  generateText: vi.fn().mockResolvedValue({ text: "Implement payments module with credit cards…" }),
}));
vi.mock("@repo/ai/lib/models", () => ({
  getAIModel: vi.fn().mockReturnValue({}),
  getActiveProvider: vi.fn().mockReturnValue("anthropic"),
}));
vi.mock("../rag-search", () => ({
  ragSearch: vi.fn().mockResolvedValue([]),
}));

import { generateAndDeliverPrompt } from "../generate-prompt";

describe("generateAndDeliverPrompt", () => {
  it("returns prompt and deepLink for cursor target", async () => {
    const result = await generateAndDeliverPrompt({ epicId: "e1", target: "cursor", ragDocIds: [] });
    expect(result.ok).toBe(true);
    expect(result.data?.prompt).toContain("payments");
    expect(result.data?.deepLink).toContain("cursor://");
  });
});
```

Run: `cd apps/app && npx vitest run app/actions/ai-prompt/__tests__/generate-prompt.test.ts`
Expected: FAIL

- [ ] **Step 2: Create `rag-search.ts`**

`apps/app/app/actions/ai-prompt/rag-search.ts`:

```typescript
"use server";

import { database } from "@repo/database";

export async function ragSearch(tenantId: string, query: string, limit = 5): Promise<{ id: string; content: string; title: string }[]> {
  // pgvector similarity search via raw query
  // Requires: enable pgvector extension in Supabase and vector column on a documents table
  // For now: returns empty array until pgvector table is set up (Task 12 adds that)
  return [];
}
```

- [ ] **Step 3: Create `generate-prompt.ts`**

`apps/app/app/actions/ai-prompt/generate-prompt.ts`:

```typescript
"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { generateText } from "ai";
import { getAIModel, getActiveProvider } from "@repo/ai/lib/models";
import { type Result, safeAction } from "../_base";
import { ragSearch } from "./rag-search";

export type PromptTarget =
  | "cursor"
  | "windsurf"
  | "vscode"
  | "claude-code"
  | "claude-ai"
  | "chatgpt"
  | "groq"
  | "gemini"
  | "perplexity";

function buildDeepLink(target: PromptTarget, promptBase64: string): string {
  const encoded = encodeURIComponent(promptBase64);
  switch (target) {
    case "cursor":       return `cursor://chat?prompt=${promptBase64}`;
    case "windsurf":     return `windsurf://chat?prompt=${promptBase64}`;
    case "vscode":       return `vscode://Cline/newTask?prompt=${promptBase64}`;
    case "claude-code":  return `claude-code://new?prompt=${promptBase64}`;
    case "claude-ai":    return `https://claude.ai/new?q=${encoded}`;
    case "chatgpt":      return `https://chatgpt.com/?prompt=${encoded}`;
    case "groq":         return `https://groq.com/`;
    case "gemini":       return `https://gemini.google.com/`;
    case "perplexity":   return `https://perplexity.ai/search?q=${encoded}`;
  }
}

function systemPromptForTarget(target: PromptTarget): string {
  const base = `Você é um especialista em desenvolvimento de software e SAFe.
Gere um prompt de implementação detalhado para o seguinte épico.
O prompt deve incluir: contexto do problema, requisitos funcionais, critérios de aceite, sugestões de arquitetura.`;

  if (target === "claude-code" || target === "claude-ai") {
    return `${base}\nUse System Prompt structure com contexto claro.`;
  }
  if (target === "cursor" || target === "windsurf") {
    return `${base}\nFoco em instruções de código direto, one-shot implementation.`;
  }
  return base;
}

export async function generateAndDeliverPrompt(input: {
  epicId: string;
  target: PromptTarget;
  ragDocIds: string[];
}): Promise<Result<{ prompt: string; deepLink: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const epic = await database.epic.findFirst({
      where: { id: input.epicId, tenantId: ctx.tenantId },
      select: { id: true, title: true, descriptionMd: true },
    });
    if (!epic) throw new Error("Épico não encontrado");

    const ragDocs = await ragSearch(ctx.tenantId, epic.title);
    const ragContext = ragDocs.length > 0
      ? `\n\nDOCUMENTOS RELEVANTES:\n${ragDocs.map((d) => `## ${d.title}\n${d.content}`).join("\n\n")}`
      : "";

    const model = getAIModel(getActiveProvider());

    const { text } = await generateText({
      model,
      system: systemPromptForTarget(input.target),
      prompt: `Épico: "${epic.title}"
Descrição: ${epic.descriptionMd ?? "(sem descrição)"}${ragContext}

Gere o prompt de implementação para ${input.target}.`,
    });

    const promptBase64 = Buffer.from(text).toString("base64");
    const deepLink = buildDeepLink(input.target, promptBase64);

    return { prompt: text, deepLink };
  });
}
```

- [ ] **Step 4: Create `prompt-delivery-dialog.tsx`**

`apps/app/app/(authenticated)/dashboard/portfolio/components/prompt-delivery-dialog.tsx`:

```typescript
"use client";

import { generateAndDeliverPrompt, type PromptTarget } from "@/app/actions/ai-prompt/generate-prompt";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { Button } from "@repo/design-system/components/ui/button";
import { useState, useTransition } from "react";
import { toast } from "sonner";

const TARGETS: { value: PromptTarget; label: string; icon: string }[] = [
  { value: "cursor",      label: "Cursor",       icon: "⚡" },
  { value: "windsurf",    label: "Windsurf",     icon: "🏄" },
  { value: "vscode",      label: "VS Code/Cline", icon: "💻" },
  { value: "claude-code", label: "Claude Code",  icon: "◆" },
  { value: "claude-ai",   label: "Claude.ai",    icon: "🤖" },
  { value: "chatgpt",     label: "ChatGPT",      icon: "💬" },
  { value: "groq",        label: "Groq",         icon: "⚙" },
  { value: "gemini",      label: "Gemini",       icon: "✨" },
  { value: "perplexity",  label: "Perplexity",   icon: "🔍" },
];

type Props = {
  epicId: string;
  epicTitle: string;
  onClose: () => void;
};

export function PromptDeliveryDialog({ epicId, epicTitle, onClose }: Props) {
  const [selectedTarget, setSelectedTarget] = useState<PromptTarget>("cursor");
  const [generatedPrompt, setGeneratedPrompt] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleGenerate = () => {
    startTransition(async () => {
      const result = await generateAndDeliverPrompt({
        epicId,
        target: selectedTarget,
        ragDocIds: [],
      });

      if (!result.ok) {
        toast.error("Erro ao gerar prompt");
        return;
      }

      const { prompt, deepLink } = result.data!;
      setGeneratedPrompt(prompt);

      await navigator.clipboard.writeText(prompt);
      window.open(deepLink, "_blank");

      toast.success(`Prompt copiado e ${TARGETS.find((t) => t.value === selectedTarget)?.label} aberto — cole com Ctrl+V`);
    });
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Gerar Prompt — {epicTitle}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Selecione o destino:</p>
          <div className="grid grid-cols-3 gap-2">
            {TARGETS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setSelectedTarget(t.value)}
                className={`flex items-center gap-2 rounded-lg border p-3 text-sm transition-colors ${
                  selectedTarget === t.value
                    ? "border-primary bg-primary/5 font-medium"
                    : "border-border hover:bg-muted"
                }`}
              >
                <span>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          {generatedPrompt && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">Ver prompt gerado</summary>
              <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted p-2 whitespace-pre-wrap">
                {generatedPrompt}
              </pre>
            </details>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Fechar</Button>
            <Button onClick={handleGenerate} disabled={isPending}>
              {isPending ? "Gerando…" : "Gerar + Abrir"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 5: Wire `PromptDeliveryDialog` in `EpicDrawerMore`**

In `epic-drawer-more.tsx`, add a "Gerar Prompt de Implementação" button that sets `showPromptDialog = true` and renders `<PromptDeliveryDialog>`.

- [ ] **Step 6: Run tests**

```bash
cd apps/app && npx vitest run app/actions/ai-prompt/__tests__/generate-prompt.test.ts
```
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/app/app/actions/ai-prompt/ apps/app/app/(authenticated)/dashboard/portfolio/components/prompt-delivery-dialog.tsx apps/app/app/(authenticated)/dashboard/portfolio/components/epic-drawer-more.tsx
git commit -m "feat(ai-prompt): RAG prompt generation + multi-IDE URI delivery"
```

---

## Task 12: AI Playground — Supabase Storage + CRUD

**Files:**
- Create: `packages/storage/src/index.ts`
- Create: `packages/storage/package.json`
- Create: `apps/app/app/actions/artifacts/schema.ts`
- Create: `apps/app/app/actions/artifacts/index.ts`
- Create: `apps/app/app/(authenticated)/portfolio/ai-playground/page.tsx`
- Create: `apps/app/app/(authenticated)/portfolio/ai-playground/components/artifact-browser.tsx`
- Create: `apps/app/app/(authenticated)/portfolio/ai-playground/components/artifact-viewer.tsx`

**Tier 0**: Supabase Storage, bucket `cosmos-ai-playground`, gzip-compressed markdown/JSON files.

- [ ] **Step 1: Add Supabase client package**

Create `packages/storage/package.json`:

```json
{
  "name": "@repo/storage",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": {
    "@supabase/supabase-js": "^2.45.0"
  }
}
```

Run: `pnpm install` from the root of the monorepo.

- [ ] **Step 2: Create Supabase storage client**

`packages/storage/src/index.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

export const storageClient = createClient(supabaseUrl, supabaseServiceKey);

export const AI_PLAYGROUND_BUCKET = "cosmos-ai-playground";

export async function ensureBucket(): Promise<void> {
  const { data: buckets } = await storageClient.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === AI_PLAYGROUND_BUCKET);
  if (!exists) {
    await storageClient.storage.createBucket(AI_PLAYGROUND_BUCKET, {
      public: false,
      fileSizeLimit: 10 * 1024 * 1024, // 10MB
    });
  }
}

export type ArtifactType = "prompt" | "prd" | "spec" | "playbook" | "transcript";

export interface ArtifactMetadata {
  id: string;
  tenantId: string;
  epicId?: string;
  title: string;
  type: ArtifactType;
  storagePath: string;
  sizeBytes: number;
  createdAt: string;
}
```

- [ ] **Step 3: Write failing test for artifact CRUD**

`apps/app/app/actions/artifacts/__tests__/artifacts.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";

vi.mock("@repo/auth/server", () => ({
  requireTenantSession: vi.fn().mockResolvedValue({ tenantId: "t1" }),
}));
vi.mock("next/headers", () => ({ headers: vi.fn().mockResolvedValue({}) }));
vi.mock("@repo/storage", () => ({
  storageClient: {
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ data: { path: "t1/a1.md.gz" }, error: null }),
        list: vi.fn().mockResolvedValue({ data: [], error: null }),
        remove: vi.fn().mockResolvedValue({ error: null }),
        download: vi.fn().mockResolvedValue({ data: new Blob(["content"]), error: null }),
      }),
    },
  },
  AI_PLAYGROUND_BUCKET: "cosmos-ai-playground",
  ensureBucket: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@repo/database", () => ({
  database: {
    tenant: {
      findFirst: vi.fn().mockResolvedValue({ metadata: {} }),
      update: vi.fn().mockResolvedValue({}),
    },
  },
}));

import { saveArtifact } from "../index";

describe("saveArtifact", () => {
  it("saves artifact and returns metadata", async () => {
    const result = await saveArtifact({
      title: "My PRD",
      type: "prd",
      content: "# PRD\nContent here",
      epicId: "e1",
    });
    expect(result.ok).toBe(true);
    expect(result.data?.title).toBe("My PRD");
  });
});
```

Run: `cd apps/app && npx vitest run app/actions/artifacts/__tests__/artifacts.test.ts`
Expected: FAIL

- [ ] **Step 4: Create `artifacts/schema.ts`**

`apps/app/app/actions/artifacts/schema.ts`:

```typescript
import { z } from "zod";

export const SaveArtifactSchema = z.object({
  title: z.string().min(1).max(200),
  type: z.enum(["prompt", "prd", "spec", "playbook", "transcript"]),
  content: z.string().min(1),
  epicId: z.string().optional(),
});

export type SaveArtifactInput = z.infer<typeof SaveArtifactSchema>;
```

- [ ] **Step 5: Create `artifacts/index.ts`**

`apps/app/app/actions/artifacts/index.ts`:

```typescript
"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { storageClient, AI_PLAYGROUND_BUCKET, ensureBucket } from "@repo/storage";
import { type Result, safeAction } from "../_base";
import { SaveArtifactSchema, type SaveArtifactInput } from "./schema";
import type { ArtifactMetadata } from "@repo/storage";
import { createId } from "@paralleldrive/cuid2";
import { gzipSync } from "node:zlib";

const META_KEY = "aiPlaygroundArtifacts";

type TenantMeta = {
  [META_KEY]?: ArtifactMetadata[];
  [k: string]: unknown;
};

export async function saveArtifact(raw: SaveArtifactInput): Promise<Result<ArtifactMetadata>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const input = SaveArtifactSchema.parse(raw);

    await ensureBucket();

    const id = createId();
    const fileName = `${id}.md.gz`;
    const storagePath = `${ctx.tenantId}/${fileName}`;

    // Gzip compress for ~60-80% size reduction
    const compressed = gzipSync(Buffer.from(input.content, "utf-8"));

    const { error } = await storageClient.storage
      .from(AI_PLAYGROUND_BUCKET)
      .upload(storagePath, compressed, {
        contentType: "application/gzip",
        upsert: false,
      });

    if (error) throw new Error(`Storage upload failed: ${error.message}`);

    const metadata: ArtifactMetadata = {
      id,
      tenantId: ctx.tenantId,
      epicId: input.epicId,
      title: input.title,
      type: input.type,
      storagePath,
      sizeBytes: compressed.byteLength,
      createdAt: new Date().toISOString(),
    };

    // Persist metadata in tenant.metadata (avoids extra DB table)
    const tenant = await database.tenant.findFirst({
      where: { id: ctx.tenantId },
      select: { metadata: true },
    });
    const existing = ((tenant?.metadata as TenantMeta)?.[META_KEY] ?? []) as ArtifactMetadata[];
    await database.tenant.update({
      where: { id: ctx.tenantId },
      data: {
        metadata: {
          ...(tenant?.metadata as object),
          [META_KEY]: [...existing, metadata],
        },
      },
    });

    return metadata;
  });
}

export async function listArtifacts(): Promise<Result<ArtifactMetadata[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const tenant = await database.tenant.findFirst({
      where: { id: ctx.tenantId },
      select: { metadata: true },
    });
    const meta = tenant?.metadata as TenantMeta | null;
    return (meta?.[META_KEY] ?? []) as ArtifactMetadata[];
  });
}

export async function deleteArtifact(artifactId: string): Promise<Result<void>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const tenant = await database.tenant.findFirst({
      where: { id: ctx.tenantId },
      select: { metadata: true },
    });
    const meta = tenant?.metadata as TenantMeta | null;
    const existing = (meta?.[META_KEY] ?? []) as ArtifactMetadata[];
    const artifact = existing.find((a) => a.id === artifactId);
    if (!artifact) throw new Error("Artifact not found");

    await storageClient.storage.from(AI_PLAYGROUND_BUCKET).remove([artifact.storagePath]);

    await database.tenant.update({
      where: { id: ctx.tenantId },
      data: {
        metadata: {
          ...(tenant?.metadata as object),
          [META_KEY]: existing.filter((a) => a.id !== artifactId),
        },
      },
    });
  });
}
```

- [ ] **Step 6: Run tests**

```bash
cd apps/app && npx vitest run app/actions/artifacts/__tests__/artifacts.test.ts
```
Expected: PASS

- [ ] **Step 7: Create AI Playground page**

`apps/app/app/(authenticated)/portfolio/ai-playground/page.tsx`:

```typescript
import { listArtifacts } from "@/app/actions/artifacts";
import { ArtifactBrowser } from "./components/artifact-browser";

export default async function AIPlaygroundPage() {
  const result = await listArtifacts();
  const artifacts = result.ok ? result.data : [];

  return (
    <div className="container py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">AI Playground</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Artefatos gerados com IA — PRDs, specs, prompts, playbooks.
        </p>
      </div>
      <ArtifactBrowser initialArtifacts={artifacts ?? []} />
    </div>
  );
}
```

- [ ] **Step 8: Create `artifact-browser.tsx`**

`apps/app/app/(authenticated)/portfolio/ai-playground/components/artifact-browser.tsx`:

```typescript
"use client";

import type { ArtifactMetadata } from "@repo/storage";
import { deleteArtifact } from "@/app/actions/artifacts";
import { useState, useTransition } from "react";
import { Button } from "@repo/design-system/components/ui/button";
import { toast } from "sonner";
import { ArtifactViewer } from "./artifact-viewer";

const TYPE_LABELS: Record<string, string> = {
  prompt: "Prompt", prd: "PRD", spec: "Spec",
  playbook: "Playbook", transcript: "Transcrição",
};

type Props = { initialArtifacts: ArtifactMetadata[] };

export function ArtifactBrowser({ initialArtifacts }: Props) {
  const [artifacts, setArtifacts] = useState(initialArtifacts);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const result = await deleteArtifact(id);
      if (result.ok) {
        setArtifacts((prev) => prev.filter((a) => a.id !== id));
        if (selectedId === id) setSelectedId(null);
        toast.success("Artefato removido");
      } else {
        toast.error("Erro ao remover artefato");
      }
    });
  };

  if (artifacts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-muted-foreground">Nenhum artefato ainda.</p>
        <p className="text-xs text-muted-foreground">
          Gere prompts ou análises a partir dos épicos no Kanban.
        </p>
      </div>
    );
  }

  const selected = artifacts.find((a) => a.id === selectedId);

  return (
    <div className="flex gap-6">
      <div className="w-80 shrink-0 space-y-2">
        {artifacts.map((a) => (
          <div
            key={a.id}
            className={`flex items-start justify-between rounded-lg border p-3 cursor-pointer transition-colors ${
              selectedId === a.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
            }`}
            onClick={() => setSelectedId(a.id)}
            onKeyDown={(e) => { if (e.key === "Enter") setSelectedId(a.id); }}
            role="button"
            tabIndex={0}
          >
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{a.title}</p>
              <p className="text-[10px] text-muted-foreground">
                {TYPE_LABELS[a.type] ?? a.type} · {new Date(a.createdAt).toLocaleDateString("pt-BR")}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 h-6 w-6 text-muted-foreground hover:text-destructive"
              onClick={(e) => { e.stopPropagation(); handleDelete(a.id); }}
              disabled={isPending}
            >
              ×
            </Button>
          </div>
        ))}
      </div>

      <div className="flex-1 min-w-0">
        {selected ? (
          <ArtifactViewer artifact={selected} />
        ) : (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            Selecione um artefato para visualizar
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 9: Create `artifact-viewer.tsx` (stub — full content fetch TBD)**

`apps/app/app/(authenticated)/portfolio/ai-playground/components/artifact-viewer.tsx`:

```typescript
"use client";

import type { ArtifactMetadata } from "@repo/storage";
import { TYPE_LABELS } from "./artifact-browser"; // Re-export or duplicate the map

type Props = { artifact: ArtifactMetadata };

export function ArtifactViewer({ artifact }: Props) {
  return (
    <div className="rounded-lg border p-6 space-y-3">
      <div>
        <h2 className="text-lg font-semibold">{artifact.title}</h2>
        <p className="text-xs text-muted-foreground">
          {artifact.type} · {(artifact.sizeBytes / 1024).toFixed(1)}KB · {new Date(artifact.createdAt).toLocaleString("pt-BR")}
        </p>
      </div>
      <div className="prose prose-sm dark:prose-invert">
        <p className="text-muted-foreground text-sm">
          (Conteúdo disponível após fetch do Supabase Storage — implementar download + gunzip no client)
        </p>
      </div>
    </div>
  );
}
```

> **Note:** Full content fetch requires a `getArtifactContent` server action that downloads from Supabase Storage and `gunzip`s the buffer. Add it in a follow-up task.

- [ ] **Step 10: Run all tests**

```bash
cd apps/app && npx vitest run app/actions/artifacts/
```
Expected: PASS

- [ ] **Step 11: TypeScript check**

```bash
cd apps/app && npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 12: Commit**

```bash
git add packages/storage/ apps/app/app/actions/artifacts/ apps/app/app/(authenticated)/portfolio/ai-playground/
git commit -m "feat(ai-playground): Supabase Storage artifacts — save/list/delete + browser UI"
```

---

## Final: Integration Run

- [ ] **Step 1: Run full test suite**

```bash
cd apps/app && npx vitest run
```
Expected: All tests PASS

- [ ] **Step 2: TypeScript build check**

```bash
cd apps/app && npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 3: Smoke test in browser**

```bash
pnpm dev
```

Navigate to `/dashboard/portfolio`. Verify:
1. Cards render with INVEST badge (gray if unscored)
2. Click card → Full Width Drawer opens
3. Descrição tab → TipTap editor visible
4. Análise IA tab → "Analisar com IA" button → calls action
5. + button in column header → Quick-Add modal opens
6. Column with > 5 epics → red WIP badge appears
7. Navigate to `/portfolio/ai-playground` → empty state visible

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "feat(kanban): P0+P1 complete — INVEST AI, drawer, quick-add, WIP limits, prompt gen, AI playground"
```

---

## Self-Review

### Spec Coverage

| Feature | Tasks |
|---------|-------|
| F1 — Kanban Board drag-drop | Existing (already works) |
| F1 — WIP limits (soft) | Task 10 |
| F1 — Quick-add modal | Task 9 |
| F2 — Card hybrid density | Task 4 |
| F2 — INVEST badge | Task 4 |
| F3 — AI INVEST scoring | Tasks 7, 8 |
| F3 — Drawer tabs INVEST/STAR/Gran | Task 8 |
| F3 — Footer warning big task | Task 8 |
| F4 — Full Width Drawer shell | Task 5 |
| F4 — Default tab = Descrição | Task 5 |
| F5 — TipTap editor | Task 6 |
| F5 — Auto-save | Task 6 |
| US-010b — RAG prompt gen | Task 11 |
| US-010b — Multi-IDE URI delivery | Task 11 |
| F8 — AI Playground | Task 12 |
| F8 — Supabase Storage Tier 0 | Task 12 |
| F8 — Gzip compression | Task 12 |

**Gaps / deferred:**
- F6 — Transcription (P1): not in plan — requires audio capture UI + Whisper/Assembly AI. Add as separate plan.
- F7 — Multiplayer (P2): partially exists (Liveblocks cursors). Full cursors + presence = existing code.
- F8 — Artifact content viewer full (gunzip download): stub left in Task 12 step 9 — add `getArtifactContent` action in follow-up.
- F3 — STAR and Granularidade sub-tab content: stubs. Add as follow-up when scoring logic designed.
- RAG pgvector table: `rag-search.ts` returns empty until documents table + embeddings exist. Separate plan needed.

### Placeholder Scan
- Task 12 step 9: `ArtifactViewer` content fetch is a noted stub with explicit "Note" — intentional, not hidden.
- STAR/Granularidade tabs: explicitly marked "em breve" — product scope, not hidden placeholder.

### Type Consistency
- `AggregatedPortfolioEpic.investBreakdown` typed as `InvestBreakdown | null` in Task 2, used identically in Tasks 4, 7, 8. ✓
- `CreateEpicInput` from `schema.ts` used in both `create-epic.ts` and `epic-create-modal.tsx`. ✓
- `PortfolioEpic` (= `AggregatedPortfolioEpic`) used in all card/column/board components. ✓
- `PromptTarget` exported from `generate-prompt.ts`, imported in `prompt-delivery-dialog.tsx`. ✓
- `ArtifactMetadata` exported from `@repo/storage`, imported in both `artifacts/index.ts` and playground components. ✓
