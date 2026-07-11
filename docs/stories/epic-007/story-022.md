# Story 022 — Flow Metrics Dashboard & Monte Carlo Forecasting

**Epic:** 007 — Solution Train & Advanced Features
**Feature:** F-007-002 Analytics & Reporting
**WSJF:** 11.0 (userValue=8, timeValue=7, riskReduction=6, jobSize=2)
**Story Points:** 8
**Priority:** Must Have
**Status:** DEFINED

---

## User Story

**As an** RTE,
**I want** a 6D flow metrics dashboard with cycle/lead time drill-down, team/ART/portfolio aggregation, and Monte Carlo throughput forecasting,
**so that** I can understand delivery flow health and forecast PI completion dates based on historical data.

---

## Acceptance Criteria

### AC-001: Metrics cards render within 2s
Given an RTE opens the Flow Metrics view for the current PI,
When the page loads,
Then:
- 5 metric cards render within 2s with non-null values (velocity, cycle time, throughput, WIP, flow efficiency)
- Prior-PI benchmark data is shown as a reference line on trend charts
- If no prior PI data exists, benchmark lines are omitted without error

### AC-002: ART-level weighted aggregation
Given an ART with 2 teams of different sizes (Team A: 5 members, Team B: 8 members),
When portfolio aggregate cycle time is computed,
Then:
- Cycle time is a weighted average: `(teamA_cycleTime × 5 + teamB_cycleTime × 8) / 13`
- NOT a simple mean of the two team cycle times
- Team weights based on `TeamCapacitySnapshot.memberCount`

### AC-003: Cycle time drill-down with outlier detection
Given a team with 30 completed stories in the current PI,
When the Cycle Time chart is opened in drill-down mode,
Then:
- A scatter plot shows each story's cycle time (days from TODO to DONE)
- Outliers are highlighted (computed as > median + 2×IQR)
- Clicking an outlier opens the story detail
- A box plot overlay shows Q1/median/Q3/whiskers

### AC-004: Monte Carlo throughput forecast
Given a team has completed 8 sprints with throughput [12, 14, 11, 13, 15, 12, 14, 11] stories/sprint,
When a forecast for 50 remaining stories is requested,
Then:
- 1,000 Monte Carlo iterations are run
- 50th/70th/85th/95th percentile completion dates are displayed
- Result is cached for 1h in Upstash Redis
- If cache hit, result returns within 500ms; if cache miss, within 10s

### AC-005: WIP cap indicator
Given an ART's configured WIP limit for Feature-level is 20,
When current WIP is 22 (110%),
Then:
- The WIP card shows 22/20 with a red background
- A "WIP exceeded" banner appears on the flow dashboard
- No blocking action — information only

### AC-006: Stale data banner
Given the last `FlowMetricSnapshot` was computed > 2h ago,
When the dashboard loads,
Then:
- A banner appears: "Metrics last updated {time ago}. Refresh to get latest data."
- A "Refresh Now" button triggers a background snapshot recompute
- The page does not fail — stale data still renders

### AC-007: Portfolio-level benchmark comparison
Given an RTE compares PI-3 and PI-4 for all 4 teams,
When the benchmark comparison view loads,
Then:
- A table shows each team's avg cycle time for PI-3 and PI-4
- Teams with > 20% increase in cycle time are highlighted red
- Teams with > 10% improvement are highlighted green

### AC-008: Flow distribution chart
Given stories classified by type (Feature, Bug, Tech Debt, Enabler),
When the Flow Distribution chart renders,
Then:
- A stacked bar chart shows percentage of each type per sprint
- Drill-down to individual stories per type is available
- Type percentages are based on `Story.type` or `Defect` count

---

## Technical Notes

### FlowMetricSnapshot Schema

```prisma
model FlowMetricSnapshot {
  id                String   @id @default(cuid())
  orgId             String
  artId             String?
  teamId            String?
  piPlanId          String?
  sprintId          String?
  period            String   // SPRINT|PI|PORTFOLIO
  velocity          Float?
  cycleTimeDays     Float?   // median
  leadTimeDays      Float?   // median
  throughput        Float?   // stories/sprint
  wip               Int?
  flowEfficiency    Float?   // active time / total time
  flowDistribution  Json?    // {Feature: %, Bug: %, TechDebt: %, Enabler: %}
  capturedAt        DateTime @default(now())
  source            String   @default("SCHEDULED")
  @@index([orgId, artId, period, capturedAt])
}
```

### Monte Carlo Implementation

```typescript
// packages/analytics/src/forecasting/monte-carlo.ts
export const monteCarloForecast = (
  historicalThroughput: number[],
  remainingItems: number,
  iterations: number = 1000
): ForecastResult => {
  const completionSprints: number[] = []

  for (let i = 0; i < iterations; i++) {
    let remaining = remainingItems
    let sprintsNeeded = 0

    while (remaining > 0) {
      // Sample from historical throughput with replacement
      const throughput = historicalThroughput[Math.floor(Math.random() * historicalThroughput.length)]
      remaining -= throughput
      sprintsNeeded++
      if (sprintsNeeded > 100) break // safety cap
    }
    completionSprints.push(sprintsNeeded)
  }

  completionSprints.sort((a, b) => a - b)
  return {
    p50: completionSprints[Math.floor(iterations * 0.50)],
    p70: completionSprints[Math.floor(iterations * 0.70)],
    p85: completionSprints[Math.floor(iterations * 0.85)],
    p95: completionSprints[Math.floor(iterations * 0.95)],
  }
}
```

### Cycle Time Computation

```typescript
// Cycle time: first IN_PROGRESS transition → DONE transition
const computeCycleTime = async (storyId: string): Promise<number | null> => {
  const [startEvent, endEvent] = await Promise.all([
    prisma.stateTransitionHistory.findFirst({
      where: { storyId, toStatus: 'IN_PROGRESS' },
      orderBy: { transitionedAt: 'asc' }
    }),
    prisma.stateTransitionHistory.findFirst({
      where: { storyId, toStatus: 'DONE' },
      orderBy: { transitionedAt: 'desc' }
    })
  ])
  if (!startEvent || !endEvent) return null
  return (endEvent.transitionedAt.getTime() - startEvent.transitionedAt.getTime()) / 86_400_000 // days
}
```

### Upstash Cache (Monte Carlo)

```typescript
// Cache key: analytics:forecast:{teamId}:{remainingItems}:{historyHash}
// TTL: 3600s (1h)
const FORECAST_CACHE_TTL = 3600
```

---

## Dependencies

- Epic 006 `StateTransitionHistory` (cycle time source)
- `FlowMetricSnapshot` model
- `TeamCapacitySnapshot` (member count for weighting)
- Upstash Redis (forecast cache)
- `recharts` for visualization

---

## Definition of Done

- [ ] `FlowMetricSnapshot` schema with all 6D metrics fields
- [ ] Flow Metrics dashboard with 5 metric cards < 2s
- [ ] Weighted ART aggregation by team member count
- [ ] Cycle time scatter plot + box plot + outlier detection (median + 2×IQR)
- [ ] Monte Carlo: 1,000 iterations, 4 percentiles (P50/P70/P85/P95), 1h cache
- [ ] WIP cap indicator (red at over-limit)
- [ ] Stale data banner (> 2h old)
- [ ] Prior-PI benchmark comparison table (> 20% increase = red)
- [ ] Flow distribution stacked bar chart
- [ ] Unit tests: Monte Carlo distribution, cycle time computation, weighted aggregation
