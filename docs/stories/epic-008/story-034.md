# Story 034 — Audit Logging, LGPD Compliance & Tenant Data Isolation

**Epic:** 008 — Enterprise & Scale
**Feature:** F-008-004 Compliance & Data Security
**WSJF:** 12.0 (userValue=8, timeValue=8, riskReduction=8, jobSize=2)
**Story Points:** 8
**Priority:** Must Have
**Status:** DEFINED

---

## User Story

**As a** Compliance Officer,
**I want** an immutable audit trail, LGPD data subject request processing, and verified multi-tenant data isolation,
**so that** the platform meets SOC2 Type I controls, LGPD Art. 18 requirements, and passes the annual security audit.

---

## Acceptance Criteria

### AC-001: AuditLog DELETE blocked by DB trigger
Given any attempt to DELETE a row from `AuditLog`,
When executed (via API or direct DB),
Then:
- DB trigger raises an exception: "AuditLog entries are immutable — deletion not permitted"
- API returns 405 (no delete route exists)
- Zero rows are deleted

### AC-002: SOC2 JSONL export for date range
Given a Compliance Officer requests a SOC2 audit export for 2026-Q1,
When the export completes,
Then:
- JSONL file contains all `AuditLog` entries with `timestamp` in Q1 2026
- Sorted by `timestamp` ascending
- No gaps in traceId sequences within a single request
- Export request itself is logged in `AuditLog`

### AC-003: LGPD erasure request processed ≤72h
Given a user submits a data erasure request (LGPD Art. 18),
When the Inngest DSR pipeline runs,
Then:
- All user-attributed PII fields are replaced with `{subject_anonymized_[sha256hash]}`
- Structural records (state transitions, approvals, scores) are retained with the pseudonymized token
- Completed within 72h of submission
- User receives a confirmation email when complete

### AC-004: LGPD portability export scoped to subject
Given a user requests a portability export of their data,
When the export is generated,
Then:
- JSON contains only data directly attributable to the requesting user (their standups, their actions, their profile)
- No org-wide data (epics, ARTs, PI data not authored by them) is included
- Export is machine-readable JSON compliant with LGPD Art. 18.IV

### AC-005: RLS cross-tenant isolation verified
Given Tenant A and Tenant B both have epics with ID overlap,
When Tenant A's session queries the epics API,
Then:
- Only Tenant A's epics are returned (verified by EXPLAIN plan showing `org_id` filter from RLS)
- No Tenant B data is accessible even if IDs match
- `FORCE ROW LEVEL SECURITY` is active on the `Epic` table

### AC-006: Raw SQL without orgId returns zero rows (RLS enforced)
Given a raw SQL query executes WITHOUT calling `set_config('app.current_org_id', ...)`,
When the query runs,
Then:
- RLS policy `USING (org_id = current_setting('app.current_org_id')::text)` returns empty result
- No exception is thrown — zero rows returned
- Application layer treats this as unauthorized (not a crash)

### AC-007: Monthly cross-tenant isolation audit report
Given the monthly isolation audit job runs,
When it completes,
Then:
- Report shows: RLS active on all tables (verified via `pg_policies` query), no policies bypassed
- Any tables missing RLS policy are flagged as CRITICAL findings
- Report is stored and accessible to ORG_ADMIN/Platform Admin

### AC-008: AuditLog high-volume pagination (1M entries/month)
Given an org with 1M audit entries per month,
When the audit feed API is queried with cursor pagination,
Then:
- Last 100 entries render within 2s via cursor-based pagination
- API supports `limit=100`, `cursor=<lastSeenId>`, `after=<timestamp>`, `action=<filter>` params
- No full-table scans (index `(orgId, createdAt)` used)

---

## Technical Notes

### AuditLog Immutability Trigger

```sql
CREATE OR REPLACE FUNCTION prevent_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog entries are immutable. Operation: %, Entry ID: %', TG_OP, OLD.id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_immutable
BEFORE UPDATE OR DELETE ON "AuditLog"
FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();
```

### RLS Policy (all tables)

```sql
-- Applied to every table in the schema
ALTER TABLE "Epic" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Epic" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_policy" ON "Epic"
  USING (org_id = current_setting('app.current_org_id', true)::text);

-- The 'true' flag in current_setting returns NULL instead of error when not set
-- NULL ≠ any org_id → zero rows returned (safe fallback)
```

### Prisma Middleware (sets org context)

```typescript
// packages/database/src/client.ts
prisma.$use(async (params, next) => {
  if (params.args?.__ctx?.orgId) {
    await prisma.$executeRawUnsafe(
      `SELECT set_config('app.current_org_id', '${params.args.__ctx.orgId}', true)`
    )
  }
  return next(params)
})
```

### LGPD DSR Pipeline (Inngest)

```typescript
export const processErasureRequest = inngest.createFunction(
  { id: 'lgpd-erasure', retries: 3 },
  { event: 'lgpd/erasure.requested' },
  async ({ event, step }) => {
    const { subjectId, orgId, requestId } = event.data
    const hash = sha256(subjectId)
    const replacement = `{subject_anonymized_${hash}}`

    // Pseudonymize PII fields (preserve structural records)
    await step.run('anonymize-user-profile', () =>
      prisma.user.update({ where: { id: subjectId }, data: { name: replacement, email: `${hash}@erased.cosmos`, phone: null } })
    )

    await step.run('anonymize-standup-entries', () =>
      prisma.standupEntry.updateMany({ where: { userId: subjectId, orgId }, data: { yesterday: replacement, today: replacement, blockers: replacement } })
    )

    await step.run('anonymize-copilot-sessions', () =>
      prisma.copilotMessage.updateMany({ where: { session: { userId: subjectId, orgId } }, data: { content: '[Erased: LGPD Art.18 request]' } })
    )

    await prisma.dataSubjectRequest.update({ where: { id: requestId }, data: { status: 'COMPLETED', processedAt: new Date() } })
    await sendCompletionEmail(subjectId)
  }
)
```

---

## Dependencies

- `AuditLog`, `DataSubjectRequest` models
- PostgreSQL RLS (`FORCE ROW LEVEL SECURITY` on all tables)
- Prisma middleware (`@repo/database`)
- Inngest (DSR processing pipeline)
- `@repo/audit`

---

## Definition of Done

- [ ] `AuditLog` DB trigger: DELETE/UPDATE blocked unconditionally
- [ ] SOC2 JSONL export with date range filter + self-logging
- [ ] `DataSubjectRequest` lifecycle: PENDING → IN_PROGRESS → COMPLETED ≤72h
- [ ] LGPD erasure: pseudonymize PII, retain structural records
- [ ] LGPD portability export: subject-scoped JSON only
- [ ] RLS `FORCE ROW LEVEL SECURITY` on all tables with `current_setting` policy
- [ ] Prisma middleware sets `app.current_org_id` on every request
- [ ] Cross-tenant isolation verified (EXPLAIN plan + monthly audit report)
- [ ] Cursor-paginated audit feed (≤2s for last 100 entries on 1M rows)
- [ ] Unit tests: immutability trigger, RLS zero-row fallback, erasure pipeline, portability scope
