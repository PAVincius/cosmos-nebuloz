# Kanban Portfolio AI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the Cosmos Portfolio Kanban per PRD v0.2 — card anatomy upgrades, full creation modal (type/template/MetaGrid/AI buttons/transcription), AI creation actions, TipTap slash commands, batch analysis, and multiplayer cursors.

**Architecture:** Next.js 15 App Router with server actions for mutations; Liveblocks for real-time sync/presence; TipTap for block editing; Prisma (PostgreSQL) for persistence; Vercel AI SDK `generateObject`/`generateText` for all LLM calls.

**Tech Stack:** TypeScript, Next.js 15, Prisma, TipTap v3, Liveblocks v3, @dnd-kit, Zustand, Framer Motion, `ai` SDK, Tailwind CSS, Zod, Sonner (toasts)

---

## What already exists (skip — do NOT re-implement)

| Component | Status |
|-----------|--------|
| `kanban-board.tsx` — DnD, Liveblocks, theme filter | ✅ Done |
| `kanban-card.tsx` — WSJF hover, OKR indicator, theme bar | ✅ Done |
| `kanban-column.tsx` — WIP limit warning, quick-add | ✅ Done |
| `epic-drawer.tsx` + all 4 tabs | ✅ Done |
| `epic-drawer-invest.tsx` — INVEST breakdown bars + rationale | ✅ Done |
| `epic-drawer-description.tsx` — TipTap StarterKit + autosave | ✅ Done |
| `analyze-invest.ts` — Claude + hash cache | ✅ Done |
| `create-epic.ts` + `update-epic.ts` + `update-status.ts` | ✅ Done |
| `epic-create-modal.tsx` — minimal (title + theme only) | ⚠️ Needs upgrade |

## File Map

### New files to create
```
apps/app/app/actions/epics/
  analyze-all-epics.ts        # Batch INVEST analysis for entire board
  suggest-title.ts            # Haiku: suggest title from partial input
  improve-description.ts      # Sonnet: improve description markdown
  generate-ac.ts              # Sonnet: generate acceptance criteria blocks
  extract-transcription.ts    # Sonnet: extract structure from meeting notes

apps/app/app/(authenticated)/dashboard/portfolio/components/
  invest-score-bar.tsx        # Reusable compact INVEST progress bar for cards
  ai-action-buttons.tsx       # 5 circular AI brand buttons (Claude/GPT/Gemini…)
  multiplayer-cursors.tsx     # Render useOthers() cursor overlays on board
  tiptap-slash-extension.ts   # Custom TipTap slash command extension
```

### Files to modify
```
packages/database/prisma/schema/art-core.prisma   # Add type, dueDate, transcription to Epic
apps/app/lib/portfolio-aggregate.ts               # Add type, dueDate to AggregatedPortfolioEpic
apps/app/app/actions/epics/schema.ts              # Add type, dueDate to schemas
apps/app/app/actions/epics/create-epic.ts         # Accept type, dueDate
apps/app/app/actions/epics/update-epic.ts         # Accept type, dueDate
apps/app/app/actions/epics/get-portfolio.ts       # Select type, dueDate
apps/app/app/(authenticated)/dashboard/portfolio/components/kanban-card.tsx
  # Add: INVEST progress bar, type badge, yellow border tint for score<50
apps/app/app/(authenticated)/dashboard/portfolio/components/kanban-board.tsx
  # Add: Analyze All button, shimmer state, multiplayer cursor overlay
apps/app/app/(authenticated)/dashboard/portfolio/components/epic-create-modal.tsx
  # Full upgrade: TypeSelector, AI chips, TemplateChips, MetaGrid, AIActionButtons, Transcription
apps/app/app/(authenticated)/dashboard/portfolio/components/epic-drawer-description.tsx
  # Add slash commands extension + inline AI buttons (Improve, Generate AC, Check INVEST)
```

---

## Phase 1 — Schema & Card Anatomy (P0)

### Task 1: Prisma — Add `type`, `dueDate`, `transcription` to Epic

**Files:**
- Modify: `packages/database/prisma/schema/art-core.prisma`

- [ ] **Step 1: Open the Epic model and add the 3 fields**

  In `packages/database/prisma/schema/art-core.prisma`, find `model Epic {` and after the `yjsDocumentState` line add:

  ```prisma
  epicType         String   @default("EPIC") // EPIC | FEATURE | STORY
  dueDate          DateTime?
  transcription    String?  // Raw meeting notes pasted by user
  ```

- [ ] **Step 2: Run migration**

  ```bash
  cd apps/app
  pnpm db:migrate --name add_epic_type_duedate_transcription
  ```

  Expected: migration file created under `packages/database/prisma/migrations/`. Prisma client regenerated.

- [ ] **Step 3: Verify migration applied**

  ```bash
  cd apps/app
  pnpm db:studio
  ```

  Open Epic table — confirm `epicType`, `dueDate`, `transcription` columns exist. Close studio.

- [ ] **Step 4: Commit**

  ```bash
  git add packages/database/prisma/schema/art-core.prisma packages/database/prisma/migrations/
  git commit -m "feat(schema): add epicType, dueDate, transcription to Epic model"
  ```

---

### Task 2: Types — Propagate new fields through the type layer

**Files:**
- Modify: `apps/app/app/actions/epics/schema.ts`
- Modify: `apps/app/lib/portfolio-aggregate.ts`
- Modify: `apps/app/app/actions/epics/create-epic.ts`
- Modify: `apps/app/app/actions/epics/update-epic.ts`
- Modify: `apps/app/app/actions/epics/get-portfolio.ts`

- [ ] **Step 1: Update Zod schemas**

  In `apps/app/app/actions/epics/schema.ts`, update `CreateEpicSchema` and `UpdateEpicSchema`:

  ```typescript
  export const CreateEpicSchema = z.object({
    title: z.string().min(1, "Título obrigatório").max(200),
    statusId: z.string().default("BACKLOG"),
    strategicThemeId: z.string().optional().nullable(),
    descriptionMd: z.string().optional().nullable(),
    epicType: z.enum(["EPIC", "FEATURE", "STORY"]).default("EPIC"),
    dueDate: z.string().datetime({ offset: true }).optional().nullable(),
    transcription: z.string().optional().nullable(),
  });

  export const UpdateEpicSchema = z.object({
    epicId: z.string().min(1),
    title: z.string().min(1).max(200).optional(),
    statusId: z.string().optional(),
    strategicThemeId: z.string().optional().nullable(),
    descriptionMd: z.string().optional().nullable(),
    order: z.number().int().min(0).optional(),
    epicType: z.enum(["EPIC", "FEATURE", "STORY"]).optional(),
    dueDate: z.string().datetime({ offset: true }).optional().nullable(),
    transcription: z.string().optional().nullable(),
  });

  export type CreateEpicInput = z.infer<typeof CreateEpicSchema>;
  export type UpdateEpicInput = z.infer<typeof UpdateEpicSchema>;
  ```

- [ ] **Step 2: Run TypeScript check — expect errors**

  ```bash
  cd apps/app
  pnpm typecheck 2>&1 | grep -E "schema|aggregate|create-epic|update-epic|get-portfolio" | head -30
  ```

  Expected: errors about `epicType`/`dueDate` not in Prisma `data` objects or `select` clauses.

- [ ] **Step 3: Update `create-epic.ts` to persist new fields**

  In `apps/app/app/actions/epics/create-epic.ts`, update the `data` block in `tx.epic.create`:

  ```typescript
  data: {
    tenantId: ctx.tenantId,
    title: input.title,
    statusId: input.statusId,
    strategicThemeId: input.strategicThemeId ?? null,
    descriptionMd: input.descriptionMd ?? null,
    epicType: input.epicType,
    dueDate: input.dueDate ? new Date(input.dueDate) : null,
    transcription: input.transcription ?? null,
    order: count,
  },
  select: { id: true, title: true, statusId: true, order: true, epicType: true },
  ```

- [ ] **Step 4: Update `update-epic.ts` to persist new fields**

  In `apps/app/app/actions/epics/update-epic.ts`, extend the `data` spread in `database.epic.update`:

  ```typescript
  data: {
    ...(input.title !== undefined && { title: input.title }),
    ...(input.statusId !== undefined && { statusId: input.statusId }),
    ...(input.strategicThemeId !== undefined && { strategicThemeId: input.strategicThemeId }),
    ...(input.descriptionMd !== undefined && { descriptionMd: input.descriptionMd }),
    ...(input.order !== undefined && { order: input.order }),
    ...(input.epicType !== undefined && { epicType: input.epicType }),
    ...(input.dueDate !== undefined && { dueDate: input.dueDate ? new Date(input.dueDate) : null }),
    ...(input.transcription !== undefined && { transcription: input.transcription }),
  },
  ```

- [ ] **Step 5: Update `AggregatedPortfolioEpic` type**

  In `apps/app/lib/portfolio-aggregate.ts`, add to the type:

  ```typescript
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
    investScore: number | null;
    investBreakdown: InvestBreakdown | null;
    descriptionMd: string | null;
    epicType: string;
    dueDate: string | null;  // ISO string
  };
  ```

  And in `aggregateEpicRow`, add the two fields to the mapper return:

  ```typescript
  epicType: epic.epicType ?? "EPIC",
  dueDate: epic.dueDate ? (epic.dueDate as Date).toISOString() : null,
  ```

  And extend the function parameter type to accept those fields:

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
      investScore?: number | null;
      investBreakdown?: InvestBreakdown | null;
      descriptionMd?: string | null;
      epicType?: string | null;
      dueDate?: Date | null;
    }
  ): AggregatedPortfolioEpic {
  ```

- [ ] **Step 6: Update `get-portfolio.ts` to select new fields**

  In `apps/app/app/actions/epics/get-portfolio.ts`, update the `EpicWithRelations` intersection to include the new fields and the `epicInclude` const — the fields `epicType`, `dueDate` are scalar columns and are included automatically. Update `mapEpicRow` to pass them:

  ```typescript
  type EpicWithRelations = Awaited<ReturnType<typeof database.epic.findMany>>[number] & {
    features: { bv: number; tc: number; rr: number; js: number; wsjfScore: number; startedAt: Date | null; completedAt: Date | null; piPlan: { name: string } | null; }[];
    _count: { features: number };
    strategicTheme: { id: string; title: string; color: string } | null;
    governedEpic: { governanceStatus: string } | null;
    investScore: number | null;
    investBreakdown: InvestBreakdown | null;
    descriptionMd: string | null;
    epicType: string;
    dueDate: Date | null;
  };
  ```

  In `mapEpicRow`, pass the new fields to `aggregateEpicRow`:

  ```typescript
  epicType: e.epicType,
  dueDate: e.dueDate,
  ```

- [ ] **Step 7: Run TypeScript check — expect zero errors**

  ```bash
  cd apps/app
  pnpm typecheck 2>&1 | grep -c "error TS"
  ```

  Expected: `0`

- [ ] **Step 8: Commit**

  ```bash
  git add apps/app/app/actions/epics/ apps/app/lib/portfolio-aggregate.ts
  git commit -m "feat(epics): propagate epicType + dueDate through action/type layer"
  ```

---

### Task 3: Card anatomy — INVEST bar, type badge, border tint

**Files:**
- Create: `apps/app/app/(authenticated)/dashboard/portfolio/components/invest-score-bar.tsx`
- Modify: `apps/app/app/(authenticated)/dashboard/portfolio/components/kanban-card.tsx`

- [ ] **Step 1: Write failing snapshot test**

  Create `apps/app/__tests__/components/invest-score-bar.test.tsx`:

  ```typescript
  import { render } from "@testing-library/react";
  import { InvestScoreBar } from "@/app/(authenticated)/dashboard/portfolio/components/invest-score-bar";

  it("renders green bar for score 80", () => {
    const { container } = render(<InvestScoreBar score={80} />);
    const bar = container.querySelector("[data-testid='invest-bar-fill']");
    expect(bar).toHaveStyle({ width: "80%" });
    expect(bar?.className).toContain("bg-green");
  });

  it("renders yellow bar for score 60", () => {
    const { container } = render(<InvestScoreBar score={60} />);
    const bar = container.querySelector("[data-testid='invest-bar-fill']");
    expect(bar?.className).toContain("bg-yellow");
  });

  it("renders red bar for score 30", () => {
    const { container } = render(<InvestScoreBar score={30} />);
    const bar = container.querySelector("[data-testid='invest-bar-fill']");
    expect(bar?.className).toContain("bg-red");
  });

  it("renders null placeholder when score is null", () => {
    const { container } = render(<InvestScoreBar score={null} />);
    const bar = container.querySelector("[data-testid='invest-bar-fill']");
    expect(bar).toBeNull();
  });
  ```

- [ ] **Step 2: Run test — expect FAIL**

  ```bash
  cd apps/app
  pnpm test __tests__/components/invest-score-bar.test.tsx 2>&1 | tail -5
  ```

  Expected: `Cannot find module '@/app/(authenticated)/dashboard/portfolio/components/invest-score-bar'`

- [ ] **Step 3: Create `invest-score-bar.tsx`**

  ```typescript
  // apps/app/app/(authenticated)/dashboard/portfolio/components/invest-score-bar.tsx
  "use client";

  import { cn } from "@repo/design-system/lib/utils";

  type Props = { score: number | null; className?: string };

  export function InvestScoreBar({ score, className }: Props) {
    if (score === null) return null;

    const pct = Math.round(Math.min(100, Math.max(0, score)));
    const fill =
      pct >= 70
        ? "bg-green-500"
        : pct >= 50
        ? "bg-yellow-500"
        : "bg-red-500";

    return (
      <div
        aria-label={`INVEST ${pct}`}
        className={cn("h-1 w-full rounded-full bg-muted", className)}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn("h-1 rounded-full transition-all duration-500", fill)}
          data-testid="invest-bar-fill"
          style={{ width: `${pct}%` }}
        />
      </div>
    );
  }
  ```

- [ ] **Step 4: Run test — expect PASS**

  ```bash
  cd apps/app
  pnpm test __tests__/components/invest-score-bar.test.tsx 2>&1 | tail -5
  ```

  Expected: `Tests: 4 passed`

- [ ] **Step 5: Modify `kanban-card.tsx` — add bar + type badge + border tint**

  In `kanban-card.tsx`, at the top add the import:

  ```typescript
  import { InvestScoreBar } from "./invest-score-bar";
  ```

  Change the outer `div` className to include the yellow tint when score < 50:

  ```typescript
  className={cn(
    "group select-none rounded-lg border bg-card shadow-sm",
    "transition-all duration-300 ease-out hover:-translate-y-px hover:shadow-md",
    isDragging && "opacity-50 shadow-lg rotate-1",
    epic.investScore !== null && epic.investScore < 50
      ? "border-yellow-400/60 dark:border-yellow-600/60"
      : "border-border",
  )}
  ```

  After the `themeColor` top bar div and before `<div className="px-3 pt-2.5 pb-2">`, add the INVEST bar:

  ```typescript
  <InvestScoreBar score={epic.investScore} className="rounded-none rounded-b-none" />
  ```

  In the metadata row, after the features span, add a type badge:

  ```typescript
  {epic.epicType && epic.epicType !== "EPIC" && (
    <span className="rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
      {epic.epicType === "FEATURE" ? "Feature" : "Story"}
    </span>
  )}
  ```

  Remove the old `investColor` + `investLabel` badge span (if it exists as a separate chip in the metadata row) since the bar now shows the score visually.

- [ ] **Step 6: Visual check**

  ```bash
  cd apps/app
  pnpm dev &
  # Navigate to http://localhost:3000/dashboard/portfolio
  # Verify: progress bar visible under theme line on cards with investScore
  # Verify: yellow border on cards with score < 50
  # Verify: "Feature" or "Story" badge visible on non-EPIC typed cards
  ```

- [ ] **Step 7: Commit**

  ```bash
  git add apps/app/app/(authenticated)/dashboard/portfolio/components/
  git commit -m "feat(kanban): INVEST progress bar, type badge, yellow border tint on card"
  ```

---

### Task 4: Batch "Analyze All" (US-008)

**Files:**
- Create: `apps/app/app/actions/epics/analyze-all-epics.ts`
- Modify: `apps/app/app/(authenticated)/dashboard/portfolio/components/kanban-board.tsx`

- [ ] **Step 1: Write failing test**

  Create `apps/app/__tests__/actions/epics/analyze-all-epics.test.ts`:

  ```typescript
  import { analyzeAllEpics } from "@/app/actions/epics/analyze-all-epics";

  jest.mock("@repo/auth/server", () => ({
    requireTenantSession: jest.fn().mockResolvedValue({ tenantId: "t1" }),
  }));
  jest.mock("next/headers", () => ({ headers: jest.fn().mockResolvedValue({}) }));
  jest.mock("@repo/database", () => ({
    database: {
      epic: {
        findMany: jest.fn().mockResolvedValue([
          { id: "e1", title: "Epic 1", descriptionMd: null, investHash: "old", investScore: null, investBreakdown: null },
        ]),
      },
    },
  }));
  jest.mock("@/app/actions/epics/analyze-invest", () => ({
    analyzeInvest: jest.fn().mockResolvedValue({ ok: true, data: { compositeScore: 75 } }),
  }));

  it("returns array of epicId + result for each epic", async () => {
    const result = await analyzeAllEpics();
    expect(result.ok).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].epicId).toBe("e1");
  });
  ```

- [ ] **Step 2: Run test — expect FAIL**

  ```bash
  cd apps/app
  pnpm test __tests__/actions/epics/analyze-all-epics.test.ts 2>&1 | tail -5
  ```

  Expected: `Cannot find module '@/app/actions/epics/analyze-all-epics'`

- [ ] **Step 3: Create `analyze-all-epics.ts`**

  ```typescript
  // apps/app/app/actions/epics/analyze-all-epics.ts
  "use server";

  import { requireTenantSession } from "@repo/auth/server";
  import { database } from "@repo/database";
  import { headers } from "next/headers";
  import { type Result, safeAction } from "../_base";
  import { analyzeInvest } from "./analyze-invest";

  type AnalyzeAllResult = { epicId: string; score: number | null }[];

  export async function analyzeAllEpics(): Promise<Result<AnalyzeAllResult>> {
    return safeAction(async () => {
      const ctx = await requireTenantSession(await headers());

      const epics = await database.epic.findMany({
        where: { tenantId: ctx.tenantId },
        select: { id: true },
        orderBy: { order: "asc" },
      });

      const results: AnalyzeAllResult = [];
      for (const epic of epics) {
        const res = await analyzeInvest({ epicId: epic.id });
        results.push({
          epicId: epic.id,
          score: res.ok && res.data ? res.data.compositeScore : null,
        });
      }
      return results;
    });
  }
  ```

- [ ] **Step 4: Run test — expect PASS**

  ```bash
  cd apps/app
  pnpm test __tests__/actions/epics/analyze-all-epics.test.ts 2>&1 | tail -5
  ```

  Expected: `Tests: 1 passed`

- [ ] **Step 5: Add "✦ Analyze All" button to `kanban-board.tsx`**

  In `kanban-board.tsx`, add import at top:

  ```typescript
  import { analyzeAllEpics } from "@/app/actions/epics/analyze-all-epics";
  import { toast } from "sonner";
  ```

  Add state inside the component:

  ```typescript
  const [isAnalyzingAll, setIsAnalyzingAll] = useState(false);
  ```

  Add handler:

  ```typescript
  const handleAnalyzeAll = useCallback(async () => {
    setIsAnalyzingAll(true);
    const result = await analyzeAllEpics();
    setIsAnalyzingAll(false);
    if (result.ok) {
      toast.success(`INVEST calculado para ${result.data.length} épicos`);
    } else {
      toast.error("Erro ao analisar épicos");
    }
  }, []);
  ```

  In the toolbar area (before the theme filter buttons), add:

  ```typescript
  <button
    className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-[11px] transition-colors hover:bg-muted disabled:opacity-50"
    disabled={isAnalyzingAll}
    onClick={handleAnalyzeAll}
    type="button"
  >
    <span className="text-indigo-500">✦</span>
    {isAnalyzingAll ? "Analisando…" : "Analyze All"}
  </button>
  ```

- [ ] **Step 6: Visual check**

  Navigate to `/dashboard/portfolio`. Click "✦ Analyze All". Verify toast fires. Check that cards with scores update after page refresh.

- [ ] **Step 7: Commit**

  ```bash
  git add apps/app/app/actions/epics/analyze-all-epics.ts apps/app/app/(authenticated)/dashboard/portfolio/components/kanban-board.tsx
  git commit -m "feat(kanban): batch Analyze All epics with INVEST scoring"
  ```

---

## Phase 2 — Full Creation Modal (P0/F4)

### Task 5: AI creation actions (sugar for modal)

**Files:**
- Create: `apps/app/app/actions/epics/suggest-title.ts`
- Create: `apps/app/app/actions/epics/improve-description.ts`
- Create: `apps/app/app/actions/epics/generate-ac.ts`
- Create: `apps/app/app/actions/epics/extract-transcription.ts`

- [ ] **Step 1: Write failing tests**

  Create `apps/app/__tests__/actions/epics/ai-creation.test.ts`:

  ```typescript
  import { suggestTitle } from "@/app/actions/epics/suggest-title";
  import { improveDescription } from "@/app/actions/epics/improve-description";
  import { generateAC } from "@/app/actions/epics/generate-ac";
  import { extractTranscription } from "@/app/actions/epics/extract-transcription";

  jest.mock("@repo/auth/server", () => ({
    requireTenantSession: jest.fn().mockResolvedValue({ tenantId: "t1" }),
  }));
  jest.mock("next/headers", () => ({ headers: jest.fn().mockResolvedValue({}) }));
  jest.mock("ai", () => ({
    generateText: jest.fn().mockResolvedValue({ text: "Sugestão de título" }),
    generateObject: jest.fn().mockResolvedValue({
      object: { description: "# Descrição melhorada", blocks: [] },
    }),
  }));
  jest.mock("@repo/ai/lib/models", () => ({
    getAIModel: jest.fn().mockReturnValue("mock-model"),
    getActiveProvider: jest.fn().mockReturnValue("anthropic"),
  }));

  it("suggestTitle returns a title string", async () => {
    const result = await suggestTitle({ partial: "plataforma de" });
    expect(result.ok).toBe(true);
    expect(typeof result.data).toBe("string");
  });

  it("improveDescription returns improved markdown", async () => {
    const result = await improveDescription({ title: "Migrar banco", descriptionMd: "precisa migrar" });
    expect(result.ok).toBe(true);
    expect(typeof result.data).toBe("string");
  });

  it("generateAC returns acceptance criteria string", async () => {
    const result = await generateAC({ title: "Migrar banco", descriptionMd: "migração para postgres" });
    expect(result.ok).toBe(true);
    expect(typeof result.data).toBe("string");
  });

  it("extractTranscription returns structured markdown", async () => {
    const result = await extractTranscription({ transcription: "reunião: discutimos autenticação..." });
    expect(result.ok).toBe(true);
    expect(typeof result.data).toBe("string");
  });
  ```

- [ ] **Step 2: Run test — expect FAIL**

  ```bash
  cd apps/app
  pnpm test __tests__/actions/epics/ai-creation.test.ts 2>&1 | tail -5
  ```

  Expected: 4 import errors.

- [ ] **Step 3: Create `suggest-title.ts`**

  ```typescript
  // apps/app/app/actions/epics/suggest-title.ts
  "use server";

  import { requireTenantSession } from "@repo/auth/server";
  import { generateText } from "ai";
  import { getAIModel, getActiveProvider } from "@repo/ai/lib/models";
  import { headers } from "next/headers";
  import { type Result, safeAction } from "../_base";

  export async function suggestTitle(input: { partial: string }): Promise<Result<string>> {
    return safeAction(async () => {
      await requireTenantSession(await headers());
      const provider = getActiveProvider();
      if (provider === "none") throw new Error("Nenhuma chave de IA configurada.");
      const model = getAIModel(provider, "fast");

      const { text } = await generateText({
        model,
        prompt: `Você é um especialista SAFe. Sugira um título curto e claro para um épico com base neste início: "${input.partial}". Retorne apenas o título, sem explicações, máximo 80 caracteres.`,
        maxTokens: 60,
      });

      return text.trim();
    });
  }
  ```

- [ ] **Step 4: Create `improve-description.ts`**

  ```typescript
  // apps/app/app/actions/epics/improve-description.ts
  "use server";

  import { requireTenantSession } from "@repo/auth/server";
  import { generateText } from "ai";
  import { getAIModel, getActiveProvider } from "@repo/ai/lib/models";
  import { headers } from "next/headers";
  import { type Result, safeAction } from "../_base";

  export async function improveDescription(input: {
    title: string;
    descriptionMd: string;
  }): Promise<Result<string>> {
    return safeAction(async () => {
      await requireTenantSession(await headers());
      const provider = getActiveProvider();
      if (provider === "none") throw new Error("Nenhuma chave de IA configurada.");
      const model = getAIModel(provider);

      const { text } = await generateText({
        model,
        system:
          "Você é especialista SAFe. Melhore a descrição de um épico mantendo estrutura markdown. Responda em português. Retorne apenas o markdown melhorado.",
        prompt: `Épico: "${input.title}"\n\nDescrição atual:\n${input.descriptionMd}`,
        maxTokens: 800,
      });

      return text.trim();
    });
  }
  ```

- [ ] **Step 5: Create `generate-ac.ts`**

  ```typescript
  // apps/app/app/actions/epics/generate-ac.ts
  "use server";

  import { requireTenantSession } from "@repo/auth/server";
  import { generateText } from "ai";
  import { getAIModel, getActiveProvider } from "@repo/ai/lib/models";
  import { headers } from "next/headers";
  import { type Result, safeAction } from "../_base";

  export async function generateAC(input: {
    title: string;
    descriptionMd: string;
  }): Promise<Result<string>> {
    return safeAction(async () => {
      await requireTenantSession(await headers());
      const provider = getActiveProvider();
      if (provider === "none") throw new Error("Nenhuma chave de IA configurada.");
      const model = getAIModel(provider);

      const { text } = await generateText({
        model,
        system:
          "Você é especialista SAFe. Gere critérios de aceite em formato markdown (lista de checkboxes) para o épico fornecido. Responda em português. Retorne apenas os critérios, sem explicação.",
        prompt: `Épico: "${input.title}"\n\nDescrição: ${input.descriptionMd}`,
        maxTokens: 600,
      });

      return text.trim();
    });
  }
  ```

- [ ] **Step 6: Create `extract-transcription.ts`**

  ```typescript
  // apps/app/app/actions/epics/extract-transcription.ts
  "use server";

  import { requireTenantSession } from "@repo/auth/server";
  import { generateText } from "ai";
  import { getAIModel, getActiveProvider } from "@repo/ai/lib/models";
  import { headers } from "next/headers";
  import { type Result, safeAction } from "../_base";

  export async function extractTranscription(input: {
    transcription: string;
  }): Promise<Result<string>> {
    return safeAction(async () => {
      await requireTenantSession(await headers());
      const provider = getActiveProvider();
      if (provider === "none") throw new Error("Nenhuma chave de IA configurada.");
      const model = getAIModel(provider);

      const { text } = await generateText({
        model,
        system:
          "Você é especialista SAFe. A partir de notas de reunião, extraia a estrutura de um épico em markdown com seções: ## Hipótese de Negócio, ## Resultados Esperados, ## MVPs, ## Métricas de Sucesso, ## Riscos. Responda em português.",
        prompt: `Transcrição/notas:\n${input.transcription}`,
        maxTokens: 1000,
      });

      return text.trim();
    });
  }
  ```

- [ ] **Step 7: Run test — expect PASS**

  ```bash
  cd apps/app
  pnpm test __tests__/actions/epics/ai-creation.test.ts 2>&1 | tail -5
  ```

  Expected: `Tests: 4 passed`

- [ ] **Step 8: Commit**

  ```bash
  git add apps/app/app/actions/epics/suggest-title.ts apps/app/app/actions/epics/improve-description.ts apps/app/app/actions/epics/generate-ac.ts apps/app/app/actions/epics/extract-transcription.ts
  git commit -m "feat(epics): AI creation actions — suggest title, improve description, generate AC, extract transcription"
  ```

---

### Task 6: Full creation modal upgrade (US-009, US-010)

**Files:**
- Create: `apps/app/app/(authenticated)/dashboard/portfolio/components/ai-action-buttons.tsx`
- Modify: `apps/app/app/(authenticated)/dashboard/portfolio/components/epic-create-modal.tsx`

- [ ] **Step 1: Create `ai-action-buttons.tsx`**

  ```typescript
  // apps/app/app/(authenticated)/dashboard/portfolio/components/ai-action-buttons.tsx
  "use client";

  import { useState } from "react";
  import { cn } from "@repo/design-system/lib/utils";

  type AITool = {
    id: string;
    label: string;
    phrase: string;
    color: string;
    icon: string;
    buildUrl: (context: string) => string;
  };

  const AI_TOOLS: AITool[] = [
    {
      id: "claude",
      label: "Claude",
      phrase: "Let's rock!",
      color: "#CC785C",
      icon: "✦",
      buildUrl: (ctx) =>
        `https://claude.ai/new?q=${encodeURIComponent(ctx)}`,
    },
    {
      id: "chatgpt",
      label: "ChatGPT",
      phrase: "Let's go!",
      color: "#10A37F",
      icon: "⬡",
      buildUrl: (ctx) =>
        `https://chatgpt.com/?q=${encodeURIComponent(ctx)}`,
    },
    {
      id: "gemini",
      label: "Gemini",
      phrase: "Vamos!",
      color: "#4285F4",
      icon: "◆",
      buildUrl: (ctx) =>
        `https://gemini.google.com/app?q=${encodeURIComponent(ctx)}`,
    },
    {
      id: "perplexity",
      label: "Perplexity",
      phrase: "Pesquisar",
      color: "#8B5CF6",
      icon: "◎",
      buildUrl: (ctx) =>
        `https://www.perplexity.ai/search?q=${encodeURIComponent(ctx)}`,
    },
  ];

  type Props = { epicContext: string };

  export function AIActionButtons({ epicContext }: Props) {
    const [hoveredId, setHoveredId] = useState<string | null>(null);

    return (
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground">Abrir com IA:</span>
        {AI_TOOLS.map((tool) => (
          <a
            className={cn(
              "inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-border transition-all duration-200",
              hoveredId === tool.id ? "px-3" : "w-9",
              "overflow-hidden whitespace-nowrap"
            )}
            href={tool.buildUrl(epicContext)}
            key={tool.id}
            onMouseEnter={() => setHoveredId(tool.id)}
            onMouseLeave={() => setHoveredId(null)}
            rel="noopener noreferrer"
            style={{ color: tool.color, borderColor: `${tool.color}40` }}
            target="_blank"
            title={`${tool.label}: ${tool.phrase}`}
          >
            <span className="text-sm">{tool.icon}</span>
            {hoveredId === tool.id && (
              <span className="text-[10px] font-medium">{tool.phrase}</span>
            )}
          </a>
        ))}
      </div>
    );
  }
  ```

- [ ] **Step 2: Rewrite `epic-create-modal.tsx`**

  Replace the entire file contents:

  ```typescript
  // apps/app/app/(authenticated)/dashboard/portfolio/components/epic-create-modal.tsx
  "use client";

  import { createEpic } from "@/app/actions/epics/create-epic";
  import { suggestTitle } from "@/app/actions/epics/suggest-title";
  import { extractTranscription } from "@/app/actions/epics/extract-transcription";
  import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
  } from "@repo/design-system/components/ui/dialog";
  import { Button } from "@repo/design-system/components/ui/button";
  import { Input } from "@repo/design-system/components/ui/input";
  import { Label } from "@repo/design-system/components/ui/label";
  import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from "@repo/design-system/components/ui/select";
  import { Textarea } from "@repo/design-system/components/ui/textarea";
  import { cn } from "@repo/design-system/lib/utils";
  import { useState, useTransition } from "react";
  import { toast } from "sonner";
  import { AIActionButtons } from "./ai-action-buttons";

  type Theme = { id: string; title: string; color: string };

  type Props = {
    statusId: string;
    onClose: () => void;
    onCreated: (epic: { id: string; title: string; statusId: string; order: number }) => void;
    themes: Theme[];
  };

  const EPIC_TYPES = [
    { value: "EPIC", label: "Epic" },
    { value: "FEATURE", label: "Feature" },
    { value: "STORY", label: "Story" },
  ] as const;

  const TEMPLATE_CHIPS = [
    { id: "safe", label: "SAFe Epic" },
    { id: "techdebt", label: "Tech Debt" },
    { id: "compliance", label: "Compliance" },
    { id: "innovation", label: "Innovation" },
  ];

  const TEMPLATE_DESCRIPTIONS: Record<string, string> = {
    safe: "## Hipótese de Negócio\n\n## Resultados Esperados\n\n## MVPs\n\n## Métricas de Sucesso\n\n## Riscos\n",
    techdebt: "## Problema Atual\n\n## Solução Proposta\n\n## Impacto Técnico\n\n## Critérios de Conclusão\n",
    compliance: "## Requisito Regulatório\n\n## Escopo\n\n## Evidências de Conformidade\n\n## Prazo\n",
    innovation: "## Oportunidade\n\n## Hipótese\n\n## Experimento MVP\n\n## Métricas de Validação\n",
  };

  export function EpicCreateModal({ statusId, onClose, onCreated, themes }: Props) {
    const [title, setTitle] = useState("");
    const [epicType, setEpicType] = useState<"EPIC" | "FEATURE" | "STORY">("EPIC");
    const [themeId, setThemeId] = useState<string>("");
    const [descriptionMd, setDescriptionMd] = useState("");
    const [transcription, setTranscription] = useState("");
    const [showTranscription, setShowTranscription] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [isExtracting, setIsExtracting] = useState(false);

    const handleTemplateChip = (chipId: string) => {
      setSelectedTemplate(chipId);
      setDescriptionMd(TEMPLATE_DESCRIPTIONS[chipId] ?? "");
    };

    const handleSuggestTitle = () => {
      if (!title.trim()) return;
      setIsSuggesting(true);
      suggestTitle({ partial: title }).then((result) => {
        setIsSuggesting(false);
        if (result.ok && result.data) setTitle(result.data);
      });
    };

    const handleExtractTranscription = () => {
      if (!transcription.trim()) return;
      setIsExtracting(true);
      extractTranscription({ transcription }).then((result) => {
        setIsExtracting(false);
        if (result.ok && result.data) {
          setDescriptionMd(result.data);
          toast.success("Estrutura extraída com sucesso");
        } else {
          toast.error("Erro ao extrair estrutura");
        }
      });
    };

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!title.trim()) return;
      startTransition(async () => {
        const result = await createEpic({
          title: title.trim(),
          statusId,
          strategicThemeId: themeId || null,
          descriptionMd: descriptionMd || null,
          epicType,
          dueDate: null,
          transcription: transcription || null,
        });
        if (result.ok && result.data) {
          onCreated(result.data);
          onClose();
        } else {
          toast.error("Erro ao criar épico");
        }
      });
    };

    const epicContext = `Épico: "${title}"\nTipo: ${epicType}\nDescrição: ${descriptionMd}`;

    return (
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-h-[90vh] w-full max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Novo item</DialogTitle>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {/* Type selector */}
            <div className="flex gap-2">
              {EPIC_TYPES.map((t) => (
                <button
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition-colors",
                    epicType === t.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:bg-muted"
                  )}
                  key={t.value}
                  onClick={() => setEpicType(t.value)}
                  type="button"
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Title */}
            <div className="space-y-1">
              <Input
                className="text-base font-semibold"
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`Título do ${epicType === "EPIC" ? "épico" : epicType === "FEATURE" ? "feature" : "story"}…`}
                required
                value={title}
              />
              {/* AI suggestion chips */}
              <div className="flex gap-1.5 pt-1">
                <button
                  className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] text-indigo-500 transition-colors hover:bg-muted disabled:opacity-50"
                  disabled={!title.trim() || isSuggesting}
                  onClick={handleSuggestTitle}
                  type="button"
                >
                  <span>✦</span>
                  {isSuggesting ? "Sugerindo…" : "Sugerir título"}
                </button>
              </div>
            </div>

            {/* Template chips */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Template</Label>
              <div className="flex flex-wrap gap-1.5">
                {TEMPLATE_CHIPS.map((chip) => (
                  <button
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                      selectedTemplate === chip.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-muted"
                    )}
                    key={chip.id}
                    onClick={() => handleTemplateChip(chip.id)}
                    type="button"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            {/* MetaGrid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Theme */}
              {themes.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Tema Estratégico</Label>
                  <Select onValueChange={setThemeId} value={themeId}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Nenhum" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nenhum</SelectItem>
                      {themes.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          <span className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} />
                            {t.title}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Transcription section */}
            <div className="space-y-2">
              <button
                className="flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setShowTranscription(!showTranscription)}
                type="button"
              >
                <span className={cn("transition-transform", showTranscription ? "rotate-90" : "")}>▶</span>
                Transcrição de reunião
              </button>
              {showTranscription && (
                <div className="space-y-2">
                  <Textarea
                    className="min-h-[80px] text-xs"
                    onChange={(e) => setTranscription(e.target.value)}
                    placeholder="Cole as notas da reunião aqui…"
                    value={transcription}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">
                      {transcription.length} caracteres
                    </span>
                    <button
                      className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[10px] text-indigo-500 transition-colors hover:bg-muted disabled:opacity-50"
                      disabled={!transcription.trim() || isExtracting}
                      onClick={handleExtractTranscription}
                      type="button"
                    >
                      <span>✦</span>
                      {isExtracting ? "Extraindo…" : "Extrair estrutura"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* AI Action Buttons */}
            {title.trim() && <AIActionButtons epicContext={epicContext} />}

            {/* Footer */}
            <div className="flex justify-end gap-2 border-t pt-3">
              <Button disabled={isPending} onClick={onClose} type="button" variant="outline">
                Cancelar
              </Button>
              <Button disabled={isPending || !title.trim()} type="submit">
                {isPending ? "Criando…" : `Criar ${epicType === "EPIC" ? "Épico" : epicType === "FEATURE" ? "Feature" : "Story"}`}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    );
  }
  ```

- [ ] **Step 3: Run TypeScript check**

  ```bash
  cd apps/app
  pnpm typecheck 2>&1 | grep "epic-create-modal\|ai-action-buttons" | head -10
  ```

  Expected: no errors for these two files.

- [ ] **Step 4: Visual check**

  Navigate to `/dashboard/portfolio`. Click "+" on any column. Verify:
  - Type selector shows Epic / Feature / Story pills
  - SAFe Epic / Tech Debt template chips fill description textarea on click
  - "✦ Sugerir título" chip calls the action when title has text
  - Transcription toggle shows collapsible section
  - "✦ Extrair estrutura" fires when transcription has text
  - AI action buttons (Claude/ChatGPT/Gemini/Perplexity) appear when title filled
  - Hover on each button expands it with the phrase
  - Create button says "Criar Épico" / "Criar Feature" / "Criar Story"

- [ ] **Step 5: Commit**

  ```bash
  git add apps/app/app/(authenticated)/dashboard/portfolio/components/
  git commit -m "feat(kanban): full creation modal — type selector, templates, MetaGrid, AI chips, transcription"
  ```

---

## Phase 3 — P1: TipTap Slash Commands

### Task 7: Slash commands in drawer description editor

**Files:**
- Create: `apps/app/app/(authenticated)/dashboard/portfolio/components/tiptap-slash-extension.ts`
- Modify: `apps/app/app/(authenticated)/dashboard/portfolio/components/epic-drawer-description.tsx`

- [ ] **Step 1: Install `@tiptap/suggestion`**

  ```bash
  cd apps/app
  pnpm add @tiptap/suggestion
  ```

  Expected: `packages/app/package.json` updated with `@tiptap/suggestion`.

- [ ] **Step 2: Create the slash extension**

  ```typescript
  // apps/app/app/(authenticated)/dashboard/portfolio/components/tiptap-slash-extension.ts
  import { Extension } from "@tiptap/core";
  import Suggestion from "@tiptap/suggestion";
  import type { Editor } from "@tiptap/core";

  export type SlashItem = {
    title: string;
    description: string;
    command: (editor: Editor) => void;
  };

  const SLASH_ITEMS: SlashItem[] = [
    {
      title: "Parágrafo",
      description: "Texto comum",
      command: (editor) => editor.chain().focus().setParagraph().run(),
    },
    {
      title: "Título 1",
      description: "Seção principal",
      command: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      title: "Título 2",
      description: "Subseção",
      command: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      title: "Título 3",
      description: "Subitem",
      command: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      title: "Lista com marcadores",
      description: "Lista não ordenada",
      command: (editor) => editor.chain().focus().toggleBulletList().run(),
    },
    {
      title: "Checkbox",
      description: "Lista de tarefas",
      command: (editor) => editor.chain().focus().toggleTaskList().run(),
    },
    {
      title: "Citação",
      description: "Bloco de citação",
      command: (editor) => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      title: "Código",
      description: "Bloco de código",
      command: (editor) => editor.chain().focus().toggleCodeBlock().run(),
    },
    {
      title: "Divisor",
      description: "Linha horizontal",
      command: (editor) => editor.chain().focus().setHorizontalRule().run(),
    },
  ];

  export const SlashCommands = Extension.create({
    name: "slashCommands",

    addOptions() {
      return {
        suggestion: {
          char: "/",
          command: ({
            editor,
            range,
            props,
          }: {
            editor: Editor;
            range: { from: number; to: number };
            props: SlashItem;
          }) => {
            props.command(editor);
            editor.commands.deleteRange(range);
          },
        },
      };
    },

    addProseMirrorPlugins() {
      return [
        Suggestion({
          editor: this.editor,
          ...this.options.suggestion,
        }),
      ];
    },
  });

  export function filterSlashItems(query: string): SlashItem[] {
    return SLASH_ITEMS.filter(
      (item) =>
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.description.toLowerCase().includes(query.toLowerCase())
    );
  }
  ```

- [ ] **Step 3: Update `epic-drawer-description.tsx` to use slash commands + inline AI toolbar**

  Replace the `useEditor` extensions array and add the toolbar:

  ```typescript
  "use client";

  import type { AggregatedPortfolioEpic } from "@/lib/portfolio-aggregate";
  import { updateEpic } from "@/app/actions/epics/update-epic";
  import { improveDescription } from "@/app/actions/epics/improve-description";
  import { generateAC } from "@/app/actions/epics/generate-ac";
  import { analyzeInvest } from "@/app/actions/epics/analyze-invest";
  import { useEditor, EditorContent } from "@tiptap/react";
  import StarterKit from "@tiptap/starter-kit";
  import Placeholder from "@tiptap/extension-placeholder";
  import TaskList from "@tiptap/extension-task-list";
  import TaskItem from "@tiptap/extension-task-item";
  import { SlashCommands, filterSlashItems } from "./tiptap-slash-extension";
  import { useEffect, useRef, useState, useTransition } from "react";
  import { toast } from "sonner";
  import { cn } from "@repo/design-system/lib/utils";

  type Props = { epic: AggregatedPortfolioEpic };

  // Slash command menu component
  function SlashMenu({
    items,
    onSelect,
    visible,
  }: {
    items: ReturnType<typeof filterSlashItems>;
    onSelect: (item: ReturnType<typeof filterSlashItems>[number]) => void;
    visible: boolean;
  }) {
    if (!visible || items.length === 0) return null;
    return (
      <div className="absolute z-50 rounded-lg border border-border bg-popover shadow-lg w-56 overflow-hidden">
        {items.map((item) => (
          <button
            className="flex w-full flex-col px-3 py-2 text-left hover:bg-muted transition-colors"
            key={item.title}
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(item);
            }}
            type="button"
          >
            <span className="text-sm font-medium">{item.title}</span>
            <span className="text-[10px] text-muted-foreground">{item.description}</span>
          </button>
        ))}
      </div>
    );
  }

  function escapeHtml(raw: string): string {
    return raw
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function markdownToHtml(md: string): string {
    return md
      .split("\n")
      .map((line) => {
        if (/^### /.test(line)) return `<h3>${escapeHtml(line.slice(4))}</h3>`;
        if (/^## /.test(line)) return `<h2>${escapeHtml(line.slice(3))}</h2>`;
        if (/^# /.test(line)) return `<h1>${escapeHtml(line.slice(2))}</h1>`;
        if (/^> /.test(line)) return `<blockquote><p>${escapeHtml(line.slice(2))}</p></blockquote>`;
        if (/^- \[x\] /i.test(line)) return `<ul data-type="taskList"><li data-type="taskItem" data-checked="true">${escapeHtml(line.slice(6))}</li></ul>`;
        if (/^- \[ \] /.test(line)) return `<ul data-type="taskList"><li data-type="taskItem" data-checked="false">${escapeHtml(line.slice(6))}</li></ul>`;
        if (/^- /.test(line)) return `<ul><li>${escapeHtml(line.slice(2))}</li></ul>`;
        if (/^---$/.test(line)) return "<hr />";
        if (line === "") return "<p></p>";
        return `<p>${escapeHtml(line)}</p>`;
      })
      .filter(Boolean)
      .join("");
  }

  function loadContent(md: string | null): string {
    if (!md) return "";
    if (md.trimStart().startsWith("<")) return md;
    return markdownToHtml(md);
  }

  export function EpicDrawerDescription({ epic }: Props) {
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const epicRef = useRef(epic);
    const [slashVisible, setSlashVisible] = useState(false);
    const [slashQuery, setSlashQuery] = useState("");
    const [isPendingImprove, startImproveTransition] = useTransition();
    const [isPendingAC, startACTransition] = useTransition();

    useEffect(() => { epicRef.current = epic; }, [epic]);

    const editor = useEditor({
      extensions: [
        StarterKit,
        TaskList,
        TaskItem.configure({ nested: true }),
        Placeholder.configure({ placeholder: "Descreva este épico… Digite / para comandos." }),
        SlashCommands.configure({
          suggestion: {
            char: "/",
            onStart: () => setSlashVisible(true),
            onUpdate: ({ query }: { query: string }) => setSlashQuery(query),
            onExit: () => { setSlashVisible(false); setSlashQuery(""); },
            items: ({ query }: { query: string }) => filterSlashItems(query),
            command: ({ editor: ed, range, props }: { editor: typeof editor; range: { from: number; to: number }; props: ReturnType<typeof filterSlashItems>[number] }) => {
              if (!ed) return;
              props.command(ed);
              ed.commands.deleteRange(range);
              setSlashVisible(false);
            },
            render: () => ({
              onStart: () => {},
              onUpdate: () => {},
              onExit: () => {},
            }),
          },
        }),
      ],
      content: loadContent(epic.descriptionMd),
      editorProps: {
        attributes: {
          class: "prose prose-sm dark:prose-invert max-w-none min-h-[200px] p-6 focus:outline-none",
        },
      },
      onUpdate: ({ editor: ed }) => {
        const content = ed.getHTML();
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(async () => {
          try {
            const result = await updateEpic({ epicId: epicRef.current.id, descriptionMd: content });
            if (!result.ok) toast.error("Erro ao salvar descrição");
          } catch {
            toast.error("Erro ao salvar descrição");
          }
        }, 1500);
      },
    });

    useEffect(() => {
      return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
    }, []);

    const handleImprove = () => {
      if (!editor) return;
      startImproveTransition(async () => {
        const result = await improveDescription({
          title: epicRef.current.title,
          descriptionMd: editor.getHTML(),
        });
        if (result.ok && result.data) {
          editor.commands.setContent(markdownToHtml(result.data));
          toast.success("Descrição melhorada");
        } else {
          toast.error("Erro ao melhorar descrição");
        }
      });
    };

    const handleGenerateAC = () => {
      if (!editor) return;
      startACTransition(async () => {
        const result = await generateAC({
          title: epicRef.current.title,
          descriptionMd: editor.getHTML(),
        });
        if (result.ok && result.data) {
          editor.commands.insertContent(markdownToHtml("\n\n## Critérios de Aceite\n" + result.data));
          toast.success("Critérios de aceite gerados");
        } else {
          toast.error("Erro ao gerar critérios");
        }
      });
    };

    const slashItems = filterSlashItems(slashQuery);

    return (
      <div className="flex h-full flex-col">
        {/* Inline AI toolbar */}
        <div className="flex gap-1.5 border-b px-4 py-2">
          <button
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] transition-colors hover:bg-muted disabled:opacity-40",
              "border-border text-indigo-500"
            )}
            disabled={isPendingImprove}
            onClick={handleImprove}
            type="button"
          >
            <span>✦</span>
            {isPendingImprove ? "Melhorando…" : "Melhorar com IA"}
          </button>
          <button
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] transition-colors hover:bg-muted disabled:opacity-40",
              "border-border text-indigo-500"
            )}
            disabled={isPendingAC}
            onClick={handleGenerateAC}
            type="button"
          >
            <span>✦</span>
            {isPendingAC ? "Gerando…" : "Gerar Critérios de Aceite"}
          </button>
        </div>

        {/* Editor area */}
        <div className="relative flex-1 overflow-y-auto">
          <EditorContent editor={editor} />
          <SlashMenu
            items={slashItems}
            onSelect={(item) => {
              if (editor) item.command(editor);
              setSlashVisible(false);
            }}
            visible={slashVisible}
          />
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 4: Install task-list extensions if missing**

  ```bash
  cd apps/app
  pnpm add @tiptap/extension-task-list @tiptap/extension-task-item
  pnpm typecheck 2>&1 | grep "epic-drawer-description" | head -10
  ```

  Expected: no type errors for the description file.

- [ ] **Step 5: Visual check**

  Open any epic's drawer → Description tab. Type `/`. Verify dropdown appears with block types. Select "Título 2" — heading inserts. Verify "✦ Melhorar com IA" fires improve action. Verify "✦ Gerar Critérios de Aceite" appends AC section.

- [ ] **Step 6: Commit**

  ```bash
  git add apps/app/app/(authenticated)/dashboard/portfolio/components/tiptap-slash-extension.ts apps/app/app/(authenticated)/dashboard/portfolio/components/epic-drawer-description.tsx apps/app/package.json pnpm-lock.yaml
  git commit -m "feat(editor): TipTap slash commands + AI inline toolbar (improve, generate AC)"
  ```

---

## Phase 4 — P2: Multiplayer Cursors

### Task 8: Render Liveblocks cursors on the board

**Files:**
- Create: `apps/app/app/(authenticated)/dashboard/portfolio/components/multiplayer-cursors.tsx`
- Modify: `apps/app/app/(authenticated)/dashboard/portfolio/components/kanban-board.tsx`

- [ ] **Step 1: Create `multiplayer-cursors.tsx`**

  ```typescript
  // apps/app/app/(authenticated)/dashboard/portfolio/components/multiplayer-cursors.tsx
  "use client";

  import { useOthers } from "@repo/collaboration/hooks";
  import { motion, AnimatePresence } from "framer-motion";

  function hashColor(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 70%, 55%)`;
  }

  export function MultiplayerCursors() {
    const others = useOthers();

    return (
      <AnimatePresence>
        {others.map(({ connectionId, presence, info }) => {
          const cursor = presence.cursor as { x: number; y: number } | null;
          if (!cursor) return null;

          const name = (info as { name?: string })?.name ?? `User ${connectionId}`;
          const color = hashColor(String(connectionId));

          return (
            <motion.div
              animate={{ opacity: 1 }}
              className="pointer-events-none fixed z-50"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              key={connectionId}
              style={{ left: cursor.x, top: cursor.y }}
              transition={{ duration: 0.1 }}
            >
              {/* Cursor SVG */}
              <svg
                height="20"
                viewBox="0 0 20 20"
                width="20"
                style={{ color }}
                fill="currentColor"
              >
                <path d="M4 2L16 10L9 11L6 18L4 2Z" />
              </svg>
              {/* Name tooltip */}
              <div
                className="mt-1 ml-3 rounded px-1.5 py-0.5 text-[10px] font-medium text-white whitespace-nowrap"
                style={{ backgroundColor: color }}
              >
                {name}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    );
  }
  ```

- [ ] **Step 2: Add online count indicator + cursors to `kanban-board.tsx`**

  Add the import:

  ```typescript
  import { MultiplayerCursors } from "./multiplayer-cursors";
  ```

  In the JSX, wrap the entire board in a `relative` container and add the cursors overlay. Also add the "N online" indicator in the toolbar:

  In the toolbar area (near theme filter), add:

  ```typescript
  {others.length > 0 && (
    <div className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-[10px]">
      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
      {others.length} online
    </div>
  )}
  ```

  After the closing `</DndContext>` tag, before the final closing div of the board, add:

  ```typescript
  <MultiplayerCursors />
  ```

  Make sure the outermost board wrapper has `className="relative"`.

- [ ] **Step 3: Run TypeScript check**

  ```bash
  cd apps/app
  pnpm typecheck 2>&1 | grep "multiplayer-cursors\|kanban-board" | head -10
  ```

  Expected: no errors.

- [ ] **Step 4: Visual check (requires two browser tabs)**

  Open `/dashboard/portfolio` in two browser windows. Move cursor in one window. Verify named cursor appears in the other window. Verify "N online" badge shows in both.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/app/app/(authenticated)/dashboard/portfolio/components/multiplayer-cursors.tsx apps/app/app/(authenticated)/dashboard/portfolio/components/kanban-board.tsx
  git commit -m "feat(kanban): multiplayer cursors + online presence indicator"
  ```

---

## Self-Review

### Spec coverage check

| PRD Requirement | Task |
|----------------|------|
| F1 Board (columns, WIP, DnD) | ✅ Already done |
| F2 Card anatomy (INVEST bar, type badge, border tint, hover expand) | Task 3 |
| F3 AI INVEST scoring (hash cache, per-card) | ✅ Already done |
| F3 AI Analysis batch "Analyze All" | Task 4 |
| F4 Creation modal type selector | Task 6 |
| F4 Creation modal AI suggestion chips | Task 6 |
| F4 Creation modal template chips | Task 6 |
| F4 Creation modal MetaGrid (theme link) | Task 6 |
| F4 Creation modal AI Action Buttons (5 circular) | Task 6 |
| F5 Editor slash commands | Task 7 |
| F5 Editor inline AI (improve, generate AC) | Task 7 |
| F6 Transcription section + extract | Task 6 |
| F7 Multiplayer cursors | Task 8 |
| SRD suggest-title Haiku <1.5s | Task 5 |
| SRD improve-description Sonnet <5s | Task 5 |
| SRD generate-AC Sonnet <4s | Task 5 |
| SRD extract-transcription Sonnet <8s | Task 5 |

### Known deferred items (out of scope for this plan)
- STAR analysis tab (drawer) — "em breve" placeholder exists
- Granularidade tab (drawer) — "em breve" placeholder exists
- `dueDate` MetaGrid input (date picker) in creation modal — schema ready, UI can be added in next iteration
- Template save/persist (US-013 `SaveDefaultToast`) — templates are local constants; DB-backed template persistence left for next sprint
- Block handles (+ and ⋮⋮) on hover in editor — requires ProseMirror node view, left for next sprint
- Full `@tiptap/extension-mention` for co-author @mention chips
