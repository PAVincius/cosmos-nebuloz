# Executive Confidence Index — Design Spec

**Date:** 2026-06-16
**Pillar:** 3 of 3 (Executive Translation) — see `2026-06-16-enterprise-positioning-roadmap.md`
**Branch context:** `feat/kanban-portfolio-ai`

---

## 1. Overview

Translate the existing Monte Carlo throughput engine into a C-level answer to one question: *"Will my product ship on time?"* The math runs backstage; the user sees a red/amber/green semaphore (the **Executive Confidence Index**) per Epic, plus an aggregate widget on the Executive Dashboard.

**Core principle:** no new database models. Everything is computed on read, reusing `monteCarloForecast()` (`apps/app/lib/analytics/monte-carlo.ts`).

## 2. Goals / Non-Goals

**Goals**
- Per-Epic RAG confidence verdict comparing a probabilistic completion date against `Epic.dueDate`.
- An aggregate Delivery Confidence widget on the existing Executive Dashboard.
- Business-language phrasing; statistics accessible but secondary (tooltip/detail).

**Non-Goals (deferred)**
- PI / portfolio / release rollup (Epic only for v1).
- Story-point–weighted forecasting (item-count based, matching the existing engine).
- Per-org configurable RAG thresholds (hardcoded defaults with a `ponytail:` comment).
- Caching / persistence of forecasts (compute per request).

## 3. Architecture

Three units, each independently testable.

### 3.1 Pure module — `apps/app/lib/analytics/release-forecast.ts`

No I/O. Pure functions over primitives. Reuses `monteCarloForecast`.

```ts
export type Rag = "GREEN" | "AMBER" | "RED" | "GRAY";

export type EpicConfidence = {
  rag: Rag;
  confidenceLabel: string;        // business-language label
  p50Date: Date | null;
  p85Date: Date | null;
  p95Date: Date | null;
  confidencePct: number | null;   // 85 when on-time at P85, etc. (for tooltip)
  reason?: string;                 // populated for GRAY (why no verdict)
};

// sprints (float allowed via ceil) + cadence in days + anchor → calendar date
export function sprintsToDate(
  sprints: number,
  cadenceDays: number,
  anchor: Date
): Date;

export function epicConfidence(input: {
  historicalThroughput: number[]; // items completed per past sprint
  remainingItems: number;
  dueDate: Date | null;
  cadenceDays: number;
  anchor: Date;                    // "today" — injected, never Date.now() in pure layer
}): EpicConfidence;
```

**Insufficient-data guard (returns GRAY, never throws):**
- `historicalThroughput.length < 3` → GRAY, reason `"need ≥3 sprints of history"`
- every throughput value is 0 (sum === 0) → GRAY, reason `"no recent delivery"`
- `dueDate == null` → GRAY, reason `"no target date"`
- `remainingItems <= 0` → GREEN with label `"Complete"` (nothing left to forecast)

`monteCarloForecast` throws on empty throughput — `epicConfidence` guards before calling it.

### 3.2 Server action — `apps/app/app/actions/analytics/epic-confidence.ts`

Tenant-scoped (`requireTenantSession`). Returns the standard `{ ok, data | error }` envelope used by sibling analytics actions.

```ts
getEpicConfidence(epicId: string): Promise<Result<EpicConfidence>>
getPortfolioConfidence(): Promise<Result<{
  green: number; amber: number; red: number; gray: number;
  atRisk: { epicId: string; title: string; rag: Rag; p85Date: Date | null; dueDate: Date | null }[];
}>>
```

**Data sourcing (real fields):**

| Input | Source |
|---|---|
| `remainingItems` | `count(Feature where epicId = epic.id AND statusId != "DONE")` (`art-core.prisma`: `Feature.epicId`, `Feature.statusId`) |
| `historicalThroughput[]` | `FlowMetricSnapshot.flowVelocityTotal` where `scope="team"` and `scopeId ∈ teams of the epic's features` (`Feature.assignedTeamId`), `period="sprint"`, ordered by `recordedAt`, last N (default 6). Per-sprint values summed across the epic's teams. |
| `dueDate` | `Epic.dueDate` |
| `cadenceDays` | average `(Sprint.endDate − Sprint.startDate)` in days over recent `Sprint` rows of those teams (`team-delivery.prisma`); fallback 14 if none |
| `anchor` | request time (`new Date()` lives in the action, not the pure layer) |

`getPortfolioConfidence` runs `getEpicConfidence` logic over Epics with `epicType="EPIC"` and `lifecycleStatus="IMPLEMENTING"` (in-flight portfolio epics), batching the Feature/throughput queries to avoid N+1.

### 3.3 UI

| Component | File | Role |
|---|---|---|
| `ConfidenceBadge` | `apps/app/app/(authenticated)/analytics/executive/components/confidence-badge.tsx` | RAG dot + business label + tooltip with plain-language math |
| `DeliveryConfidenceWidget` | `apps/app/app/(authenticated)/analytics/executive/components/delivery-confidence-widget.tsx` | Aggregate counts (🟢/🟡/🔴/⚪) + top at-risk epics list; rendered on the existing Executive Dashboard page |
| Epic badge | inline use of `ConfidenceBadge` in the epic detail page header | per-Epic verdict in workflow |

The widget is added to `apps/app/app/(authenticated)/analytics/executive/page.tsx` alongside the existing `KpiTiles` / `ArtHealthTable`, fed by a new `getPortfolioConfidence()` call in the page's `Promise.all`.

## 4. Data Flow

```
Epic ─┬─ incomplete Features (count)            → remainingItems
      ├─ Features.assignedTeamId → teams
      │     └─ FlowMetricSnapshot per sprint     → historicalThroughput[]
      │     └─ Sprint start/end                  → cadenceDays
      └─ Epic.dueDate                            → dueDate
                          │
            monteCarloForecast(throughput, remaining) → {p50,p85,p95} sprints
                          │ + sprintsToDate(·, cadence, today)
                          ▼
                 {p50Date, p85Date, p95Date}
                          │ compare p50Date / p85Date vs dueDate
                          ▼
                   RAG + business label
```

## 5. RAG Semantics (hardcoded defaults)

P85 is the commitment standard; P50 the coin-flip line.

| RAG | Rule | Business label |
|---|---|---|
| 🟢 GREEN | `p85Date ≤ dueDate` | "On track — delivery ~{p85Date}" |
| 🟡 AMBER | `p50Date ≤ dueDate < p85Date` | "At risk — likely ~{p50Date}" |
| 🔴 RED | `dueDate < p50Date` | "Likely to slip past {dueDate}" |
| ⚪ GRAY | insufficient data (§3.1) | reason string |

## 6. Business-Language Layer (jargon → impact)

| Backstage (math) | Front-stage (executive) |
|---|---|
| "P85 = 6 sprints" | "85% confident: done by {date}" |
| "Monte Carlo, 1000 iterations" | (hidden; available in tooltip footnote only) |
| "Throughput percentile" | "Delivery confidence" |
| Report column "Monte Carlo P85" | "Delivery confidence (85%)" |

Tooltip body (plain): `"85% confident this ships by {p85Date}. Coin-flip date: {p50Date}."` No "percentile", "iteration", or "stochastic" in primary UI copy.

## 7. Error Handling

- Pure layer never throws for data conditions → returns GRAY with `reason`.
- Action wraps DB access in try/catch, returns `{ ok: false, error }`; UI renders GRAY/empty state, never a crash.
- Missing teams / no sprints → cadence fallback (14d) and/or GRAY as applicable.

## 8. Testing (vitest)

Unit (pure layer — the money path):
- `sprintsToDate`: whole + fractional sprints, cadence math, anchor offset.
- `epicConfidence` RAG boundaries: due exactly on p85Date (GREEN), between p50/p85 (AMBER), before p50 (RED).
- Insufficient-data branches: <3 sprints, all-zero throughput, null dueDate, zero remaining (→ GREEN/Complete).

Action (integration, mocked Prisma): correct field selection, N+1-free batch in `getPortfolioConfidence`, envelope shape.

Target ≥80% on new files.

## 9. File List

**New**
- `apps/app/lib/analytics/release-forecast.ts`
- `apps/app/lib/analytics/__tests__/release-forecast.test.ts`
- `apps/app/app/actions/analytics/epic-confidence.ts`
- `apps/app/app/(authenticated)/analytics/executive/components/confidence-badge.tsx`
- `apps/app/app/(authenticated)/analytics/executive/components/delivery-confidence-widget.tsx`

**Modified**
- `apps/app/app/(authenticated)/analytics/executive/page.tsx` — mount widget
- Epic detail page header — mount `ConfidenceBadge`
- Existing executive report template — relabel column copy (§6)

## 10. YAGNI Cuts (explicit)

- No new Prisma models / migrations.
- No forecast caching (add only if profiling shows the per-request Monte Carlo is slow).
- No per-org RAG threshold config (`ponytail:` comment marks the hardcoded ceiling + upgrade path).
- No story-point weighting; item-count only.
- No PI/portfolio/release rollup beyond the Epic-aggregate widget.
