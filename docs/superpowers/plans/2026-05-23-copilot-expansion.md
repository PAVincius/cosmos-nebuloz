# Copilot Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the Cosmos Copilot with 4 new query tools, a `navigate_to` suggestion type (UI deep-link action), an ART-level context builder, and a system prompt update that documents all capabilities.

**Architecture:** All new tools follow the existing Vercel AI SDK `tool()` in-process pattern in `tools.ts` — no MCP server. The `navigate_to` suggestion is purely client-side (no DB write): the frontend parses the XML tag, renders a navigation button, and calls `router.push`. Context enrichment follows the existing builder pattern in `context/`.

**Tech Stack:** Vercel AI SDK, Prisma (`database.aRT`, `database.team`, `database.epic`, `database.oKR`), Next.js App Router (`useRouter`), React, Tailwind + `dark:` variants, Zod.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/app/app/actions/safe-copilot/tools.ts` | Modify | Add `queryARTs`, `queryTeams`, `queryEpics`, `queryOKRs` |
| `apps/app/app/actions/safe-copilot/context/arts.ts` | Create | `buildARTsContext` — list ARTs + latest flow metrics |
| `apps/app/app/actions/safe-copilot/context/index.ts` | Modify | Wire `ArtsContext` into `CopilotContext`, load for `global`/`rte` mode |
| `apps/app/app/actions/safe-copilot/prompts/index.ts` | Modify | Document new tools + `navigate_to` format in `COPILOT_BASE_RULES` + `summarizeContext` |
| `apps/app/app/(authenticated)/components/copilot/copilot-suggestions.tsx` | Modify | Add `NavigateSuggestionCard` for `navigate_to` type |

**Parallelism:**
- Tasks 1, 2, 3 are fully independent → run in parallel
- Task 4 (prompt update) depends on Tasks 1 + 3 → run after

---

## Task 1: Add 4 new query tools to tools.ts

**Files:**
- Modify: `apps/app/app/actions/safe-copilot/tools.ts`

Append inside `buildCopilotTools` return object, after `moveFeature`.

- [ ] **Step 1: Add tools**

```typescript
// ── inside the return { ... } of buildCopilotTools, after moveFeature: ──

    queryARTs: tool({
      description:
        "List all ARTs in the tenant with their latest flow metrics. Use this when the user asks which ART is underperforming, to compare ARTs, or when you need ART IDs for further queries.",
      inputSchema: z.object({
        includeMetrics: z
          .boolean()
          .default(true)
          .describe("Include latest flow metrics per ART"),
      }),
      execute: async ({ includeMetrics }) => {
        const arts = await database.aRT.findMany({
          where: { tenantId },
          select: { id: true, name: true, cadence: true },
        });

        if (!includeMetrics) return { arts };

        const snapshots = await database.flowMetricSnapshot.findMany({
          where: {
            tenantId,
            scope: "art",
            scopeId: { in: arts.map((a) => a.id) },
          },
          orderBy: { periodRef: "desc" },
          select: {
            scopeId: true,
            periodRef: true,
            flowVelocityTotal: true,
            flowEfficiency: true,
            flowPredictability: true,
          },
        });

        const latestByArt = new Map<string, (typeof snapshots)[0]>();
        for (const s of snapshots) {
          if (!latestByArt.has(s.scopeId)) latestByArt.set(s.scopeId, s);
        }

        return {
          arts: arts.map((a) => ({
            ...a,
            latestMetrics: latestByArt.get(a.id) ?? null,
          })),
        };
      },
    }),

    queryTeams: tool({
      description:
        "List teams, optionally filtered by ART ID. Returns team names, IDs, velocity, and sprint length. Use to answer questions about team capacity or composition.",
      inputSchema: z.object({
        artId: z
          .string()
          .optional()
          .describe("Filter teams belonging to this ART"),
      }),
      execute: async ({ artId }) => {
        const teams = await database.team.findMany({
          where: { tenantId, ...(artId ? { artId } : {}) },
          select: {
            id: true,
            name: true,
            velocity: true,
            sprintLengthDays: true,
            artId: true,
          },
          take: 30,
        });
        return { teams };
      },
    }),

    queryEpics: tool({
      description:
        "List epics with status and feature count. Use to answer questions about portfolio delivery, epic progress, or finding epics linked to strategic themes.",
      inputSchema: z.object({
        status: z
          .string()
          .optional()
          .describe("Filter by statusId, e.g. BACKLOG, IN_PROGRESS, DONE"),
        take: z
          .number()
          .int()
          .min(1)
          .max(30)
          .default(15)
          .describe("Number of epics to retrieve"),
      }),
      execute: async ({ status, take }) => {
        const epics = await database.epic.findMany({
          where: { tenantId, ...(status ? { statusId: status } : {}) },
          select: {
            id: true,
            title: true,
            statusId: true,
            strategicThemeId: true,
            _count: { select: { features: true } },
          },
          orderBy: { createdAt: "desc" },
          take,
        });
        return {
          epics: epics.map((e) => ({
            id: e.id,
            title: e.title,
            statusId: e.statusId,
            strategicThemeId: e.strategicThemeId,
            featuresCount: e._count.features,
          })),
        };
      },
    }),

    queryOKRs: tool({
      description:
        "Query OKRs and their key results with progress (current vs target). Use to answer questions about strategic alignment, OKR health, or which objectives are at risk.",
      inputSchema: z.object({
        status: z
          .enum(["ON_TRACK", "AT_RISK", "BEHIND", "ACHIEVED"])
          .optional()
          .describe("Filter by OKR status"),
        type: z
          .string()
          .optional()
          .describe(
            "Filter by type: portfolio_theme, portfolio_epic, pi_art, team_pi, improvement"
          ),
      }),
      execute: async ({ status, type }) => {
        const okrs = await database.oKR.findMany({
          where: {
            tenantId,
            ...(status ? { status } : {}),
            ...(type ? { type } : {}),
          },
          select: {
            id: true,
            title: true,
            type: true,
            status: true,
            artId: true,
            teamId: true,
            horizon: true,
            keyResults: {
              select: {
                id: true,
                title: true,
                current: true,
                target: true,
                unit: true,
                metric: true,
              },
              take: 5,
            },
          },
          take: 20,
        });
        return { okrs };
      },
    }),
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz
npx tsc --noEmit -p apps/app/tsconfig.json 2>&1 | grep -E 'tools\.ts|error' | head -20
```

Expected: no errors referencing `tools.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/app/app/actions/safe-copilot/tools.ts
git commit -m "feat(copilot): add queryARTs, queryTeams, queryEpics, queryOKRs tools"
```

---

## Task 2: navigate_to suggestion (frontend only)

**Files:**
- Modify: `apps/app/app/(authenticated)/components/copilot/copilot-suggestions.tsx`

`navigate_to` is never persisted to DB — handled entirely on the client. No changes needed to `safe-copilot/index.ts`.

- [ ] **Step 1: Add NavigateSuggestionCard and wire it**

Add after the imports, before `SuggestionCard`:

```typescript
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
```

Add the `NavigateSuggestionCard` component (insert before `SuggestionCard`):

```typescript
type NavigatePayload = {
  route: string;
  params?: Record<string, string>;
  label?: string;
};

function NavigateSuggestionCard({ suggestion }: { suggestion: ParsedSuggestion }) {
  const router = useRouter();
  const payload = suggestion.payload as NavigatePayload;
  const label = payload.label ?? "Navegar para view";

  const href = payload.params
    ? `${payload.route}?${new URLSearchParams(payload.params).toString()}`
    : payload.route;

  return (
    <div className="mt-2 flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2">
      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-violet-500" />
      <span className="flex-1 text-foreground text-xs">{label}</span>
      <Button
        className="h-7 text-xs"
        onClick={() => router.push(href)}
        size="sm"
      >
        Ir
      </Button>
    </div>
  );
}
```

In `CopilotSuggestions` (update the `suggestions.map` in the return):

```typescript
  return (
    <div className="mt-2 space-y-2">
      {suggestions.map((s) => (
        s.type === "navigate_to" ? (
          <NavigateSuggestionCard
            key={`navigate-${String(JSON.stringify(s.payload)).slice(0, 30)}`}
            suggestion={s}
          />
        ) : (
          <SuggestionCard
            key={`${s.type}-${String(JSON.stringify(s.payload)).slice(0, 30)}`}
            sessionId={sessionId}
            suggestion={s}
          />
        )
      ))}
    </div>
  );
```

Note: `CopilotSuggestionsProps` already has `sessionId` — pass it through to `SuggestionCard` as before.

- [ ] **Step 2: Verify no type errors**

```bash
cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz
npx tsc --noEmit -p apps/app/tsconfig.json 2>&1 | grep -E 'copilot-suggestions|error' | head -20
```

- [ ] **Step 3: Commit**

```bash
git add apps/app/app/\(authenticated\)/components/copilot/copilot-suggestions.tsx
git commit -m "feat(copilot): add navigate_to suggestion card with deep-link navigation"
```

---

## Task 3: ARTs context builder

**Files:**
- Create: `apps/app/app/actions/safe-copilot/context/arts.ts`
- Modify: `apps/app/app/actions/safe-copilot/context/index.ts`

- [ ] **Step 1: Create arts.ts**

```typescript
import { database } from "@repo/database";

export type ARTsContext = {
  arts: Array<{
    id: string;
    name: string;
    cadence: number;
    teamsCount: number;
    latestMetrics: {
      periodRef: string;
      flowVelocityTotal: number | null;
      flowEfficiency: number | null;
      flowPredictability: number | null;
    } | null;
  }>;
};

export async function buildARTsContext(tenantId: string): Promise<ARTsContext> {
  const arts = await database.aRT.findMany({
    where: { tenantId },
    select: {
      id: true,
      name: true,
      cadence: true,
      _count: { select: { teams: true } },
    },
  });

  const snapshots = await database.flowMetricSnapshot.findMany({
    where: {
      tenantId,
      scope: "art",
      scopeId: { in: arts.map((a) => a.id) },
    },
    orderBy: { periodRef: "desc" },
    select: {
      scopeId: true,
      periodRef: true,
      flowVelocityTotal: true,
      flowEfficiency: true,
      flowPredictability: true,
    },
  });

  const latestByArt = new Map<string, (typeof snapshots)[0]>();
  for (const s of snapshots) {
    if (!latestByArt.has(s.scopeId)) latestByArt.set(s.scopeId, s);
  }

  return {
    arts: arts.map((a) => {
      const m = latestByArt.get(a.id) ?? null;
      return {
        id: a.id,
        name: a.name,
        cadence: a.cadence,
        teamsCount: a._count.teams,
        latestMetrics: m
          ? {
              periodRef: m.periodRef,
              flowVelocityTotal: m.flowVelocityTotal,
              flowEfficiency: m.flowEfficiency,
              flowPredictability: m.flowPredictability,
            }
          : null,
      };
    }),
  };
}
```

- [ ] **Step 2: Update context/index.ts**

Add to the `CopilotContext` type:
```typescript
arts?: Awaited<ReturnType<typeof buildARTsContext>>;
```

Add the import:
```typescript
import { buildARTsContext } from "./arts";
export type { ARTsContext } from "./arts";
```

Add loader inside `buildCopilotContext` (after the existing loaders, before `await Promise.all`):

```typescript
  // Load ARTs context for global and rte modes — enables ART comparison queries
  if (mode === "global" || mode === "rte") {
    loaders.push(
      buildARTsContext(tenantId).then((data) => {
        ctx.arts = data;
      })
    );
  }
```

- [ ] **Step 3: Verify**

```bash
cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz
npx tsc --noEmit -p apps/app/tsconfig.json 2>&1 | grep -E 'context|arts|error' | head -20
```

- [ ] **Step 4: Commit**

```bash
git add apps/app/app/actions/safe-copilot/context/arts.ts \
        apps/app/app/actions/safe-copilot/context/index.ts
git commit -m "feat(copilot): add ARTs context builder with flow metrics for global/rte mode"
```

---

## Task 4: Update system prompt (depends on Tasks 1 + 3)

**Files:**
- Modify: `apps/app/app/actions/safe-copilot/prompts/index.ts`

Two changes: (a) update `COPILOT_BASE_RULES` to document new tools + `navigate_to`; (b) update `summarizeContext` to render ARTs context.

- [ ] **Step 1: Update COPILOT_BASE_RULES**

Find the section:
```
FERRAMENTAS DISPONÍVEIS (use somente após confirmação explícita do usuário):
- createFeature: Cria uma feature no backlog com parâmetros WSJF (bv, tc, rr, js)
- moveFeature: Move uma feature para um novo status (BACKLOG, IN_PROGRESS, DONE, CANCELLED)
- queryFlowMetrics, queryLeanBudget, queryProgramBoard, queryRiskVectors: Consultas de dados (sem efeito colateral)
```

Replace with:
```
FERRAMENTAS DISPONÍVEIS:
CONSULTAS (sem efeito colateral — use livremente):
- queryARTs: Lista todos os ARTs do tenant com métricas de flow mais recentes (velocity, efficiency, predictability). Use para comparar ARTs ou obter IDs.
- queryTeams: Lista times, filtrado opcionalmente por artId. Retorna name, velocity, sprintLengthDays.
- queryEpics: Lista épicos com status e contagem de features. Filtros: status (BACKLOG/IN_PROGRESS/DONE).
- queryOKRs: Lista OKRs com KeyResults (current/target/unit). Filtros: status (ON_TRACK/AT_RISK/BEHIND/ACHIEVED), type.
- queryFlowMetrics: Métricas de flow por scope/scopeId com N períodos.
- queryLeanBudget: Budget alocado vs gasto por entidade.
- queryProgramBoard: Features, riscos e objetivos de um PI.
- queryRiskVectors: Busca semântica vetorial em riscos.

AÇÕES DE ESCRITA (solicitar confirmação explícita do usuário antes de executar):
- createFeature: Cria feature no backlog com WSJF (bv, tc, rr, js). Calcule e apresente WSJF antes de criar.
- moveFeature: Move feature para status (BACKLOG, IN_PROGRESS, DONE, CANCELLED).

FORMATO DE SUGESTÕES NAVIGATE_TO:
Quando a resposta referencia uma view específica do Cosmos que o usuário pode navegar, inclua:
<suggestion type="navigate_to">{ "route": "/caminho/da/rota", "params": { "chave": "valor" }, "label": "Texto descritivo do botão" }</suggestion>

Rotas disponíveis (params como query string):
- /arts → lista todos os ARTs (params: nenhum)
- /arts/[artId] → detalhe do ART (substitua [artId] pelo ID real)
- /arts/[artId]/program-board → program board do ART
- /analytics/flow → flow metrics (params: scope, scopeId, period)
- /analytics/velocity → velocity por time
- /teams → lista times
- /teams/[teamId] → detalhe do time
- /portfolio/okrs → todos os OKRs
- /portfolio/wsjf → priorização WSJF
- /portfolio/budgets → lean budgets
- /risks → todos os riscos
- /epics/[epicId] → detalhe do épico
- /dependencies → mapa de dependências

EXEMPLO: "Qual ART está com menor flow efficiency?"
→ Chame queryARTs, identifique o ART X, responda com a análise, e inclua:
<suggestion type="navigate_to">{ "route": "/analytics/flow", "params": { "scope": "art", "scopeId": "id-do-art-x" }, "label": "Ver Flow Metrics do ART X" }</suggestion>
```

- [ ] **Step 2: Update summarizeContext to render ARTs**

Inside `summarizeContext`, after the existing `wsjf` block (before the `return`):

```typescript
  if (ctx.arts && ctx.arts.arts.length > 0) {
    const artLines = ctx.arts.arts.map((a) => {
      const m = a.latestMetrics;
      const metrics = m
        ? `vel=${m.flowVelocityTotal ?? "?"} eff=${m.flowEfficiency ?? "?"} pred=${m.flowPredictability ?? "?"}`
        : "sem métricas";
      return `[${a.id}] ${sanitizeForPrompt(a.name)} (${a.teamsCount} times, cadence:${a.cadence}w) — ${metrics}`;
    });
    parts.push(
      `\nARTs DO TENANT — ${ctx.arts.arts.length} ARTs:`,
      artLines.join("\n")
    );
  }
```

- [ ] **Step 3: Update CopilotContext type reference in summarizeContext**

The function signature is `function summarizeContext(ctx: CopilotContext)` — `CopilotContext` already has `arts?` after Task 3. No signature change needed.

- [ ] **Step 4: Verify**

```bash
cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz
npx tsc --noEmit -p apps/app/tsconfig.json 2>&1 | grep -E 'prompts|error' | head -20
```

- [ ] **Step 5: Commit**

```bash
git add apps/app/app/actions/safe-copilot/prompts/index.ts
git commit -m "feat(copilot): update system prompt with new tools, navigate_to format, and ARTs context"
```

---

## Self-Review Checklist

- [x] All 4 new tools use `tenantId` scoping — no cross-tenant data leakage
- [x] `navigate_to` has no server action — pure client, no IDOR risk
- [x] `queryOKRs` uses real KeyResult fields (`current`, `target`, `unit`, `metric`) from generated schema
- [x] `buildARTsContext` deduplicates snapshots with `Map` (no N+1, 2 queries total)
- [x] ARTs context only loads for `global` and `rte` modes — no extra cost for other modes
- [x] All Prisma model access follows existing patterns: `database.aRT`, `database.team`, `database.epic`, `database.oKR`
- [x] navigate_to renders correctly for both light and dark mode (uses `bg-muted/20`, `text-foreground` — semantic tokens)
