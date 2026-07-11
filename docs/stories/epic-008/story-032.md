# Story 032 — `withSecureAction` HOF & ESLint Enforcement

**Epic:** 008 — Enterprise & Scale
**Feature:** F-008-002 Security Infrastructure
**WSJF:** 14.0 (userValue=8, timeValue=8, riskReduction=9, jobSize=2)
**Story Points:** 5
**Priority:** Must Have — prerequisite for all other stories
**Status:** DEFINED

---

## User Story

**As a** Platform Engineer,
**I want** a `withSecureAction` HOF that wraps all server actions with session validation, RBAC, RLS, and audit logging, enforced by a CI ESLint rule,
**so that** no server mutation can bypass security controls regardless of how the code is written.

---

## Acceptance Criteria

### AC-001: ESLint rule fails on unwrapped action
Given a server action file `app/actions/epics/transitions.ts` exports an `async function` not wrapped in `withSecureAction`,
When `pnpm lint` runs,
Then:
- ESLint reports: "require-secure-action-wrapper: Server action must be wrapped with withSecureAction [actions/transitions.ts:14]"
- `pnpm lint` exits with code 1
- CI pipeline fails and the PR is blocked from merging

### AC-002: Valid session + correct role → handler executes
Given a valid Better Auth session with role=RTE,
When a server action with `requiredRole: 'RTE'` is called with a valid Zod schema input,
Then:
- `app.current_org_id` is set before any Prisma operation
- The handler function is called with typed input and `ActionContext`
- HTTP 200 with the handler's return value

### AC-003: Unauthorized role returns 403 without executing handler
Given a DEVELOPER calls a server action with `requiredRole: 'RTE'`,
When `withSecureAction` evaluates,
Then:
- Handler is NEVER called
- Return value: `{success: false, error: "Insufficient permissions", code: 403}`
- No DB operations are performed
- `AuditLog` entry: `action=action.unauthorized_attempt`

### AC-004: Invalid Zod schema returns 422
Given a server action receives input missing a required field,
When Zod validation runs,
Then:
- Return value: `{success: false, error: "Validation error: [field] is required", code: 422, details: [...]}`
- Handler is NOT called
- No DB operations

### AC-005: Transactional rollback on handler error
Given a `transactional: true` action where the handler:
- Step 1: creates Record A (succeeds)
- Step 2: creates Record B (throws "DB constraint violation")
When the handler throws after step 2,
Then:
- Record A is rolled back (not persisted)
- Return value: `{success: false, error: "Internal error", code: 500}`
- `AuditLog` entry records the failed action with `errorCode=DB_CONSTRAINT`

### AC-006: AuditLog written on every action call
Given any server action call (success or failure),
When the HOF completes,
Then:
- An `AuditLog` entry is written with: `orgId`, `actorId`, `actorIp`, `action`, `resourceType`, `resourceId` (if available), `before`/`after` (if provided), `timestamp`, `traceId`, `sessionId`
- The log is written even when the action fails (for failed attempts)

### AC-007: No session → 401 without executing handler
Given an unauthenticated request reaches a server action,
When `withSecureAction` validates the session,
Then:
- Return value: `{success: false, error: "Unauthorized", code: 401}`
- Handler is not called
- No `AuditLog` entry for the missing session (to avoid flooding logs with scanner traffic)

### AC-008: HOF overhead < 10ms
Given a simple server action (no DB ops) wrapped with `withSecureAction`,
When measured across 100 calls,
Then:
- The HOF overhead (session check + audit write + Zod validation) averages < 10ms per call
- Measured via OpenTelemetry span on `withSecureAction` execution

---

## Technical Notes

### HOF Interface

```typescript
// packages/security/src/with-secure-action.ts
import { z } from 'zod'
import { getSession } from '@repo/auth/server'
import { prisma } from '@repo/database'
import { writeAuditLog } from '@repo/audit'

type SecureActionConfig<TInput extends z.ZodType> = {
  requiredRole?: Role
  requiredPermission?: string
  schema: TInput
  transactional?: boolean
  auditAction: string
  auditResourceType: string
  resourceIdFn?: (input: z.infer<TInput>) => string | undefined
}

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code: 401 | 403 | 409 | 422 | 500; details?: unknown }

export async function withSecureAction<TInput extends z.ZodType, TOutput>(
  config: SecureActionConfig<TInput>,
  handler: (input: z.infer<TInput>, ctx: ActionContext) => Promise<TOutput>
): Promise<ActionResult<TOutput>> {
  // 1. Session check
  const session = await getSession()
  if (!session) return { success: false, error: 'Unauthorized', code: 401 }

  // 2. Role check
  if (config.requiredRole && !hasRole(session.role, config.requiredRole)) {
    await writeAuditLog({ action: `${config.auditAction}.unauthorized`, ... })
    return { success: false, error: 'Insufficient permissions', code: 403 }
  }

  // 3. Zod validation
  const parsed = config.schema.safeParse(/* raw input */)
  if (!parsed.success) return { success: false, error: 'Validation error', code: 422, details: parsed.error.issues }

  // 4. Set RLS context
  const ctx: ActionContext = { orgId: session.orgId, userId: session.userId, role: session.role, ... }

  // 5. Execute handler (with or without transaction)
  try {
    const execute = async () => {
      await prisma.$executeRaw`SELECT set_config('app.current_org_id', ${ctx.orgId}, true)`
      return handler(parsed.data, ctx)
    }

    const result = config.transactional
      ? await prisma.$transaction(execute)
      : await execute()

    // 6. Audit log (success)
    await writeAuditLog({ action: config.auditAction, resourceType: config.auditResourceType, ... })
    return { success: true, data: result }
  } catch (err) {
    // 7. Normalize error + audit log (failure)
    await writeAuditLog({ action: `${config.auditAction}.failed`, errorCode: getErrorCode(err), ... })
    return normalizeError(err)
  }
}
```

### ESLint Rule

```javascript
// packages/eslint-plugin-cosmos/src/rules/require-secure-action-wrapper.js
module.exports = {
  meta: { type: 'problem', schema: [] },
  create(context) {
    return {
      ExportNamedDeclaration(node) {
        const filename = context.getFilename()
        if (!filename.includes('/app/actions/')) return

        const decl = node.declaration
        if (decl?.type === 'FunctionDeclaration' && decl.async) {
          // Check if function body contains a withSecureAction call
          const hasWrapper = functionBodyContains(decl, 'withSecureAction')
          if (!hasWrapper) {
            context.report({ node, message: 'Server action must be wrapped with withSecureAction' })
          }
        }
      }
    }
  }
}
```

---

## Dependencies

- Better Auth session API (`@repo/auth/server`)
- Prisma client middleware (sets `app.current_org_id`)
- `@repo/audit` (writeAuditLog)
- Zod for schema validation
- OpenTelemetry for span timing
- ESLint custom plugin registration in `eslint.config.mjs`

---

## Definition of Done

- [ ] `withSecureAction` HOF in `@repo/security` with full contract
- [ ] Session check (401), role check (403), Zod validation (422), transaction rollback (500)
- [ ] `app.current_org_id` set via `SET` before every DB operation
- [ ] `AuditLog` written on every call (success + failure)
- [ ] ESLint custom rule `require-secure-action-wrapper` in `packages/eslint-plugin-cosmos`
- [ ] Rule registered in `eslint.config.mjs` targeting `app/actions/**`
- [ ] CI gate: `pnpm lint` blocks PR merge on unwrapped actions
- [ ] HOF overhead < 10ms (OpenTelemetry span)
- [ ] Role hierarchy: OWNER > ORG_ADMIN > RTE > PM > SA > SM > PO > DEVELOPER > VIEWER
- [ ] Unit tests: unauthorized role, invalid schema, transaction rollback, audit log, ESLint rule
