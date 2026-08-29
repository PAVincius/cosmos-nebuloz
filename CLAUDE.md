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

## Knowledge Graph (graphify-out/)

Graph built from full repo: 10.189 nodes · 15.392 edges · 871 communities.

**When to query instead of reading files:**

| Task | Use graph |
|------|-----------|
| "What calls X?" | Yes — BFS from node X |
| "Impact of changing Y?" | Yes — neighbors + community |
| "Where is Z defined?" | No — `grep`/LSP faster |
| "How does feature F flow end-to-end?" | Yes — DFS path query |
| Understanding unfamiliar module | Yes — community context |
| Adding a new file | No — just read adjacent files |

**God nodes** (highest connectivity — touch with care):
- `auth_server_requiretenantsession` — multi-tenant session guard
- `actions_base_safeaction` — server action HOF wrapper
- `actions_base_result` — Result<T> pattern, used everywhere
- `lib_app_design_appdesign` — central design system
- `auth_server_requirerole` — RBAC enforcement

**Query commands:**
```bash
# Broad context (BFS)
/graphify query "how does PI Planning confidence vote work?"

# Trace specific path (DFS)
/graphify path "actions_base_safeaction" "audit_index_logaudit"

# Explain a node
/graphify explain "auth_server_requiretenantsession"
```

**Rebuild** (after significant new files): `/graphify --update`

**Visualize**: open `graphify-out/graph.html` in browser.

---

<!-- SPECKIT START -->
## Spec Kit

Active plan: [`specs/001-add-intent-stage/plan.md`](specs/001-add-intent-stage/plan.md)
<!-- SPECKIT END -->

---

**Last Updated**: 2026-08-27
