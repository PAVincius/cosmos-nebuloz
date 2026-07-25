# Story 025 — Strategic Themes, Lean Budget & Portfolio Health Report

**Epic:** 006 — Enhanced Portfolio & ART
**Feature:** F-015 Portfolio Strategy & Finance
**WSJF:** 5.5 (userValue=5, timeValue=4, riskReduction=3, jobSize=2)
**Story Points:** 8
**Priority:** Should Have
**Status:** DEFINED

---

## User Story

**As a** Portfolio Manager,
**I want** to manage strategic themes with investment targets, configure lean budgets per ART/PI, and generate portfolio health reports via AI batch analysis,
**so that** strategic investment is aligned and portfolio health is measured objectively.

---

## Acceptance Criteria

### AC-001: Strategic theme concentration alert (60% default)
Given 3 themes with 8/2/2 epics respectively (66.7% / 16.7% / 16.7%),
When the Strategy Map opens with default 60% concentration threshold,
Then:
- Theme 1 is flagged amber: "Theme 'Security' has 66.7% of portfolio epics — exceeds 60% concentration guideline"
- Themes 2 and 3 are within bounds
- Threshold is configurable per org (FR-014)

### AC-002: CapEx + OpEx = 100% validation
Given an RTE sets CapEx% = 60 and attempts OpEx% = 50,
When the form saves,
Then:
- HTTP 422 `{code: "BUDGET_SPLIT_INVALID", message: "CapEx + OpEx must equal 100%. Current: 110%"}`
- LeanBudget is not saved

Given CapEx=60, OpEx=40,
When saved,
Then:
- `LeanBudget.capexPct=60`, `opexPct=40`
- `@@unique([artId, piPlanId])` ensures one budget per ART/PI (409 on duplicate)

### AC-003: LeanBudgetReallocation is immutable
Given an existing reallocation entry,
When a DELETE or UPDATE is attempted on `LeanBudgetReallocation`,
Then:
- API returns 405 (no update/delete routes)
- DB trigger blocks direct mutation

### AC-004: Over-allocation warning (soft)
Given ART has `LeanBudget.totalAmount = R$500k` and current epic allocations = R$450k,
When R$100k more is allocated to a new epic,
Then:
- Allocation save is NOT blocked
- A warning modal: "This allocation will exceed the ART budget by R$50,000. Proceed anyway?"
- On confirm: allocation saves and a soft over-allocation flag appears on the budget dashboard

### AC-005: CLOSED PI Plan budget is read-only
Given a PI Plan with status=CLOSED,
When the budget editor is opened,
Then:
- All input fields are read-only
- `LeanBudget.immutableAt` is set to PI close timestamp
- A banner: "Budget for this PI is final — changes not permitted"

### AC-006: PortfolioAnalysisReport batch job — HTTP 202 + jobId
Given an RTE triggers batch INVEST analysis for an ART with 25 non-terminal epics,
When the request is submitted,
Then:
- HTTP 202 with `{jobId: "xxx", status: "QUEUED", estimatedMinutes: 5}` within 500ms
- Inngest job is enqueued
- Per-ART distributed lock prevents concurrent runs (409 if already running)

### AC-007: Batch analysis per-ART Upstash lock
Given a batch analysis is running for ART-1,
When a second batch analysis is triggered for ART-1,
Then:
- HTTP 409 `{code: "ANALYSIS_RUNNING", jobId: "...", artId: "ART-1", estimatedCompletion: "..."}`
- No duplicate Inngest job is enqueued

### AC-008: PARTIAL_SUCCESS handling
Given 30 epics in an ART batch, 5 have descriptions < 100 chars (INSUFFICIENT_CONTENT),
When the batch completes,
Then:
- Those 5 epics are marked `analysisStatus=UNAVAILABLE` in the report
- `PortfolioAnalysisReport.completionStatus = PARTIAL_SUCCESS`
- The report is still created and accessible (not failed/discarded)
- The 5 unavailable epics are listed in a "Skipped Epics" section

### AC-009: Weekly cron with change-diff section
Given a prior `PortfolioAnalysisReport` exists from 7 days ago,
When the weekly cron fires and the new analysis completes,
Then:
- The new report includes a "Changes Since Last Analysis" section
- Any epics that moved between readiness categories are listed
- The old report's 90-day TTL is not reset (independent expiry per report)

---

## Technical Notes

### LeanBudgetReallocation Immutability

```sql
CREATE OR REPLACE FUNCTION prevent_reallocation_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'LeanBudgetReallocation entries are immutable.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reallocation_immutable
BEFORE UPDATE OR DELETE ON "LeanBudgetReallocation"
FOR EACH ROW EXECUTE FUNCTION prevent_reallocation_mutation();
```

### Batch Analysis Inngest Job

```typescript
// apps/app/app/api/inngest/route.ts
export const portfolioAnalysisBatch = inngest.createFunction(
  { id: 'portfolio-analysis-batch', concurrency: { limit: 1, key: 'event.data.artId' } },
  { event: 'portfolio/analysis.requested' },
  async ({ event, step }) => {
    const { artId, orgId, reportId } = event.data

    const epics = await step.run('fetch-epics', () =>
      prisma.epic.findMany({ where: { artId, orgId, status: { notIn: ['DONE', 'REJECTED'] } } })
    )

    // Chunk into batches of 10
    const chunks = chunk(epics, 10)
    const results: AnalysisResult[] = []

    for (const [i, batch] of chunks.entries()) {
      const batchResults = await step.run(`analyze-batch-${i}`, async () => {
        return Promise.all(batch.map(epic => analyzeEpicInvest(epic, orgId)))
      })
      results.push(...batchResults)
    }

    const failed = results.filter(r => r.status === 'UNAVAILABLE')
    const status = failed.length > 0 ? 'PARTIAL_SUCCESS' : 'COMPLETE'

    await step.run('save-report', () =>
      prisma.portfolioAnalysisReport.update({
        where: { id: reportId },
        data: { reportJson: buildReport(results), completionStatus: status, epicCount: epics.length }
      })
    )
  }
)
```

### Upstash Distributed Lock

```typescript
// Per-ART lock: prevents concurrent batch runs
const acquireLock = async (artId: string): Promise<boolean> => {
  const key = `portfolio:analysis:lock:${artId}`
  const result = await redis.set(key, '1', { nx: true, ex: 600 }) // 10-min TTL
  return result === 'OK'
}
```

---

## Dependencies

- Story-011 (schema: Epic fields for analysis)
- Story-014 (INVEST analysis — reused by batch)
- Story-026 (strategic themes model)
- `PortfolioAnalysisReport` model in portfolio.prisma
- Inngest for batch processing

---

## Definition of Done

- [ ] Strategic theme CRUD (max 7 active without override, archive non-cascading)
- [ ] Strategy Map: investment distribution by count/budget/story points
- [ ] Concentration alert (60% default, configurable)
- [ ] LeanBudget CRUD with CapEx+OpEx=100% validation + `@@unique([artId, piPlanId])`
- [ ] Over-allocation soft warning (save not blocked)
- [ ] CLOSED PI budget read-only + `immutableAt`
- [ ] `LeanBudgetReallocation` immutable (DB trigger + 405)
- [ ] `PortfolioAnalysisReport` batch job: HTTP 202 + Inngest + per-ART Upstash lock
- [ ] PARTIAL_SUCCESS handling (skipped epics listed)
- [ ] Weekly cron with change-diff section
- [ ] `PortfolioAnalysisReport` 90-day TTL
- [ ] Unit tests: CapEx+OpEx validation, lock, PARTIAL_SUCCESS, concentration alert
