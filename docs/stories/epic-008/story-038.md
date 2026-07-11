# Story 038 — RBAC & Permission Enforcement

**Epic:** 008 — Enterprise & Scale
**Feature:** F-008-008 Access Control
**WSJF:** 10.0 (userValue=8, timeValue=7, riskReduction=8, jobSize=2)
**Story Points:** 8
**Priority:** Must Have
**Status:** DEFINED

---

## User Story

**As a** Security Engineer,
**I want** a centralized RBAC permission matrix enforced at every layer (middleware, server actions, RLS, UI), with SAFe role-aware access and no privilege escalation paths,
**so that** users can only access and mutate data their role permits.

---

## Acceptance Criteria

### AC-001: VIEWER cannot mutate Epics
Given a VIEWER-role user,
When they call `POST /api/epics` or `PUT /api/epics/:id`,
Then:
- HTTP 403 `{code: "INSUFFICIENT_ROLE", required: "PORTFOLIO_MANAGER", actual: "VIEWER"}`
- No DB write occurs
- `AuditLog` entry: `action=authz.denied`, `resource=epic`, `role=VIEWER`

### AC-002: Permission matrix enforced consistently at all layers
Given any API endpoint, server action, and RLS policy,
When a TEAM_MEMBER attempts to transition an Epic (portfolio-level operation),
Then:
- Middleware, `withSecureAction`, AND RLS all deny independently
- No single layer bypass grants access even if another layer is bypassed
- Defense-in-depth: 3 independent enforcement points

### AC-003: Custom role with explicit permission set
Given an Org Admin creates a custom role "BI_ANALYST" with permissions `[analytics:read, reporting:export]`,
When a user with BI_ANALYST role accesses the analytics API,
Then:
- Access granted to analytics endpoints
- Access denied to epic mutations (403)
- Custom role permissions are additive to no base permissions

### AC-004: SAFe role hierarchy enforced
Given permission hierarchy: ORG_ADMIN > RELEASE_TRAIN_ENGINEER > PRODUCT_MANAGER > SCRUM_MASTER > TEAM_MEMBER > VIEWER,
When a SCRUM_MASTER attempts a RELEASE_TRAIN_ENGINEER operation,
Then:
- HTTP 403 with required role in response
- No privilege escalation

### AC-005: ART-scoped role assignment
Given user U has role SCRUM_MASTER for ART "Platform ART" only,
When U accesses a Sprint in "Mobile ART" (a different ART),
Then:
- U has VIEWER-level access to Mobile ART (cross-ART fallback)
- U has SCRUM_MASTER access within Platform ART
- ART-scoped role checked before org-wide role

### AC-006: Permission check latency < 5ms
Given a permission check is performed via `checkPermission(userId, orgId, action, resource)`,
When the check runs,
Then:
- Response within 5ms (Redis cache hit path)
- Permission matrix cached in Redis with 5-min TTL: `perm:{orgId}:{userId}:{artId?}`
- On cache miss: DB lookup + cache populate

### AC-007: Role propagation on member addition to ART
Given an Org Admin adds user U to ART "Platform ART" with role TEAM_MEMBER,
When U logs in,
Then:
- U sees Platform ART's sprints and features
- U cannot access other ARTs' sprint details (VIEWER fallback)
- Role assignment written to `AuditLog`

### AC-008: UI permission gates hide inaccessible actions
Given a VIEWER viewing an Epic detail page,
When they view the action buttons,
Then:
- "Move to ANALYZING" button is not rendered (not just disabled)
- "Edit Epic" button is not rendered
- No 403 error needed — actions simply don't appear
- Server-side permission check still enforces even if UI is bypassed

---

## Technical Notes

### Permission Matrix

```typescript
// packages/rbac/src/matrix.ts
export const PERMISSION_MATRIX: Record<Role, Permission[]> = {
  ORG_ADMIN: ['*'], // all permissions
  RELEASE_TRAIN_ENGINEER: [
    'epic:read', 'epic:write', 'epic:transition',
    'feature:read', 'feature:write',
    'art:manage', 'pi-plan:manage',
    'governance:approve', 'budget:read', 'budget:write',
    'member:read', 'analytics:read', 'reporting:export',
  ],
  PRODUCT_MANAGER: [
    'epic:read', 'epic:write',
    'feature:read', 'feature:write',
    'story:read', 'story:write',
    'pi-plan:read', 'wsjf:write',
    'analytics:read',
  ],
  SCRUM_MASTER: [
    'feature:read', 'feature:write',
    'story:read', 'story:write',
    'sprint:manage', 'impediment:manage',
    'retro:manage', 'analytics:read',
  ],
  TEAM_MEMBER: [
    'feature:read', 'story:read', 'story:write',
    'sprint:read', 'standup:write',
  ],
  VIEWER: ['epic:read', 'feature:read', 'sprint:read', 'analytics:read'],
}

export const hasPermission = (role: Role, permission: Permission): boolean => {
  const perms = PERMISSION_MATRIX[role]
  return perms.includes('*') || perms.includes(permission)
}
```

### withSecureAction Permission Check

```typescript
// packages/security/src/secure-action.ts
export const withSecureAction = <T, R>(
  options: SecureActionOptions<T, R>
) => async (input: T): Promise<R> => {
  // 1. Session check
  const session = await requireSession()
  if (!session) throw new UnauthorizedError()

  // 2. RBAC check (Redis cache → DB fallback)
  if (options.requiredPermission) {
    const effectiveRole = await getEffectiveRole(session.userId, session.orgId, options.artId)
    if (!hasPermission(effectiveRole, options.requiredPermission)) {
      await writeAuditLog({ action: 'authz.denied', resource: options.resource, role: effectiveRole, actorId: session.userId })
      throw new ForbiddenError({ required: options.requiredPermission, actual: effectiveRole })
    }
  }

  // 3. Zod input validation
  const validated = options.schema.parse(input)

  // 4. Set RLS context
  await setOrgContext(session.orgId)

  // 5. Execute in transaction
  return prisma.$transaction(() => options.execute(validated, session))
}
```

### Effective Role Resolution (ART-scoped)

```typescript
// packages/rbac/src/resolve.ts
export const getEffectiveRole = async (userId: string, orgId: string, artId?: string): Promise<Role> => {
  const cacheKey = `perm:${orgId}:${userId}:${artId ?? 'org'}`
  const cached = await redis.get(cacheKey)
  if (cached) return cached as Role

  // ART-scoped role takes priority
  if (artId) {
    const artMembership = await prisma.artMember.findFirst({ where: { userId, artId } })
    if (artMembership) {
      await redis.set(cacheKey, artMembership.role, { ex: 300 })
      return artMembership.role
    }
  }

  // Org-wide role fallback
  const orgMembership = await prisma.orgMember.findFirst({ where: { userId, orgId } })
  const role = orgMembership?.role ?? 'VIEWER'
  await redis.set(cacheKey, role, { ex: 300 })
  return role
}
```

---

## Dependencies

- `packages/rbac` (permission matrix, role resolution)
- `packages/security` (`withSecureAction` HOF)
- Upstash Redis (permission cache, 5-min TTL)
- PostgreSQL RLS (3rd enforcement layer)
- `AuditLog` (denied access logging)

---

## Definition of Done

- [ ] Permission matrix: all 6 SAFe roles with explicit permission sets
- [ ] `withSecureAction`: RBAC check before any mutation (session→role→permission→Zod→RLS→execute)
- [ ] ART-scoped role resolution (ART membership overrides org role, VIEWER fallback)
- [ ] Custom roles with explicit permission sets
- [ ] Permission cache Redis 5-min TTL (`perm:{orgId}:{userId}:{artId?}`)
- [ ] `AuditLog` on every `authz.denied` event
- [ ] UI permission gates: inaccessible actions not rendered
- [ ] Permission check p95 < 5ms
- [ ] Defense-in-depth: middleware + HOF + RLS all enforce independently
- [ ] Unit tests: each role boundary, ART-scope override, cache hit/miss, custom role enforcement
