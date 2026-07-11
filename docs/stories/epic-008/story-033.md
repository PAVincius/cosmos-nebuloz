# Story 033 — Tenant Administration, Member Management & TOTP 2FA

**Epic:** 008 — Enterprise & Scale
**Feature:** F-008-003 Tenant Administration
**WSJF:** 8.0 (userValue=7, timeValue=6, riskReduction=4, jobSize=2)
**Story Points:** 8
**Priority:** Must Have
**Status:** DEFINED

---

## User Story

**As an** Org Admin,
**I want** complete tenant settings management, member lifecycle controls (invite/role-change/remove), and TOTP 2FA enforcement,
**so that** my organization's access and security posture is under full administrative control.

---

## Acceptance Criteria

### AC-001: Terminology customization propagates everywhere
Given an Org Admin changes "PI" to "Program Cycle" in the terminology map,
When any user views any page, notification, or export in that org,
Then:
- All labels showing "PI" now show "Program Cycle"
- SAFe canonical enum values in the DB (e.g., `PLANNING`, `COMMITTED`) are unchanged
- PT-BR translation of "Program Cycle" is also updated automatically

### AC-002: Member removal revokes sessions within 60s
Given an Org Admin removes member M,
When removal is confirmed with work reassignment,
Then:
- M's active sessions are invalidated within 60s
- Open Impediments assigned to M show "Unassigned" with an admin notification to reassign
- M receives a "Your account access has been removed" email
- No 5xx errors occur if M makes a request after removal

### AC-003: Last-admin demotion blocked
Given an org has only 1 ORG_ADMIN,
When that admin attempts to demote themselves or another admin removes them,
Then:
- HTTP 409 `{code: "LAST_ADMIN_BLOCKED", message: "Cannot remove the last admin — promote another member first"}`
- Role unchanged

### AC-004: Bulk invite CSV processing
Given an Org Admin uploads a CSV with: 10 valid rows + 2 rows with existing emails + 1 row with invalid email format,
When bulk invite processes,
Then:
- 10 invitations are sent (within 5 min)
- A summary report shows: 10 sent, 2 "already a member", 1 "invalid email"
- The report is downloadable as CSV
- No partial failure halts the valid invites

### AC-005: TOTP enrollment via QR code
Given a user opens the 2FA setup page and scans the QR code,
When they submit a valid TOTP code from their authenticator app,
Then:
- 2FA is enabled for their account
- 8 backup codes are displayed once (bcrypt-hashed in DB, never shown again)
- All existing sessions except the current one are invalidated
- An `AuditLog` entry: `action=auth.2fa.enabled`

### AC-006: 2FA policy enforcement with grace period
Given an org with `require2FA=true` and `gracePeriodDays=7`,
When a user with 2FA disabled attempts to log in on day 8,
Then:
- Login is blocked with: "Two-factor authentication is required for your organization. Set it up to continue."
- Link to the 2FA setup page is provided
- On days 1–7: login succeeds but a warning banner is shown

### AC-007: Session revocation from profile page
Given a user views their "Active Sessions" list showing 3 devices,
When they click "Revoke" on a specific device,
Then:
- That device's session token is invalidated within 10s
- The device receives a 401 on the next request
- The "Sessions" list refreshes without the revoked device
- An `AuditLog` entry records the revocation

### AC-008: Admin security policy IP allowlist
Given `allowedIpRanges=["10.0.0.0/8"]` and a request from `203.0.113.42`,
When middleware evaluates the request,
Then:
- HTTP 403 `{code: "IP_NOT_ALLOWED", message: "Access denied: your IP is not in the allowed range"}`
- An `AuditLog` entry records the blocked IP and requesting userId (if authenticated)

---

## Technical Notes

### Terminology Map

```typescript
// packages/i18n/src/terminology.ts
type TenantTerminologyMap = {
  PI?: string          // default: "PI"
  ART?: string         // default: "ART"
  Sprint?: string      // default: "Sprint"
  Retrospective?: string
  // ... all SAFe artifact names
}

// Resolved in rendering: t('PI', terminology) → terminology.PI ?? 'PI'
// Translations for custom terms auto-computed from base PT-BR/ES mappings
```

### Session Invalidation

```typescript
// packages/auth/src/session-revocation.ts
export const revokeAllUserSessions = async (userId: string): Promise<void> => {
  // Better Auth: revoke all sessions for the user
  await auth.revokeUserSessions({ userId })
  // Redis: set revocation flag for immediate enforcement
  await redis.set(`session:revoked:user:${userId}`, '1', { ex: 86400 })
}

// Middleware: check revocation flag on every request
const isRevoked = await redis.get(`session:revoked:user:${session.userId}`)
if (isRevoked) return Response.json({ error: 'Session revoked' }, { status: 401 })
```

### TOTP with Better Auth

```typescript
// apps/app/app/api/auth/totp/enable/route.ts
export async function POST(req: Request) {
  const session = await requireSession(req)
  const { token } = await req.json()

  // Better Auth totp plugin
  const result = await auth.api.enableTOTP({ body: { token }, headers: req.headers })
  if (!result.success) return Response.json({ error: 'Invalid TOTP code' }, { status: 422 })

  // Generate 8 backup codes
  const backupCodes = Array.from({ length: 8 }, () => generateSecureCode())
  const hashedCodes = await Promise.all(backupCodes.map(c => bcrypt.hash(c, 10)))
  await prisma.user.update({ where: { id: session.userId }, data: { backupCodesHashed: hashedCodes } })

  // Revoke all other sessions
  await revokeOtherSessions(session.userId, session.sessionId)

  await writeAuditLog({ action: 'auth.2fa.enabled', actorId: session.userId, orgId: session.orgId })

  return Response.json({ backupCodes }) // shown once only
}
```

---

## Dependencies

- Better Auth `totp` plugin + session management
- `TenantSecurityPolicy`, `TenantMember`, `Invitation` models
- `@repo/auth/server` (session invalidation)
- `@repo/notifications`
- `@repo/audit`
- Middleware (IP allowlist check)

---

## Definition of Done

- [ ] Tenant settings: terminology map propagated across all UI/notifications/exports
- [ ] Onboarding wizard (ART + team + ≥1 member + integration)
- [ ] Member invitation (single + bulk CSV with summary report)
- [ ] Invite expiry 7 days + resend/cancel
- [ ] Role change with last-admin guard (409)
- [ ] Member removal: session revocation ≤60s + work reassignment + email
- [ ] TOTP enrollment: QR code + backup codes (displayed once) + session revocation
- [ ] 2FA policy enforcement with configurable grace period
- [ ] Admin IP allowlist enforcement in middleware
- [ ] Session management: active session list + per-device revocation ≤10s
- [ ] All admin actions written to `AuditLog`
- [ ] Unit tests: last-admin guard, bulk invite dedup, TOTP enrollment, session revocation, IP allowlist
