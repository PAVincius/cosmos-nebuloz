# Story 035 — Webhook Pipeline Reliability, Sync Logs & Integration Lifecycle

**Epic:** 007 — Solution Train & Advanced Features
**Feature:** F-007-015 Integration Reliability
**WSJF:** 6.0 (userValue=5, timeValue=5, riskReduction=4, jobGroup=2)
**Story Points:** 5
**Priority:** Must Have
**Status:** DEFINED

---

## User Story

**As an** Org Admin,
**I want** reliable webhook delivery with DLQ management, resumable sync cursors, and clear integration health monitoring,
**so that** integration failures are visible, recoverable, and don't silently lose data.

---

## Acceptance Criteria

### AC-001: Webhook ack < 200ms with idempotency
Given a Linear webhook arrives,
When processed,
Then:
- HTTP 200 is returned within 200ms
- HMAC is validated, idempotency SETNX checked, Inngest job enqueued — all within the 200ms budget
- Duplicate event (same webhookId within 48h) returns 200 within 100ms with no processing

### AC-002: DLQ after 5 failed retries
Given an Inngest worker fails to process a webhook event 5 consecutive times (e.g., external API timeout),
When the 5th attempt fails,
Then:
- The event appears in the DLQ UI within 30s
- The RTE/admin is notified: "Integration sync failure — {n} events in DLQ"
- No 6th attempt is made

### AC-003: DLQ retry and discard actions
Given 3 events in the DLQ,
When the admin clicks "Retry All",
Then:
- All 3 events are re-enqueued as new Inngest jobs
- Their DLQ status changes to RETRYING

When the admin clicks "Discard" on one event,
Then:
- That event is permanently discarded with a `discardedBy` and timestamp
- An `AuditLog` entry records the discard

### AC-004: Cursor-resumable sync
Given a full-pull sync interrupted at cursor 500/2,000,
When the retry job fires,
Then:
- Sync resumes from item 501 (not from the beginning)
- `BillingSyncRun.cursor = "500"` was persisted at interruption
- Final `BillingSyncRun.itemsProcessed = 2,000` after completion

### AC-005: Delta sync every 4h with 5-min overlap
Given a Linear integration is active,
When the scheduled delta sync fires every 4h,
Then:
- Sync fetches changes from `lastSyncedAt - 5min` (overlap prevents missed events)
- Only changed items (not the full dataset) are processed
- `Integration.lastSyncedAt` is updated on successful completion

### AC-006: Webhook health monitoring and auto re-registration
Given a webhook endpoint returns 5xx for 3 consecutive attempts over 15 min,
When the health monitor runs,
Then:
- Integration health status changes to `DEGRADED`
- An auto re-registration is attempted for the webhook endpoint
- RTE is notified if re-registration fails

### AC-007: Field mapping versioning (last 5 restorable)
Given an integration field mapping is updated,
When the new version is saved,
Then:
- Previous version is preserved as version N-1 (max 5 versions retained)
- A "Restore version N-1" option appears in the mapping history panel
- Restoring a version creates a new version record (not overwriting)

### AC-008: Per-IP rate limit (1,000/min)
Given an IP address sends 1,001 webhook requests in 60 seconds,
When the 1,001st arrives,
Then:
- HTTP 429 `{code: "RATE_LIMIT_EXCEEDED", scope: "per_ip", limit: 1000, resetAt: "<ISO>"}`
- The IP is logged in abuse detection with `source=WEBHOOK`
- No Inngest job is enqueued for the rate-limited request

---

## Technical Notes

### DLQ Model

```prisma
model WebhookDLQEntry {
  id              String   @id @default(cuid())
  orgId           String
  integrationId   String
  eventId         String   // original webhook event ID
  source          String   // LINEAR|GITHUB|CUSTOM
  payload         Json
  lastError       String?
  attemptCount    Int      @default(5)
  status          String   @default("FAILED") // FAILED|RETRYING|DISCARDED
  createdAt       DateTime @default(now())
  retriedAt       DateTime?
  discardedAt     DateTime?
  discardedBy     String?
  @@index([orgId, integrationId, status])
}
```

### Cursor-Resumable Sync Pattern

```typescript
// packages/integrations/src/sync-runner.ts
export const runFullPull = async (integrationId: string, orgId: string) => {
  const run = await prisma.billingSyncRun.create({ data: { orgId, integrationId, status: 'RUNNING' } })

  let cursor: string | null = null
  let totalProcessed = 0

  do {
    try {
      const page = await fetchPage({ integrationId, cursor, pageSize: 250 })
      await processItems(page.items, orgId)
      cursor = page.nextCursor
      totalProcessed += page.items.length

      // Persist cursor: allows resumption on crash
      await prisma.billingSyncRun.update({ where: { id: run.id }, data: { cursor, entriesProcessed: totalProcessed } })
    } catch (err) {
      await prisma.billingSyncRun.update({ where: { id: run.id }, data: { status: 'ERROR', errorMessage: String(err) } })
      throw err
    }
  } while (cursor !== null)

  await prisma.billingSyncRun.update({ where: { id: run.id }, data: { status: 'COMPLETE', completedAt: new Date() } })
}
```

### Integration XState Lifecycle

```typescript
export const integrationMachine = createMachine({
  id: 'integration',
  initial: 'PENDING',
  states: {
    PENDING: { on: { ACTIVATE: 'ACTIVE', REVOKE: 'REVOKED' } },
    ACTIVE: { on: { PAUSE: 'PAUSED', REVOKE: 'REVOKED', ERROR: 'ERROR' } },
    PAUSED: { on: { RESUME: 'ACTIVE', REVOKE: 'REVOKED' } },
    ERROR: { on: { RETRY: 'ACTIVE', REVOKE: 'REVOKED' } },
    REVOKED: { type: 'final' },
  },
})
```

---

## Dependencies

- `SyncLog`, `BillingSyncRun`, `Integration` models
- Inngest (retry policy, DLQ handling)
- Upstash Redis (idempotency SETNX, rate limiting)
- `@repo/webhooks` (HMAC utilities)
- `@repo/audit`
- Epic 007 Stories 024/025 (Linear + GitHub webhook handlers)

---

## Definition of Done

- [ ] Webhook ack < 200ms (HMAC → Redis dedup → Inngest enqueue)
- [ ] 48h idempotency SETNX (100ms on duplicate)
- [ ] DLQ after 5 failed retries + admin notification
- [ ] DLQ retry/discard UI with `AuditLog` for discards
- [ ] Cursor-resumable sync with `BillingSyncRun.cursor` persistence
- [ ] Delta sync every 4h with 5-min overlap
- [ ] Webhook health monitoring + auto re-registration
- [ ] Field mapping versioning (last 5, restorable)
- [ ] Per-IP rate limit 1,000/min (429 + abuse log)
- [ ] Integration XState lifecycle (PENDING/ACTIVE/PAUSED/ERROR/REVOKED)
- [ ] Unit tests: cursor resumption, DLQ retry, idempotency, rate limit
