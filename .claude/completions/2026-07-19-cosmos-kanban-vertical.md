# COSMOS — Session Handoff (2026-07-19)

Resume point after porting `cosmos.html` (SAFe LPM prototype) into the Next.js app at
state-of-the-art. Read this first, then the approved plan.

- **Approved plan**: `~/.claude/plans/compiled-mapping-newell.md` (full architecture + perf + NFRs)
- **UI/UX source of truth (verbatim)**: `/Users/azos/Downloads/design_handoff_cosmos_full 3/`
  — README (route table + interactions) and `cosmos-ds/CLAUDE.md` (tokens §1, Tailwind config §2,
  component recipes §5, motion §9). Screens live in `screen-bundle-1..5.jsx` (`grep 'function XScreen'`).
- **Locked decisions**: Tailwind v4 · RSC-first islands · next-themes · real Prisma backend ·
  Liveblocks full collab · tiered motion (View Transitions + Motion One + surgical framer) ·
  RBAC via `requireTenantSession`/`requireRole` + role→capability map.

## DONE + verified this session

**Foundation** (`apps/app/components/cosmos/`)
- `cosmos.css` — tokens (light/dark) scoped `[data-theme] .cosmos-root`, keyframes, KPI decor, utils.
- `cosmos-theme.css` — Tailwind v4 `@theme` layer, namespaced `cos-*` (collision-free) +
  `data-tone` dynamic-tone indirection. Imported in `apps/app/app/styles.css`.
- `icons.tsx` (lucide-backed `Icon`), `kit.tsx` (Button/Badge/Card/SectionCard/KpiCard/Progress/
  Avatar/PageHeader/CopyId/ChartTip/GlossaryTip/CopilotInsightBar/Skel/SkeletonKpi/Switch/LivePulse,
  `useThemeName` via next-themes, `NavCtx`/`useNav`), `shell.tsx` (Sidebar+Topbar+`CosmosShell`,
  `Link`+`usePathname` routing, next-themes toggle = CSS-only), `modal.tsx` (`ModalProvider`/`useModal`/`ModalCard`).
- Fonts deduped (reuse design-system `--font-manrope`/`--font-space-grotesk`/`--font-jetbrains-mono`).

**Routing**: `apps/app/app/(cosmos)/layout.tsx` (shell) + `(cosmos)/cosmos/[[...seg]]/page.tsx`
(dynamic screen registry). Screens at `/cosmos/<id>`. Registry: `components/cosmos/screens/registry.tsx`.

**Screens** (`components/cosmos/screens/`): `kanban.tsx` (full, wired to real data), `dashboard.tsx`
(charts, mock), `wsjf.tsx` (table, mock). Others → `ComingSoon`.

**Backend vertical (real Postgres, `cosmos_dev`)**
- `packages/database/prisma/schema/art-core.prisma` — `Epic` extended with denorm board columns:
  `wsjf, sizePoints, hot, ownerId, ownerName, artId, artTone` + `@@index([tenantId, lifecycleStatus, order])`.
  Applied via `prisma db push` (LIVE).
- `apps/app/app/(cosmos)/actions/kanban.ts` — `listEpics` / `moveEpic` / `createEpic` (tenant-scoped,
  `safeAction`→`Result<T>`, `requireTenantSession`, `requireRole(['ADMIN','RTE','PO'])`, `logAudit`,
  `unstable_cache` + `revalidateTag(portfolioEpicsCacheTag(tenantId),'max')`, IDOR guard on theme FK).
  Column↔lifecycle: funnel↔FUNNEL, analyzing↔ANALYZING, backlog↔PORTFOLIO_BACKLOG,
  implementing↔IMPLEMENTING, done↔DONE.
- Seed: `packages/database/scripts/seed-cosmos.mts` — `cosmos-demo` tenant + 6 themes + 14 epics
  (ART tone per DS §4: pay=blue, plat=purple, growth=green, data=amber).
- Board: `kanban.tsx` fetches `listEpics`→`listEpicsDev`→mock; drag-move (native DnD, optimistic +
  revert); create-from-modal (refetch on success); staggered card entrance (CSS).
- Tests: `apps/app/__tests__/actions/kanban.test.ts` — 6 passing (tenant isolation, RBAC deny,
  cross-tenant, IDOR, happy paths).

**Verified in browser**: 14 real cards (`fonte: dev`), drag persists across reload, create persists.

## DEV SCAFFOLDS — retire together when real dev auth lands
`listEpicsDev`, `moveEpicDev`, `createEpicDev` in `actions/kanban.ts`. Hard-gated to non-production
(`NODE_ENV !== 'production'`), ownership enforced. The board falls back to them when there's no
session (dev). Production path uses `requireTenantSession` + `requireRole`.

## How to run
```bash
# dev server (app on :3012)
cd apps/app && pnpm dev
# seed the demo tenant + epics
cd packages/database && pnpm exec tsx --env-file=.env scripts/seed-cosmos.mts
# tests
cd apps/app && pnpm exec vitest run __tests__/actions/kanban.test.ts
# typecheck (ALWAYS grep — repo has many unrelated errors from a prior screen strip)
cd apps/app && pnpm exec tsc --noEmit 2>&1 | grep -iE "components/cosmos|\(cosmos\)|lib/cosmos-data"
```

## REMAINING (ordered; each its own session/increment)
1. **Real dev auth** — retire the 3 `*Dev` scaffolds. Create dev User + `TenantMember`(ADMIN) for
   `cosmos-demo`; wire a login/session (better-auth). Then `listEpics`/`moveEpic`/`createEpic` work authed.
2. **Liveblocks collab** — room per board `kanban:${tenantId}`; presence + cursors + comments
   (prototype had `PresenceLayer`/`LiveCursor` in `cosmos-widgets.jsx`).
3. **Tiered motion** — native View Transitions for card→Epic Detail shared-element morph; Motion One
   (WAAPI) for count-up/stagger; framer surgical for drag-reorder. (Epic Detail screen not built yet.)
4. **RSC/Tailwind INP rewrite** — convert kit/screens to server components + client islands; rewrite
   the ~250 inline styles to Tailwind `cos-*` utilities + `data-tone`; `content-visibility` on columns,
   `contain` on cards; measure INP before/after.
5. **More screens** — port remaining SAFe screens (Risks/ROAM, Program Board, PI Planning, Flow,
   Teams, OKRs, Themes…) using the registry pattern; wire Dashboard/WSJF to real data.

## Gotchas learned (save debugging time)
- **Subagents overflow** in this env (huge preamble) — work inline, don't delegate.
- **rtk hook is broken** (`rtk: No such file`) — wraps `pnpm`/`git`; pipe through `grep -vE '^\[rtk'`.
- **tsc** — repo has thousands of unrelated errors from a prior screen strip; ALWAYS grep to cosmos paths.
- **Reads compress** in this harness — read ≤~120 lines at a time or retrieve the hash.
- Prisma 7: `db push` (no `--skip-generate`); split schema in `prisma/schema/`; `prisma.config.ts`
  loads env via dotenv; select typing needs `satisfies Prisma.EpicSelect` + `Prisma.EpicGetPayload`.
- Next 16: `revalidateTag(tag, 'max')` (2 args). `params` is a Promise (await it).
- Seed via tsx: `@repo/database` does `import "server-only"` (throws under tsx) → instantiate
  `PrismaClient` directly with `PrismaPg` adapter + `tsx --env-file=.env`.
- `StrategicTheme.title` (not `name`). `MemberRole` enum: ADMIN/STE/RTE/SM/PO/DEV/MEMBER.
- Real `Epic.lifecycleStatus` has no "reviewing" (mock did) — 5 board columns.
