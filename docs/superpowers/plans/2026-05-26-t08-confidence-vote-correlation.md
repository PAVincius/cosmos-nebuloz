# T08 — Confidence Vote + Correlação Histórica — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing Confidence Vote with historical predictability correlation: after each PI closes, a job correlates average vote score → actual `flowPredictability`. Dashboard shows bias pattern (chronic overconfidence or underconfidence) and a trend chart of vote vs delivery over time.

**Architecture:** New `VotePredictabilityCorrelation` table stores `(piPlanId, avgVote, predictability, biasScore)` — written by a `correlatePIOutcome()` action triggered when PI closes. The RTE dashboard widget reads last N correlations and renders a scatter/line chart. Bias indicator flags if `biasScore > 0.2` consistently.

**Tech Stack:** Prisma (new model), Next.js Server Actions, Recharts ScatterChart, existing `ConfidenceVoteSession.votes` + `FlowMetricSnapshot.flowPredictability`.

---

## File Structure

```
packages/database/prisma/schema/planning.prisma
  VotePredictabilityCorrelation model         ADD to existing schema

apps/app/app/actions/arts/
  correlate-pi-outcome.ts                     NEW: runs after PI closes
  vote-correlation-history.ts                 NEW: query last N correlations

apps/app/app/(authenticated)/arts/[artId]/
  components/
    confidence-correlation-chart.tsx          NEW: scatter chart vote vs predictability
    vote-bias-indicator.tsx                   NEW: bias callout badge

apps/app/__tests__/actions/arts/
  correlate-pi-outcome.test.ts                NEW
  vote-correlation-history.test.ts            NEW
```

---

## Task 1: Add VotePredictabilityCorrelation model

**Files:**
- Modify: `packages/database/prisma/schema/planning.prisma`

- [ ] **Step 1: Add model to schema**

```prisma
// Add at end of planning.prisma

model VotePredictabilityCorrelation {
  id             String   @id @default(cuid())
  tenantId       String
  artId          String
  piPlanId       String   @unique  // one correlation per PI
  // Vote data
  avgVoteScore   Float    // mean of all votes across all rounds (1–5 scale)
  participantCount Int    @default(0)
  roundCount     Int      @default(1)
  // Outcome data
  predictability Float    // 0–1 actual PI predictability at close
  plannedCount   Int      @default(0)
  deliveredCount Int      @default(0)
  // Derived
  biasScore      Float    // avgVoteScore/5 - predictability; positive = overconfident
  correlatedAt   DateTime @default(now())

  tenant  Tenant  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  piPlan  PIPlan  @relation(fields: [piPlanId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([tenantId, artId])
  @@index([tenantId, correlatedAt])
}
```

- [ ] **Step 2: Generate migration**

```bash
cd packages/database
npx prisma migrate dev --name add_vote_predictability_correlation
```

Expected output: `The following migration(s) have been created and applied: .../add_vote_predictability_correlation`

- [ ] **Step 3: Commit**

```bash
git add packages/database/prisma/schema/planning.prisma \
        packages/database/prisma/migrations/
git commit -m "feat(db): add VotePredictabilityCorrelation model for confidence vote history"
```

---

## Task 2: Correlate PI outcome action

**Files:**
- Create: `apps/app/app/actions/arts/correlate-pi-outcome.ts`
- Create: `apps/app/__tests__/actions/arts/correlate-pi-outcome.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { correlatePIOutcome } from "@/app/actions/arts/correlate-pi-outcome";

const mockPIPlan = {
  id: "pi-1",
  tenantId: "t1",
  artId: "art-1",
  piObjectives: [
    { isStretch: false, status: "ACHIEVED" },
    { isStretch: false, status: "ACHIEVED" },
    { isStretch: false, status: "NOT_ACHIEVED" },
    { isStretch: true, status: "ACHIEVED" },
  ],
  piSessions: [
    {
      confidenceSessions: [
        { votes: [4, 5, 3, 4], xStateStatus: "APPROVED" },
        { votes: [5, 5, 4, 5], xStateStatus: "APPROVED" },
      ],
    },
  ],
};

jest.mock("@repo/database", () => ({
  database: {
    pIPlan: { findFirst: jest.fn().mockResolvedValue(mockPIPlan) },
    votePredictabilityCorrelation: {
      upsert: jest.fn().mockResolvedValue({ id: "corr-1" }),
    },
  },
}));

jest.mock("@repo/auth/server", () => ({
  requireTenantSession: jest.fn().mockResolvedValue({ tenantId: "t1" }),
}));
jest.mock("next/headers", () => ({ headers: jest.fn().mockResolvedValue({}) }));

test("computes avgVote and predictability correctly", async () => {
  const { database } = require("@repo/database");
  await correlatePIOutcome("pi-1");

  const upsertCall = database.votePredictabilityCorrelation.upsert.mock.calls[0][0];
  const data = upsertCall.create;

  // votes: [4,5,3,4,5,5,4,5] = 35/8 = 4.375
  expect(data.avgVoteScore).toBeCloseTo(4.375, 2);
  // predictability: 2 achieved / 3 committed = 0.667
  expect(data.predictability).toBeCloseTo(0.667, 2);
  // biasScore: 4.375/5 - 0.667 = 0.875 - 0.667 = 0.208
  expect(data.biasScore).toBeCloseTo(0.208, 2);
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd apps/app && npx jest __tests__/actions/arts/correlate-pi-outcome.test.ts --no-coverage
```

- [ ] **Step 3: Implement**

```typescript
"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";

export async function correlatePIOutcome(piPlanId: string): Promise<void> {
  const ctx = await requireTenantSession(await headers());
  const { tenantId } = ctx;

  const pi = await database.pIPlan.findFirst({
    where: { id: piPlanId, tenantId },
    select: {
      id: true,
      artId: true,
      tenantId: true,
      piObjectives: { select: { isStretch: true, status: true } },
      piSessions: {
        select: {
          confidenceSessions: {
            where: { xStateStatus: { in: ["APPROVED", "REWORK"] } },
            select: { votes: true },
          },
        },
      },
    },
  });

  if (!pi) throw new Error("PI não encontrada.");

  // ── Compute avgVoteScore ─────────────────────────────────────────────
  const allVotes: number[] = [];
  for (const session of pi.piSessions) {
    for (const round of session.confidenceSessions) {
      const votes = Array.isArray(round.votes) ? (round.votes as number[]) : [];
      allVotes.push(...votes.filter((v) => typeof v === "number" && v >= 1 && v <= 5));
    }
  }

  const avgVoteScore =
    allVotes.length > 0
      ? allVotes.reduce((a, b) => a + b, 0) / allVotes.length
      : 0;

  // ── Compute predictability ───────────────────────────────────────────
  const committed = pi.piObjectives.filter((o) => !o.isStretch);
  const achieved = committed.filter((o) => o.status === "ACHIEVED");
  const predictability = committed.length > 0 ? achieved.length / committed.length : 0;

  // ── Bias: (avgVote/5) - predictability ──────────────────────────────
  // Positive = team was more confident than they delivered (overconfident)
  // Negative = team was less confident than they delivered (underconfident)
  const biasScore = Math.round((avgVoteScore / 5 - predictability) * 1000) / 1000;

  await database.votePredictabilityCorrelation.upsert({
    where: { piPlanId },
    create: {
      tenantId,
      artId: pi.artId,
      piPlanId,
      avgVoteScore: Math.round(avgVoteScore * 1000) / 1000,
      participantCount: allVotes.length,
      roundCount: pi.piSessions.reduce((acc, s) => acc + s.confidenceSessions.length, 0),
      predictability: Math.round(predictability * 1000) / 1000,
      plannedCount: committed.length,
      deliveredCount: achieved.length,
      biasScore,
    },
    update: {
      avgVoteScore: Math.round(avgVoteScore * 1000) / 1000,
      predictability: Math.round(predictability * 1000) / 1000,
      biasScore,
      plannedCount: committed.length,
      deliveredCount: achieved.length,
    },
  });
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd apps/app && npx jest __tests__/actions/arts/correlate-pi-outcome.test.ts --no-coverage
```

- [ ] **Step 5: Commit**

```bash
git add apps/app/app/actions/arts/correlate-pi-outcome.ts \
        apps/app/__tests__/actions/arts/correlate-pi-outcome.test.ts
git commit -m "feat(confidence-vote): correlatePIOutcome — bias score computation"
```

---

## Task 3: Query correlation history

**Files:**
- Create: `apps/app/app/actions/arts/vote-correlation-history.ts`
- Create: `apps/app/__tests__/actions/arts/vote-correlation-history.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { getVoteCorrelationHistory, getBiasTrend } from "@/app/actions/arts/vote-correlation-history";

jest.mock("@repo/database", () => ({
  database: {
    votePredictabilityCorrelation: {
      findMany: jest.fn().mockResolvedValue([
        { piPlanId: "pi-1", avgVoteScore: 4.2, predictability: 0.7, biasScore: 0.14, correlatedAt: new Date("2026-01-01"), piPlan: { name: "PI-1" } },
        { piPlanId: "pi-2", avgVoteScore: 4.5, predictability: 0.5, biasScore: 0.40, correlatedAt: new Date("2026-04-01"), piPlan: { name: "PI-2" } },
      ]),
    },
  },
}));

jest.mock("@repo/auth/server", () => ({
  requireTenantSession: jest.fn().mockResolvedValue({ tenantId: "t1" }),
}));
jest.mock("next/headers", () => ({ headers: jest.fn().mockResolvedValue({}) }));

test("returns history with piLabel", async () => {
  const history = await getVoteCorrelationHistory("art-1");
  expect(history).toHaveLength(2);
  expect(history[0].piLabel).toBe("PI-1");
});

test("getBiasTrend detects chronic overconfidence", async () => {
  await getVoteCorrelationHistory("art-1"); // populate mock
  const trend = await getBiasTrend("art-1");
  expect(trend.pattern).toBe("OVERCONFIDENT");
  expect(trend.avgBias).toBeGreaterThan(0.2);
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd apps/app && npx jest __tests__/actions/arts/vote-correlation-history.test.ts --no-coverage
```

- [ ] **Step 3: Implement**

```typescript
"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";

export type CorrelationPoint = {
  piPlanId: string;
  piLabel: string;
  avgVoteScore: number;
  predictability: number;
  biasScore: number;
  correlatedAt: Date;
};

export type BiasTrend = {
  pattern: "OVERCONFIDENT" | "UNDERCONFIDENT" | "CALIBRATED";
  avgBias: number;
  worstPI: string | null;
};

export async function getVoteCorrelationHistory(
  artId: string,
  limit = 8
): Promise<CorrelationPoint[]> {
  const ctx = await requireTenantSession(await headers());

  const rows = await database.votePredictabilityCorrelation.findMany({
    where: { tenantId: ctx.tenantId, artId },
    orderBy: { correlatedAt: "asc" },
    take: limit,
    include: { piPlan: { select: { name: true } } },
  });

  return rows.map((r) => ({
    piPlanId: r.piPlanId,
    piLabel: r.piPlan.name,
    avgVoteScore: r.avgVoteScore,
    predictability: r.predictability,
    biasScore: r.biasScore,
    correlatedAt: r.correlatedAt,
  }));
}

export async function getBiasTrend(artId: string): Promise<BiasTrend> {
  const history = await getVoteCorrelationHistory(artId);

  if (history.length === 0) {
    return { pattern: "CALIBRATED", avgBias: 0, worstPI: null };
  }

  const avgBias = history.reduce((a, h) => a + h.biasScore, 0) / history.length;
  const worst = [...history].sort((a, b) => Math.abs(b.biasScore) - Math.abs(a.biasScore))[0];

  let pattern: BiasTrend["pattern"] = "CALIBRATED";
  if (avgBias > 0.15) pattern = "OVERCONFIDENT";
  else if (avgBias < -0.15) pattern = "UNDERCONFIDENT";

  return {
    pattern,
    avgBias: Math.round(avgBias * 1000) / 1000,
    worstPI: worst?.piLabel ?? null,
  };
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd apps/app && npx jest __tests__/actions/arts/vote-correlation-history.test.ts --no-coverage
```

- [ ] **Step 5: Commit**

```bash
git add apps/app/app/actions/arts/vote-correlation-history.ts \
        apps/app/__tests__/actions/arts/vote-correlation-history.test.ts
git commit -m "feat(confidence-vote): vote correlation history + bias trend analysis"
```

---

## Task 4: Correlation chart + bias indicator UI

**Files:**
- Create: `apps/app/app/(authenticated)/arts/[artId]/components/confidence-correlation-chart.tsx`
- Create: `apps/app/app/(authenticated)/arts/[artId]/components/vote-bias-indicator.tsx`

- [ ] **Step 1: Scatter chart — vote score vs predictability**

```tsx
"use client";

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Label,
} from "recharts";
import type { CorrelationPoint } from "@/app/actions/arts/vote-correlation-history";

interface Props {
  data: CorrelationPoint[];
}

export function ConfidenceCorrelationChart({ data }: Props) {
  const chartData = data.map((d) => ({
    vote: Math.round((d.avgVoteScore / 5) * 100),
    predictability: Math.round(d.predictability * 100),
    label: d.piLabel,
  }));

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Eixo X: Confiança média declarada (% do máximo) · Eixo Y: Previsibilidade real da PI
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <ScatterChart margin={{ top: 8, right: 16, bottom: 16, left: -8 }}>
          <XAxis
            type="number"
            dataKey="vote"
            domain={[0, 100]}
            unit="%"
            tick={{ fontSize: 10 }}
          >
            <Label value="Confiança declarada" position="insideBottom" offset={-8} fontSize={10} />
          </XAxis>
          <YAxis type="number" dataKey="predictability" domain={[0, 100]} unit="%" tick={{ fontSize: 10 }}>
            <Label value="Previsibilidade real" angle={-90} position="insideLeft" offset={12} fontSize={10} />
          </YAxis>
          {/* Diagonal: perfect calibration */}
          <ReferenceLine
            segment={[{ x: 0, y: 0 }, { x: 100, y: 100 }]}
            stroke="#94a3b8"
            strokeDasharray="4 2"
            label={{ value: "Calibrado", fontSize: 9, position: "insideTopLeft" }}
          />
          <Tooltip
            content={({ payload }) => {
              if (!payload?.length) return null;
              const d = payload[0]?.payload;
              return (
                <div className="rounded-md border bg-background p-2 text-xs shadow">
                  <p className="font-semibold">{d.label}</p>
                  <p>Confiança: {d.vote}%</p>
                  <p>Previsibilidade: {d.predictability}%</p>
                </div>
              );
            }}
          />
          <Scatter data={chartData} fill="#6366f1" fillOpacity={0.8} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Bias indicator badge**

```tsx
import type { BiasTrend } from "@/app/actions/arts/vote-correlation-history";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TrendingUp, TrendingDown, CheckCircle2 } from "lucide-react";

interface Props {
  trend: BiasTrend;
}

const CONFIG = {
  OVERCONFIDENT: {
    icon: TrendingUp,
    title: "Padrão: Excesso de confiança",
    description: (bias: number, pi: string | null) =>
      `Média de ${Math.round(bias * 100)}% acima da previsibilidade real.${pi ? ` PI com maior viés: ${pi}.` : ""} Equipes tendem a superestimar a capacidade de entrega.`,
    className: "border-rose-300 bg-rose-50 text-rose-800",
    iconClass: "text-rose-500",
  },
  UNDERCONFIDENT: {
    icon: TrendingDown,
    title: "Padrão: Subconfiança crônica",
    description: (bias: number, pi: string | null) =>
      `Média de ${Math.round(Math.abs(bias) * 100)}% abaixo da previsibilidade real.${pi ? ` PI com maior viés: ${pi}.` : ""} Equipes entregam mais do que declaram confiar.`,
    className: "border-amber-300 bg-amber-50 text-amber-800",
    iconClass: "text-amber-500",
  },
  CALIBRATED: {
    icon: CheckCircle2,
    title: "Confiança calibrada",
    description: () => "Declarações de confiança historicamente alinhadas com previsibilidade de entrega.",
    className: "border-emerald-300 bg-emerald-50 text-emerald-800",
    iconClass: "text-emerald-500",
  },
};

export function VoteBiasIndicator({ trend }: Props) {
  const c = CONFIG[trend.pattern];
  const Icon = c.icon;

  return (
    <Alert className={c.className}>
      <Icon className={`h-4 w-4 ${c.iconClass}`} />
      <AlertTitle className="font-semibold">{c.title}</AlertTitle>
      <AlertDescription className="text-xs mt-0.5">
        {c.description(trend.avgBias, trend.worstPI)}
      </AlertDescription>
    </Alert>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/app/app/\(authenticated\)/arts/\[artId\]/components/confidence-correlation-chart.tsx \
        apps/app/app/\(authenticated\)/arts/\[artId\]/components/vote-bias-indicator.tsx
git commit -m "feat(confidence-vote): scatter chart + bias indicator UI"
```

---

## Task 5: Wire correlation into ART dashboard + trigger on PI close

**Files:**
- Modify: ART detail page or PI Planning close action to call `correlatePIOutcome`
- Modify: ART analytics section to show correlation widget

- [ ] **Step 1: Trigger correlation when PI closes**

Find the action that sets PI status to CLOSED (likely in `apps/app/app/actions/arts/` or `pi-planning/`). Add at end:

```typescript
import { correlatePIOutcome } from "./correlate-pi-outcome";

// After PI status updated to CLOSED:
queueMicrotask(() => {
  correlatePIOutcome(piPlanId).catch((err) => {
    console.error("[confidence-vote] correlation failed", { piPlanId, err });
  });
});
```

- [ ] **Step 2: Add widget to ART analytics page (Server Component)**

```tsx
import { getVoteCorrelationHistory, getBiasTrend } from "@/app/actions/arts/vote-correlation-history";
import { ConfidenceCorrelationChart } from "./components/confidence-correlation-chart";
import { VoteBiasIndicator } from "./components/vote-bias-indicator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ...inside async Server Component:
const [history, trend] = await Promise.all([
  getVoteCorrelationHistory(artId),
  getBiasTrend(artId),
]);

// In JSX:
{history.length >= 2 && (
  <Card>
    <CardHeader>
      <CardTitle>Confiança vs Previsibilidade — Histórico</CardTitle>
    </CardHeader>
    <CardContent className="space-y-3">
      <VoteBiasIndicator trend={trend} />
      <ConfidenceCorrelationChart data={history} />
    </CardContent>
  </Card>
)}
```

- [ ] **Step 3: Commit**

```bash
git add apps/app/app/\(authenticated\)/arts/
git commit -m "feat(confidence-vote): wire correlation widget into ART dashboard"
```

---

## Done When

- [ ] `VotePredictabilityCorrelation` migration runs cleanly
- [ ] `correlatePIOutcome` fires async when PI status → CLOSED
- [ ] `biasScore` = `avgVote/5 - predictability` stored correctly
- [ ] Tests pass: `correlate-pi-outcome.test.ts`, `vote-correlation-history.test.ts`
- [ ] Scatter chart renders with diagonal "calibration" reference line
- [ ] Bias indicator shows correct pattern (OVERCONFIDENT / UNDERCONFIDENT / CALIBRATED)
- [ ] Widget hidden when < 2 PIs correlated (not enough data)
