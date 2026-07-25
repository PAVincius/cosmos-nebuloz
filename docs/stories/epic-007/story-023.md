# Story 023 — AWS Cost Explorer Ingestion Pipeline (FOCUS 1.1)

**Epic:** 007 — Solution Train & Advanced Features
**Feature:** F-007-003 FinOps Intelligence
**WSJF:** 10.0 (userValue=7, timeValue=6, riskReduction=7, jobSize=2)
**Story Points:** 8
**Priority:** Must Have
**Status:** DEFINED

---

## User Story

**As a** Finance Partner,
**I want** daily AWS cost data ingested via FOCUS 1.1-compliant pipeline with idempotent upserts, tag-based attribution, and budget anomaly detection,
**so that** engineering investment is tracked to the ART/epic level and surprises are surfaced before month-end.

---

## Acceptance Criteria

### AC-001: Nightly sync creates BillingEntry rows
Given a valid AWS integration with `ce:GetCostAndUsage` IAM role,
When the nightly billing sync cron fires,
Then:
- Prior-day `BillingEntry` rows are upserted with the composite unique key `(orgId, date, provider, service, region, tagHash)`
- `lastSyncedAt` is updated on the `Integration` record
- No duplicate rows for the same composite key
- `BillingSyncRun` record created with `status=COMPLETE` and `entriesProcessed` count

### AC-002: Idempotent upsert — re-running creates no duplicates
Given a sync has already run for 2026-06-08,
When the sync is manually triggered again for the same date,
Then:
- Existing rows are updated (not duplicated)
- `BillingSyncRun.status = COMPLETE` with same `entriesProcessed` count
- No new rows in `BillingEntry` for that date

### AC-003: Exponential backoff on AWS 429
Given the AWS Cost Explorer API returns HTTP 429 (throttled),
When the pipeline retries,
Then:
- Retry 1 after 2s, Retry 2 after 4s, Retry 3 after 8s, Retry 4 after 16s, Retry 5 after 32s
- After 5 retries: `BillingSyncRun.status = ERROR`, `errorMessage` contains the throttle details
- RTE is notified of the sync failure

### AC-004: 6-month backfill
Given a new AWS integration is connected,
When a 6-month backfill is triggered,
Then:
- Data is chunked into 30-day windows (6 chunks)
- Each chunk is processed independently (resumable via `BillingSyncRun.cursor`)
- `CostSnapshot` records exist per month after completion
- Re-running the backfill creates no duplicates

### AC-005: Read-only IAM enforcement (no cost writing)
Given the AWS integration is configured,
When the pipeline validates the IAM policy,
Then:
- The policy is verified to only include `ce:GetCostAndUsage` and `ce:GetCostForecast`
- If write permissions are detected, setup is blocked with a warning
- Credentials are stored AES-256-GCM encrypted (never plaintext)

### AC-006: FOCUS 1.1 schema compliance
Given a `BillingEntry` row is created,
When the schema is validated against FOCUS 1.1 standard,
Then:
- Fields present: `provider`, `service`, `region`, `billedCost`, `effectiveCost`, `currency`, `date`, `rawTags`
- `billedCost` ≠ `effectiveCost` when a Savings Plan discount applies
- Source currency is immutable (never overwritten by display currency conversion)

### AC-007: Tag rule attribution creates BillingEntryAllocation
Given a TagRule with pattern `epic-payments-*` → `epicId=42` and priority=10,
When a `BillingEntry` with `rawTags.Epic = "epic-payments-q3"` is processed,
Then:
- A `BillingEntryAllocation` is created with `epicId=42`, `percentage=100`, `amount=billedCost`
- If multiple rules match: first-match-wins (lowest `priority` number)
- Unmatched entries have no allocation (visible in attribution audit as "Unattributed")

### AC-008: Multi-account independent sync
Given an org has 2 AWS account integrations (account A and account B),
When the nightly sync fires,
Then:
- Each account syncs independently (separate Inngest jobs)
- Failure in account A does not affect account B
- Both `BillingSyncRun` records are created with independent statuses

---

## Technical Notes

### FOCUS 1.1 BillingEntry Schema

```prisma
model BillingEntry {
  id              String   @id @default(cuid())
  orgId           String
  integrationId   String
  date            DateTime @db.Date
  provider        String   // AWS|GCP|AZURE
  service         String   // e.g. "Amazon EC2"
  region          String   // e.g. "us-east-1"
  billedCost      Float    // list price
  effectiveCost   Float    // after discounts
  currency        String   @default("USD")
  tagHash         String   // SHA-256 of sorted tag key=value pairs
  rawTags         Json     // {key: value} map
  createdAt       DateTime @default(now())
  allocations     BillingEntryAllocation[]
  @@unique([orgId, date, provider, service, region, tagHash])
  @@index([orgId, date])
  @@index([integrationId, date])
}
```

### Inngest Pipeline Structure

```typescript
export const billingSyncJob = inngest.createFunction(
  { id: 'billing-sync', retries: 5 },
  { event: 'billing/sync.requested' },
  async ({ event, step }) => {
    const { integrationId, orgId, startDate, endDate } = event.data

    // Chunked into 30-day windows for backfill
    const windows = generateDateWindows(startDate, endDate, 30)

    for (const window of windows) {
      await step.run(`fetch-window-${window.start}`, async () => {
        const entries = await fetchCostAndUsage({
          integrationId,
          startDate: window.start,
          endDate: window.end,
          granularity: 'DAILY',
          groupBy: ['SERVICE', 'REGION', 'TAGS'],
        })

        // Idempotent upsert
        await upsertBillingEntries(orgId, integrationId, entries)

        // Apply tag rules
        await applyTagRules(orgId, entries)
      })
    }
  }
)
```

### Credential Storage (AES-256-GCM)

```typescript
// packages/security/src/encrypt.ts
// Already exists in codebase — use @repo/security
import { encryptCredential, decryptCredential } from '@repo/security'

// Store: always encrypted
const encrypted = await encryptCredential(orgId, { roleArn: '...', externalId: '...' })
await prisma.integration.update({ where: { id }, data: { config: encrypted } })

// Retrieve: decrypt in server action only — never return to client
```

---

## Dependencies

- `BillingEntry`, `BillingEntryAllocation`, `TagRule`, `BillingSyncRun` models
- `@aws-sdk/client-cost-explorer ^3.600.0`
- `@repo/security` (AES-256-GCM credential storage)
- Inngest 4.4 (pipeline + retries)
- Upstash Redis (tag rule cache, dedup lock)

---

## Definition of Done

- [ ] `BillingEntry` FOCUS 1.1 compliant schema with composite unique key
- [ ] Nightly Inngest cron + manual trigger
- [ ] Idempotent upsert (no duplicates on re-run)
- [ ] Exponential backoff on AWS 429 (5 retries, 2s start)
- [ ] 30-day chunked backfill with resumable cursor
- [ ] Tag rules engine: first-match-wins, priority ordering
- [ ] `BillingEntryAllocation` created per matched rule
- [ ] Multi-account: independent sync jobs per integration
- [ ] Read-only IAM validation on setup
- [ ] Credentials AES-256-GCM encrypted, never returned to client
- [ ] Unit tests: idempotent upsert, tag rule priority, backoff logic, FOCUS 1.1 fields
