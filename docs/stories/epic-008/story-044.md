# Story 044 — Onboarding, Platform Health Dashboard & Multi-Org Support

**Epic:** 008 — Enterprise & Scale
**Feature:** F-008-011 Platform Operations
**WSJF:** 6.0 (userValue=6, timeValue=5, riskReduction=3, jobSize=2)
**Story Points:** 5
**Priority:** Should Have
**Status:** DEFINED

---

## User Story

**As a** Platform Admin,
**I want** an onboarding wizard for new tenants, a platform health dashboard for system-wide monitoring, and multi-org user support (single user in multiple orgs),
**so that** onboarding is guided, platform health is visible, and enterprise users who manage multiple teams aren't forced to use multiple accounts.

---

## Acceptance Criteria

### AC-001: Onboarding wizard completes in < 5 minutes
Given a new Org Admin signs up,
When the onboarding wizard launches,
Then:
- Step 1: Organization name + terminology + timezone (2 min)
- Step 2: First ART setup (name + teams) (1.5 min)
- Step 3: Invite ≥1 team member (invite by email) (30s)
- Step 4: Connect optional integration (Linear/GitHub/skip) (1 min)
- Completing all 4 steps marks `onboardingCompleted=true` on the org
- A "Setup Complete" email is sent to the Org Admin

### AC-002: Wizard progress persisted across sessions
Given the Org Admin completes steps 1 and 2, then closes the browser,
When they return the next day,
Then:
- The wizard reopens at step 3 (persisted in `Org.onboardingState` JSON)
- Completed steps are shown with a green checkmark
- No data re-entry required

### AC-003: Platform health dashboard — 6 core metrics
Given the Platform Admin opens the health dashboard,
When viewing current metrics,
Then:
- Database: connection pool usage % + p95 query latency
- Inngest: active jobs count, error rate, DLQ depth
- Liveblocks: active rooms count, total presence users
- Redis: memory usage %, hit rate %
- API: p95 latency per route (top 10 slowest)
- Error rate: Sentry error count last 24h

### AC-004: Health dashboard auto-refresh every 30s
Given the Platform Admin is viewing the health dashboard,
When 30s elapse,
Then:
- All 6 metric panels refresh automatically
- No full page reload (SWR or polling)
- Stale data is indicated if the refresh fails

### AC-005: Multi-org user — org switcher
Given user U is a member of org_A (SCRUM_MASTER) and org_B (VIEWER),
When U clicks the org switcher in the navigation,
Then:
- Both orgs are listed with their role displayed
- Selecting org_B: session context switches to org_B with VIEWER role
- No logout required
- URL changes to `/{orgSlug}/dashboard`
- RLS context switches to org_B orgId immediately

### AC-006: Per-org notification preferences (multi-org)
Given user U is in org_A and org_B,
When U configures notification preferences,
Then:
- Preferences are per-org (org_A: anomaly digest only; org_B: immediate)
- Switching org does not affect the other org's preferences
- The notification settings page shows which org is currently being configured

### AC-007: Platform Admin — org usage metrics
Given the Platform Admin opens the Org Management panel,
When viewing org list,
Then:
- Each org shows: member count, ART count, active Sprint count, storage usage (estimated)
- Search by org name or ID
- Export CSV of all orgs and their metrics

### AC-008: Graceful degradation — Inngest unavailable
Given Inngest service is unreachable (network partition),
When a background job (e.g. billing sync) is triggered,
Then:
- The job is queued in a PostgreSQL fallback table `JobFallbackQueue`
- User sees: "Background processing is temporarily delayed. Your changes are saved."
- When Inngest recovers: fallback queue is drained automatically
- Zero data loss (all triggered jobs eventually execute)

---

## Technical Notes

### Onboarding State Machine

```typescript
// packages/onboarding/src/wizard-machine.ts
const ONBOARDING_STEPS = ['org-setup', 'art-setup', 'invite-members', 'connect-integration'] as const
type OnboardingStep = typeof ONBOARDING_STEPS[number]

// Persisted to Org.onboardingState as JSON
type OnboardingState = {
  currentStep: OnboardingStep
  completedSteps: OnboardingStep[]
  data: {
    orgName?: string
    artId?: string
    invitedEmails?: string[]
    integrationConnected?: boolean
  }
}
```

### Multi-Org Session Context Switch

```typescript
// apps/app/app/actions/auth/switch-org.ts
export const switchOrg = withSecureAction({
  schema: z.object({ targetOrgId: z.string() }),
  requiredPermission: null, // no special permission needed to switch to own org
  execute: async ({ targetOrgId }, session) => {
    // Verify user is a member of targetOrgId
    const membership = await prisma.orgMember.findFirst({
      where: { userId: session.userId, orgId: targetOrgId }
    })
    if (!membership) throw new ForbiddenError({ message: 'Not a member of this org' })

    // Update session active org (Better Auth session update)
    await updateSessionActiveOrg(session.sessionId, targetOrgId)

    // Redis: cache new org context (for RLS middleware)
    await redis.set(`session:org:${session.sessionId}`, targetOrgId, { ex: 3600 })

    return { success: true, orgId: targetOrgId, role: membership.role }
  }
})
```

### Platform Health API

```typescript
// apps/app/app/api/platform/health/route.ts
// Platform Admin only — requires PLATFORM_ADMIN role
export async function GET(req: Request) {
  const [dbHealth, inngestHealth, liveblocksHealth, redisHealth] = await Promise.allSettled([
    getDbHealthMetrics(),
    getInngestMetrics(),
    getLiveblocksMetrics(),
    getRedisMetrics(),
  ])

  return Response.json({
    db: dbHealth.status === 'fulfilled' ? dbHealth.value : { error: 'unavailable' },
    inngest: inngestHealth.status === 'fulfilled' ? inngestHealth.value : { error: 'unavailable' },
    liveblocks: liveblocksHealth.status === 'fulfilled' ? liveblocksHealth.value : { error: 'unavailable' },
    redis: redisHealth.status === 'fulfilled' ? redisHealth.value : { error: 'unavailable' },
    fetchedAt: new Date().toISOString(),
  })
}
```

---

## Dependencies

- `Org.onboardingState` field (JSON)
- Better Auth multi-session / org-switching
- `JobFallbackQueue` model (Inngest degradation)
- `@repo/platform-admin` (health metrics aggregation)
- `@repo/notifications`

---

## Definition of Done

- [ ] Onboarding wizard: 4 steps, progress persisted to `Org.onboardingState`
- [ ] Wizard resumable across sessions (no re-entry)
- [ ] Onboarding completion email to Org Admin
- [ ] Platform health dashboard: 6 metric panels (DB, Inngest, Liveblocks, Redis, API, Errors)
- [ ] 30s auto-refresh with SWR polling
- [ ] Multi-org support: org switcher, per-org session context, no logout required
- [ ] RLS context switches immediately on org switch
- [ ] Per-org notification preferences
- [ ] Platform Admin org usage metrics + CSV export
- [ ] Inngest degradation: `JobFallbackQueue` + auto-drain on recovery
- [ ] Unit tests: onboarding step persistence, org switch membership check, health metric aggregation, fallback queue drain
