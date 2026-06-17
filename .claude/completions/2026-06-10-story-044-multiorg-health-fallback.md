# Story-044: Onboarding + Platform Health + Multi-Org

**Date:** 2026-06-10
**Commit:** 4cfe6fc0 (bundled with keyboard nav)
**Tests:** 14 passing (switch-org × 6, health × 8)

## Implemented

### AC-005 — switchOrg action
- `apps/app/app/actions/auth/switch-org.ts`
- Validates `targetTenantId` (cuid), checks TenantMember, updates `session.activeTenantId`, invalidates permission cache
- Returns `{ tenantId, role }` or structured `Err` with UNAUTHORIZED/FORBIDDEN/VALIDATION_ERROR codes

### AC-003 — Platform health API
- `apps/app/app/api/platform/health/route.ts`
- GET endpoint, ADMIN/STE only via `withSecureAction`
- `Promise.allSettled` over DB/Redis/Inngest/fallbackQueue metrics
- Returns `{ overall, metrics: { db, redis, inngest, fallbackQueue }, fetchedAt }`
- `apps/app/lib/platform/health.ts` — `aggregateSettled`, `overallStatus` helpers

### AC-008 — sendSafe + drainJobFallbackQueue
- `apps/app/lib/inngest/send-safe.ts` — wraps `inngest.send`; on failure writes `JobFallbackQueue`; never throws
- `apps/app/lib/inngest/job-fallback-drain.ts` — cron `*/5 * * * *`, batch 50, marks DONE or increments attempts (FAILED after 3)
- Both registered in `apps/app/app/api/inngest/route.ts`

## Notes
- Vitest mock resolution: use `@/` alias imports in source files (not relative `"./client"`) so `vi.mock("@/lib/inngest/client", ...)` intercepts correctly
