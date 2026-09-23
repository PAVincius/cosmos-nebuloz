# Architecture Map

---

## Monorepo Structure

```
cosmos-nebuloz/
├── apps/
│   ├── app/                        # Client products (:3012) — app.nebuloz.ai
│   │   ├── app/
│   │   │   ├── (cosmos)/cosmos/[[...seg]]   # Cosmos — one route, every screen
│   │   │   ├── (charter)/charter/           # Charter
│   │   │   ├── (meridian)/meridian/         # Meridian
│   │   │   ├── meridian-responder/          # Meridian external respondent (token link)
│   │   │   ├── (scaffold)/scaffold/         # Scaffold
│   │   │   ├── (signal)/signal/             # Signal
│   │   │   ├── <produto>-indisponivel/      # tenant without the module contracted
│   │   │   ├── (authenticated)/             # produto (catalog), settings, profile, onboarding
│   │   │   ├── (unauthenticated)/           # sign-in
│   │   │   ├── actions/                     # Server actions by domain (Cosmos + shared)
│   │   │   │   ├── _base.ts                 # ← shared primitives (Result, safeAction, Zod helpers)
│   │   │   │   └── <domain>/
│   │   │   └── api/
│   │   ├── components/<produto>/   # screens + <produto>.css tokens; Impeccable root (PRODUCT.md, DESIGN.md)
│   │   ├── lib/<produto>/          # domain logic per product
│   │   ├── e2e/                    # Playwright
│   │   └── __tests__/              # Vitest (mirrors actions/, lib/, screens)
│   ├── backoffice/                 # Big Bang, internal staff panel — backoffice.nebuloz.ai
│   │   └── app/(staff)/            # clientes, propostas, aprovações, audit, funil, growth, empresa…
│   ├── api/                        # api.nebuloz.ai
│   ├── web/                        # nebuloz.ai marketing site (:3001)
│   ├── docs/                       # public client docs from docs/cliente (:3004)
│   ├── docs-internal/              # internal PRD/SRD from docs/produto, Vercel Authentication (:3014)
│   ├── email/                      # react-email preview (:3003)
│   ├── storybook/                  # (:6006)
│   └── studio/                     # Prisma Studio (:3005)
└── packages/
    ├── auth/                       # requireTenantSession, session mgmt
    ├── rbac/                       # permission matrices (one per product today — see boundary map)
    ├── provisioning/               # tenant + module provisioning, product bootstraps
    ├── database/                   # Prisma client + multi-file schema
    ├── design-system/              # shadcn/ui + cosmos kit (cosmos/cosmos.css)
    ├── safe-engine/                # SAFe domain logic
    ├── ai/                         # model router (Anthropic key → Haiku 4.5; else Google/OpenAI), tracing
    ├── collaboration/              # Liveblocks wrappers
    ├── feature-flags/              # Feature flag client
    ├── observability/              # Sentry wrappers
    └── ...                         # analytics, email, webhooks, etc.
```

## Products

| Product | Route | Code | Context (PRODUCT.md, DESIGN.md) |
|---|---|---|---|
| Meridian | `/meridian`, `/meridian-responder` | `apps/app/{app/(meridian),components/meridian,lib/meridian}` | `apps/app/components/meridian/` |
| Scaffold | `/scaffold` (+ staff side in back-office) | `apps/app/{app/(scaffold),components/scaffold,lib/scaffold}`, `apps/backoffice/app/(staff)/scaffold` | `apps/app/components/scaffold/` |
| Cosmos | `/cosmos/[[...seg]]` | `apps/app/{app/(cosmos),components/cosmos,app/actions}`, `packages/safe-engine` | `apps/app/components/cosmos/` |
| Signal | `/signal` | `apps/app/{app/(signal),components/signal,lib/signal}` | `apps/app/components/signal/` |
| Charter | `/charter` | `apps/app/{app/(charter),components/charter,lib/charter}` | `apps/app/components/charter/` |
| Back-office | backoffice.nebuloz.ai | `apps/backoffice` | `apps/backoffice/` |

Who owns each shared entity (tenant, permission, baseline, portfolio, confidence scale…): `docs/produto/mapa-de-fronteiras.md`.

## Key File Locations

| What | Where |
|------|-------|
| Prisma schema | `packages/database/prisma/schema/*.prisma` (one file per domain) |
| DB client | `import { database } from "@repo/database"` |
| Auth | `import { requireTenantSession } from "@repo/auth/server"` |
| Back-office guard | `apps/backoffice/lib/guard.ts` (`requirePlatformStaff`) |
| Permission matrices | `packages/rbac/src/*-matrix.ts` |
| Action primitives | `apps/app/app/actions/_base.ts` |
| Design system | `import { ... } from "@repo/design-system"` |
| Turbo config | `turbo.json` |
| Biome config | `biome.jsonc` |
| E2E tests | `apps/app/e2e/` |
| Product requirements | `docs/produto/<produto>-{prd,srd}.md` |
| Agent notes (Maestri) | `.maestri/knowledge/<produto>/note.md` |

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

---

**Last Updated**: 2026-09-22
