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

Toda mudança de schema exige uma migration versionada (`prisma/migrations/`)
— não editar o banco à mão e não editar uma migration já commitada (exceto
correção de um handler que impediria a cadeia de rodar do zero, documentada
no PR). `pnpm migrate` é para iteração local: formata, gera o client e roda
`prisma migrate deploy` contra o banco de dev.

Em produção, as migrations agora são aplicadas automaticamente no deploy —
`packages/database` roda `prisma migrate deploy` como parte do próprio
`build` (`packages/database/scripts/deploy-migrations.mts`), só quando
`VERCEL_ENV === "production"`. Preview e desenvolvimento nunca migram.

**Banco divergiu do que as migrations descrevem?** Não rode `migrate resolve`
antes de confirmar, objeto por objeto, que o efeito da migration já está
presente no banco (coluna, índice, constraint — o que ela declarava criar ou
alterar). Só depois disso, marque como aplicada sem reexecutar:

```bash
cd packages/database && npx prisma migrate resolve --applied <nome-da-migration>
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
