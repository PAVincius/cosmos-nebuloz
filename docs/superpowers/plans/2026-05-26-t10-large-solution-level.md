# T10 — Large Solution Level (LST) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the optional Large Solution Level (LST) module — SolutionTrain list, Capability Kanban, SolutionEpic board, ART → SolutionTrain linking, and LACE page. Module is hidden by default behind a feature flag; activated per-tenant in settings. Uses existing `SolutionTrain`, `Capability`, `SolutionEpic`, `LACE` Prisma models.

**Architecture:** Feature flag `LARGE_SOLUTION_ENABLED` stored in `Tenant.featureFlags` JSON field. Navigation sidebar checks flag before rendering LST entries. All LST pages are under `/solution-trains/`. Existing schema already has all models — this is pure UI + actions work.

**Tech Stack:** Next.js 15 App Router, existing Prisma models (`SolutionTrain`, `Capability`, `SolutionEpic`, `LACE`), DnD Kit for Capability Kanban, shadcn/ui, Zod validation.

---

## File Structure

```
apps/app/app/actions/
  solution-trains/index.ts          MODIFY: add createSolutionTrain, linkART
  solution-trains/capabilities.ts   NEW: CRUD for Capability with Kanban reorder
  solution-trains/lace.ts           NEW: get/update LACE

apps/app/app/(authenticated)/solution-trains/
  page.tsx                          NEW: SolutionTrain list
  [id]/
    page.tsx                        NEW: SolutionTrain detail (Capability Kanban + SolutionEpic board)
    components/
      capability-kanban.tsx         NEW: 4-column DnD Kanban
      capability-card.tsx           NEW: single Capability card
      solution-epic-board.tsx       NEW: SolutionEpic list table
      art-link-dialog.tsx           NEW: dialog to link ARTs to SolutionTrain
  lace/
    page.tsx                        NEW: LACE principles + improvement tracking

apps/app/app/actions/settings/
  feature-flags.ts                  NEW: enable/disable LST per tenant

apps/app/__tests__/actions/solution-trains/
  capabilities.test.ts              NEW
```

---

## Task 1: Feature flag action

**Files:**
- Create: `apps/app/app/actions/settings/feature-flags.ts`

- [ ] **Step 1: Write failing test**

```typescript
// apps/app/__tests__/actions/settings/feature-flags.test.ts
import { enableLargeSolutionLevel, isLSTEnabled } from "@/app/actions/settings/feature-flags";

jest.mock("@repo/database", () => ({
  database: {
    tenant: {
      findFirst: jest.fn().mockResolvedValue({ featureFlags: {} }),
      update: jest.fn().mockResolvedValue({ featureFlags: { LARGE_SOLUTION_ENABLED: true } }),
    },
  },
}));

jest.mock("@repo/auth/server", () => ({
  requireTenantSession: jest.fn().mockResolvedValue({ tenantId: "t1" }),
  requireRole: jest.fn(),
}));
jest.mock("next/headers", () => ({ headers: jest.fn().mockResolvedValue({}) }));

test("enableLargeSolutionLevel sets flag to true", async () => {
  const { database } = require("@repo/database");
  await enableLargeSolutionLevel(true);
  expect(database.tenant.update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        featureFlags: expect.objectContaining({ LARGE_SOLUTION_ENABLED: true }),
      }),
    })
  );
});

test("isLSTEnabled reads flag from tenant", async () => {
  const { database } = require("@repo/database");
  database.tenant.findFirst.mockResolvedValueOnce({ featureFlags: { LARGE_SOLUTION_ENABLED: true } });
  const result = await isLSTEnabled();
  expect(result).toBe(true);
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd apps/app && npx jest __tests__/actions/settings/feature-flags.test.ts --no-coverage
```

- [ ] **Step 3: Implement**

```typescript
"use server";

import { requireTenantSession, requireRole } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";

type FeatureFlags = {
  LARGE_SOLUTION_ENABLED?: boolean;
  [key: string]: boolean | undefined;
};

export async function isLSTEnabled(): Promise<boolean> {
  const ctx = await requireTenantSession(await headers());
  const tenant = await database.tenant.findFirst({
    where: { id: ctx.tenantId },
    select: { featureFlags: true },
  });
  const flags = (tenant?.featureFlags ?? {}) as FeatureFlags;
  return flags.LARGE_SOLUTION_ENABLED === true;
}

export async function enableLargeSolutionLevel(enabled: boolean): Promise<void> {
  const ctx = await requireTenantSession(await headers());
  requireRole(["ADMIN"], ctx);

  const tenant = await database.tenant.findFirst({
    where: { id: ctx.tenantId },
    select: { featureFlags: true },
  });
  const existing = (tenant?.featureFlags ?? {}) as FeatureFlags;

  await database.tenant.update({
    where: { id: ctx.tenantId },
    data: {
      featureFlags: { ...existing, LARGE_SOLUTION_ENABLED: enabled },
    },
  });
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd apps/app && npx jest __tests__/actions/settings/feature-flags.test.ts --no-coverage
```

- [ ] **Step 5: Commit**

```bash
git add apps/app/app/actions/settings/feature-flags.ts \
        apps/app/__tests__/actions/settings/feature-flags.test.ts
git commit -m "feat(lst): feature flag toggle for Large Solution Level"
```

---

## Task 2: Capability CRUD actions

**Files:**
- Create: `apps/app/app/actions/solution-trains/capabilities.ts`
- Create: `apps/app/__tests__/actions/solution-trains/capabilities.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { createCapability, moveCapability } from "@/app/actions/solution-trains/capabilities";

jest.mock("@repo/database", () => ({
  database: {
    solutionTrain: {
      findFirst: jest.fn().mockResolvedValue({ id: "st-1", tenantId: "t1" }),
    },
    capability: {
      create: jest.fn().mockResolvedValue({ id: "cap-1", title: "Cloud Platform", status: "BACKLOG" }),
      update: jest.fn().mockResolvedValue({ id: "cap-1" }),
      findMany: jest.fn().mockResolvedValue([]),
    },
  },
}));

jest.mock("@repo/auth/server", () => ({
  requireTenantSession: jest.fn().mockResolvedValue({ tenantId: "t1" }),
}));
jest.mock("next/headers", () => ({ headers: jest.fn().mockResolvedValue({}) }));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

test("createCapability creates with correct solutionTrainId", async () => {
  const { database } = require("@repo/database");
  const result = await createCapability("st-1", "Cloud Platform", "Migrate all services to cloud");
  expect(database.capability.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ title: "Cloud Platform", solutionTrainId: "st-1" }),
    })
  );
  expect(result.id).toBe("cap-1");
});

test("moveCapability updates status field", async () => {
  const { database } = require("@repo/database");
  await moveCapability("cap-1", "IMPLEMENTING");
  expect(database.capability.update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ status: "IMPLEMENTING" }),
    })
  );
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd apps/app && npx jest __tests__/actions/solution-trains/capabilities.test.ts --no-coverage
```

- [ ] **Step 3: Implement**

```typescript
"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const CAPABILITY_STATUSES = ["BACKLOG", "ANALYZING", "IMPLEMENTING", "DONE"] as const;
type CapabilityStatus = (typeof CAPABILITY_STATUSES)[number];

const CreateSchema = z.object({
  solutionTrainId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});

const MoveSchema = z.object({
  capabilityId: z.string().min(1),
  status: z.enum(CAPABILITY_STATUSES),
});

export async function createCapability(
  solutionTrainId: string,
  title: string,
  description?: string
) {
  const ctx = await requireTenantSession(await headers());
  const { tenantId } = ctx;

  const input = CreateSchema.parse({ solutionTrainId, title, description });

  const st = await database.solutionTrain.findFirst({
    where: { id: input.solutionTrainId, tenantId },
    select: { id: true },
  });
  if (!st) throw new Error("SolutionTrain não encontrado.");

  const cap = await database.capability.create({
    data: {
      tenantId,
      solutionTrainId: input.solutionTrainId,
      title: input.title,
      description: input.description,
    },
  });

  revalidatePath(`/solution-trains/${input.solutionTrainId}`);
  return cap;
}

export async function moveCapability(capabilityId: string, status: CapabilityStatus) {
  const ctx = await requireTenantSession(await headers());
  const input = MoveSchema.parse({ capabilityId, status });

  const updated = await database.capability.update({
    where: { id: input.capabilityId, tenantId: ctx.tenantId } as any,
    data: { status: input.status },
  });

  revalidatePath(`/solution-trains`);
  return updated;
}

export async function getCapabilities(solutionTrainId: string) {
  const ctx = await requireTenantSession(await headers());
  return database.capability.findMany({
    where: { tenantId: ctx.tenantId, solutionTrainId },
    orderBy: [{ status: "asc" }, { order: "asc" }],
  });
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd apps/app && npx jest __tests__/actions/solution-trains/capabilities.test.ts --no-coverage
```

- [ ] **Step 5: Commit**

```bash
git add apps/app/app/actions/solution-trains/capabilities.ts \
        apps/app/__tests__/actions/solution-trains/capabilities.test.ts
git commit -m "feat(lst): Capability CRUD actions — create + move + list"
```

---

## Task 3: Capability Kanban UI

**Files:**
- Create: `apps/app/app/(authenticated)/solution-trains/[id]/components/capability-card.tsx`
- Create: `apps/app/app/(authenticated)/solution-trains/[id]/components/capability-kanban.tsx`

- [ ] **Step 1: Capability card**

```tsx
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const STATUS_COLOR: Record<string, string> = {
  BACKLOG: "bg-slate-100 text-slate-700",
  ANALYZING: "bg-amber-100 text-amber-700",
  IMPLEMENTING: "bg-blue-100 text-blue-700",
  DONE: "bg-emerald-100 text-emerald-700",
};

interface Props {
  id: string;
  title: string;
  description?: string | null;
  status: string;
}

export function CapabilityCard({ title, description, status }: Props) {
  return (
    <Card className="cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-3 space-y-1.5">
        <div className="font-medium text-sm leading-tight">{title}</div>
        {description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>
        )}
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${STATUS_COLOR[status] ?? ""}`}>
          {status}
        </Badge>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: DnD Kanban board**

```tsx
"use client";

import { useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { moveCapability } from "@/app/actions/solution-trains/capabilities";
import { CapabilityCard } from "./capability-card";

const COLUMNS = [
  { status: "BACKLOG", label: "Backlog" },
  { status: "ANALYZING", label: "Analisando" },
  { status: "IMPLEMENTING", label: "Implementando" },
  { status: "DONE", label: "Concluído" },
];

type Capability = { id: string; title: string; description?: string | null; status: string };

interface SortableCardProps {
  cap: Capability;
}

function SortableCard({ cap }: SortableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: cap.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <CapabilityCard {...cap} />
    </div>
  );
}

interface Props {
  initialCapabilities: Capability[];
}

export function CapabilityKanban({ initialCapabilities }: Props) {
  const [capabilities, setCapabilities] = useState(initialCapabilities);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const activeCard = capabilities.find((c) => c.id === activeId);

  function onDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string);
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) return;

    const targetStatus = over.id as string;
    if (!COLUMNS.find((c) => c.status === targetStatus)) return;

    const card = capabilities.find((c) => c.id === active.id);
    if (!card || card.status === targetStatus) return;

    setCapabilities((prev) =>
      prev.map((c) => (c.id === active.id ? { ...c, status: targetStatus } : c))
    );

    startTransition(() => {
      moveCapability(active.id as string, targetStatus as any).catch(() => {
        // Revert on error
        setCapabilities(initialCapabilities);
      });
    });
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="grid grid-cols-4 gap-4">
        {COLUMNS.map((col) => {
          const cards = capabilities.filter((c) => c.status === col.status);
          return (
            <div
              key={col.status}
              id={col.status}
              className="rounded-lg bg-muted/30 border border-dashed p-3 min-h-[200px] space-y-2"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {col.label}
                </h3>
                <span className="text-xs text-muted-foreground">{cards.length}</span>
              </div>
              <SortableContext
                items={cards.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                {cards.map((cap) => (
                  <SortableCard key={cap.id} cap={cap} />
                ))}
              </SortableContext>
            </div>
          );
        })}
      </div>
      <DragOverlay>
        {activeCard && <CapabilityCard {...activeCard} />}
      </DragOverlay>
    </DndContext>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/app/app/\(authenticated\)/solution-trains/\[id\]/components/capability-card.tsx \
        apps/app/app/\(authenticated\)/solution-trains/\[id\]/components/capability-kanban.tsx
git commit -m "feat(lst): Capability Kanban with DnD Kit drag-to-column"
```

---

## Task 4: SolutionTrain list + detail pages

**Files:**
- Create: `apps/app/app/(authenticated)/solution-trains/page.tsx`
- Create: `apps/app/app/(authenticated)/solution-trains/[id]/page.tsx`

- [ ] **Step 1: SolutionTrain list page**

```tsx
import { database } from "@repo/database";
import { requireTenantSession } from "@repo/auth/server";
import { headers } from "next/headers";
import { isLSTEnabled } from "@/app/actions/settings/feature-flags";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function SolutionTrainsPage() {
  const ctx = await requireTenantSession(await headers());

  const enabled = await isLSTEnabled();
  if (!enabled) redirect("/settings?tab=features");

  const trains = await database.solutionTrain.findMany({
    where: { tenantId: ctx.tenantId },
    include: {
      _count: { select: { capabilities: true, solutionEpics: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Solution Trains</h1>
        <p className="text-sm text-muted-foreground">Large Solution Level — SAFe 6.0</p>
      </div>

      {trains.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          <p className="text-sm">Nenhum Solution Train configurado ainda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {trains.map((st) => (
            <Link key={st.id} href={`/solution-trains/${st.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{st.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  {st.description && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{st.description}</p>
                  )}
                  <div className="flex gap-2">
                    <Badge variant="outline">{st._count.capabilities} capabilities</Badge>
                    <Badge variant="outline">{st._count.solutionEpics} solution epics</Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: SolutionTrain detail page**

```tsx
import { database } from "@repo/database";
import { requireTenantSession } from "@repo/auth/server";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CapabilityKanban } from "./components/capability-kanban";
import { getCapabilities } from "@/app/actions/solution-trains/capabilities";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SolutionTrainDetailPage({ params }: Props) {
  const ctx = await requireTenantSession(await headers());
  const { id } = await params;

  const [st, capabilities, solutionEpics] = await Promise.all([
    database.solutionTrain.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { id: true, name: true, description: true },
    }),
    getCapabilities(id),
    database.solutionEpic.findMany({
      where: { solutionTrainId: id, tenantId: ctx.tenantId },
      orderBy: { wsjfScore: "desc" },
    }),
  ]);

  if (!st) notFound();

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">{st.name}</h1>
        {st.description && (
          <p className="text-sm text-muted-foreground mt-1">{st.description}</p>
        )}
      </div>

      <Tabs defaultValue="capabilities">
        <TabsList>
          <TabsTrigger value="capabilities">Capabilities ({capabilities.length})</TabsTrigger>
          <TabsTrigger value="epics">Solution Epics ({solutionEpics.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="capabilities" className="mt-4">
          <CapabilityKanban initialCapabilities={capabilities} />
        </TabsContent>

        <TabsContent value="epics" className="mt-4">
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Solution Epic</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-right p-3 font-medium">WSJF</th>
                </tr>
              </thead>
              <tbody>
                {solutionEpics.map((e) => (
                  <tr key={e.id} className="border-t hover:bg-muted/20">
                    <td className="p-3 font-medium">{e.title}</td>
                    <td className="p-3 text-muted-foreground">{e.status}</td>
                    <td className="p-3 text-right">{e.wsjfScore.toFixed(1)}</td>
                  </tr>
                ))}
                {solutionEpics.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-6 text-center text-muted-foreground text-sm">
                      Nenhuma Solution Epic criada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/app/app/\(authenticated\)/solution-trains/page.tsx \
        apps/app/app/\(authenticated\)/solution-trains/\[id\]/page.tsx
git commit -m "feat(lst): SolutionTrain list + detail pages with Capability Kanban"
```

---

## Task 5: LACE page

**Files:**
- Create: `apps/app/app/(authenticated)/solution-trains/lace/page.tsx`

- [ ] **Step 1: LACE page (Lean-Agile Center of Excellence)**

```tsx
import { database } from "@repo/database";
import { requireTenantSession } from "@repo/auth/server";
import { headers } from "next/headers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function LACEPage() {
  const ctx = await requireTenantSession(await headers());

  const lace = await database.lACE.findFirst({
    where: { tenantId: ctx.tenantId },
    select: {
      id: true,
      name: true,
      description: true,
      principles: true,
    },
  });

  const principles = Array.isArray(lace?.principles) ? (lace.principles as string[]) : [];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">{lace?.name ?? "LACE"}</h1>
        <p className="text-sm text-muted-foreground">
          Lean-Agile Center of Excellence — guardião da excelência SAFe
        </p>
      </div>

      {lace?.description && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sobre o LACE</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{lace.description}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Princípios Lean-Agile</CardTitle>
        </CardHeader>
        <CardContent>
          {principles.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum princípio configurado. Edite para adicionar os princípios guia do LACE.
            </p>
          ) : (
            <ol className="space-y-2">
              {principles.map((p, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <Badge variant="outline" className="shrink-0 mt-0.5 text-xs w-6 h-6 flex items-center justify-center rounded-full">
                    {i + 1}
                  </Badge>
                  <span>{p}</span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/app/app/\(authenticated\)/solution-trains/lace/page.tsx
git commit -m "feat(lst): LACE page with Lean-Agile principles display"
```

---

## Task 6: Feature flag UI in settings

**Files:**
- Modify: settings page (likely `apps/app/app/(authenticated)/settings/` — add LST toggle)

- [ ] **Step 1: Add LST toggle in settings features tab**

```tsx
// Inside the settings features section (Server Component to read flag):
import { isLSTEnabled, enableLargeSolutionLevel } from "@/app/actions/settings/feature-flags";

// Read current state:
const lstEnabled = await isLSTEnabled();

// Render a toggle (inline form action or client component with switch):
```

```tsx
"use client";
// LSTToggle client component
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useTransition } from "react";
import { enableLargeSolutionLevel } from "@/app/actions/settings/feature-flags";

interface Props {
  initialEnabled: boolean;
}

export function LSTToggle({ initialEnabled }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [, startTransition] = useTransition();

  function toggle(value: boolean) {
    setEnabled(value);
    startTransition(() => {
      enableLargeSolutionLevel(value).catch(() => setEnabled(!value));
    });
  }

  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div className="space-y-0.5">
        <Label className="text-base font-medium">Large Solution Level (LST)</Label>
        <p className="text-sm text-muted-foreground">
          Habilita Solution Trains, Capabilities e LACE para coordenação de múltiplos ARTs.
          Recomendado apenas para organizações com 3+ ARTs.
        </p>
      </div>
      <Switch checked={enabled} onCheckedChange={toggle} />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/app/app/\(authenticated\)/settings/
git commit -m "feat(lst): LST feature flag toggle in settings"
```

---

## Done When

- [ ] `isLSTEnabled()` returns false by default for new tenants
- [ ] ADMIN can toggle LST flag; non-admins cannot
- [ ] `/solution-trains` redirects to settings when LST disabled
- [ ] SolutionTrain list shows count of capabilities + solution epics
- [ ] Capability Kanban drag-to-column updates `status` via server action
- [ ] Solution Epics table sorts by WSJF descending
- [ ] LACE page renders principles list
- [ ] Tests passing: `capabilities.test.ts`, `feature-flags.test.ts`
