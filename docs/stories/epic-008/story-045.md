# Story 045 — Advanced Reporting, Export & Platform Scalability

**Epic:** 008 — Enterprise & Scale
**Feature:** F-008-012 Enterprise Reporting
**WSJF:** 5.5 (userValue=5, timeValue=4, riskReduction=4, jobSize=2)
**Story Points:** 8
**Priority:** Should Have
**Status:** DEFINED

---

## User Story

**As a** Portfolio Manager,
**I want** scheduled automated reports, multi-format exports (PDF/CSV/JSONL), custom dashboard layouts, and platform scalability features (query optimization, DB partitioning strategy, horizontal job processing),
**so that** stakeholders receive consistent reporting without manual effort and the platform handles enterprise-scale data volumes.

---

## Acceptance Criteria

### AC-001: Scheduled report delivery via email/Slack
Given a Portfolio Manager configures a "Weekly PI Health Report" with:
- Schedule: every Monday 08:00 org timezone
- Recipients: `[pm@example.com, rte@example.com]`
- Content: Portfolio KPI tiles + ART health statuses
When the schedule triggers,
Then:
- PDF report is generated and emailed to both recipients
- Slack message (if Slack integration configured): "Weekly PI Health Report attached"
- `ScheduledReportExecution` record created: `{reportId, status: DELIVERED, executedAt}`
- If delivery fails: retry 3× then `FAILED` + Platform Admin alert

### AC-002: PDF report generation — pre-signed URL
Given a "Portfolio Health Report" is generated for Q2-2026,
When generation completes,
Then:
- PDF is stored in object storage (S3/R2)
- Pre-signed URL issued with 7-day expiry
- Link included in the delivery email
- After 7 days: URL expires, but the file is retained for 90 days (re-downloadable by admin)

### AC-003: Custom dashboard layout per user
Given a PRODUCT_MANAGER user customizes their dashboard:
- Removes "ART Health Status" tile
- Adds "Feature Cycle Time" tile
- Moves "WSJF Leaderboard" to position 2
When they log in on a different device,
Then:
- The same custom layout is restored
- Layout stored in `UserDashboardLayout.config` (JSON per user per org)
- Other users' layouts are unaffected

### AC-004: Multi-ART aggregate CSV export
Given a Portfolio Manager exports a "Multi-ART Feature Progress" CSV for PI-2026-Q2,
When the export completes,
Then:
- CSV columns: ART, Feature, State, AssignedTeam, Sprint, StoryPoints (completed/total), WSJF
- One row per Feature across all ARTs in the selected PI
- Large exports (>5,000 rows) processed via Inngest job (202 + jobId response)
- Download link emailed when complete

### AC-005: JSONL audit export complies with 7-year retention
Given a Compliance Officer requests an audit JSONL export for 2019-2020,
When the export is requested,
Then:
- Data is accessible (7-year retention policy applied)
- JSONL format with one JSON object per line
- Sorted by `timestamp` ascending
- Files > 100MB are split into chunks with sequential naming: `audit-2019-part-1.jsonl`, `audit-2019-part-2.jsonl`

### AC-006: Query performance — portfolio load <1.5s at 10,000 Epics
Given an org with 10,000 Epics in the portfolio,
When the Portfolio Kanban loads,
Then:
- Initial load completes in <1.5s (p95)
- Pagination: 50 Epics per column (cursor-based)
- Composite index `(orgId, state, wsjfNormalized)` used
- No N+1 queries (EXPLAIN output shows ≤3 queries)

### AC-007: DB partitioning — AuditLog by month
Given the AuditLog table grows to 50M+ rows over 7 years,
When queries filter by date range,
Then:
- `AuditLog` is range-partitioned by `createdAt` (monthly partitions)
- Queries for a specific month scan only that partition (partition pruning verified via EXPLAIN)
- New partitions are created automatically via a monthly maintenance cron

### AC-008: Horizontal Inngest job processing
Given a batch job (e.g. PortfolioAnalysisReport) fans out to 100 ART sub-jobs,
When all 100 sub-jobs run,
Then:
- Sub-jobs execute in parallel across available Inngest concurrency slots
- Parent job polls sub-job completion with Inngest `step.waitForEvent`
- Total batch time < 5 min for 100 ARTs (vs. >30 min sequential)
- Partial success is handled: parent reports `{completed: 98, failed: 2, errors: [...]}`

---

## Technical Notes

### Scheduled Report (Inngest)

```typescript
// packages/reporting/src/scheduled-reports.ts
export const runScheduledReport = inngest.createFunction(
  { id: 'scheduled-report', retries: 3 },
  { event: 'reporting/scheduled.triggered' },
  async ({ event, step }) => {
    const { reportId, orgId } = event.data
    const report = await step.run('load-config', () => prisma.scheduledReport.findUniqueOrThrow({ where: { id: reportId } }))

    const pdfUrl = await step.run('generate-pdf', () => generatePortfolioPDF(report.config, orgId))

    await step.run('deliver', async () => {
      await sendReportEmail({ recipients: report.recipients, pdfUrl, reportName: report.name })
      if (report.slackChannelId) await sendSlackMessage({ channelId: report.slackChannelId, message: `${report.name} attached`, attachmentUrl: pdfUrl })
    })

    await prisma.scheduledReportExecution.create({ data: { reportId, status: 'DELIVERED', executedAt: new Date() } })
  }
)
```

### Dashboard Layout Persistence

```typescript
// Stored as JSON in UserDashboardLayout
type DashboardTile = {
  id: string
  type: 'portfolio-kpi' | 'art-health' | 'feature-cycle-time' | 'wsjf-leaderboard' | 'velocity-chart' | string
  position: number
  visible: boolean
  config?: Record<string, unknown>
}

// Per user, per org — does not affect other users
type DashboardLayoutConfig = {
  tiles: DashboardTile[]
  lastModified: string
}
```

### Portfolio Query Optimization

```sql
-- Composite index for Portfolio Kanban
CREATE INDEX idx_epic_portfolio_kanban
  ON "Epic" (org_id, state, wsjf_normalized DESC)
  WHERE deleted_at IS NULL;

-- Cursor-based pagination (no OFFSET)
SELECT * FROM "Epic"
WHERE org_id = $1
  AND state = $2
  AND (wsjf_normalized, id) < ($3, $4)  -- cursor
ORDER BY wsjf_normalized DESC, id DESC
LIMIT 50;
```

### AuditLog Partitioning (monthly)

```sql
-- Range partition by createdAt (monthly)
CREATE TABLE "AuditLog" (
  id          TEXT NOT NULL,
  org_id      TEXT NOT NULL,
  action      TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL,
  -- ...
) PARTITION BY RANGE (created_at);

-- Monthly partition creation (automated via cron)
CREATE TABLE "AuditLog_2026_06" PARTITION OF "AuditLog"
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
```

---

## Dependencies

- `ScheduledReport`, `ScheduledReportExecution`, `UserDashboardLayout` models
- Inngest (scheduled report execution, fan-out batch processing)
- Object storage (S3/Cloudflare R2) for PDF/JSONL files
- PostgreSQL range partitioning (`AuditLog`)
- `@repo/pdf-generator`
- `@repo/notifications`

---

## Definition of Done

- [ ] Scheduled reports: Inngest cron per report schedule, 3-retry, `ScheduledReportExecution` record
- [ ] PDF generation: stored in R2, pre-signed 7-day URL, 90-day file retention
- [ ] Slack delivery (optional) + email delivery
- [ ] Custom dashboard layout: per-user, per-org JSON config, device-synced
- [ ] Multi-ART CSV export: columns spec, large exports via Inngest (202 + jobId)
- [ ] JSONL audit export: 7-year retention, >100MB file splitting
- [ ] Portfolio Kanban: <1.5s at 10k Epics, cursor pagination, composite index, ≤3 queries
- [ ] AuditLog range partitioning by month with automated partition creation cron
- [ ] Fan-out batch jobs: `step.waitForEvent` parent polling, partial success `{completed, failed, errors}`
- [ ] Unit tests: schedule trigger, layout persistence, CSV export column ordering, partition pruning, fan-out completion detection
