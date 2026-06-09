# CLAUDE.md

**cosmos-nebuloz** — SAFe project management platform (Next Forge 5.3.2)

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 15 App Router |
| Language | TypeScript 5.9 |
| Monorepo | pnpm + Turborepo |
| Database | Prisma + PostgreSQL |
| Auth | `@repo/auth` (multi-tenant) |
| UI | shadcn/ui + Tailwind |
| Linter | Biome (via ultracite) |
| Tests | Vitest (unit) + Playwright (E2E) |
| Realtime | Liveblocks |
| State | XState |
| Rich text | Tiptap |
| Observability | Sentry |

---

## Session Start Protocol

Read these on session start:

```
.claude/COMMON_MISTAKES.md   ← read FIRST
.claude/QUICK_START.md
.claude/ARCHITECTURE_MAP.md
```

Never auto-load: `.claude/completions/`, `.claude/sessions/`, `docs/archive/`

At task completion → create `.claude/completions/YYYY-MM-DD-task-name.md`

---

## Quick Start

```bash
pnpm dev          # all apps (app on :3012)
pnpm test         # vitest all packages
pnpm build        # turbo build
pnpm migrate      # prisma format + generate + db push
pnpm check        # biome lint/format check
pnpm fix          # biome lint/format autofix
pnpm typecheck    # tsc --noEmit (run inside apps/app)
```

**See**: `.claude/QUICK_START.md` for complete reference

---

## Core References

- **Mistakes**: `.claude/COMMON_MISTAKES.md`
- **Commands**: `.claude/QUICK_START.md`
- **Architecture**: `.claude/ARCHITECTURE_MAP.md`
- **PRD/SRD**: `docs/superpowers/plans/`

---

**Last Updated**: 2026-05-31
