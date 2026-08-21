# Common Mistakes

**Read at session start — these cost hours.**

---

## 1. Missing `tenantId` filter in DB queries

**Symptom**: Data leaks across tenants / wrong results in multi-tenant context.

**Wrong**:
```typescript
database.epic.findMany({ where: { statusId: input.statusId } })
```

**Fix**: Always scope to `ctx.tenantId`:
```typescript
const ctx = await requireTenantSession(await headers());
database.epic.findMany({ where: { tenantId: ctx.tenantId, statusId: input.statusId } })
```

---

## 2. Throwing instead of returning `Result<T>`

**Symptom**: Unhandled server errors surface as 500s; client has no typed error.

**Wrong**:
```typescript
export async function deleteFoo(id: string) {
  // throws on error
  return database.foo.delete({ where: { id } });
}
```

**Fix**: Wrap in `safeAction()` from `_base.ts`:
```typescript
export async function deleteFoo(id: string): Promise<Result<void>> {
  return safeAction(async () => {
    await database.foo.delete({ where: { id } });
  });
}
```

---

## 3. Forgetting `await headers()` in `requireTenantSession`

**Symptom**: `TypeError: headers is not iterable` or auth silently fails.

**Wrong**:
```typescript
const ctx = await requireTenantSession(headers());
```

**Fix**:
```typescript
const ctx = await requireTenantSession(await headers());
```

---

## 4. Duplicating Zod primitives already in `_base.ts`

**Symptom**: Inconsistent validation, bloated schema files.

**Wrong**: Defining `z.string().min(1).max(255).trim()` inline per schema.

**Fix**: Import from `_base.ts`:
```typescript
import { nnStr, optStr, cuid, optCuid, isoDate } from "../_base";
```

Available: `cuid`, `nnStr`, `optStr`, `optCuid`, `isoDate`, `optDate`, `SortOrder`, `PaginationSchema`

---

## 5. Importing action BEFORE `vi.mock()` in tests

**Symptom**: Mocks not applied — test hits real implementations and crashes.

**Wrong**:
```typescript
import { createEpic } from "../../../app/actions/epics/create-epic";
vi.mock("@repo/database", () => ({ ... }));
```

**Fix**: All `vi.mock()` calls BEFORE the action import:
```typescript
const mocks = vi.hoisted(() => ({ ... }));
vi.mock("@repo/auth/server", () => ({ requireTenantSession: mocks.requireTenantSession }));
vi.mock("@repo/database", () => ({ database: { ... } }));
// import action last
import { createEpic } from "../../../app/actions/epics/create-epic";
```

---

## 6. Using `npm`/`yarn` instead of `pnpm`

**Symptom**: Lockfile conflicts, missing workspace links, build fails.

**Fix**: Always `pnpm`. Root has `"packageManager": "pnpm@10.24.0"`.

---

## 7. Styling `apps/backoffice` — Tailwind is the default, inline is legacy

**Symptom**: You see 358 `style={{}}` against 190 `className` in the back-office
and copy the inline style, or you write Tailwind and it silently does nothing.

**Fix**: New code uses Tailwind utilities plus the cosmos primitives (`.btn`,
`.mono`, `.lift`, `.navitem`, `.kpi`). The existing inline styles are a legacy
port of the `backoffice-shell.jsx` handoff — leave them where they are, do not
add more, and do not run a migration.

Tailwind only works there because two things are wired, and both are easy to
break by "cleaning up":

- `apps/backoffice/postcss.config.mjs` re-exports the design-system PostCSS
  config. Without it no plugin runs and every utility is inert.
- `@source "../**/*.{ts,tsx}"` at the bottom of `apps/backoffice/app/styles.css`.
  Tailwind's automatic source detection does NOT reach this app — measured: with
  the plugin on and that line removed, `.items-center` existed (it comes from
  the design-system's own `@source`) and `.flex` and `.p-8` did not.

It stays at the bottom of the file because CSS requires every `@import` to
precede other at-rules; Biome fails the build if you move it up.

This was live for months: ~72 utility classes rendered unstyled, including the
four guard refusal screens in `app/(staff)/layout.tsx`.

---

## 8. Adding a package test without `test:coverage`

**Symptom**: The suite is green locally and has never run in CI. No error, no
warning.

**Fix**: CI runs `pnpm turbo test:coverage` and nothing else. Turbo silently
skips any package that does not declare the task, so a package with only
`"test"` is invisible to CI. Declare both:

```json
"test": "vitest run",
"test:coverage": "vitest run --coverage"
```

Then run it once, measure, and set `thresholds` to the measured floor — not to
an aspirational 80. A gate that is red on day one gets switched off in week one.

This has now bitten twice: `apps/app` (see the comment in its
`vitest.config.mts`) and `apps/backoffice`, whose 24 files and 4.254 lines of
tests had never run in a pull request.

---

**Update this file when:**
- Bug took >30 min to debug
- Mistake repeated across sessions
- Pattern violates project conventions

**Last Updated**: 2026-08-21
