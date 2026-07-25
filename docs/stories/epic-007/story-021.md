# Story 021 — Anomaly Detection Engine & Rule Set

**Epic:** 007 — Solution Train & Advanced Features
**Feature:** F-007-001 Flow Intelligence
**WSJF:** 13.0 (userValue=8, timeValue=8, riskReduction=7, jobSize=2)
**Story Points:** 8
**Priority:** Must Have
**Status:** DEFINED

---

## User Story

**As an** RTE,
**I want** a scheduled anomaly detection engine that evaluates team and ART-level signals against a versioned rule set with configurable thresholds,
**so that** flow health issues are automatically surfaced before they become critical delivery problems.

---

## Acceptance Criteria

### AC-001: Nightly cron creates AnomalyDetectionRun
Given an org with an active PI Plan and in-flight sprints,
When the nightly cron fires at 02:00 UTC,
Then:
- An `AnomalyDetectionRun` is created with `source=CRON`, `ranAt` within 5 min of scheduled time
- `itemsEvaluated > 0`
- Any detected anomalies are created as `Anomaly` records

### AC-002: Deduplication prevents duplicate anomalies
Given an `Anomaly` of type `VELOCITY_DROP` for Team Alpha from run N-1 is still OPEN,
When run N detects the same `VELOCITY_DROP` for Team Alpha,
Then:
- No duplicate `Anomaly` is created
- The existing record's `runId` is not mutated (immutable once created)
- The dedup query checks: same `type`, `entityId`, `status NOT IN (RESOLVED, SUPPRESSED)`, `detectedAt > NOW() - 24h`

### AC-003: HIGH anomaly notification within 60s
Given a HIGH anomaly is created by the detection run,
When the anomaly record is committed,
Then:
- Both the team SM and the ART RTE receive in-app notifications within 60s
- Notification includes a deep link to the anomaly detail in the ART anomaly dashboard

### AC-004: Concurrent run protection (409)
Given a manual run is triggered while the scheduled run is still processing,
When the second run request arrives,
Then:
- HTTP 409 `{code: "DETECTION_RUN_IN_PROGRESS", runId: "...", estimatedCompletion: "..."}`
- No second Inngest job is enqueued

### AC-005: Org-level threshold override within platform bounds
Given the platform default for `R-VEL-01` velocity variance threshold is 20%,
And the platform allows 10–40% range,
When an RTE sets the threshold to 30% for their ART,
Then:
- A sprint 25% below rolling average does NOT create an R-VEL-01 anomaly
- Setting threshold to 5% (below min 10%) returns 422 with allowed range

### AC-006: CRITICAL rules non-disablable
Given a CRITICAL rule (e.g., R-IMP-02 for cascading dependency risk),
When an Org Admin attempts to disable it,
Then:
- HTTP 422 `{code: "CRITICAL_RULE_NON_DISABLABLE", ruleId: "R-IMP-02"}`
- Rule remains active

### AC-007: Partial completion with resumption
Given a run processing 9,500 entities,
When the Inngest job timer reaches 115s (near 120s limit),
Then:
- A partial-completion record is written to `AnomalyDetectionRun.partialCompletion=true`
- All anomalies found so far are dispatched/notified
- A continuation job is scheduled with the cursor position
- Run eventually completes with `itemsEvaluated = 9,500`

### AC-008: Threshold reset to default
Given an org-level override exists for `R-WIP-01`,
When the RTE resets it to default,
Then:
- The override record is deleted
- The next run uses the platform default threshold
- AuditLog records the reset action

---

## Technical Notes

### AnomalyDetectionRun Model Extension

```prisma
model AnomalyDetectionRun {
  // existing +
  source              String   @default("CRON") // CRON|MANUAL
  ruleEngineVersion   String
  itemsEvaluated      Int      @default(0)
  anomaliesFound      Int      @default(0)
  partialCompletion   Boolean  @default(false)
  continuationCursor  String?
}
```

### Rule Catalogue (sample entries)

```typescript
export const ANOMALY_RULES = {
  'R-VEL-01': {
    name: 'Velocity Variance',
    type: 'VELOCITY_DROP',
    severity: 'HIGH',
    defaultThreshold: 0.20, // 20%
    bounds: { min: 0.10, max: 0.40 },
    critical: false,
    evaluate: (team: TeamMetrics, threshold: number) =>
      team.currentVelocity < team.rollingAvgVelocity * (1 - threshold),
    suggestedAction: 'SM to review sprint commitments and team capacity',
  },
  'R-IMP-02': {
    name: 'Critical Impediment',
    type: 'IMPEDIMENT_AGING',
    severity: 'CRITICAL',
    defaultThreshold: 24, // hours
    bounds: null, // non-configurable
    critical: true,
    evaluate: (impediment: Impediment) =>
      impediment.severity >= 4 && hoursSince(impediment.createdAt) >= 24,
    suggestedAction: 'RTE to escalate to Portfolio Risk Register immediately',
  },
  // R-WIP, R-DEP, R-OBJ, R-RISK, R-EPIC, R-STALE, R-CYCLE, R-FLOW, R-OKR...
}
```

### Deduplication Query

```sql
SELECT id FROM "Anomaly"
WHERE org_id = $orgId
  AND type = $type
  AND entity_id = $entityId
  AND status NOT IN ('RESOLVED', 'SUPPRESSED')
  AND detected_at > NOW() - INTERVAL '24 hours'
LIMIT 1;
```

### Inngest Job Structure

```typescript
export const anomalySchedulerJob = inngest.createFunction(
  { id: 'anomaly-scheduler', concurrency: { limit: 1, key: 'event.data.orgId' } },
  { cron: '0 2 * * *' }, // 02:00 UTC nightly
  async ({ event, step }) => {
    const orgs = await step.run('get-active-orgs', () => getOrgsWithActivePIPlans())

    for (const org of orgs) {
      await step.run(`evaluate-org-${org.id}`, async () => {
        const run = await createRun(org.id)
        const results = await evaluateAllRules(org, run.id)
        await finalizeRun(run.id, results)
        await dispatchNotifications(results)
      })
    }
  }
)
```

---

## Dependencies

- Epic 006 anomaly infrastructure (Anomaly model, VELOCITY_DROP etc.)
- `FlowMetricSnapshot` model (data source for flow rules)
- `@repo/notifications`
- Inngest 4.4 (job scheduling + concurrency)
- Upstash Redis (dedup lock, threshold cache)

---

## Definition of Done

- [ ] `AnomalyDetectionRun` with `source`, `ruleEngineVersion`, `partialCompletion`, cursor
- [ ] 11+ rule catalogue entries with suggested actions
- [ ] Nightly cron at 02:00 UTC via Inngest
- [ ] Deduplication within 24h (same type+entityId+status)
- [ ] HIGH anomaly → SM + RTE notification within 60s
- [ ] Concurrent run protection: 409 with running jobId
- [ ] Org-level threshold override with platform bounds validation
- [ ] CRITICAL rules non-disablable (422)
- [ ] Partial completion with cursor-based continuation
- [ ] Threshold reset audited
- [ ] Unit tests: deduplication, threshold override, critical rule guard, partial completion
