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

**Update this file when:**
- Bug took >30 min to debug
- Mistake repeated across sessions
- Pattern violates project conventions

**Last Updated**: 2026-05-31
