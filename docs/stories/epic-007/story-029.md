# Story 029 — Executive Dashboard & Scheduled Reports

**Epic:** 007 — Solution Train & Advanced Features
**Feature:** F-007-009 Executive Reporting
**WSJF:** 8.0 (userValue=7, timeValue=6, riskReduction=4, jobSize=2)
**Story Points:** 5
**Priority:** Must Have
**Status:** DEFINED

---

## User Story

**As a** Business Owner,
**I want** an executive dashboard with key delivery KPIs, anomaly feed, and scheduled PDF/XLSX reports,
**so that** I can monitor engineering investment value without attending every ART ceremony.

---

## Acceptance Criteria

### AC-001: Dashboard renders within 3s
Given a Portfolio Manager with 4 active ARTs,
When the Executive Dashboard loads,
Then:
- 6 KPI tiles render within 3s with non-null values: predictability, flow efficiency, cycle time, cost-per-point, action completion rate, active ARTs count
- A 4-row ART summary table with composite health indicator per ART
- 3 trend charts (predictability, cycle time, cost-per-point over last 6 PIs)

### AC-002: ART health indicator logic
Given an ART with: predictability 65% (below 80% SAFe benchmark), declining 3-sprint throughput trend, and 2 CRITICAL anomalies,
When the health indicator renders,
Then:
- The ART row shows a red health badge (CRITICAL state)
- Hovering shows: "Predictability below 80% benchmark | 2 open critical anomalies | Throughput declining"

### AC-003: Scheduled report registration
Given a Portfolio Manager saves a monthly "Executive Summary" schedule for their org with 3 email recipients,
When saved,
Then:
- `ScheduledReport` record is created with `active=true`, `cadence=MONTHLY`
- An Inngest cron job registers for the schedule
- A confirmation notification is sent to the PM + recipients

### AC-004: Scheduled report generation
Given the monthly cron fires for a registered "Executive Summary" report,
When generation completes,
Then:
- PDF is generated server-side with org logo, period summary, 6 KPI values, anomaly list, and ART health table
- Report is stored in Blob storage and accessible via a pre-signed 7-day URL
- Recipients receive an email with the download link
- `ScheduledReport.lastRunAt` and `artifactRef` are updated

### AC-005: PDF export rate-limited (10/user/hour)
Given a Portfolio Manager requests 11 PDF exports within 60 minutes,
When the 11th request is submitted,
Then:
- HTTP 429 `{code: "RATE_LIMIT_EXCEEDED", limit: 10, resetAt: "<ISO timestamp>"}`
- 10th export completes successfully

### AC-006: Analytics API — read-only, audited
Given a developer uses a scoped analytics API token (scope: `analytics:read`),
When they query `GET /api/analytics/executive?artId=art-01&period=last-pi`,
Then:
- Response returns the KPI payload within 2s (5-min cache)
- PII fields are excluded unless the token has `include_member_pii` scope
- The request is logged in `AuditLog` with `action=analytics.api.queried`, `actorId`, `endpoint`

### AC-007: 5-min cache on dashboard KPIs
Given the dashboard has been loaded and data cached,
When the same Portfolio Manager reloads within 5 min,
Then:
- KPI response is served from Upstash Redis cache (< 500ms)
- Cache is invalidated when a new `FlowMetricSnapshot` is computed

### AC-008: Anomaly feed on dashboard
Given an ART has 3 CRITICAL and 5 HIGH open anomalies,
When the Executive Dashboard anomaly feed renders,
Then:
- Top 10 anomalies sorted by severity (CRITICAL first) + detected date
- Each anomaly has a deep link to the source entity
- Resolved anomalies are excluded from the feed

---

## Technical Notes

### ScheduledReport Model

```prisma
model ScheduledReport {
  id          String   @id @default(cuid())
  orgId       String
  type        String   // EXECUTIVE_SUMMARY|PI_HEALTH|FLOW_METRICS|BUDGET_INTELLIGENCE|VELOCITY
  cadence     String   // WEEKLY|MONTHLY|QUARTERLY
  recipients  String[]
  artId       String?
  lastRunAt   DateTime?
  artifactRef String?
  active      Boolean  @default(true)
  createdBy   String
  createdAt   DateTime @default(now())
  @@index([orgId, type, active])
}
```

### Dashboard KPI Computation

```typescript
// apps/app/app/actions/analytics/index.ts
export const getExecutiveDashboard = withSecureAction(
  { schema: ExecutiveDashboardSchema, auditAction: 'analytics.dashboard.viewed', auditResourceType: 'Dashboard' },
  async ({ orgId, artIds }, ctx) => {
    const cacheKey = `analytics:executive:${orgId}:${artIds.sort().join(',')}}`
    const cached = await redis.get(cacheKey)
    if (cached) return JSON.parse(cached)

    const [kpis, artTable, anomalyFeed] = await Promise.all([
      computeKPIs(orgId, artIds),
      buildARTTable(orgId, artIds),
      getTopAnomalies(orgId, artIds, 10),
    ])

    const result = { kpis, artTable, anomalyFeed }
    await redis.set(cacheKey, JSON.stringify(result), { ex: 300 }) // 5-min TTL
    return result
  }
)
```

### ART Health Score

```typescript
const computeARTHealth = (art: ARTMetrics): HealthState => {
  const criticalAnomies = art.anomalies.filter(a => a.severity === 'CRITICAL').length
  const predictability = art.piPPM ?? 0

  if (criticalAnomies >= 2 || predictability < 0.65) return 'CRITICAL'
  if (criticalAnomies >= 1 || predictability < 0.80) return 'WARNING'
  return 'HEALTHY'
}
```

---

## Dependencies

- `FlowMetricSnapshot` (Story-022 Epic 007)
- `ScheduledReport` model
- `Anomaly` model
- Upstash Redis (5-min cache)
- Inngest (scheduled report cron jobs)
- PDF generation library (e.g., `@react-pdf/renderer`)

---

## Definition of Done

- [ ] Executive dashboard with 6 KPI tiles, ART table, 3 trend charts, anomaly feed
- [ ] Dashboard renders < 3s
- [ ] ART health indicator (CRITICAL/WARNING/HEALTHY) logic
- [ ] Scheduled report CRUD (5 report types, cadence WEEKLY/MONTHLY/QUARTERLY)
- [ ] PDF generation: org logo, KPIs, anomaly list, ART table
- [ ] Pre-signed 7-day download links
- [ ] Email dispatch to recipients on schedule
- [ ] PDF export rate limit (10/user/hr)
- [ ] Analytics API: read-only, token-scoped, PII excluded by default, audited
- [ ] 5-min Upstash Redis cache on KPIs
- [ ] Unit tests: health indicator logic, KPI computation, cache invalidation
