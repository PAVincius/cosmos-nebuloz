# Quick Start Commands

---

## Development

```bash
# Start all apps (app runs on :3012)
pnpm dev

# Start only the main app
cd apps/app && pnpm dev

# Type check
cd apps/app && pnpm typecheck

# Lint + format check (Biome)
pnpm check

# Autofix lint + format
pnpm fix
```

## Testing

```bash
# Run all unit tests (Vitest)
pnpm test

# Run with coverage
pnpm test:coverage

# Run E2E (Playwright)
cd apps/app && pnpm test:e2e
cd apps/app && pnpm test:e2e:ui       # interactive UI
cd apps/app && pnpm test:e2e:headed   # headed browser

# Run single test file
cd apps/app && pnpm test __tests__/actions/epics/create-epic.test.ts
```

## Database

```bash
# Full migration flow (format + generate + push)
pnpm migrate

# Schema location
packages/database/generated/schema.prisma

# Seed scripts (from apps/app)
pnpm seed:admin
pnpm seed:tenants
pnpm seed:portfolio
pnpm seed:e2e
```

## Build

```bash
pnpm build          # turbo build all
pnpm analyze        # bundle analysis (apps/app)
pnpm clean          # git clean node_modules
```

## Common Workflows

**New action:**
1. Create `apps/app/app/actions/<domain>/schema.ts` (Zod)
2. Create `apps/app/app/actions/<domain>/<verb>-<entity>.ts` (server action)
3. Create `apps/app/__tests__/actions/<domain>/<verb>-<entity>.test.ts`
4. Run `pnpm test` → green

**Schema change:**
1. Edit `packages/database/generated/schema.prisma`
2. `pnpm migrate`
3. Regenerate types: Prisma client auto-updates

**Pre-push checklist:**
```bash
pnpm check       # biome
pnpm typecheck   # inside apps/app
pnpm test        # vitest
```

---

**Last Updated**: 2026-05-31
