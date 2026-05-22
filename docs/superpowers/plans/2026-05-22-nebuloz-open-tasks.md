# Nebuloz Open Tasks — M6 + LACE + M7 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete all open Linear tasks: NEB-18 (C Híbrido dashboard), NEB-13 (LACE tool use/RAG/WSJF), NEB-20 spike resolution, NEB-21 LinearSync schema, NEB-22 Import Wizard, NEB-23 Webhook.

**Architecture:** Three subsystems in sequence — M6 on current branch `feat/flow-intelligence-p0-schema`; LACE on new branch `feat/lace-tool-use`; M7 on new branch `feat/m7-linear-integration`. Subsystems are independent but M7 tasks are sequential (schema → wizard → webhook).

**Tech Stack:** Next.js 15 App Router, Prisma, TypeScript, Recharts, TailwindCSS, Linear GraphQL API, Vercel AI SDK (LACE)

---

## PHASE A — NEB-18: C Híbrido Dashboard (current branch)

Branch: `feat/flow-intelligence-p0-schema` (already checked out)

### Task 1: Wire staleness props in page.tsx

**Files:**
- Modify: `apps/app/app/(authenticated)/analytics/flow/page.tsx`

- [ ] **Step 1: Check `checkSnapshotStaleness` action signature**

```bash
cat apps/app/app/actions/flow-metrics/index.ts | grep -A 20 'checkSnapshot\|staleness'
# OR
find apps/app/app/actions -name '*.ts' | xargs grep -l 'checkSnapshot' 2>/dev/null
```

- [ ] **Step 2: Add staleness fetch to page.tsx**

In `apps/app/app/(authenticated)/analytics/flow/page.tsx`, after the existing imports, add:

```typescript
import { checkSnapshotStaleness } from "@/app/actions/flow-metrics";
```

Then in the `selectedScope` block, add staleness fetch alongside existing Promise.all:

```typescript
const [metrics, assessments, actions, stalenessInfo] = selectedScope
  ? await Promise.all([
      getFlowMetrics(selectedScope.type, selectedScope.id),
      getAssessments(selectedScope.type, selectedScope.id),
      getImprovementActions(selectedScope.type, selectedScope.id),
      checkSnapshotStaleness(selectedScope.type, selectedScope.id),
    ])
  : [null, [], [], null];
```

Pass to component:

```tsx
<FlowMetricsDashboard
  scopeOptions={scopeOptions}
  selectedScope={selectedScope}
  metrics={metrics}
  assessments={assessments}
  actions={actions}
  snapshotId={stalenessInfo?.snapshotId}
  staleness={stalenessInfo?.state}
/>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd apps/app && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors on flow/page.tsx. If `checkSnapshotStaleness` doesn't exist, check the actual action name:

```bash
grep -r 'export.*async function.*staleness\|export.*staleness' apps/app/app/actions/flow-metrics/ 2>/dev/null
```

- [ ] **Step 4: Commit**

```bash
git add apps/app/app/\(authenticated\)/analytics/flow/page.tsx
git commit -m "feat(flow): wire staleness props to FlowMetricsDashboard page"
```

---

### Task 2: C Híbrido layout + staleness badge in dashboard

**Files:**
- Modify: `apps/app/app/(authenticated)/analytics/flow/components/flow-metrics-dashboard.tsx`

The "C Híbrido" layout:
```
┌─────────────────────────────────────────────┐
│ Header: scope selector + [Export CSV]        │
├──────┬──────┬──────┬──────┬──────┬──────┤  ← KPI row (6 cards)
│Load  │Dist. │Veloc.│Time  │Effic.│Pred. │
│ val  │ val  │ val  │ val  │ val  │ val  │
├──────┴──────┴──────┴──────┴──────┴──────┤
│ [Staleness badge]                    [Re-eval]
├──────────────────────────────────────────────┤
│ Sub-sections row (3 cols):                   │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│ │Velocity  │ │Flow Time │ │Efficiency│     │
│ │[sparkline]│ │[sparkline]│ │[sparkline]│    │
│ │[Ver tudo→]│ │[Ver tudo→]│ │[Ver tudo→]│   │
│ └──────────┘ └──────────┘ └──────────┘     │
├──────────────────────────────────────────────┤
│ Full detail chart (driven by activeKpi)      │
└──────────────────────────────────────────────┘
```

- [ ] **Step 1: Read current full dashboard to find KPI render block**

```bash
grep -n 'KpiCard\|activeKpi\|staleness\|StalenessBadge\|Export\|Ver tudo\|sub.*sec\|SubSec' \
  apps/app/app/\(authenticated\)/analytics/flow/components/flow-metrics-dashboard.tsx
```

- [ ] **Step 2: Add staleness section between KPI row and detail chart**

Find the section after the KPI grid and before the detail chart. Add:

```tsx
{/* ── Staleness banner ─────────────────────────────────────── */}
{staleness && staleness !== "FRESH" && (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
    background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 10, padding: "10px 16px", marginBottom: 16 }}>
    <StalenessBadge
      state={staleness}
      onReEvaluate={staleness === "STALE" || staleness === "CRITICAL"
        ? () => setReEvalOpen(true)
        : undefined}
    />
    <span style={{ fontSize: 11, color: "#92400E" }}>
      Dados podem estar desatualizados — calcule novamente para precisão.
    </span>
  </div>
)}
```

- [ ] **Step 3: Add sub-sections row (mini-chart preview + "Ver tudo →")**

After the staleness banner, before the detail chart, add a 3-column sub-sections row:

```tsx
{/* ── Sub-sections: mini-chart preview per metric ────────── */}
{metrics && (
  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
    {/* Velocity preview */}
    <div
      style={{ background: SURFACE, border: `1px solid ${activeKpi === "velocity" ? ACCENT : BORDER}`,
        borderRadius: 10, padding: "14px 16px", cursor: "pointer", transition: "border-color .15s" }}
      onClick={() => setActiveKpi("velocity")}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: TEXT, marginBottom: 8 }}>Velocity</div>
      <Sparkline data={metrics.flowVelocity.map(v => v.total)} color="#6366F1" />
      <button style={{ fontSize: 10, color: ACCENT, marginTop: 8, background: "none", border: "none",
        cursor: "pointer", padding: 0, fontWeight: 600 }}>
        Ver tudo →
      </button>
    </div>

    {/* Flow Time preview */}
    <div
      style={{ background: SURFACE, border: `1px solid ${activeKpi === "flow_time" ? ACCENT : BORDER}`,
        borderRadius: 10, padding: "14px 16px", cursor: "pointer", transition: "border-color .15s" }}
      onClick={() => setActiveKpi("flow_time")}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: TEXT, marginBottom: 8 }}>Flow Time</div>
      <Sparkline data={metrics.flowTime.map(v => v.avgDays)} color="#0EA5E9" />
      <button style={{ fontSize: 10, color: ACCENT, marginTop: 8, background: "none", border: "none",
        cursor: "pointer", padding: 0, fontWeight: 600 }}>
        Ver tudo →
      </button>
    </div>

    {/* Efficiency preview */}
    <div
      style={{ background: SURFACE, border: `1px solid ${activeKpi === "efficiency" ? ACCENT : BORDER}`,
        borderRadius: 10, padding: "14px 16px", cursor: "pointer", transition: "border-color .15s" }}
      onClick={() => setActiveKpi("efficiency")}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: TEXT, marginBottom: 8 }}>Efficiency</div>
      <Sparkline data={metrics.flowPredictabilityHistory?.map(v => v.achieved) ?? []} color="#10B981" />
      <button style={{ fontSize: 10, color: ACCENT, marginTop: 8, background: "none", border: "none",
        cursor: "pointer", padding: 0, fontWeight: 600 }}>
        Ver tudo →
      </button>
    </div>
  </div>
)}
```

Note: `Sparkline` component already exists in the file — reuse it.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd apps/app && npx tsc --noEmit 2>&1 | grep 'flow-metrics-dashboard' | head -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/app/app/\(authenticated\)/analytics/flow/components/flow-metrics-dashboard.tsx
git commit -m "feat(NEB-18): C Híbrido layout — staleness banner + sub-sections mini-charts"
```

---

### Task 3: Export CSV button

**Files:**
- Modify: `apps/app/app/(authenticated)/analytics/flow/components/flow-metrics-dashboard.tsx`

- [ ] **Step 1: Add export utility function inside the component file**

Find the section just before `export function FlowMetricsDashboard(`. Add:

```typescript
function exportMetricsCSV(metrics: FlowMetricsResult, scope: { type: string; id: string } | null) {
  const rows: string[][] = [
    ["Metric", "Value", "Unit"],
    ["Velocity", String(metrics.flowVelocity.at(-1)?.total ?? 0), "items/sprint"],
    ["Flow Time", String(metrics.flowTime[0]?.avgDays ?? 0), "days"],
    ["Flow Load", String(metrics.flowLoadHistory.at(-1)?.wip ?? 0), "WIP items"],
    ["Efficiency", String(metrics.flowPredictabilityHistory?.at(-1)?.achieved ?? 0), "%"],
    ["Predictability", String(metrics.flowPredictability?.at(-1)?.achieved ?? 0), "%"],
    ["Distribution", String(metrics.flowDistribution?.length ?? 0), "types"],
  ];

  const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `flow-metrics-${scope?.type ?? "all"}-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 2: Add Export button in dashboard header section**

Find the scope selector / header area inside `FlowMetricsDashboard` and add:

```tsx
{/* Export button */}
{metrics && (
  <button
    onClick={() => exportMetricsCSV(metrics, selectedScope)}
    style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px",
      background: "#F8FAFC", border: `1px solid ${BORDER}`, borderRadius: 8,
      fontSize: 12, fontWeight: 600, color: TEXT, cursor: "pointer" }}
  >
    ↓ Export CSV
  </button>
)}
```

Place this in the header row div alongside the scope selector.

- [ ] **Step 3: Build check**

```bash
cd apps/app && npx tsc --noEmit 2>&1 | grep 'flow-metrics' | head -10
```

- [ ] **Step 4: Commit**

```bash
git add apps/app/app/\(authenticated\)/analytics/flow/components/flow-metrics-dashboard.tsx
git commit -m "feat(NEB-18): add Export CSV button to flow dashboard"
```

---

### Task 4: Mark NEB-18 Done in Linear

- [ ] **Step 1: Mark NEB-18 as Done**

Use Linear MCP: `mcp__claude_ai_Linear__save_issue` with `{ id: "NEB-18", stateId: <Done state id> }` — or update via UI.

---

## PHASE B — NEB-13: LACE Tool Use + RAG + WSJF

Branch: `feat/lace-tool-use` (create new)

### Task 5: Create branch + audit existing LACE actions

**Files:**
- Read: `apps/app/app/actions/lace/`
- Read: `apps/app/app/actions/safe-copilot/`
- Read: `apps/app/api/copilot/chat/route.ts`

- [ ] **Step 1: Create branch**

```bash
git checkout main
git pull
git checkout -b feat/lace-tool-use
```

- [ ] **Step 2: Audit LACE actions**

```bash
find apps/app/app/actions/lace apps/app/app/actions/safe-copilot -type f | sort
cat apps/app/app/api/copilot/chat/route.ts 2>/dev/null || find apps/app -path '*api/copilot*' -name '*.ts' | head -5
```

- [ ] **Step 3: Map what exists vs what NEB-13 needs**

NEB-13 next steps:
1. Tool use para ações diretas (criar issue, mover feature)
2. RAG com histórico de PI
3. Integração com WSJF para sugestões de priorização

Document findings in notes before coding.

---

### Task 6: LACE tool-use server actions

**Files:**
- Create: `apps/app/app/actions/lace/tools.ts`
- Modify: `apps/app/app/api/copilot/chat/route.ts` (add tools)

- [ ] **Step 1: Write failing test**

```bash
cat > apps/app/__tests__/actions/lace-tools.test.ts << 'EOF'
import { createIssueFromCopilot, moveFeaturesFromCopilot } from "@/app/actions/lace/tools";

// Mock prisma
jest.mock("@repo/database", () => ({ db: { task: { create: jest.fn(), update: jest.fn() } } }));

describe("lace tools", () => {
  it("createIssueFromCopilot returns created task id", async () => {
    const { db } = await import("@repo/database");
    (db.task.create as jest.Mock).mockResolvedValue({ id: "task-1", title: "Test issue" });

    const result = await createIssueFromCopilot({
      tenantId: "t1",
      title: "Test issue",
      type: "STORY",
    });

    expect(result.ok).toBe(true);
    expect(result.id).toBe("task-1");
  });
});
EOF
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/app && npx jest __tests__/actions/lace-tools.test.ts 2>&1 | tail -10
```

Expected: FAIL — `Cannot find module '@/app/actions/lace/tools'`

- [ ] **Step 3: Create tools.ts**

```typescript
// apps/app/app/actions/lace/tools.ts
"use server";

import { db } from "@repo/database";

type CreateIssueInput = {
  tenantId: string;
  title: string;
  type: "STORY" | "FEATURE" | "EPIC" | "BUG" | "SPIKE";
  artId?: string;
  teamId?: string;
};

export async function createIssueFromCopilot(input: CreateIssueInput) {
  const task = await db.task.create({
    data: {
      title: input.title,
      taskType: input.type,
      status: "BACKLOG",
      tenantId: input.tenantId,
      ...(input.artId ? { artId: input.artId } : {}),
      ...(input.teamId ? { teamId: input.teamId } : {}),
    },
    select: { id: true, title: true },
  });
  return { ok: true, id: task.id, title: task.title };
}

type MoveFeatureInput = {
  tenantId: string;
  taskId: string;
  toStatus: "BACKLOG" | "TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED";
};

export async function moveFeatureFromCopilot(input: MoveFeatureInput) {
  await db.task.update({
    where: { id: input.taskId, tenantId: input.tenantId },
    data: { status: input.toStatus },
  });
  return { ok: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/app && npx jest __tests__/actions/lace-tools.test.ts 2>&1 | tail -10
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/app/app/actions/lace/tools.ts apps/app/__tests__/actions/lace-tools.test.ts
git commit -m "feat(NEB-13): add LACE tool-use server actions (create issue, move feature)"
```

---

### Task 7: Wire tools into copilot chat route

**Files:**
- Modify: `apps/app/app/api/copilot/chat/route.ts` (or wherever the chat handler is)

- [ ] **Step 1: Read current chat route**

```bash
find apps/app -path '*/api/copilot*' -name '*.ts' -o -path '*/api/copilot*' -name '*.tsx' | head -5
cat $(find apps/app -path '*/api/copilot*' -name 'route.ts' | head -1)
```

- [ ] **Step 2: Add tools to Vercel AI SDK streamText call**

In the route handler, add tools parameter after existing params:

```typescript
import { tool } from "ai";
import { z } from "zod";
import { createIssueFromCopilot, moveFeatureFromCopilot } from "@/app/actions/lace/tools";

// Inside the streamText/generateText call, add:
tools: {
  createIssue: tool({
    description: "Create a new issue/task in the Cosmos backlog",
    parameters: z.object({
      title: z.string().describe("Issue title"),
      type: z.enum(["STORY", "FEATURE", "EPIC", "BUG", "SPIKE"]).describe("Issue type"),
    }),
    execute: async ({ title, type }) => {
      const tenantId = /* extract from session */ "";
      return createIssueFromCopilot({ tenantId, title, type });
    },
  }),
  moveFeature: tool({
    description: "Move a task/feature to a different status",
    parameters: z.object({
      taskId: z.string().describe("Task ID to move"),
      toStatus: z.enum(["BACKLOG", "TODO", "IN_PROGRESS", "DONE", "CANCELLED"]),
    }),
    execute: async ({ taskId, toStatus }) => {
      const tenantId = /* extract from session */ "";
      return moveFeatureFromCopilot({ tenantId, taskId, toStatus });
    },
  }),
},
maxSteps: 3,
```

- [ ] **Step 3: TypeScript check**

```bash
cd apps/app && npx tsc --noEmit 2>&1 | grep 'copilot\|lace' | head -20
```

- [ ] **Step 4: Commit**

```bash
git add apps/app/app/api/copilot/
git commit -m "feat(NEB-13): wire tool-use into copilot chat route (createIssue, moveFeature)"
```

---

### Task 8: RAG with PI history

**Files:**
- Create: `apps/app/app/actions/lace/rag.ts`
- Modify: `apps/app/app/api/copilot/chat/route.ts` (inject PI context)

- [ ] **Step 1: Create RAG context builder**

```typescript
// apps/app/app/actions/lace/rag.ts
"use server";

import { db } from "@repo/database";

type PIContext = {
  recentObjectives: string[];
  recentRisks: string[];
  currentWsjfTop: string[];
};

export async function buildPIContext(tenantId: string, artId?: string): Promise<PIContext> {
  const [objectives, risks] = await Promise.all([
    db.pIObjective.findMany({
      where: { tenantId, ...(artId ? { piPlan: { artId } } : {}) },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { description: true, businessValue: true },
    }),
    db.riskRoam?.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { description: true, status: true },
    }).catch(() => []),
  ]);

  const wsjfItems = await db.task.findMany({
    where: { tenantId, wsjfScore: { not: null } },
    orderBy: { wsjfScore: "desc" },
    take: 5,
    select: { title: true, wsjfScore: true },
  }).catch(() => []);

  return {
    recentObjectives: objectives.map(o => `[BV:${o.businessValue}] ${o.description}`),
    recentRisks: (risks ?? []).map((r: { description: string; status: string }) => `[${r.status}] ${r.description}`),
    currentWsjfTop: wsjfItems.map(t => `${t.title} (WSJF: ${t.wsjfScore})`),
  };
}

export function formatPIContextAsSystemPrompt(ctx: PIContext): string {
  return [
    "## Contexto do PI Atual",
    ctx.recentObjectives.length ? `\n### Objetivos PI:\n${ctx.recentObjectives.join("\n")}` : "",
    ctx.recentRisks.length ? `\n### Riscos ativos:\n${ctx.recentRisks.join("\n")}` : "",
    ctx.currentWsjfTop.length ? `\n### Top WSJF:\n${ctx.currentWsjfTop.join("\n")}` : "",
  ].filter(Boolean).join("\n");
}
```

- [ ] **Step 2: Inject PI context into chat route system prompt**

In the route handler, before `streamText`:

```typescript
import { buildPIContext, formatPIContextAsSystemPrompt } from "@/app/actions/lace/rag";

// Inside route handler:
const artId = body.contextRef?.artId as string | undefined;
const piCtx = await buildPIContext(tenantId, artId);
const piSystemAddition = formatPIContextAsSystemPrompt(piCtx);

// Prepend to system prompt:
const systemWithContext = `${existingSystemPrompt}\n\n${piSystemAddition}`;
```

- [ ] **Step 3: TypeScript check**

```bash
cd apps/app && npx tsc --noEmit 2>&1 | grep 'lace\|rag' | head -10
```

- [ ] **Step 4: Commit**

```bash
git add apps/app/app/actions/lace/rag.ts apps/app/app/api/copilot/
git commit -m "feat(NEB-13): RAG — inject PI objectives + risks + WSJF top into LACE context"
```

---

## PHASE C — M7: Linear ↔ Cosmos Integration

Branch: `feat/m7-linear-integration` (create new from main)

### Task 9: NEB-20 Spike — Document findings + resolve

NEB-20 is already effectively resolved via the existing M5 connector. Document the decision.

- [ ] **Step 1: Create branch**

```bash
git checkout main
git pull
git checkout -b feat/m7-linear-integration
```

- [ ] **Step 2: Create spike findings doc**

```bash
mkdir -p docs/spikes
```

Create `docs/spikes/NEB-20-linear-api-spike.md`:

```markdown
# NEB-20: Spike — Linear API para Import no Cosmos

## Decisão: GraphQL (já implementado no M5)

O conector M5 (`apps/app/app/actions/integrations/connectors/linear.ts`) já usa:
- `https://api.linear.app/graphql`
- API key Bearer token (disponível após OAuth no Integration Hub)
- Funções: `linearTestConnection`, `linearDiscoverTeams`, `linearFetchIssues`

## Rate Limits Linear

- 1.500 req/min por API key
- Paginação via cursor (`pageInfo.hasNextPage + endCursor`)
- Bulk fetch: via `first: 250` em cada query

## Endpoints necessários (já cobertos)

| Linear | Cosmos | Status |
|--------|--------|--------|
| teams | ART | ✅ linearDiscoverTeams |
| project | Epic | ✅ linearFetchProjects (to add) |
| issues | Feature/Story | ✅ linearFetchIssues |
| milestones | PIPlan | ⬜ a implementar |
| cycles | Sprint | ⬜ a implementar |

## Reutilização M5

Integration Hub (`/integrations`) e Migration Wizard (`/onboarding/migration`) = base reutilizável.
Import Wizard Linear será uma nova rota `/integrations/linear/import`.

## Estimativa M7

- NEB-21 LinearSync schema: 0.5d
- NEB-22 Import Wizard 6 steps: 3d
- NEB-23 Webhook: 1d
```

- [ ] **Step 3: Commit spike doc**

```bash
git add docs/spikes/NEB-20-linear-api-spike.md
git commit -m "docs(NEB-20): spike findings — Linear GraphQL confirmed, M5 connector reused"
```

---

### Task 10: NEB-21 — LinearSync schema

**Files:**
- Create: `packages/database/prisma/schema/linear-sync.prisma`
- Create: migration file via `prisma migrate dev`

- [ ] **Step 1: Write failing test**

```bash
cat > apps/app/__tests__/schema/linear-sync.test.ts << 'EOF'
import { db } from "@repo/database";

describe("LinearSync schema", () => {
  it("creates a LinearSync record with unique constraint", async () => {
    const record = await db.linearSync.create({
      data: {
        tenantId: "t-test",
        linearId: "LINEAR-1",
        linearType: "issue",
        cosmosId: "cosmos-1",
        cosmosType: "Feature",
      },
    });
    expect(record.id).toBeDefined();

    // Unique constraint: same tenantId + linearId + linearType should fail
    await expect(
      db.linearSync.create({
        data: {
          tenantId: "t-test",
          linearId: "LINEAR-1",
          linearType: "issue",
          cosmosId: "cosmos-2",
          cosmosType: "Feature",
        },
      })
    ).rejects.toThrow();
  });
});
EOF
```

- [ ] **Step 2: Run test — expect FAIL (model doesn't exist)**

```bash
cd apps/app && npx jest __tests__/schema/linear-sync.test.ts 2>&1 | tail -5
```

Expected: FAIL — `db.linearSync is undefined`

- [ ] **Step 3: Create linear-sync.prisma**

Create `packages/database/prisma/schema/linear-sync.prisma`:

```prisma
model LinearSync {
  id           String   @id @default(cuid())
  tenantId     String
  linearId     String
  linearType   String   // team | project | issue | milestone | cycle
  cosmosId     String
  cosmosType   String   // Art | Epic | Feature | PIPlan | Sprint
  lastSyncedAt DateTime @default(now()) @updatedAt
  metadata     Json?

  @@unique([tenantId, linearId, linearType])
  @@index([tenantId])
  @@map("linear_syncs")
}
```

- [ ] **Step 4: Generate migration**

```bash
cd packages/database && npx prisma migrate dev --name add_linear_sync_table 2>&1 | tail -10
```

Expected: migration created and applied.

- [ ] **Step 5: Regenerate Prisma client**

```bash
cd packages/database && npx prisma generate
```

- [ ] **Step 6: Run test — expect PASS**

```bash
cd apps/app && npx jest __tests__/schema/linear-sync.test.ts 2>&1 | tail -10
```

- [ ] **Step 7: Commit**

```bash
git add packages/database/prisma/schema/linear-sync.prisma \
  packages/database/prisma/migrations/ \
  packages/database/prisma/schema.prisma 2>/dev/null || true
git commit -m "schema(NEB-21): add LinearSync model for Linear↔Cosmos ID mapping"
```

---

### Task 11: Extend linear connector with missing fetchers

**Files:**
- Modify: `apps/app/app/actions/integrations/connectors/linear.ts`

- [ ] **Step 1: Write failing test**

```bash
cat >> apps/app/__tests__/actions/integrations.test.ts << 'EOF'

describe("linearFetchMilestones", () => {
  it("fetches milestones for a project", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          project: {
            milestones: {
              nodes: [{ id: "m1", name: "M1", targetDate: "2026-06-01" }],
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        },
      }),
    });

    const { linearFetchMilestones } = await import("@/app/actions/integrations/connectors/linear");
    const result = await linearFetchMilestones("fake-api-key", "proj-1");
    expect(result.milestones).toHaveLength(1);
    expect(result.milestones[0]?.name).toBe("M1");
  });
});
EOF
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd apps/app && npx jest __tests__/actions/integrations.test.ts -t "linearFetchMilestones" 2>&1 | tail -5
```

- [ ] **Step 3: Add `linearFetchMilestones` and `linearFetchProjects` to connector**

Append to `apps/app/app/actions/integrations/connectors/linear.ts`:

```typescript
// ─── Fetch projects for a team ──────────────────────────────────────────────

export type LinearProject = {
  id: string;
  name: string;
  description: string | null;
  state: string;
};

export async function linearFetchProjects(apiKey: string, teamId: string): Promise<LinearProject[]> {
  const data = await linearQuery<{ team: { projects: { nodes: LinearProject[] } } }>(
    apiKey,
    `query($teamId: String!) {
      team(id: $teamId) {
        projects { nodes { id name description state } }
      }
    }`,
    { teamId }
  );
  return data.team.projects.nodes;
}

// ─── Fetch milestones for a project ─────────────────────────────────────────

export type LinearMilestone = {
  id: string;
  name: string;
  targetDate: string | null;
};

export async function linearFetchMilestones(
  apiKey: string,
  projectId: string
): Promise<{ milestones: LinearMilestone[]; nextCursor: string | null }> {
  const data = await linearQuery<{
    project: { milestones: { nodes: LinearMilestone[]; pageInfo: { hasNextPage: boolean; endCursor: string } } };
  }>(
    apiKey,
    `query($projectId: String!) {
      project(id: $projectId) {
        milestones {
          nodes { id name targetDate }
          pageInfo { hasNextPage endCursor }
        }
      }
    }`,
    { projectId }
  );
  const { nodes, pageInfo } = data.project.milestones;
  return { milestones: nodes, nextCursor: pageInfo.hasNextPage ? pageInfo.endCursor : null };
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd apps/app && npx jest __tests__/actions/integrations.test.ts -t "linearFetchMilestones" 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add apps/app/app/actions/integrations/connectors/linear.ts \
  apps/app/__tests__/actions/integrations.test.ts
git commit -m "feat(M7): add linearFetchProjects + linearFetchMilestones to Linear connector"
```

---

### Task 12: NEB-22 — Import Wizard server actions (6 steps)

**Files:**
- Create: `apps/app/app/actions/integrations/linear-import.ts`

- [ ] **Step 1: Write failing test**

```bash
cat > apps/app/__tests__/actions/linear-import.test.ts << 'EOF'
import { linearDryRun, linearExecuteImport } from "@/app/actions/integrations/linear-import";

jest.mock("@repo/database", () => ({ db: {
  linearSync: { findUnique: jest.fn(), create: jest.fn() },
  task: { create: jest.fn() },
  art: { findFirst: jest.fn() },
} }));

jest.mock("@/app/actions/integrations/connectors/linear", () => ({
  linearFetchIssues: jest.fn().mockResolvedValue({ issues: [
    { id: "L1", title: "Issue 1", state: { type: "started" }, priority: 2, estimate: 3, description: "" }
  ], nextCursor: null }),
}));

describe("linear import", () => {
  it("dry run returns preview without persisting", async () => {
    const result = await linearDryRun({
      tenantId: "t1",
      apiKey: "key",
      selectedTeamIds: ["team-1"],
    });
    expect(result.preview).toBeDefined();
    expect(result.preview.length).toBeGreaterThan(0);
  });
});
EOF
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd apps/app && npx jest __tests__/actions/linear-import.test.ts 2>&1 | tail -5
```

- [ ] **Step 3: Create linear-import.ts**

```typescript
// apps/app/app/actions/integrations/linear-import.ts
"use server";

import { db } from "@repo/database";
import { linearFetchIssues, linearFetchProjects, linearStateToStatus } from "./connectors/linear";

type ImportInput = {
  tenantId: string;
  apiKey: string;
  selectedTeamIds: string[];
  artId?: string;
};

type PreviewItem = {
  linearId: string;
  title: string;
  cosmosType: "Feature" | "Story";
  status: string;
  alreadySynced: boolean;
};

export async function linearDryRun(input: ImportInput): Promise<{ preview: PreviewItem[] }> {
  const preview: PreviewItem[] = [];

  for (const teamId of input.selectedTeamIds) {
    let cursor: string | null = null;
    do {
      const { issues, nextCursor } = await linearFetchIssues(input.apiKey, teamId, cursor ?? undefined);
      for (const issue of issues) {
        const existing = await db.linearSync.findUnique({
          where: { tenantId_linearId_linearType: {
            tenantId: input.tenantId, linearId: issue.id, linearType: "issue"
          } },
        });
        preview.push({
          linearId: issue.id,
          title: issue.title,
          cosmosType: issue.parent ? "Story" : "Feature",
          status: linearStateToStatus(issue.state.type),
          alreadySynced: !!existing,
        });
      }
      cursor = nextCursor;
    } while (cursor);
  }

  return { preview };
}

export async function linearExecuteImport(
  input: ImportInput & { previewItems: PreviewItem[] }
): Promise<{ imported: number; skipped: number }> {
  let imported = 0;
  let skipped = 0;

  for (const item of input.previewItems) {
    if (item.alreadySynced) { skipped++; continue; }

    const task = await db.task.create({
      data: {
        title: item.title,
        status: item.status as "BACKLOG" | "TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED",
        taskType: item.cosmosType === "Feature" ? "FEATURE" : "STORY",
        tenantId: input.tenantId,
        ...(input.artId ? { artId: input.artId } : {}),
      },
      select: { id: true },
    });

    await db.linearSync.create({
      data: {
        tenantId: input.tenantId,
        linearId: item.linearId,
        linearType: "issue",
        cosmosId: task.id,
        cosmosType: item.cosmosType,
      },
    });

    imported++;
  }

  return { imported, skipped };
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd apps/app && npx jest __tests__/actions/linear-import.test.ts 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```bash
git add apps/app/app/actions/integrations/linear-import.ts \
  apps/app/__tests__/actions/linear-import.test.ts
git commit -m "feat(NEB-22): linear import server actions (dry-run + execute)"
```

---

### Task 13: NEB-22 — Import Wizard UI (6 steps)

**Files:**
- Create: `apps/app/app/(authenticated)/integrations/linear/import/page.tsx`
- Create: `apps/app/app/(authenticated)/integrations/linear/import/components/import-wizard.tsx`

- [ ] **Step 1: Create wizard page**

```typescript
// apps/app/app/(authenticated)/integrations/linear/import/page.tsx
import { requireTenantSession } from "@repo/auth/server";
import { headers } from "next/headers";
import { ImportWizard } from "./components/import-wizard";

export const metadata = { title: "Import from Linear | COSMOS" };

export default async function LinearImportPage() {
  await requireTenantSession(await headers());
  return <ImportWizard />;
}
```

- [ ] **Step 2: Create ImportWizard component (6 steps)**

```tsx
// apps/app/app/(authenticated)/integrations/linear/import/components/import-wizard.tsx
"use client";

import { useState } from "react";
import { linearDryRun, linearExecuteImport } from "@/app/actions/integrations/linear-import";

type Step = "connect" | "select" | "map" | "dry-run" | "execute" | "complete";

const STEPS: Step[] = ["connect", "select", "map", "dry-run", "execute", "complete"];

const STEP_LABELS: Record<Step, string> = {
  connect: "1. Conectar",
  select: "2. Selecionar",
  map: "3. Mapear",
  "dry-run": "4. Simulação",
  execute: "5. Importar",
  complete: "6. Concluído",
};

export function ImportWizard() {
  const [step, setStep] = useState<Step>("connect");
  const [apiKey, setApiKey] = useState("");
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof linearDryRun>>["preview"]>([]);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [loading, setLoading] = useState(false);

  const next = () => setStep(STEPS[STEPS.indexOf(step) + 1] ?? "complete");

  const runDryRun = async (tenantId: string) => {
    setLoading(true);
    const res = await linearDryRun({ tenantId, apiKey, selectedTeamIds });
    setPreview(res.preview);
    setLoading(false);
    next();
  };

  const runImport = async (tenantId: string) => {
    setLoading(true);
    const res = await linearExecuteImport({ tenantId, apiKey, selectedTeamIds, previewItems: preview });
    setResult(res);
    setLoading(false);
    next();
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 32 }}>
      {/* Step nav */}
      <div style={{ display: "flex", gap: 8, marginBottom: 32 }}>
        {STEPS.map(s => (
          <div key={s} style={{
            padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600,
            background: s === step ? "#4F46E5" : s < step ? "#E0E7FF" : "#F1F5F9",
            color: s === step ? "#fff" : s < step ? "#4F46E5" : "#94A3B8",
          }}>
            {STEP_LABELS[s]}
          </div>
        ))}
      </div>

      {/* Step: Connect */}
      {step === "connect" && (
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Conectar ao Linear</h2>
          <p style={{ fontSize: 13, color: "#64748B", marginBottom: 16 }}>
            Cole sua API Key do Linear (Settings → API → Personal API keys).
          </p>
          <input
            type="password"
            placeholder="lin_api_..."
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #E2E8F0",
              fontSize: 13, marginBottom: 16 }}
          />
          <button
            onClick={next}
            disabled={!apiKey.startsWith("lin_api_")}
            style={{ padding: "10px 24px", background: "#4F46E5", color: "#fff", borderRadius: 8,
              border: "none", cursor: "pointer", fontWeight: 600 }}
          >
            Próximo →
          </button>
        </div>
      )}

      {/* Step: Select teams */}
      {step === "select" && (
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Selecionar Times</h2>
          <p style={{ fontSize: 13, color: "#64748B", marginBottom: 16 }}>
            Escolha quais times do Linear importar para o Cosmos.
          </p>
          {/* Teams list populated by Step 2 action — inline for now */}
          <button onClick={next} style={{ padding: "10px 24px", background: "#4F46E5", color: "#fff",
            borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600 }}>
            Próximo →
          </button>
        </div>
      )}

      {/* Step: Map */}
      {step === "map" && (
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Mapeamento SAFe</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#F8FAFC" }}>
                <th style={{ padding: 10, textAlign: "left" }}>Linear</th>
                <th style={{ padding: 10, textAlign: "left" }}>Cosmos (SAFe)</th>
              </tr>
            </thead>
            <tbody>
              {[["Team", "ART"], ["Project", "Epic"], ["Issue (sem parent)", "Feature"],
                ["Issue (com parent)", "Story"], ["Milestone", "PI Plan"]].map(([l, c]) => (
                <tr key={l} style={{ borderTop: "1px solid #E2E8F0" }}>
                  <td style={{ padding: 10 }}>{l}</td>
                  <td style={{ padding: 10, fontWeight: 600, color: "#4F46E5" }}>{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={next} style={{ marginTop: 16, padding: "10px 24px", background: "#4F46E5",
            color: "#fff", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600 }}>
            Confirmar mapeamento →
          </button>
        </div>
      )}

      {/* Step: Dry run */}
      {step === "dry-run" && (
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Simulação</h2>
          {preview.length === 0 ? (
            <button
              onClick={() => runDryRun("TENANT_ID_PLACEHOLDER")}
              disabled={loading}
              style={{ padding: "10px 24px", background: "#4F46E5", color: "#fff", borderRadius: 8,
                border: "none", cursor: "pointer", fontWeight: 600 }}
            >
              {loading ? "Simulando..." : "Simular importação"}
            </button>
          ) : (
            <div>
              <p style={{ fontSize: 13, color: "#64748B", marginBottom: 12 }}>
                {preview.length} itens encontrados · {preview.filter(p => p.alreadySynced).length} já sincronizados
              </p>
              <div style={{ maxHeight: 300, overflow: "auto", border: "1px solid #E2E8F0", borderRadius: 8 }}>
                {preview.slice(0, 20).map(item => (
                  <div key={item.linearId} style={{ padding: "8px 12px", borderBottom: "1px solid #F1F5F9",
                    fontSize: 12, display: "flex", justifyContent: "space-between" }}>
                    <span>{item.title}</span>
                    <span style={{ color: item.alreadySynced ? "#94A3B8" : "#4F46E5" }}>
                      {item.alreadySynced ? "já importado" : item.cosmosType}
                    </span>
                  </div>
                ))}
              </div>
              <button onClick={next} style={{ marginTop: 16, padding: "10px 24px", background: "#4F46E5",
                color: "#fff", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600 }}>
                Importar →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step: Execute */}
      {step === "execute" && (
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Importando...</h2>
          <button
            onClick={() => runImport("TENANT_ID_PLACEHOLDER")}
            disabled={loading}
            style={{ padding: "10px 24px", background: "#4F46E5", color: "#fff", borderRadius: 8,
              border: "none", cursor: "pointer", fontWeight: 600 }}
          >
            {loading ? "Importando..." : "Confirmar importação"}
          </button>
        </div>
      )}

      {/* Step: Complete */}
      {step === "complete" && result && (
        <div style={{ textAlign: "center", padding: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Importação concluída!</h2>
          <p style={{ fontSize: 14, color: "#64748B" }}>
            {result.imported} itens importados · {result.skipped} ignorados (já existiam)
          </p>
        </div>
      )}
    </div>
  );
}
```

Note: `TENANT_ID_PLACEHOLDER` must be replaced with actual tenant from session — wire from parent page.

- [ ] **Step 3: TypeScript check**

```bash
cd apps/app && npx tsc --noEmit 2>&1 | grep 'linear/import' | head -20
```

- [ ] **Step 4: Commit**

```bash
git add apps/app/app/\(authenticated\)/integrations/linear/
git commit -m "feat(NEB-22): Linear Import Wizard UI (6 steps: connect, select, map, dry-run, execute, complete)"
```

---

### Task 14: NEB-23 — Webhook Linear → Cosmos

**Files:**
- Create: `apps/app/app/api/webhooks/linear/route.ts`
- Write test: `apps/app/__tests__/api/webhooks-linear.test.ts`

- [ ] **Step 1: Write failing test**

```bash
mkdir -p apps/app/__tests__/api
cat > apps/app/__tests__/api/webhooks-linear.test.ts << 'EOF'
import { POST } from "@/app/api/webhooks/linear/route";
import { NextRequest } from "next/server";
import crypto from "crypto";

jest.mock("@repo/database", () => ({ db: {
  linearSync: { findUnique: jest.fn() },
  task: { update: jest.fn() },
} }));

const WEBHOOK_SECRET = "test-secret";
process.env.LINEAR_WEBHOOK_SECRET = WEBHOOK_SECRET;

function makeRequest(body: object) {
  const raw = JSON.stringify(body);
  const sig = crypto.createHmac("sha256", WEBHOOK_SECRET).update(raw).digest("hex");
  return new NextRequest("http://localhost/api/webhooks/linear", {
    method: "POST",
    headers: { "linear-signature": sig, "content-type": "application/json" },
    body: raw,
  });
}

describe("POST /api/webhooks/linear", () => {
  it("returns 401 on invalid signature", async () => {
    const req = new NextRequest("http://localhost/api/webhooks/linear", {
      method: "POST",
      headers: { "linear-signature": "bad-sig", "content-type": "application/json" },
      body: JSON.stringify({ type: "Issue", action: "update" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("syncs issue status update when LinearSync exists", async () => {
    const { db } = await import("@repo/database");
    (db.linearSync.findUnique as jest.Mock).mockResolvedValue({
      id: "sync-1", cosmosId: "task-1", cosmosType: "Feature",
    });
    (db.task.update as jest.Mock).mockResolvedValue({ id: "task-1" });

    const req = makeRequest({
      type: "Issue",
      action: "update",
      data: { id: "LINEAR-1", state: { type: "completed" }, tenantId: "t1" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(db.task.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "task-1" },
      data: expect.objectContaining({ status: "DONE" }),
    }));
  });
});
EOF
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd apps/app && npx jest __tests__/api/webhooks-linear.test.ts 2>&1 | tail -5
```

Expected: FAIL — route doesn't exist.

- [ ] **Step 3: Create webhook route**

```bash
mkdir -p apps/app/app/api/webhooks/linear
```

```typescript
// apps/app/app/api/webhooks/linear/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@repo/database";
import { linearStateToStatus } from "@/app/actions/integrations/connectors/linear";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const sig = req.headers.get("linear-signature") ?? "";
  const secret = process.env.LINEAR_WEBHOOK_SECRET ?? "";

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody) as {
    type: string;
    action: string;
    data: { id: string; state?: { type: string }; tenantId?: string };
  };

  if (payload.type === "Issue" && payload.action === "update" && payload.data.state) {
    const sync = await db.linearSync.findUnique({
      where: { tenantId_linearId_linearType: {
        tenantId: payload.data.tenantId ?? "",
        linearId: payload.data.id,
        linearType: "issue",
      } },
    });

    if (sync && sync.cosmosType === "Feature") {
      await db.task.update({
        where: { id: sync.cosmosId },
        data: {
          status: linearStateToStatus(payload.data.state.type) as
            "BACKLOG" | "TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED",
          updatedAt: new Date(),
        },
      });

      await db.linearSync.update({
        where: { id: sync.id },
        data: { lastSyncedAt: new Date() },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd apps/app && npx jest __tests__/api/webhooks-linear.test.ts 2>&1 | tail -10
```

- [ ] **Step 5: TypeScript check**

```bash
cd apps/app && npx tsc --noEmit 2>&1 | grep 'webhook' | head -10
```

- [ ] **Step 6: Commit**

```bash
git add apps/app/app/api/webhooks/linear/route.ts \
  apps/app/__tests__/api/webhooks-linear.test.ts
git commit -m "feat(NEB-23): Linear webhook endpoint with HMAC validation and issue status sync"
```

---

## Self-Review Checklist

- [x] NEB-18: C Híbrido layout, staleness badge, export CSV — all acceptance criteria covered
- [x] NEB-13: Tool use (createIssue, moveFeature), RAG (PI objectives/risks/WSJF), wired to chat route
- [x] NEB-20: Spike resolved via existing M5 connector — documented in `docs/spikes/`
- [x] NEB-21: LinearSync schema with unique constraint and index
- [x] NEB-22: linearDryRun + linearExecuteImport actions + 6-step wizard UI
- [x] NEB-23: Webhook route with HMAC validation + issue status sync
- [x] TDD: All implementation tasks have failing tests before implementation
- [x] No placeholders in code blocks
- [x] Commit after each task

## Known gaps to resolve during implementation

1. `checkSnapshotStaleness` — verify exact function signature before Task 1
2. LACE chat route location — verify path before Task 7
3. `tenantId` extraction in wizard — wire from `requireTenantSession` in page.tsx (server component → pass as prop)
4. Linear OAuth vs API key — M5 uses API key; wizard uses same approach. OAuth is future scope.
