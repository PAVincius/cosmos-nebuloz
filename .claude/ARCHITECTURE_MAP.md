# Architecture Map

---

## Monorepo Structure

```
cosmos-nebuloz/
├── apps/
│   └── app/                        # Main Next.js 15 app (:3012)
│       ├── app/
│       │   ├── (authenticated)/    # Protected routes (all features)
│       │   ├── (unauthenticated)/  # sign-in
│       │   ├── actions/            # Server actions by domain
│       │   │   ├── _base.ts        # ← shared primitives (Result, safeAction, Zod helpers)
│       │   │   └── <domain>/
│       │   │       ├── schema.ts   # Zod input schemas
│       │   │       ├── create-*.ts
│       │   │       └── update-*.ts
│       │   └── hooks/              # Custom React hooks
│       └── __tests__/
│           └── actions/            # Unit tests (mirrors actions/)
└── packages/
    ├── ai/                         # RAG orchestrator, LLM utils
    ├── auth/                       # requireTenantSession, session mgmt
    ├── database/                   # Prisma client + schema
    ├── design-system/              # shadcn/ui components
    ├── safe-engine/                # SAFe domain logic
    ├── collaboration/              # Liveblocks wrappers
    ├── feature-flags/              # Feature flag client
    ├── observability/              # Sentry wrappers
    └── ...                         # analytics, email, webhooks, etc.
```

## Key File Locations

| What | Where |
|------|-------|
| Prisma schema | `packages/database/generated/schema.prisma` |
| DB client | `import { database } from "@repo/database"` |
| Auth | `import { requireTenantSession } from "@repo/auth/server"` |
| Action primitives | `apps/app/app/actions/_base.ts` |
| Design system | `import { ... } from "@repo/design-system"` |
| Turbo config | `turbo.json` |
| Biome config | `biome.jsonc` |
| E2E tests | `apps/app/__tests__/e2e/` |

## Key Patterns

### Server Action pattern
```typescript
"use server";
import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { safeAction, type Result } from "../_base";

export async function createFoo(raw: FooInput): Promise<Result<Foo>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const input = FooSchema.parse(raw);
    // Always filter by ctx.tenantId
    return database.foo.create({ data: { tenantId: ctx.tenantId, ...input } });
  });
}
```

### Result type usage (client)
```typescript
const result = await createFoo(input);
if (!result.ok) { toast.error(result.error); return; }
// result.data is typed
```

### Test pattern
```typescript
const mocks = vi.hoisted(() => ({ requireTenantSession: vi.fn(), ... }));
vi.mock("@repo/auth/server", () => ({ requireTenantSession: mocks.requireTenantSession }));
vi.mock("@repo/database", () => ({ database: { foo: { create: mocks.fooCreate } } }));
// import action AFTER vi.mock()
import { createFoo } from "../../../app/actions/foo/create-foo";
```

## Domain Routes (authenticated)

| Route | Domain |
|-------|--------|
| `/dashboard` | Overview |
| `/portfolio` | Portfolio Kanban, budgets, anomalies |
| `/pi-planning` | PI Planning board |
| `/epics` | Epic management |
| `/teams/[teamId]` | Team config, sprints, stories |
| `/analytics` | Flow metrics, velocity |
| `/copilot` | SAFe AI Copilot |
| `/integrations` | Jira, Azure DevOps, GitHub, Slack |
| `/workflows` | BPMN workflow editor |

---

**Last Updated**: 2026-05-31
