# Story 024 — Linear SAFe-Aware Two-Way Sync

**Epic:** 007 — Solution Train & Advanced Features
**Feature:** F-007-004 Integration Layer
**WSJF:** 9.0 (userValue=7, timeValue=6, riskReduction=5, jobSize=2)
**Story Points:** 8
**Priority:** Must Have
**Status:** DEFINED

---

## User Story

**As a** Developer,
**I want** bidirectional SAFe-aware sync between Linear and Cosmos, where Cosmos holds the SAFe hierarchy and Linear holds the engineering execution state,
**so that** I can work in Linear while the portfolio team sees the SAFe context in Cosmos without migrating my Linear team.

---

## Acceptance Criteria

### AC-001: Linear status change syncs to Cosmos Story
Given a developer sets a Linear issue to "Done",
When the Linear webhook is processed,
Then:
- The mapped Cosmos Story status changes to DONE within 5s
- A `SyncLog` entry records the sync with `source=LINEAR`, `direction=INBOUND`
- `StateTransitionHistory` shows the transition with `userId=null` and `externalRef=<linearIssueId>`

### AC-002: Cosmos WSJF and SAFe hierarchy NOT overwritten by Linear
Given a PM updates a feature's WSJF score in Cosmos,
When a Linear webhook later fires for the same issue (with no WSJF data),
Then:
- `Feature.wsjfScore` is unchanged
- `Feature.strategicThemeId` is unchanged
- Only fields in the LINEAR_WINS merge policy (status, assignee, cycle) are updated

### AC-003: Webhook HMAC validation blocks invalid signatures
Given a webhook arrives at `POST /api/webhooks/linear` with an invalid `linear-signature` header,
When the handler processes,
Then:
- HTTP 401 is returned within 200ms
- No data is modified
- An `AuditLog` entry is written: `action=webhook.signature_invalid`, `actorIp`, `timestamp`

### AC-004: PAUSED integration queues to DLQ
Given a Linear integration is paused by an admin,
When a Linear webhook arrives,
Then:
- HTTP 200 is returned (no 4xx to Linear)
- The event is stored in a DLQ (dead-letter queue)
- Cosmos data is NOT modified
- DLQ entry appears in the integration management UI

### AC-005: Portfolio views work without Linear team migration
Given an org uses Linear for engineering but only wants portfolio-level SAFe views in Cosmos,
When they connect Linear without migrating teams,
Then:
- Portfolio Kanban, PI Planning, and Program Board views are fully functional
- Synced Linear items appear in the correct SAFe hierarchy without requiring team migration
- Un-mapped Linear teams land in a "Holding Area" — not blocking portfolio function

### AC-006: Full pull with cursor-resumable pagination
Given an org has 2,000 Linear issues to sync,
When the initial full-pull sync is triggered,
Then:
- Items are fetched 250 per page
- On interruption at cursor 500: retry resumes from item 501
- Final `BillingSyncRun.itemsProcessed = 2,000`, no gaps

### AC-007: Outbound push — Cosmos status to Linear
Given a Cosmos Story moves from IN_REVIEW to DONE via the sprint board,
When the outbound sync job runs,
Then:
- Linear issue status is updated to the mapped state within 10s
- Only `cosmos:*` namespaced labels and milestones are created/updated in Linear
- Non-`cosmos:` labels and milestones are preserved untouched

### AC-008: Conflict resolution UI
Given a field is set to COSMOS_WINS policy but Linear sent an update for it,
When the webhook processes,
Then:
- Linear's value is rejected (Cosmos field unchanged)
- A `SyncLog` entry records `action=SKIPPED`, `field`, `linearValue`, `cosmosValue`
- The conflict is visible in the "Integration Sync Log" UI for the RTE to review

---

## Technical Notes

### Merge Policy

```typescript
type FieldMergePolicy = 'LINEAR_WINS' | 'COSMOS_WINS' | 'LAST_WRITE_WINS'

const DEFAULT_LINEAR_FIELD_POLICY: Record<string, FieldMergePolicy> = {
  status: 'LINEAR_WINS',
  assigneeId: 'LINEAR_WINS',
  cycleId: 'LINEAR_WINS',
  title: 'LAST_WRITE_WINS',
  // SAFe fields — always COSMOS_WINS
  wsjfScore: 'COSMOS_WINS',
  investScore: 'COSMOS_WINS',
  strategicThemeId: 'COSMOS_WINS',
  piPlanId: 'COSMOS_WINS',
  featureId: 'COSMOS_WINS',
}
```

### Webhook Handler Architecture

```typescript
// apps/app/app/api/webhooks/linear/route.ts
export async function POST(req: Request) {
  // 1. Buffer raw body BEFORE any parsing (HMAC requires raw body)
  const rawBody = await req.text()

  // 2. HMAC validation (constant-time comparison)
  const signature = req.headers.get('linear-signature')
  const isValid = await verifyLinearHmac(rawBody, signature, integrationSecret)
  if (!isValid) {
    await writeAuditLog('webhook.signature_invalid', { actorIp: getIp(req) })
    return Response.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // 3. Parse body after validation
  const event = JSON.parse(rawBody)

  // 4. Redis idempotency SETNX (48h TTL)
  const deduped = await redis.set(`webhook:linear:${event.webhookId}`, '1', { nx: true, ex: 172800 })
  if (!deduped) return Response.json({ ok: true }) // already processed

  // 5. Enqueue to Inngest (ack within 200ms total)
  await inngest.send({ name: 'integration/linear.webhook', data: event })
  return Response.json({ ok: true })
}
```

### SyncLog Model

```prisma
model SyncLog {
  id              String   @id @default(cuid())
  orgId           String
  integrationId   String
  direction       String   // INBOUND|OUTBOUND
  source          String   // LINEAR|GITHUB|COSMOS
  action          String   // CREATED|UPDATED|SKIPPED|FAILED
  entityType      String
  entityId        String
  externalId      String?
  payload         Json?
  cursor          String?
  createdAt       DateTime @default(now())
  @@index([orgId, integrationId, createdAt])
}
```

---

## Dependencies

- `Integration` model with XState lifecycle (Story-007)
- `@repo/webhooks` for HMAC verification utilities
- `@repo/security` for credential decryption
- Inngest for async processing (< 200ms webhook ack)
- Upstash Redis for idempotency (SETNX 48h)
- Epic 006 Story + Feature models

---

## Definition of Done

- [ ] Bidirectional sync: Linear→Cosmos status, Cosmos→Linear status
- [ ] Merge policy per field (LINEAR_WINS / COSMOS_WINS / LAST_WRITE_WINS)
- [ ] SAFe fields always COSMOS_WINS (WSJF, themes, PI context)
- [ ] Webhook handler: raw body buffer → HMAC → Redis dedup → Inngest ack <200ms
- [ ] PAUSED integration → DLQ (no data mutation, HTTP 200 to Linear)
- [ ] Full pull: 250/page cursor-resumable, handles 2k+ issues
- [ ] Outbound push: only `cosmos:*` namespace writes to Linear
- [ ] Portfolio views functional without Linear team migration
- [ ] Conflict resolution UI with SyncLog SKIPPED entries
- [ ] `StateTransitionHistory` with `externalRef` for inbound transitions
- [ ] Unit tests: HMAC validation, merge policy, dedup idempotency, PAUSED DLQ
