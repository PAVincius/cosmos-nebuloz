# T04 — Flow Metrics 6D na UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-ready Flow Metrics dashboard exposing all 6 SAFe dimensions (Distribution, Velocity, Time, Load, Efficiency, Predictability) with zero external BI dependency — data comes directly from `getFlowMetrics()`.

**Architecture:** Scope selector (team/ART) → Server Component fetches `FlowMetricsResult` → Client Chart components (Recharts). Staleness badge reuses `FlowMetricSnapshot.staleness`. Anomaly highlights wire to existing `AnomalyDetectionRun` records. No new backend logic needed — UI-only work.

**Tech Stack:** Next.js 15 App Router, Recharts, Tailwind, shadcn/ui, existing `getFlowMetrics()` + `getFlowScopeOptions()` Server Actions.

---

## File Structure

```
apps/app/app/(authenticated)/analytics/
  flow/
    page.tsx                            MODIFY: replace stub with full dashboard
    components/
      flow-scope-selector.tsx           NEW: ART/team select with URL param sync
      flow-distribution-chart.tsx       NEW: stacked bar — story/feature/defect/enabler
      flow-velocity-chart.tsx           NEW: area chart — last 10 sprints
      flow-time-card.tsx                NEW: avg cycle time by type + overall
      flow-load-gauge.tsx               NEW: WIP current + sparkline history
      flow-efficiency-gauge.tsx         NEW: radial progress gauge (0–100%)
      flow-predictability-chart.tsx     NEW: bar pair planned vs delivered per PI/sprint
      flow-staleness-badge.tsx          NEW: FRESH/AGING/STALE/CRITICAL badge
      flow-anomaly-callout.tsx          NEW: inline warning if anomaly active for scope
      flow-metric-card.tsx              NEW: generic wrapper card with title + staleness

apps/app/__tests__/components/flow-metrics/
  flow-distribution-chart.test.tsx      NEW
  flow-predictability-chart.test.tsx    NEW
```

---

## Task 1: Scope selector with URL sync

**Files:**
- Create: `apps/app/app/(authenticated)/analytics/flow/components/flow-scope-selector.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// apps/app/__tests__/components/flow-metrics/flow-scope-selector.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter, useSearchParams } from "next/navigation";
import { FlowScopeSelector } from "@/app/(authenticated)/analytics/flow/components/flow-scope-selector";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}));

const options = [
  { id: "art-1", label: "ART Alpha", type: "art" as const },
  { id: "team-1", label: "Team Red", type: "team" as const },
];

test("renders options and pushes URL on change", async () => {
  const push = jest.fn();
  (useRouter as jest.Mock).mockReturnValue({ push });
  (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams(""));

  render(<FlowScopeSelector options={options} />);
  expect(screen.getByText("ART Alpha")).toBeInTheDocument();

  await userEvent.click(screen.getByRole("combobox"));
  await userEvent.click(screen.getByText("Team Red"));
  expect(push).toHaveBeenCalledWith("?scope=team&scopeId=team-1");
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd apps/app && npx jest __tests__/components/flow-metrics/flow-scope-selector.test.tsx --no-coverage
```

- [ ] **Step 3: Implement**

```tsx
"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter, useSearchParams } from "next/navigation";
import type { FlowScopeOption } from "@/app/actions/flow-metrics";

interface Props {
  options: FlowScopeOption[];
}

export function FlowScopeSelector({ options }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const current = `${params.get("scope") ?? "art"}:${params.get("scopeId") ?? ""}`;

  function onChange(value: string) {
    const [type, id] = value.split(":");
    router.push(`?scope=${type}&scopeId=${id}`);
  }

  return (
    <Select value={current} onValueChange={onChange}>
      <SelectTrigger className="w-64">
        <SelectValue placeholder="Selecionar escopo..." />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={`${o.type}:${o.id}`} value={`${o.type}:${o.id}`}>
            <span className="text-muted-foreground text-xs mr-1">
              {o.type === "art" ? "ART" : "Time"}
            </span>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd apps/app && npx jest __tests__/components/flow-metrics/flow-scope-selector.test.tsx --no-coverage
```

- [ ] **Step 5: Commit**

```bash
git add apps/app/app/\(authenticated\)/analytics/flow/components/flow-scope-selector.tsx \
        apps/app/__tests__/components/flow-metrics/flow-scope-selector.test.tsx
git commit -m "feat(flow-metrics): scope selector with URL param sync"
```

---

## Task 2: Flow Distribution chart

**Files:**
- Create: `apps/app/app/(authenticated)/analytics/flow/components/flow-distribution-chart.tsx`
- Create: `apps/app/__tests__/components/flow-metrics/flow-distribution-chart.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
import { render, screen } from "@testing-library/react";
import { FlowDistributionChart } from "@/app/(authenticated)/analytics/flow/components/flow-distribution-chart";

const data = [
  { type: "História", count: 42, pct: 70 },
  { type: "Feature", count: 12, pct: 20 },
  { type: "Defect", count: 6, pct: 10 },
];

test("renders all distribution types with percentages", () => {
  render(<FlowDistributionChart data={data} />);
  expect(screen.getByText("70%")).toBeInTheDocument();
  expect(screen.getByText("História")).toBeInTheDocument();
  expect(screen.getByText("Defect")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd apps/app && npx jest __tests__/components/flow-metrics/flow-distribution-chart.test.tsx --no-coverage
```

- [ ] **Step 3: Implement**

```tsx
"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const COLORS: Record<string, string> = {
  História: "#6366f1",
  Feature: "#22c55e",
  Defect: "#ef4444",
  Enabler: "#f59e0b",
};

interface Props {
  data: { type: string; count: number; pct: number }[];
}

export function FlowDistributionChart({ data }: Props) {
  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
          <XAxis type="number" unit="%" domain={[0, 100]} tickCount={5} />
          <YAxis type="category" dataKey="type" width={72} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(v: number) => [`${v}%`, "Proporção"]} />
          <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
            {data.map((d) => (
              <Cell key={d.type} fill={COLORS[d.type] ?? "#94a3b8"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex gap-3 flex-wrap">
        {data.map((d) => (
          <span key={d.type} className="flex items-center gap-1 text-xs text-muted-foreground">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ background: COLORS[d.type] ?? "#94a3b8" }}
            />
            {d.type}: <strong>{d.pct}%</strong> ({d.count})
          </span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd apps/app && npx jest __tests__/components/flow-metrics/flow-distribution-chart.test.tsx --no-coverage
```

- [ ] **Step 5: Commit**

```bash
git add apps/app/app/\(authenticated\)/analytics/flow/components/flow-distribution-chart.tsx \
        apps/app/__tests__/components/flow-metrics/flow-distribution-chart.test.tsx
git commit -m "feat(flow-metrics): distribution chart — stacked bar by work type"
```

---

## Task 3: Velocity + Time cards

**Files:**
- Create: `apps/app/app/(authenticated)/analytics/flow/components/flow-velocity-chart.tsx`
- Create: `apps/app/app/(authenticated)/analytics/flow/components/flow-time-card.tsx`

- [ ] **Step 1: Implement velocity area chart**

```tsx
"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface Props {
  data: { label: string; total: number }[];
}

export function FlowVelocityChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={140}>
      <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
        <defs>
          <linearGradient id="velGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip />
        <Area
          type="monotone"
          dataKey="total"
          name="Velocity"
          stroke="#6366f1"
          fill="url(#velGrad)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 2: Implement flow time card**

```tsx
import type { FlowMetricsResult } from "@/app/actions/flow-metrics";

interface Props {
  flowTime: FlowMetricsResult["flowTime"];
  overall: number;
}

export function FlowTimeCard({ flowTime, overall }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold">{overall}</span>
        <span className="text-sm text-muted-foreground">dias (média geral)</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {flowTime.map((t) => (
          <div key={t.type} className="rounded-lg border p-3 text-center">
            <div className="text-lg font-semibold">{t.avgDays}d</div>
            <div className="text-xs text-muted-foreground">{t.type}</div>
            <div className="text-xs text-muted-foreground">({t.count} itens)</div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/app/app/\(authenticated\)/analytics/flow/components/flow-velocity-chart.tsx \
        apps/app/app/\(authenticated\)/analytics/flow/components/flow-time-card.tsx
git commit -m "feat(flow-metrics): velocity area chart + cycle time card"
```

---

## Task 4: Load gauge + Efficiency gauge

**Files:**
- Create: `apps/app/app/(authenticated)/analytics/flow/components/flow-load-gauge.tsx`
- Create: `apps/app/app/(authenticated)/analytics/flow/components/flow-efficiency-gauge.tsx`

- [ ] **Step 1: Implement WIP load gauge**

```tsx
"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

interface Props {
  current: number;
  history: { label: string; wip: number }[];
  wipLimit?: number;
}

export function FlowLoadGauge({ current, history, wipLimit }: Props) {
  const isOverloaded = wipLimit ? current > wipLimit : false;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2">
        <span className={`text-3xl font-bold ${isOverloaded ? "text-rose-500" : "text-foreground"}`}>
          {current}
        </span>
        <span className="text-sm text-muted-foreground">itens em andamento</span>
        {isOverloaded && (
          <span className="text-xs text-rose-500 font-medium">⚠ acima do limite WIP</span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={80}>
        <LineChart data={history} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
          <XAxis dataKey="label" tick={{ fontSize: 9 }} />
          <YAxis tick={{ fontSize: 9 }} />
          <Tooltip />
          {wipLimit && (
            <ReferenceLine y={wipLimit} stroke="#ef4444" strokeDasharray="4 2" label={{ value: "Limite", fontSize: 9 }} />
          )}
          <Line type="monotone" dataKey="wip" stroke="#f59e0b" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Implement efficiency radial gauge**

```tsx
"use client";

import { RadialBarChart, RadialBar, ResponsiveContainer } from "recharts";

interface Props {
  value: number; // 0–1
}

export function FlowEfficiencyGauge({ value }: Props) {
  const pct = Math.round(value * 100);
  const color = pct >= 60 ? "#22c55e" : pct >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative flex flex-col items-center">
      <ResponsiveContainer width={160} height={160}>
        <RadialBarChart
          cx="50%"
          cy="50%"
          innerRadius="60%"
          outerRadius="90%"
          startAngle={90}
          endAngle={-270}
          data={[{ value: pct, fill: color }]}
        >
          <RadialBar dataKey="value" cornerRadius={8} background={{ fill: "#e2e8f0" }} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold" style={{ color }}>{pct}%</span>
        <span className="text-xs text-muted-foreground">eficiência</span>
      </div>
      <p className="text-xs text-center text-muted-foreground max-w-32">
        Tempo ativo / tempo total de ciclo
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/app/app/\(authenticated\)/analytics/flow/components/flow-load-gauge.tsx \
        apps/app/app/\(authenticated\)/analytics/flow/components/flow-efficiency-gauge.tsx
git commit -m "feat(flow-metrics): WIP load gauge + efficiency radial gauge"
```

---

## Task 5: Predictability chart + staleness badge

**Files:**
- Create: `apps/app/app/(authenticated)/analytics/flow/components/flow-predictability-chart.tsx`
- Create: `apps/app/app/(authenticated)/analytics/flow/components/flow-staleness-badge.tsx`
- Create: `apps/app/__tests__/components/flow-metrics/flow-predictability-chart.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
import { render, screen } from "@testing-library/react";
import { FlowPredictabilityChart } from "@/app/(authenticated)/analytics/flow/components/flow-predictability-chart";

const history = [
  { label: "PI-1", planned: 8, delivered: 6 },
  { label: "PI-2", planned: 10, delivered: 9 },
];

test("renders planned and delivered bars", () => {
  render(<FlowPredictabilityChart history={history} current={0.9} />);
  expect(screen.getByText("PI-1")).toBeInTheDocument();
  expect(screen.getByText("90%")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd apps/app && npx jest __tests__/components/flow-metrics/flow-predictability-chart.test.tsx --no-coverage
```

- [ ] **Step 3: Implement predictability chart**

```tsx
"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface Props {
  history: { label: string; planned: number; delivered: number }[];
  current: number; // 0–1
}

export function FlowPredictabilityChart({ history, current }: Props) {
  const pct = Math.round(current * 100);
  const color = pct >= 80 ? "text-emerald-600" : pct >= 60 ? "text-amber-500" : "text-rose-500";

  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-2">
        <span className={`text-3xl font-bold ${color}`}>{pct}%</span>
        <span className="text-sm text-muted-foreground">previsibilidade atual</span>
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={history} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="planned" name="Planejado" fill="#94a3b8" radius={[2, 2, 0, 0]} />
          <Bar dataKey="delivered" name="Entregue" fill="#6366f1" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 4: Implement staleness badge**

```tsx
import { Badge } from "@/components/ui/badge";

const CONFIG = {
  FRESH: { label: "Atualizado", variant: "outline" as const, className: "border-emerald-500 text-emerald-600" },
  AGING: { label: "Envelhecendo", variant: "outline" as const, className: "border-amber-400 text-amber-600" },
  STALE: { label: "Desatualizado", variant: "outline" as const, className: "border-orange-500 text-orange-600" },
  CRITICAL: { label: "Crítico", variant: "outline" as const, className: "border-rose-500 text-rose-600" },
};

interface Props {
  staleness: "FRESH" | "AGING" | "STALE" | "CRITICAL" | null;
}

export function FlowStalenessBadge({ staleness }: Props) {
  if (!staleness) return null;
  const c = CONFIG[staleness];
  return (
    <Badge variant={c.variant} className={c.className}>
      {c.label}
    </Badge>
  );
}
```

- [ ] **Step 5: Run test — expect PASS**

```bash
cd apps/app && npx jest __tests__/components/flow-metrics/flow-predictability-chart.test.tsx --no-coverage
```

- [ ] **Step 6: Commit**

```bash
git add apps/app/app/\(authenticated\)/analytics/flow/components/ \
        apps/app/__tests__/components/flow-metrics/
git commit -m "feat(flow-metrics): predictability chart + staleness badge"
```

---

## Task 6: Anomaly callout + metric card wrapper

**Files:**
- Create: `apps/app/app/(authenticated)/analytics/flow/components/flow-anomaly-callout.tsx`
- Create: `apps/app/app/(authenticated)/analytics/flow/components/flow-metric-card.tsx`

- [ ] **Step 1: Anomaly callout — query active anomaly for scope**

```tsx
import { database } from "@repo/database";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Props {
  tenantId: string;
  scopeId: string;
}

// Server Component — can query directly
export async function FlowAnomalyCallout({ tenantId, scopeId }: Props) {
  const anomaly = await database.anomalyDetectionRun.findFirst({
    where: {
      tenantId,
      scopeId,
      status: "COMPLETED",
      anomalies: { some: { severity: { in: ["HIGH", "CRITICAL"] }, resolvedAt: null } },
    },
    orderBy: { completedAt: "desc" },
    select: {
      anomalies: {
        where: { severity: { in: ["HIGH", "CRITICAL"] }, resolvedAt: null },
        select: { ruleCode: true, severity: true, metadata: true },
        take: 3,
      },
    },
  });

  if (!anomaly?.anomalies.length) return null;

  return (
    <Alert variant="destructive" className="border-rose-300 bg-rose-50">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Anomalias ativas no fluxo</AlertTitle>
      <AlertDescription>
        <ul className="mt-1 list-disc list-inside space-y-0.5 text-xs">
          {anomaly.anomalies.map((a, i) => (
            <li key={i}>
              <strong>{a.ruleCode}</strong> — {a.severity}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
```

- [ ] **Step 2: Generic metric card wrapper**

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReactNode } from "react";
import { FlowStalenessBadge } from "./flow-staleness-badge";

interface Props {
  title: string;
  staleness?: "FRESH" | "AGING" | "STALE" | "CRITICAL" | null;
  children: ReactNode;
}

export function FlowMetricCard({ title, staleness, children }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <FlowStalenessBadge staleness={staleness ?? null} />
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/app/app/\(authenticated\)/analytics/flow/components/flow-anomaly-callout.tsx \
        apps/app/app/\(authenticated\)/analytics/flow/components/flow-metric-card.tsx
git commit -m "feat(flow-metrics): anomaly callout + metric card wrapper"
```

---

## Task 7: Wire dashboard page

**Files:**
- Modify: `apps/app/app/(authenticated)/analytics/flow/page.tsx`

- [ ] **Step 1: Replace stub with full Server Component dashboard**

```tsx
import { Suspense } from "react";
import { getFlowMetrics, getFlowScopeOptions } from "@/app/actions/flow-metrics";
import { requireTenantSession } from "@repo/auth/server";
import { headers } from "next/headers";
import { FlowScopeSelector } from "./components/flow-scope-selector";
import { FlowDistributionChart } from "./components/flow-distribution-chart";
import { FlowVelocityChart } from "./components/flow-velocity-chart";
import { FlowTimeCard } from "./components/flow-time-card";
import { FlowLoadGauge } from "./components/flow-load-gauge";
import { FlowEfficiencyGauge } from "./components/flow-efficiency-gauge";
import { FlowPredictabilityChart } from "./components/flow-predictability-chart";
import { FlowMetricCard } from "./components/flow-metric-card";
import { FlowAnomalyCallout } from "./components/flow-anomaly-callout";

interface Props {
  searchParams: Promise<{ scope?: string; scopeId?: string }>;
}

export default async function FlowMetricsDashboard({ searchParams }: Props) {
  const ctx = await requireTenantSession(await headers());
  const sp = await searchParams;
  const scope = (sp.scope as "team" | "art" | "value_stream") ?? "art";

  const scopeOptions = await getFlowScopeOptions();
  const firstScopeId = sp.scopeId ?? scopeOptions[0]?.id ?? "";

  let metrics = null;
  let error: string | null = null;

  if (firstScopeId) {
    try {
      metrics = await getFlowMetrics(scope, firstScopeId);
    } catch (e) {
      error = (e as Error).message;
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Flow Metrics</h1>
          <p className="text-sm text-muted-foreground">SAFe 6.0 — 6 dimensões integradas</p>
        </div>
        <FlowScopeSelector options={scopeOptions} />
      </div>

      {error && (
        <div className="rounded-md bg-rose-50 border border-rose-300 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      {metrics && (
        <>
          <Suspense>
            <FlowAnomalyCallout tenantId={ctx.tenantId} scopeId={firstScopeId} />
          </Suspense>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <FlowMetricCard title="Flow Distribution" staleness={metrics.staleness}>
              <FlowDistributionChart data={metrics.flowDistribution} />
            </FlowMetricCard>

            <FlowMetricCard title="Flow Velocity" staleness={metrics.staleness}>
              <FlowVelocityChart data={metrics.flowVelocity} />
            </FlowMetricCard>

            <FlowMetricCard title="Flow Time (Cycle Time)" staleness={metrics.staleness}>
              <FlowTimeCard flowTime={metrics.flowTime} overall={metrics.flowTimeOverall} />
            </FlowMetricCard>

            <FlowMetricCard title="Flow Load (WIP)" staleness={metrics.staleness}>
              <FlowLoadGauge
                current={metrics.flowLoad}
                history={metrics.flowLoadHistory}
              />
            </FlowMetricCard>

            <FlowMetricCard title="Flow Efficiency" staleness={metrics.staleness}>
              <FlowEfficiencyGauge value={metrics.flowEfficiency} />
            </FlowMetricCard>

            <FlowMetricCard title="Flow Predictability" staleness={metrics.staleness}>
              <FlowPredictabilityChart
                history={metrics.flowPredictabilityHistory}
                current={metrics.flowPredictability}
              />
            </FlowMetricCard>
          </div>

          <p className="text-xs text-muted-foreground text-right">
            Período: {metrics.periodLabel} · Escopo: {metrics.scopeLabel}
          </p>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/app/app/\(authenticated\)/analytics/flow/page.tsx
git commit -m "feat(flow-metrics): full 6D dashboard page — zero BI dependency"
```

---

## Done When

- [ ] Scope selector changes URL without page reload flash
- [ ] All 6 metric cards render with real data
- [ ] Staleness badge shows correct state per snapshot
- [ ] Anomaly callout appears when HIGH/CRITICAL anomaly active for scope
- [ ] No external BI tool required — all data from `getFlowMetrics()`
- [ ] Tests passing: distribution chart, predictability chart, scope selector
