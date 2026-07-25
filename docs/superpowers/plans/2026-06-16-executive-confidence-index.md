# Executive Confidence Index Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Per-Epic red/amber/green delivery-confidence semaphore (and an aggregate Executive Dashboard widget) that translates the existing Monte Carlo throughput engine into a plain "will it ship on time?" verdict.

**Architecture:** A pure forecast module (`release-forecast.ts`) reuses `monteCarloForecast()` to turn historical throughput + remaining scope into P50/P85/P95 calendar dates, then compares against `Epic.dueDate` to produce a RAG verdict. Two server actions source the data from Prisma; two React components render the badge and the dashboard widget. No new DB models — everything computed on read.

**Tech Stack:** TypeScript, Next.js 15 server actions (`safeAction`/`Result` envelope), Prisma (`@repo/database`), Vitest + Testing Library (jsdom), shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-06-16-executive-confidence-index-design.md`

---

## File Structure

**New**
- `apps/app/lib/analytics/release-forecast.ts` — pure: types, `sprintsToDate`, `ragFromDates`, `epicConfidence`. No I/O.
- `apps/app/__tests__/lib/analytics/release-forecast.test.ts` — pure-function unit tests.
- `apps/app/app/actions/analytics/epic-confidence.ts` — `getEpicConfidence`, `getPortfolioConfidence` server actions + shared `computeEpicConfidence`.
- `apps/app/__tests__/actions/analytics/epicConfidence.test.ts` — action tests (mocked Prisma).
- `apps/app/app/(authenticated)/analytics/executive/components/confidence-badge.tsx` — RAG badge + tooltip.
- `apps/app/app/(authenticated)/analytics/executive/components/delivery-confidence-widget.tsx` — aggregate widget.
- `apps/app/__tests__/components/confidence-badge.test.tsx` — render test.

**Modified**
- `apps/app/app/(authenticated)/analytics/executive/page.tsx` — mount `DeliveryConfidenceWidget`.
- `apps/app/app/(authenticated)/epics/[epicId]/page.tsx` — mount `ConfidenceBadge` in header.

> **Report-copy relabel (spec §6):** No existing executive report template surfaces "P85 / Monte Carlo / percentile" copy to users (the only file with that wording is the engine internals). The business-language layer therefore lives entirely in the badge/widget/tooltip we build here. No separate relabel task.

---

## Task 1: Pure module — types + `sprintsToDate`

**Files:**
- Create: `apps/app/lib/analytics/release-forecast.ts`
- Test: `apps/app/__tests__/lib/analytics/release-forecast.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/app/__tests__/lib/analytics/release-forecast.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { sprintsToDate } from "../../../lib/analytics/release-forecast";

describe("sprintsToDate", () => {
  const anchor = new Date("2026-01-01T00:00:00.000Z");

  it("adds whole sprints × cadence days to the anchor", () => {
    // 3 sprints × 14 days = 42 days after Jan 1 → Feb 12
    expect(sprintsToDate(3, 14, anchor).toISOString()).toBe(
      "2026-02-12T00:00:00.000Z"
    );
  });

  it("rounds fractional sprints up (ceil)", () => {
    // 2.1 sprints → 3 sprints × 10 days = 30 days → Jan 31
    expect(sprintsToDate(2.1, 10, anchor).toISOString()).toBe(
      "2026-01-31T00:00:00.000Z"
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/app && pnpm vitest run __tests__/lib/analytics/release-forecast.test.ts`
Expected: FAIL — `sprintsToDate is not a function` / module not found.

- [ ] **Step 3: Write minimal implementation**

Create `apps/app/lib/analytics/release-forecast.ts`:

```ts
// Pillar 3: Executive Confidence Index.
// Pure layer — turns Monte Carlo sprint forecasts into calendar dates + a RAG verdict.
// Reuses monteCarloForecast (Story-022). No I/O here; "today" is injected as `anchor`.
import { monteCarloForecast } from "./monte-carlo";

export type Rag = "GREEN" | "AMBER" | "RED" | "GRAY";

export type EpicConfidence = {
  rag: Rag;
  confidenceLabel: string;
  p50Date: Date | null;
  p85Date: Date | null;
  p95Date: Date | null;
  confidencePct: number | null;
  reason?: string;
};

const MS_PER_DAY = 86_400_000;
// ponytail: hardcoded floor; make per-org config only if a customer asks.
const MIN_SPRINTS_HISTORY = 3;

export function sprintsToDate(
  sprints: number,
  cadenceDays: number,
  anchor: Date
): Date {
  const days = Math.ceil(sprints) * cadenceDays;
  return new Date(anchor.getTime() + days * MS_PER_DAY);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/app && pnpm vitest run __tests__/lib/analytics/release-forecast.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/app/lib/analytics/release-forecast.ts apps/app/__tests__/lib/analytics/release-forecast.test.ts
git commit -m "feat(forecast): add sprintsToDate pure helper"
```

---

## Task 2: Pure module — `ragFromDates` + `epicConfidence`

`epicConfidence` is partly stochastic (Monte Carlo). The RAG boundary decision is extracted into `ragFromDates` so the GREEN/AMBER/RED boundaries are tested deterministically; `epicConfidence` tests cover the guards and the deterministic GREEN/Complete path.

**Files:**
- Modify: `apps/app/lib/analytics/release-forecast.ts`
- Test: `apps/app/__tests__/lib/analytics/release-forecast.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `apps/app/__tests__/lib/analytics/release-forecast.test.ts`:

```ts
import {
  epicConfidence,
  ragFromDates,
} from "../../../lib/analytics/release-forecast";

describe("ragFromDates", () => {
  const d = (iso: string) => new Date(iso);
  const p50 = d("2026-03-01");
  const p85 = d("2026-04-01");

  it("GREEN when p85 date is on or before the due date", () => {
    expect(ragFromDates(p50, p85, d("2026-04-01"))).toBe("GREEN");
    expect(ragFromDates(p50, p85, d("2026-05-01"))).toBe("GREEN");
  });

  it("AMBER when due date is between p50 and p85", () => {
    expect(ragFromDates(p50, p85, d("2026-03-15"))).toBe("AMBER");
  });

  it("RED when due date is before p50", () => {
    expect(ragFromDates(p50, p85, d("2026-02-01"))).toBe("RED");
  });
});

describe("epicConfidence guards", () => {
  const base = {
    historicalThroughput: [10, 10, 10],
    remainingItems: 30,
    dueDate: new Date("2027-01-01"),
    cadenceDays: 14,
    anchor: new Date("2026-01-01T00:00:00.000Z"),
  };

  it("returns GREEN/Complete when nothing remains", () => {
    const r = epicConfidence({ ...base, remainingItems: 0 });
    expect(r.rag).toBe("GREEN");
    expect(r.confidenceLabel).toBe("Complete");
  });

  it("returns GRAY when history has fewer than 3 sprints", () => {
    const r = epicConfidence({ ...base, historicalThroughput: [10, 10] });
    expect(r.rag).toBe("GRAY");
    expect(r.reason).toMatch(/history/i);
  });

  it("returns GRAY when there is no recent delivery", () => {
    const r = epicConfidence({ ...base, historicalThroughput: [0, 0, 0] });
    expect(r.rag).toBe("GRAY");
  });

  it("returns GRAY when there is no due date", () => {
    const r = epicConfidence({ ...base, dueDate: null });
    expect(r.rag).toBe("GRAY");
  });

  it("returns GREEN for a comfortably early due date (deterministic throughput)", () => {
    // constant throughput 10, remaining 30 → exactly 3 sprints every iteration
    // 3 sprints × 14d = 42d after anchor → well before 2027 due date
    const r = epicConfidence(base);
    expect(r.rag).toBe("GREEN");
    expect(r.confidencePct).toBe(85);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/app && pnpm vitest run __tests__/lib/analytics/release-forecast.test.ts`
Expected: FAIL — `ragFromDates` / `epicConfidence` not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `apps/app/lib/analytics/release-forecast.ts`:

```ts
export function ragFromDates(p50Date: Date, p85Date: Date, dueDate: Date): Rag {
  if (p85Date.getTime() <= dueDate.getTime()) {
    return "GREEN";
  }
  if (p50Date.getTime() <= dueDate.getTime()) {
    return "AMBER";
  }
  return "RED";
}

function fmt(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function epicConfidence(input: {
  historicalThroughput: number[];
  remainingItems: number;
  dueDate: Date | null;
  cadenceDays: number;
  anchor: Date;
}): EpicConfidence {
  const { historicalThroughput, remainingItems, dueDate, cadenceDays, anchor } =
    input;

  const gray = (reason: string): EpicConfidence => ({
    rag: "GRAY",
    confidenceLabel: "Not enough data",
    p50Date: null,
    p85Date: null,
    p95Date: null,
    confidencePct: null,
    reason,
  });

  if (remainingItems <= 0) {
    return {
      rag: "GREEN",
      confidenceLabel: "Complete",
      p50Date: anchor,
      p85Date: anchor,
      p95Date: anchor,
      confidencePct: 100,
    };
  }
  if (historicalThroughput.length < MIN_SPRINTS_HISTORY) {
    return gray("need at least 3 sprints of delivery history");
  }
  if (historicalThroughput.reduce((s, v) => s + v, 0) === 0) {
    return gray("no recent delivery");
  }
  if (!dueDate) {
    return gray("no target date set");
  }

  const f = monteCarloForecast(historicalThroughput, remainingItems);
  const p50Date = sprintsToDate(f.p50, cadenceDays, anchor);
  const p85Date = sprintsToDate(f.p85, cadenceDays, anchor);
  const p95Date = sprintsToDate(f.p95, cadenceDays, anchor);

  const rag = ragFromDates(p50Date, p85Date, dueDate);
  const dates = { p50Date, p85Date, p95Date };

  if (rag === "GREEN") {
    return {
      ...dates,
      rag,
      confidenceLabel: `On track — delivery ~${fmt(p85Date)}`,
      confidencePct: 85,
    };
  }
  if (rag === "AMBER") {
    return {
      ...dates,
      rag,
      confidenceLabel: `At risk — likely ~${fmt(p50Date)}`,
      confidencePct: 50,
    };
  }
  return {
    ...dates,
    rag,
    confidenceLabel: `Likely to slip past ${fmt(dueDate)}`,
    confidencePct: null,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/app && pnpm vitest run __tests__/lib/analytics/release-forecast.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add apps/app/lib/analytics/release-forecast.ts apps/app/__tests__/lib/analytics/release-forecast.test.ts
git commit -m "feat(forecast): add ragFromDates + epicConfidence verdict"
```

---

## Task 3: Server action — `getEpicConfidence`

**Files:**
- Create: `apps/app/app/actions/analytics/epic-confidence.ts`
- Test: `apps/app/__tests__/actions/analytics/epicConfidence.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/app/__tests__/actions/analytics/epicConfidence.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { tenantCtx } from "../../helpers/action-mocks";

const db = {
  epic: { findFirst: vi.fn(), findMany: vi.fn() },
  feature: { findMany: vi.fn() },
  flowMetricSnapshot: { findMany: vi.fn() },
  sprint: { findMany: vi.fn() },
};

vi.mock("@repo/database", () => ({ database: db }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: vi.fn().mockResolvedValue(tenantCtx),
}));
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

import { getEpicConfidence } from "../../../app/actions/analytics/epic-confidence";

describe("getEpicConfidence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a GREEN verdict for an on-track epic", async () => {
    db.epic.findFirst.mockResolvedValue({
      id: "epic1",
      dueDate: new Date("2027-01-01"),
    });
    db.feature.findMany.mockResolvedValue([
      { assignedTeamId: "team1" },
      { assignedTeamId: "team1" },
    ]);
    db.flowMetricSnapshot.findMany.mockResolvedValue([
      { periodRef: "s1", flowVelocityTotal: 10, recordedAt: new Date() },
      { periodRef: "s2", flowVelocityTotal: 10, recordedAt: new Date() },
      { periodRef: "s3", flowVelocityTotal: 10, recordedAt: new Date() },
    ]);
    db.sprint.findMany.mockResolvedValue([
      {
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-01-15"),
      },
    ]);

    const res = await getEpicConfidence({ id: "epic1" });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.rag).toBe("GREEN");
    }
  });

  it("returns an error result when the epic is missing", async () => {
    db.epic.findFirst.mockResolvedValue(null);
    const res = await getEpicConfidence({ id: "epic1" });
    expect(res.ok).toBe(false);
  });
});
```

> Note: the input field is `id` (a cuid). The test uses `"epic1"`; if the `cuid` Zod check rejects it at runtime, relax the test input to a valid cuid like `"clz0000000000000000000000"`. Keep the schema as `cuid` in code.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/app && pnpm vitest run __tests__/actions/analytics/epicConfidence.test.ts`
Expected: FAIL — module `epic-confidence` not found.

- [ ] **Step 3: Write minimal implementation**

Create `apps/app/app/actions/analytics/epic-confidence.ts`:

```ts
"use server";

// Pillar 3: Executive Confidence Index — server actions.
// Sources remaining scope, historical throughput, and sprint cadence per Epic,
// then delegates the verdict to the pure release-forecast module.
import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { z } from "zod";
import {
  type EpicConfidence,
  epicConfidence,
  type Rag,
} from "@/lib/analytics/release-forecast";
import { cuid, type Result, safeAction } from "../_base";

const HISTORY_SPRINTS = 6;
const DEFAULT_CADENCE_DAYS = 14;
const MS_PER_DAY = 86_400_000;

async function computeCadenceDays(teamIds: string[]): Promise<number> {
  if (teamIds.length === 0) {
    return DEFAULT_CADENCE_DAYS;
  }
  const sprints = await database.sprint.findMany({
    where: { teamId: { in: teamIds } },
    select: { startDate: true, endDate: true },
    orderBy: { startDate: "desc" },
    take: 6,
  });
  if (sprints.length === 0) {
    return DEFAULT_CADENCE_DAYS;
  }
  const lengths = sprints.map(
    (s) => (s.endDate.getTime() - s.startDate.getTime()) / MS_PER_DAY
  );
  const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  return Math.max(1, Math.round(avg));
}

export async function computeEpicConfidence(
  tenantId: string,
  epicId: string
): Promise<EpicConfidence> {
  const epic = await database.epic.findFirst({
    where: { id: epicId, tenantId },
    select: { id: true, dueDate: true },
  });
  if (!epic) {
    throw new Error("EPIC_NOT_FOUND");
  }

  const features = await database.feature.findMany({
    where: { epicId, statusId: { not: "DONE" } },
    select: { assignedTeamId: true },
  });
  const remainingItems = features.length;
  const teamIds = [
    ...new Set(
      features.map((f) => f.assignedTeamId).filter((t): t is string => Boolean(t))
    ),
  ];

  const snapshots = teamIds.length
    ? await database.flowMetricSnapshot.findMany({
        where: {
          tenantId,
          scope: "team",
          scopeId: { in: teamIds },
          period: "sprint",
        },
        select: { periodRef: true, flowVelocityTotal: true, recordedAt: true },
        orderBy: { recordedAt: "desc" },
        take: HISTORY_SPRINTS * Math.max(teamIds.length, 1),
      })
    : [];

  // Sum velocity per sprint (periodRef); snapshots are newest-first, so the
  // Map preserves newest-first insertion order.
  const bySprint = new Map<string, number>();
  for (const s of snapshots) {
    bySprint.set(s.periodRef, (bySprint.get(s.periodRef) ?? 0) + s.flowVelocityTotal);
  }
  const historicalThroughput = [...bySprint.values()].slice(0, HISTORY_SPRINTS);

  const cadenceDays = await computeCadenceDays(teamIds);

  return epicConfidence({
    historicalThroughput,
    remainingItems,
    dueDate: epic.dueDate,
    cadenceDays,
    anchor: new Date(),
  });
}

const EpicConfidenceSchema = z.object({ id: cuid });

export async function getEpicConfidence(
  raw?: unknown
): Promise<Result<EpicConfidence>> {
  return safeAction(async () => {
    const { tenantId } = await requireTenantSession(await headers());
    const { id } = EpicConfidenceSchema.parse(raw);
    return computeEpicConfidence(tenantId, id);
  });
}

export type { Rag };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/app && pnpm vitest run __tests__/actions/analytics/epicConfidence.test.ts`
Expected: PASS (2 tests). If the `cuid` parse rejects `"epic1"`, update the test inputs to a valid cuid as noted in Step 1.

- [ ] **Step 5: Commit**

```bash
git add apps/app/app/actions/analytics/epic-confidence.ts apps/app/__tests__/actions/analytics/epicConfidence.test.ts
git commit -m "feat(forecast): add getEpicConfidence server action"
```

---

## Task 4: Server action — `getPortfolioConfidence`

**Files:**
- Modify: `apps/app/app/actions/analytics/epic-confidence.ts`
- Test: `apps/app/__tests__/actions/analytics/epicConfidence.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `apps/app/__tests__/actions/analytics/epicConfidence.test.ts`:

```ts
import { getPortfolioConfidence } from "../../../app/actions/analytics/epic-confidence";

describe("getPortfolioConfidence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("aggregates RAG counts and lists at-risk epics", async () => {
    db.epic.findMany.mockResolvedValue([
      { id: "e1", title: "Green Epic", dueDate: new Date("2027-01-01") },
      { id: "e2", title: "Red Epic", dueDate: new Date("2020-01-01") },
    ]);
    // computeEpicConfidence re-queries per epic:
    db.epic.findFirst
      .mockResolvedValueOnce({ id: "e1", dueDate: new Date("2027-01-01") })
      .mockResolvedValueOnce({ id: "e2", dueDate: new Date("2020-01-01") });
    db.feature.findMany.mockResolvedValue([
      { assignedTeamId: "team1" },
      { assignedTeamId: "team1" },
    ]);
    db.flowMetricSnapshot.findMany.mockResolvedValue([
      { periodRef: "s1", flowVelocityTotal: 10, recordedAt: new Date() },
      { periodRef: "s2", flowVelocityTotal: 10, recordedAt: new Date() },
      { periodRef: "s3", flowVelocityTotal: 10, recordedAt: new Date() },
    ]);
    db.sprint.findMany.mockResolvedValue([
      { startDate: new Date("2026-01-01"), endDate: new Date("2026-01-15") },
    ]);

    const res = await getPortfolioConfidence();
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.green).toBe(1);
      expect(res.data.red).toBe(1);
      expect(res.data.atRisk).toHaveLength(1);
      expect(res.data.atRisk[0].title).toBe("Red Epic");
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/app && pnpm vitest run __tests__/actions/analytics/epicConfidence.test.ts`
Expected: FAIL — `getPortfolioConfidence` not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `apps/app/app/actions/analytics/epic-confidence.ts`:

```ts
export type PortfolioConfidence = {
  green: number;
  amber: number;
  red: number;
  gray: number;
  atRisk: {
    epicId: string;
    title: string;
    rag: Rag;
    p85Date: Date | null;
    dueDate: Date | null;
  }[];
};

export async function getPortfolioConfidence(): Promise<
  Result<PortfolioConfidence>
> {
  return safeAction(async () => {
    const { tenantId } = await requireTenantSession(await headers());

    const epics = await database.epic.findMany({
      where: { tenantId, epicType: "EPIC", lifecycleStatus: "IMPLEMENTING" },
      select: { id: true, title: true, dueDate: true },
    });

    const counts = { green: 0, amber: 0, red: 0, gray: 0 };
    const atRisk: PortfolioConfidence["atRisk"] = [];

    // ponytail: per-epic queries (N+1). IMPLEMENTING epics are few (tens at most);
    // batch the feature/throughput queries only if that cardinality grows large.
    for (const e of epics) {
      const c = await computeEpicConfidence(tenantId, e.id);
      if (c.rag === "GREEN") {
        counts.green += 1;
      } else if (c.rag === "AMBER") {
        counts.amber += 1;
      } else if (c.rag === "RED") {
        counts.red += 1;
      } else {
        counts.gray += 1;
      }
      if (c.rag === "AMBER" || c.rag === "RED") {
        atRisk.push({
          epicId: e.id,
          title: e.title,
          rag: c.rag,
          p85Date: c.p85Date,
          dueDate: e.dueDate,
        });
      }
    }

    // RED before AMBER
    atRisk.sort((a, b) => (a.rag === "RED" ? 0 : 1) - (b.rag === "RED" ? 0 : 1));

    return { ...counts, atRisk };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/app && pnpm vitest run __tests__/actions/analytics/epicConfidence.test.ts`
Expected: PASS (3 tests total).

- [ ] **Step 5: Commit**

```bash
git add apps/app/app/actions/analytics/epic-confidence.ts apps/app/__tests__/actions/analytics/epicConfidence.test.ts
git commit -m "feat(forecast): add getPortfolioConfidence aggregate action"
```

---

## Task 5: `ConfidenceBadge` component

**Files:**
- Create: `apps/app/app/(authenticated)/analytics/executive/components/confidence-badge.tsx`
- Test: `apps/app/__tests__/components/confidence-badge.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/app/__tests__/components/confidence-badge.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConfidenceBadge } from "../../app/(authenticated)/analytics/executive/components/confidence-badge";

describe("ConfidenceBadge", () => {
  it("renders the business label and a RAG dot for the verdict", () => {
    render(
      <ConfidenceBadge
        confidence={{
          rag: "RED",
          confidenceLabel: "Likely to slip past Jan 1, 2027",
          p50Date: new Date("2027-02-01"),
          p85Date: new Date("2027-03-01"),
          p95Date: new Date("2027-04-01"),
          confidencePct: null,
        }}
      />
    );
    expect(
      screen.getByText(/Likely to slip past Jan 1, 2027/)
    ).toBeInTheDocument();
    expect(screen.getByTestId("confidence-dot")).toHaveAttribute(
      "data-rag",
      "RED"
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/app && pnpm vitest run __tests__/components/confidence-badge.test.tsx`
Expected: FAIL — module `confidence-badge` not found.

- [ ] **Step 3: Write minimal implementation**

Create `apps/app/app/(authenticated)/analytics/executive/components/confidence-badge.tsx`:

```tsx
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import type { EpicConfidence } from "@/lib/analytics/release-forecast";

const DOT_COLOR: Record<EpicConfidence["rag"], string> = {
  GREEN: "bg-emerald-500",
  AMBER: "bg-amber-500",
  RED: "bg-rose-500",
  GRAY: "bg-slate-400",
};

function fmt(d: Date | null): string {
  return d
    ? d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";
}

interface ConfidenceBadgeProps {
  confidence: EpicConfidence;
}

export function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  const { rag, confidenceLabel, p50Date, p85Date, reason } = confidence;

  // Business-language primary copy; statistics stay in the tooltip footnote.
  const tooltip =
    rag === "GRAY"
      ? (reason ?? "Not enough data to forecast")
      : `85% confident this ships by ${fmt(p85Date)}. Coin-flip date: ${fmt(p50Date)}.`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-2 text-sm">
          <span
            data-testid="confidence-dot"
            data-rag={rag}
            className={`inline-block h-2.5 w-2.5 rounded-full ${DOT_COLOR[rag]}`}
          />
          <span className="text-muted-foreground">{confidenceLabel}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
```

> If `@repo/design-system` exposes tooltip under a different path, match the import used by an existing component in `analytics/executive/components/` (e.g. check `anomaly-card.tsx`). The `data-testid`/`data-rag` dot and label text must remain for the test.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/app && pnpm vitest run __tests__/components/confidence-badge.test.tsx`
Expected: PASS. (If the test runner needs the tooltip wrapped in a provider, render with the app's `TooltipProvider` from `@repo/design-system`.)

- [ ] **Step 5: Commit**

```bash
git add "apps/app/app/(authenticated)/analytics/executive/components/confidence-badge.tsx" apps/app/__tests__/components/confidence-badge.test.tsx
git commit -m "feat(forecast): add ConfidenceBadge component"
```

---

## Task 6: `DeliveryConfidenceWidget` component

**Files:**
- Create: `apps/app/app/(authenticated)/analytics/executive/components/delivery-confidence-widget.tsx`

No new automated test (presentational aggregation; logic is covered by the action tests). Verified via typecheck + manual render in Task 7.

- [ ] **Step 1: Write the implementation**

Create `apps/app/app/(authenticated)/analytics/executive/components/delivery-confidence-widget.tsx`:

```tsx
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import type { PortfolioConfidence } from "@/app/actions/analytics/epic-confidence";

function fmt(d: Date | null): string {
  return d
    ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "—";
}

const RISK_DOT: Record<"AMBER" | "RED", string> = {
  AMBER: "bg-amber-500",
  RED: "bg-rose-500",
};

interface DeliveryConfidenceWidgetProps {
  data: PortfolioConfidence;
}

export function DeliveryConfidenceWidget({
  data,
}: DeliveryConfidenceWidgetProps) {
  const { green, amber, red, gray, atRisk } = data;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Delivery Confidence</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex gap-6 text-sm">
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            On track {green}
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            At risk {amber}
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
            Slipping {red}
          </span>
          <span className="flex items-center gap-2 text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
            No data {gray}
          </span>
        </div>

        {atRisk.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {atRisk.map((e) => (
              <li
                key={e.epicId}
                className="flex items-center justify-between text-sm"
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${RISK_DOT[e.rag === "RED" ? "RED" : "AMBER"]}`}
                  />
                  {e.title}
                </span>
                <span className="text-muted-foreground">
                  due {fmt(e.dueDate)} · forecast {fmt(e.p85Date)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">
            No epics currently at risk.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/app && pnpm typecheck`
Expected: no new type errors from this file.

- [ ] **Step 3: Commit**

```bash
git add "apps/app/app/(authenticated)/analytics/executive/components/delivery-confidence-widget.tsx"
git commit -m "feat(forecast): add DeliveryConfidenceWidget component"
```

---

## Task 7: Mount widget on Executive Dashboard + badge on Epic detail

**Files:**
- Modify: `apps/app/app/(authenticated)/analytics/executive/page.tsx`
- Modify: `apps/app/app/(authenticated)/epics/[epicId]/page.tsx`

- [ ] **Step 1: Mount the widget on the Executive Dashboard**

In `apps/app/app/(authenticated)/analytics/executive/page.tsx`:

1. Add imports near the existing component imports:

```tsx
import { getPortfolioConfidence } from "@/app/actions/analytics/epic-confidence";
import { DeliveryConfidenceWidget } from "./components/delivery-confidence-widget";
```

2. Add the call into the existing `Promise.all` (alongside `getExecutiveDashboard()` / `getExecutiveTrends()`):

```tsx
const [dashResult, trendsResult, confidenceResult] = await Promise.all([
  getExecutiveDashboard(),
  getExecutiveTrends(),
  getPortfolioConfidence(),
]);
```

3. Render the widget inside the dashboard layout (after the KPI tiles, before/after the ART table — match surrounding spacing). Only render when the result is ok:

```tsx
{confidenceResult.ok ? (
  <DeliveryConfidenceWidget data={confidenceResult.data} />
) : null}
```

- [ ] **Step 2: Mount the badge on the Epic detail page**

In `apps/app/app/(authenticated)/epics/[epicId]/page.tsx`:

1. Add imports:

```tsx
import { getEpicConfidence } from "@/app/actions/analytics/epic-confidence";
import { ConfidenceBadge } from "@/app/(authenticated)/analytics/executive/components/confidence-badge";
```

2. In the page's async body, fetch the confidence for the current epic id (use the same `epicId` param the page already resolves):

```tsx
const confidenceResult = await getEpicConfidence({ id: epicId });
```

3. Render the badge near the epic title/header (inside the existing `CardHeader`/title area). Only render when ok:

```tsx
{confidenceResult.ok ? (
  <ConfidenceBadge confidence={confidenceResult.data} />
) : null}
```

> Match the page's existing param name. If the route param is destructured as `params.epicId` or via `await params`, reuse that exact variable rather than re-reading it.

- [ ] **Step 3: Typecheck + run the full analytics test suite**

Run: `cd apps/app && pnpm typecheck && pnpm vitest run __tests__/lib/analytics/release-forecast.test.ts __tests__/actions/analytics/epicConfidence.test.ts __tests__/components/confidence-badge.test.tsx`
Expected: typecheck clean; all tests PASS.

- [ ] **Step 4: Manual verification**

Run: `pnpm dev` (app on :3012). Open `/analytics/executive` → the **Delivery Confidence** widget shows RAG counts and any at-risk epics. Open an epic detail page → the **ConfidenceBadge** shows next to the title with a tooltip in plain language.
Expected: no console errors; widget and badge render with sensible values (GRAY where history < 3 sprints).

- [ ] **Step 5: Commit**

```bash
git add "apps/app/app/(authenticated)/analytics/executive/page.tsx" "apps/app/app/(authenticated)/epics/[epicId]/page.tsx"
git commit -m "feat(forecast): surface confidence widget + epic badge"
```

---

## Final Verification

- [ ] Run the full app test suite for regressions: `cd apps/app && pnpm vitest run`
- [ ] Run lint/format: `pnpm check` (or `pnpm fix` to autofix)
- [ ] Confirm no new DB migration was introduced (this feature is read-only): `git status` shows no `packages/database/prisma/schema` changes.

---

## Spec Coverage Check

- §3.1 pure module (`sprintsToDate`, `epicConfidence`, GRAY guards) → Tasks 1–2 ✅
- §3.2 server actions (`getEpicConfidence`, `getPortfolioConfidence`, data sourcing) → Tasks 3–4 ✅
- §3.3 UI (`ConfidenceBadge`, `DeliveryConfidenceWidget`, mounts) → Tasks 5–7 ✅
- §4 data flow (features count, throughput sum, cadence, MC → dates → RAG) → Task 3 ✅
- §5 RAG semantics (P85/P50 boundaries) → Task 2 (`ragFromDates`) ✅
- §6 business-language layer (badge labels + tooltip; report relabel N/A — no surface) → Tasks 2, 5 ✅
- §7 error handling (GRAY never throws; action envelope) → Tasks 2–4 ✅
- §8 testing (pure boundaries, guards, action shape) → Tasks 1–5 ✅
- §10 YAGNI cuts (no models, no cache, hardcoded thresholds, item-count, epic-only) → honored throughout ✅
