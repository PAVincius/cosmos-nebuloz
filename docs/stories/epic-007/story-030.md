# Story 030 — Epic Cost Attribution, Cost Anomaly & Budget Plans

**Epic:** 007 — Solution Train & Advanced Features
**Feature:** F-007-010 FinOps Intelligence (cont.)
**WSJF:** 7.5 (userValue=6, timeValue=5, riskReduction=4, jobSize=2)
**Story Points:** 5
**Priority:** Must Have
**Status:** DEFINED

---

## User Story

**As a** Business Owner,
**I want** to see real cloud spend attributed to my epics, receive cost anomaly alerts, and track budgets with multi-threshold hysteresis,
**so that** engineering investment is accountable and surprises are surfaced before month-end.

---

## Acceptance Criteria

### AC-001: Epic cost panel shows attribution
Given an Epic with `BillingEntryAllocation` totaling $12,450 and `leanBudgetAllocation=$15,000`,
When the epic cost panel renders,
Then:
- Panel shows: 83% budget utilization, amber bar (70–90%), lifetime spend $12,450
- Top-3 services by spend are listed (e.g., EC2: $8k, RDS: $3k, Lambda: $1.4k)
- A "Dispute Attribution" button is available for the epic owner

### AC-002: Cost anomaly detected and notified
Given an epic spends $200/day for 14 days (baseline = $200/day),
When the spend spikes to $650 on day 15,
Then:
- A `CostAnomaly` HIGH is created: `variancePct=225`, `baselineAmount=200`, `actualAmount=650`
- RTE and epic owner are notified within 5 min
- The anomaly appears in the ART anomaly dashboard

### AC-003: Budget plan multi-threshold hysteresis
Given a `BudgetPlan` with `totalAmount=$10,000` and thresholds 70/90/100,
When spend reaches $7,200,
Then:
- A 70% threshold notification fires to the budget owner
- `thresholdCrossedAt.70 = <timestamp>` is recorded
- No 90% notification fires (spend is at 72%, not 90%)

Given spend reaches $7,200 then drops to $6,800 then rises again to $7,300,
When re-evaluated,
Then:
- The 70% alert does NOT fire a second time (hysteresis: already crossed this threshold)
- Only the 90% and 100% thresholds can still trigger

### AC-004: Currency display (BRL) with source immutable
Given billing entries in USD and org display currency set to BRL,
When the cost panel renders,
Then:
- Amounts are displayed in BRL using the latest exchange rate
- The source amount (USD) in `BillingEntry.billedCost` is unchanged in the DB
- If the rate is older than 25h, a "Rates may be outdated" indicator appears

### AC-005: Personnel cost restricted to billing:admin
Given a Developer attempts to view the personnel cost panel,
When the request is made,
Then:
- HTTP 403 `{code: "INSUFFICIENT_PERMISSION", permission: "billing:admin"}`
- No personnel cost data is exposed

Given a user with `billing:admin` views the total cost of an epic,
Then:
- Personnel cost from `PersonCost` is added to cloud spend: total cost = cloud + personnel

### AC-006: CostSnapshot immutable after 72h grace
Given a `CostSnapshot` created 73h ago,
When an update is attempted,
Then:
- HTTP 422 `{code: "SNAPSHOT_IMMUTABLE", message: "CostSnapshot is immutable after 72-hour grace period"}`
- `immutableAt` was set at 72h after creation

### AC-007: Attribution audit log
Given an epic owner disputes an attribution ("This $5k EC2 charge is not from our services"),
When the dispute is submitted with reason,
Then:
- A `CostAttributionDispute` record is created with `status=OPEN`, reason, epicId, amount
- A notification is sent to the FinOps admin/RTE
- The disputed amount is visually marked "Disputed" in the cost panel (still counted in totals)

### AC-008: Portfolio kanban cost badges
Given the Portfolio Kanban is loaded with epics that have cost attributions,
When cards render,
Then:
- Each epic card shows a small cost badge: current-period spend vs budget allocation
- Budget utilization > 90%: red badge
- Budget utilization 70–90%: amber badge
- Budget utilization < 70%: green badge
- No `BillingEntryAllocation`: grey "No cost data" badge

---

## Technical Notes

### Cost Anomaly Detection

```typescript
// packages/finops/src/anomaly-detector.ts
export const detectCostAnomalies = async (orgId: string) => {
  const recentEntries = await prisma.billingEntry.groupBy({
    by: ['epicId'],
    where: { orgId, date: { gte: subDays(new Date(), 14) } },
    _sum: { effectiveCost: true },
    _count: { date: true },
  })

  for (const entry of recentEntries) {
    const baseline = entry._sum.effectiveCost! / entry._count.date! // daily average
    const latestDay = await getLatestDaySpend(entry.epicId, orgId)
    const variancePct = ((latestDay - baseline) / baseline) * 100

    if (variancePct > 100) { // > 2× baseline
      const severity = variancePct > 200 ? 'HIGH' : 'MEDIUM'
      await createCostAnomaly({ orgId, epicId: entry.epicId, baseline, actualAmount: latestDay, variancePct, severity })
    }
  }
}
```

### Budget Plan Hysteresis

```typescript
// Track which thresholds have been crossed to prevent re-firing
const checkBudgetThresholds = async (budgetPlanId: string, currentSpend: number) => {
  const plan = await prisma.budgetPlan.findUniqueOrThrow({ where: { id: budgetPlanId } })
  const utilization = (currentSpend / plan.totalAmount) * 100
  const thresholds = [70, 90, 100]

  const crossed = plan.thresholdCrossed as Record<string, string> ?? {}

  for (const threshold of thresholds) {
    if (utilization >= threshold && !crossed[threshold]) {
      // First time crossing this threshold — notify
      await sendBudgetAlert(budgetPlanId, threshold, currentSpend)
      crossed[threshold] = new Date().toISOString()
      await prisma.budgetPlan.update({ where: { id: budgetPlanId }, data: { thresholdCrossed: crossed } })
    }
  }
}
```

---

## Dependencies

- Epic 007 Story-023 (BillingEntry + TagRule from FinOps pipeline)
- `CostAnomaly`, `BudgetPlan`, `CostSnapshot`, `PersonCost`, `CurrencyRate` models
- `@repo/security` (billing:admin permission gate)
- `@repo/notifications`

---

## Definition of Done

- [ ] Epic cost panel: utilization bar, top-3 services, dispute button
- [ ] `CostAnomaly` detection: 14-day baseline, variance >100%, severity bands
- [ ] Cost anomaly → RTE + owner notification within 5 min
- [ ] `BudgetPlan` multi-threshold hysteresis (no re-fire after crossing)
- [ ] Currency display conversion (source immutable)
- [ ] Personnel cost gated by `billing:admin` permission
- [ ] `CostSnapshot` immutable after 72h grace period
- [ ] Attribution dispute flow
- [ ] Portfolio kanban cost badges (red/amber/green/grey)
- [ ] Daily exchange rate refresh with >25h stale indicator
- [ ] Unit tests: anomaly detection baseline, hysteresis, currency conversion, immutability
