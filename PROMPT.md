# Cosmos/Nebuloz — 90-Day Remediation Loop

You are an autonomous agent executing a security and engineering remediation plan for the Cosmos/Nebuloz SaaS platform. The platform is a Next.js 15 + Turborepo monorepo with multi-tenant SAFe planning features.

**Your job each iteration:**
1. Read the git log to determine what has already been completed
2. Find the highest-priority incomplete item from the checklist below
3. Implement the fix fully and correctly
4. Run type checks / lint to verify no regressions
5. Commit with a descriptive message
6. If ALL items are complete, output `<promise>REMEDIATION COMPLETE</promise>`

---

## How to assess progress

```bash
git log --oneline --format="%s" | head -40
```

Each completed item will have a commit message starting with `fix(remediation):` followed by the item ID (e.g., `fix(remediation): C1 remove liveblocks wildcard grant`).

Items not in the git log are incomplete. Always work the highest-priority incomplete item.

---

## Root path

```
/Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz
```

---

## SPRINT 1 — CRITICAL (must complete first, in order)

### C1 — Remove Liveblocks wildcard grant
**File:** `packages/collaboration/auth.ts` line 30
**Fix:** Delete `session.allow('*', session.FULL_ACCESS)`. Keep only the orgId-scoped grant.
**Why:** Active cross-tenant breach — any user can read/write any tenant's Liveblocks rooms.
**Verify:** File contains exactly one `session.allow(` call after fix.
**Commit:** `fix(remediation): C1 remove liveblocks wildcard grant`

---

### C2 — Encrypt third-party credentials at rest
**Files:**
- `apps/app/app/api/migration/[source]/connect/route.ts`
- `apps/app/app/actions/integrations/index.ts`

**Fix:** Before storing integration credentials (Jira API token, Azure PAT, GitHub token, Trello key/token, Slack webhook URL), encrypt the secret fields using a symmetric key from `process.env.ENCRYPTION_KEY`. Use Node.js `crypto.createCipheriv('aes-256-gcm', ...)`. Store as `{ iv, authTag, ciphertext }` JSON. Add a `packages/security/encrypt.ts` utility with `encryptSecret(plaintext: string): string` and `decryptSecret(ciphertext: string): string`. Use this in connect route before upsert, and in integrations read path before returning config to callers.

**Commit:** `fix(remediation): C2 encrypt third-party credentials at rest`

---

### C3 — BETTER_AUTH_SECRET runtime guard
**File:** `packages/auth/server.ts`
**Fix:** Before the `betterAuth({...})` call, add:
```typescript
const authSecret = process.env.BETTER_AUTH_SECRET
if (!authSecret || authSecret.length < 32) {
  throw new Error('BETTER_AUTH_SECRET must be at least 32 characters')
}
```
Remove the `!` non-null assertion on the env var usage.
**Commit:** `fix(remediation): C3 better_auth_secret runtime guard`

---

### C4 — Fix PDF upload: real text extraction
**File:** `apps/app/app/api/copilot/upload/route.ts`
**Fix:**
1. Add `pdf-parse` to the app's package.json dependencies
2. For files with `application/pdf` MIME type, use `pdf-parse` to extract text: `const data = await pdfParse(Buffer.from(await file.arrayBuffer())); const text = data.text;`
3. For all other text files, continue using `file.text()`
4. Add per-tenant rate limiting to the upload endpoint (max 10 uploads/hour per tenant) using the same Upstash sliding window pattern as the chat route
**Commit:** `fix(remediation): C4 pdf upload real extraction and rate limiting`

---

### C5 — Rate limiters fail-closed
**Files:**
- `apps/app/app/api/copilot/chat/route.ts`
- `apps/app/app/api/migration/[source]/import/route.ts`

**Fix:** In both files, find the rate limit wrapper/function. When `UPSTASH_REDIS_REST_URL` is absent, change from returning `true` (allow) to returning `false` (deny) and returning a 429 response. Log a warning on startup if Redis is not configured:
```typescript
if (!process.env.UPSTASH_REDIS_REST_URL) {
  console.warn('[rate-limit] UPSTASH_REDIS_REST_URL not set — rate limiting disabled (INSECURE)')
}
```
Actually for production safety, fail closed: `return false` when Redis unavailable.
**Commit:** `fix(remediation): C5 rate limiters fail-closed when redis absent`

---

### C6 — Fix broken RLS policies + FORCE ROW LEVEL SECURITY
**File:** Create new migration `packages/database/prisma/migrations/20260608000001_fix_rls_force_rls/migration.sql`

**Fix:**
1. Add `FORCE ROW LEVEL SECURITY` for all tables that have RLS enabled (check the existing RLS migration for the list)
2. Fix the 4 broken policies that reference non-existent `tenantId` columns:
   - `BillingSyncCursor` — use JOIN via `integrationId` → `Integration.tenantId`
   - `CurrencyRate` — global/shared table, remove tenantId policy entirely
   - `RiskOKR` — junction table, use JOIN via `riskId` → `Risk.tenantId`
   - `ThemeART` — junction table, use JOIN via `themeId` → `Theme.tenantId` (or StrategicTheme)
3. Add `WITH CHECK (("tenantId" = current_tenant_id()))` to all existing INSERT policies that are missing it (USING-only policies don't protect INSERT)

**Commit:** `fix(remediation): C6 force rls and fix broken policies with check clauses`

---

## SPRINT 2-3 — HIGH PRIORITY

### H1 — Migration import idempotency guard
**File:** `apps/app/app/api/migration/[source]/import/route.ts`
**Fix:** Before running `createMigrationEntities`, check if the connection already has an `importReport` or if a status field indicates it's been imported. If yes, return the cached report (200). If no, proceed and mark as imported after completion. Add a `status` field to `MigrationConnection` if not present, or use the existing `importReport` field as the idempotency signal.
**Commit:** `fix(remediation): H1 migration import idempotency guard`

---

### H2 — Fix MFA session verification
**File:** `packages/auth/server.ts` lines 193-206 (requireMfaForPrivilegedRoles)
**Fix:** After checking `user.twoFactorEnabled === true`, also assert:
```typescript
const sessionData = session.session as { twoFactorVerified?: boolean }
if (!sessionData.twoFactorVerified) {
  return { error: 'MFA verification required', status: 401 }
}
```
**Commit:** `fix(remediation): H2 mfa session verification check twoFactorVerified`

---

### H3 — Fix rate limit order in migration import (auth before rate limit)
**File:** `apps/app/app/api/migration/[source]/import/route.ts`
**Fix:** Move the `requireTenantSession` call to BEFORE the IP rate limit check. Unauthenticated requests should receive 401 before any rate limit counter is incremented.
**Commit:** `fix(remediation): H3 auth before rate limit in migration import`

---

### H4 — Add rate limiting to webhook endpoints
**Files:**
- `apps/app/app/api/webhooks/linear/route.ts`
- `apps/app/app/api/webhooks/github/route.ts`
**Fix:** Add an IP-level rate limiter (max 100 req/min per IP) using the same Upstash sliding window pattern before the HMAC verification. Return 429 on exceeded limit.
**Commit:** `fix(remediation): H4 rate limiting on webhook endpoints`

---

### H5 — Add middleware.ts for edge-level auth
**File:** Create `apps/app/middleware.ts`
**Fix:** Add Next.js middleware that protects all routes under `/(authenticated)/` and `/api/` (except `/api/auth/`, `/api/webhooks/`, `/api/health`, `/api/inngest`). Use Better Auth's session check or a lightweight cookie presence check. This ensures any future route added under the authenticated group is protected by default.
**Commit:** `fix(remediation): H5 add middleware for edge-level auth protection`

---

### H6 — Fix (database as any) in integrations
**File:** `apps/app/app/actions/integrations/index.ts`
**Fix:** Replace all 7 occurrences of `(database as any).integration.*` and `(database as any).syncLog.*` with properly typed calls. Check if `Integration` and `SyncLog` models are exported from `@repo/database`. If not, add them to the package exports. Use `database.integration.*` and `database.syncLog.*` with correct types.
**Commit:** `fix(remediation): H6 remove database as any in integrations`

---

### H7 — Add prompt injection defenses in RAG pipeline
**Files:**
- `packages/ai/lib/rag/query-rewriter.ts`
- `packages/ai/lib/rag/reranker.ts`
**Fix:**
1. Add `messages[].content` max-length validation in `apps/app/app/api/copilot/chat/route.ts` BodySchema: `content: z.string().max(10000)`
2. Add sessionId UUID format validation in upload route: `sessionId: z.string().uuid()`
3. In query-rewriter.ts, escape/truncate the user query before interpolation: `const safeQuery = original.slice(0, 500).replace(/[<>]/g, '')`
4. In reranker.ts, truncate chunk content: already uses `.slice(0,500)` but add the same escaping
**Commit:** `fix(remediation): H7 prompt injection defenses max-length and sanitization`

---

### H8 — Fix copilot upload tenant scoping
**File:** `apps/app/app/api/copilot/upload/route.ts`
**Fix:** Pass `ctx.tenantId` alongside `sessionId` to `indexDocumentChunk`. Ensure the indexer stores and filters by `tenantId` so chunks from one tenant cannot appear in another tenant's copilot context.
**Commit:** `fix(remediation): H8 scope copilot upload chunks to tenantId`

---

### H9 — Fix staleness-check cron tenantId filter
**File:** `apps/app/app/api/cron/staleness-check/route.ts`
**Fix:** The query that fetches `flowMetricSnapshot` rows must include a `tenantId` filter. If this is a cross-tenant maintenance job, implement fair-share pagination: process N rows per tenant per run, not a flat 200 across all tenants.
**Commit:** `fix(remediation): H9 staleness-check cron tenant isolation`

---

### H10 — Fix billing-sync-dispatch to use POST
**File:** `apps/app/app/api/cron/billing-sync-dispatch/route.ts`
**Fix:** Export `POST` handler instead of `GET`. Update Vercel Cron configuration (`vercel.json`) to use `POST` for this cron route. GET must not mutate state per RFC 9110.
**Commit:** `fix(remediation): H10 billing-sync-dispatch use POST not GET`

---

### H11 — Fix AuditLog cascade delete
**File:** `packages/database/prisma/schema/system.prisma`
**Fix:** Change `AuditLog` → `Tenant` relation from `onDelete: Cascade` to `onDelete: Restrict` (or `NoAction`). Add a new migration. Update tenant deletion flows to archive or soft-delete audit logs before removing the tenant record.
**Commit:** `fix(remediation): H11 audit log no cascade delete on tenant`

---

### H12 — Remove design-system → auth dependency inversion
**File:** `packages/design-system/index.tsx` (or wherever AuthProvider is imported)
**Fix:** Extract the auth provider composition into a separate `packages/shell/` package or into `apps/app/` layout. `design-system` must have zero `@repo/auth` imports. Move the provider wrapping up the dependency tree to the consumer (app-level layout).
**Commit:** `fix(remediation): H12 remove design-system auth dependency inversion`

---

## SPRINT 4-6 — MEDIUM PRIORITY

### M1 — Add loading.tsx and error.tsx to authenticated routes
**Fix:** Create the following files (each ~10 lines):
- `apps/app/app/(authenticated)/loading.tsx` — full-page skeleton
- `apps/app/app/(authenticated)/error.tsx` — error boundary with retry button
- `apps/app/app/(authenticated)/analytics/loading.tsx`
- `apps/app/app/(authenticated)/portfolio/loading.tsx`
- `apps/app/app/(authenticated)/dashboard/loading.tsx`

Use the existing `Skeleton` component from `@repo/design-system`.
**Commit:** `fix(remediation): M1 add loading and error boundaries to authenticated routes`

---

### M2 — Fix keyboard accessibility violations
**Files:**
- `apps/app/app/(authenticated)/analytics/flow/components/flow-metrics-dashboard.tsx`
- Any `session-item.tsx` file with `role='button'` divs
**Fix:** For every `role='button'` div or span: add `tabIndex={0}` and `onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.() }}`.
**Commit:** `fix(remediation): M2 keyboard accessibility tabIndex and onKeyDown on role=button`

---

### M3 — Add aria-live regions for real-time updates
**Files:** Kanban board, PI planning board components
**Fix:** Add `<div role="status" aria-live="polite" aria-atomic="true" className="sr-only">` region that announces board mutations (card moved, user joined, vote submitted). Update the text content on relevant mutations.
**Commit:** `fix(remediation): M3 aria-live regions for real-time board updates`

---

### M4 — Add Content-Security-Policy header
**File:** `packages/next-config/index.ts`
**Fix:** Add a `Content-Security-Policy` header to the `headers()` export. The policy must allow:
- `default-src 'self'`
- `connect-src 'self' wss://*.liveblocks.io https://*.liveblocks.io https://*.anthropic.com https://*.googleapis.com` (adjust for actual third-party domains)
- `script-src 'self' 'unsafe-inline'` (Next.js requires unsafe-inline for RSC; use nonce-based CSP if possible)
- `frame-ancestors 'none'`
Start with a report-only header first (`Content-Security-Policy-Report-Only`) to avoid breaking the app.
**Commit:** `fix(remediation): M4 add content-security-policy header`

---

### M5 — Replace console.error with structured logger (18 sites)
**Files:** `bpmn-wrapper.tsx`, `conflict-resolver.ts`, `linear-push.ts`, `github-push.ts`, route handlers with `console.error`
**Fix:** Replace `console.error(...)` with `import { log } from '@repo/observability/log'; log.error(...)`. Ensure each log call includes relevant context (tenantId, userId, route name as structured fields where available).
**Commit:** `fix(remediation): M5 replace console.error with structured observability logger`

---

### M6 — Replace hand-rolled skeletons with DS Skeleton component
**Fix:** Find all `animate-pulse` div patterns across page files. Replace with `import { Skeleton } from '@repo/design-system/components/ui/skeleton'`. Maintain the same layout dimensions.
**Commit:** `fix(remediation): M6 replace animate-pulse divs with Skeleton DS component`

---

### M7 — Add analytics/page.tsx KPICard deduplication
**File:** `apps/app/app/(authenticated)/analytics/page.tsx`
**Fix:** Remove the locally defined `KPICard` function. Import from `@repo/design-system/components/cosmos/kpi-card` instead.
**Commit:** `fix(remediation): M7 analytics page use shared KpiCard not local duplicate`

---

### M8 — Fix untyped String status fields (top 5 models)
**File:** `packages/database/prisma/schema/` files
**Fix:** Convert the top 5 most-used bare `String` status fields to Prisma enums:
- `CostAnomaly.status` → `CostAnomalyStatus` enum
- `BillingEntry.chargeCategory` → `ChargeCategory` enum  
- `MemberThroughputBaseline.trend` → `TrendDirection` enum
- `TeamCapacitySnapshot.teamTrend` → `TrendDirection` enum (reuse)
- `IntegrationDraft` — add `status` field as `IntegrationDraftStatus` enum

Add migration file. Update affected queries and types.
**Commit:** `fix(remediation): M8 convert top 5 string status fields to prisma enums`

---

### M9 — Fix LeanBudget dual-column normalization
**File:** `packages/database/prisma/schema/portfolio.prisma`
**Fix:** Remove the legacy `spent Float @map("spent_float_backup")` column. Keep only `spentDecimal Decimal? @map("spent")`. Rename the Prisma field to `spent` for clarity. Add a migration that drops the float backup column. Update all references from `spentDecimal` to `spent`.
**Commit:** `fix(remediation): M9 fix lean budget dual column debt remove float backup`

---

### M10 — Add FK constraint on Session.activeTenantId
**File:** `packages/database/prisma/schema/tenant.prisma`
**Fix:** Add a proper `@relation` on `Session.activeTenantId` pointing to `Tenant.id` with `onDelete: SetNull`. This ensures a tenant deletion nullifies the session reference rather than leaving a dangling string.
**Commit:** `fix(remediation): M10 add fk constraint on session activeTenantId`

---

### M11 — Fix QueryCache unbounded growth
**File:** `packages/ai/lib/rag/query-cache.ts`
**Fix:** Add automatic eviction: (1) call `evictExpired()` on every `get()` and `set()`, (2) add a `MAX_ENTRIES = 500` cap — when exceeded, evict the oldest 20% of entries by insertion order using a Map's insertion ordering.
**Commit:** `fix(remediation): M11 query cache bounded size and auto eviction`

---

### M12 — Extend logAudit coverage to critical entities
**Files:** Server actions for Story, Sprint, Risk, PIObjective
**Fix:** Add `logAudit(...)` calls on create/update/delete operations for: Story, Sprint, Risk, PIObjective. Use the existing `logAudit` function signature from `@repo/audit`. Include `action`, `entityType`, `entityId`, `tenantId`, `userId`, and a `details` object with the changed fields.
**Commit:** `fix(remediation): M12 extend audit log to story sprint risk piobjective`

---

## Completion criteria

All 24 items must have a corresponding commit in the git log matching their commit message prefix.

Verify with:
```bash
git log --oneline --format="%s" | grep "fix(remediation):" | wc -l
```

If count >= 24, output:

```
<promise>REMEDIATION COMPLETE</promise>
```

---

## Working rules

- **Read before edit:** Always read a file before modifying it
- **One item per iteration:** Complete one full item end-to-end, commit, then stop
- **Verify types:** After any TypeScript change, check for type errors with `cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz && npx tsc --noEmit 2>&1 | head -30` in the affected app/package
- **Never break existing tests:** If tests exist for a file you're changing, run them
- **Surgical edits only:** Touch only what the item requires. No refactoring adjacents.
- **Skip if blocked:** If an item requires external env or infra not available locally, add a TODO comment with the exact change needed, commit the partial scaffold, and move to the next item. Do not get stuck.
- **Commit message format:** Always `fix(remediation): <ID> <description>` exactly
