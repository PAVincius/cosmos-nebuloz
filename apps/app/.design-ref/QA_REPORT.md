# QA Report — E2E Coverage Expansion + A11y/Contrast Audit

Date: 2026-07-04
Scope: all ~27 screens ported from `cosmos.html` that previously had no dedicated E2E coverage, plus an axe-core accessibility/contrast sweep across the full authenticated app.

## Summary

- **19 new Playwright spec files** created under `apps/app/e2e/` (18 functional smoke specs + 1 a11y sweep), on top of the 11 pre-existing specs.
- **~30 screens/sub-routes** now have at least a smoke-level E2E check (render + one interaction), plus **29 routes** audited for WCAG 2.1 AA critical/serious violations.
- **Full suite**: 78 passed / 37 failed (201s total run, well under the 12-min timebox).
- **2 real app bugs found and NOT fixed** (per instructions) — both crash a page outright: `/portfolio/tags` and `/settings/roles`.
- **A systemic accessibility issue** affects essentially every authenticated screen: a critical `button-name` violation (icon-only button with no accessible name) and a serious `color-contrast` violation (3–30 elements per page), both present even on pre-existing, previously "green" pages (`/dashboard`, `/portfolio` kanban, `/pi-planning`, `/sign-in`).
- 3 of my own spec-side mistakes were found and fixed directly in the test files (locator strict-mode collision, a too-short button wait, and a too-short global navigation timeout for Next dev cold-compiles).

## Specs created

| # | File | Screens covered |
|---|------|------------------|
| 1 | `e2e/portfolio-wsjf.spec.ts` | `/portfolio/wsjf` (table + Rebalance dialog) |
| 2 | `e2e/portfolio-themes.spec.ts` | `/portfolio/themes` (board + Novo tema dialog) |
| 3 | `e2e/portfolio-strategy-map.spec.ts` | `/portfolio/strategy-map` (tree + add-epic modal) |
| 4 | `e2e/portfolio-okrs.spec.ts` | `/portfolio/okrs` (cards + Novo OKR dialog) |
| 5 | `e2e/portfolio-budgets.spec.ts` | `/portfolio/budgets`, `/portfolio/budgets/anomalies` |
| 6 | `e2e/portfolio-tags.spec.ts` | `/portfolio/tags` (list + Nova regra dialog) |
| 7 | `e2e/portfolio-roadmap.spec.ts` | `/portfolio/roadmap` (timeline) |
| 8 | `e2e/portfolio-governance.spec.ts` | `/portfolio/governance`, `/portfolio/governance/decision-log` |
| 9 | `e2e/art-detail.spec.ts` | `/arts/[artId]`, `/arts/[artId]/program-board`, `/arts/[artId]/pi-planning` (+ tab switch) |
| 10 | `e2e/solution-trains.spec.ts` | `/solution-trains` |
| 11 | `e2e/dependencies.spec.ts` | `/dependencies` |
| 12 | `e2e/risks.spec.ts` | `/risks` (list + Registrar risco dialog) |
| 13 | `e2e/analytics-dashboards.spec.ts` | `/analytics/flow`, `/analytics/velocity`, `/analytics/measure-grow` |
| 14 | `e2e/teams.spec.ts` | `/teams`, `/teams/[teamId]/standup` |
| 15 | `e2e/copilot.spec.ts` | `/copilot` |
| 16 | `e2e/workflows.spec.ts` | `/workflows` (list; BPMN canvas already covered by pre-existing `bpmn-canvas.spec.ts`) |
| 17 | `e2e/integrations.spec.ts` | `/integrations` |
| 18 | `e2e/settings.spec.ts` | `/settings/audit`, `/integrations`, `/members`, `/reports`, `/roles`, `/sso`, `/workspace` |
| 19 | `e2e/a11y-screens.spec.ts` | axe sweep of all 27 static routes above + 2 dynamic-route groups |

Convention followed: `test.use({ storageState: "./e2e/fixtures/auth-session.json" })` (same pattern as `persona-home.spec.ts`), `<h1>` via the shared `PageHeader` component as the primary render assertion, one non-mutating smoke interaction per screen (open a create/detail dialog, switch a tab, follow a link). Real mutating server actions (workflow activate toggle, anomaly escalate/ignore, governance approve/reject) were deliberately **not** clicked to avoid corrupting shared seeded dev data.

## E2E results by screen

All PASS unless noted.

| Screen | Result | Notes |
|---|---|---|
| `/portfolio/wsjf` | PASS | Fixed test-side strict-mode collision: `getByRole("button", { name: "Rebalance" })` also matched an unrelated "Rebalanceamento por IA" control; added `exact: true`. |
| `/portfolio/themes` | PASS | |
| `/portfolio/strategy-map` | PASS | |
| `/portfolio/okrs` | PASS | |
| `/portfolio/budgets` (dashboard) | PASS in isolation / **FAIL in full-suite run** | See "Session TTL" note below — not a selector bug. |
| `/portfolio/budgets/anomalies` | PASS in isolation / **FAIL in full-suite run** | Same cause — page silently redirected to `/sign-in` mid-run. |
| `/portfolio/tags` | **FAIL — real app bug** | `Runtime Error: A "use server" file can only export async functions, found object` at `app/actions/billing/tag-rules.ts:151`. Page never renders; crashes to Next dev error overlay. |
| `/portfolio/roadmap` | PASS | |
| `/portfolio/governance` | PASS | |
| `/portfolio/governance/decision-log` | PASS | |
| `/arts/[artId]` detail + Program Board + PI Planning tabs | PASS | Tab switch (Program Board ↔ Team Breakout) verified. |
| `/solution-trains` | PASS | |
| `/dependencies` | PASS | |
| `/risks` | PASS | Registrar risco dialog opens correctly. |
| `/analytics/flow`, `/velocity`, `/measure-grow` | PASS | |
| `/teams` + `/teams/[teamId]/standup` | PASS | |
| `/copilot` | PASS | |
| `/workflows` | PASS | |
| `/integrations` | PASS | |
| `/settings/audit` | PASS | |
| `/settings/integrations` | PASS | |
| `/settings/members` | PASS | Convidar link → `/settings/workspace` navigation verified. |
| `/settings/reports` | PASS | |
| `/settings/roles` | **FAIL — real app bug** | `Runtime Error: A "use server" file can only export async functions, found object` at `app/actions/settings/custom-roles.ts:157` (`export { ALLOWED_PERMISSIONS }` inside a `"use server"` file). Page never renders. |
| `/settings/sso` | PASS | |
| `/settings/workspace` | PASS | |

### Pre-existing specs — full-suite run observations (not created by me, not modified)

- `e2e/persona-home.spec.ts` — 2 tests fail looking for a `getByRole("link", { name: "Trocar persona" })`. Confirmed via screenshot that `/dashboard` renders correctly and healthily, but the persona switcher is now a row of static pill badges (RTE / LPM / PO / SM / DEV), not a link named "Trocar persona". This looks like a **stale pre-existing test** vs. current UI, not a new regression — flagging for the app/test owner rather than editing a test I didn't write.
- `e2e/a11y.spec.ts` — all 4 pre-existing routes (`/sign-in`, `/dashboard`, portfolio kanban, PI planning kanban) now fail on the same systemic `button-name` + `color-contrast` violations described below — i.e., this is not new-screen-specific, it's app-wide.

### Session TTL note (test infra, not an app bug in scope here)

When the **entire suite runs serially in one `--workers=1` pass** (~3.3 min), the two `portfolio-budgets` tests near the end of the run get redirected to `/sign-in` — the stored `storageState` session appears to expire mid-run. Both tests pass reliably when run in isolation or in smaller batches (confirmed twice). Not fixed (it's a call about session TTL / CI sharding, outside "write tests, don't fix the app"), but flagged since it will cause flaky CI runs if the full suite is ever run as a single serial job.

## Accessibility / contrast audit (axe-core, WCAG 2.1 AA, critical+serious only)

**29/29 routes tested have at least one critical or serious violation.** Two violation types are near-universal (present on almost every single page, including previously-passing pre-existing routes), meaning these are app-wide/design-system-level issues, not per-screen bugs:

| Rule | Impact | Where | Description |
|---|---|---|---|
| `button-name` | **critical** | Every route (1 instance on most pages; up to 11 on `/portfolio/okrs`, 7 on `/risks`) | An icon-only button somewhere on the page has no accessible name (no `aria-label`, no visible text, no `title`). Likely a shared header/toolbar icon button repeated across layouts, plus page-specific icon buttons (row actions) on OKRs/Risks/Roadmap/WSJF/Copilot. |
| `color-contrast` | **serious** | Every route (range: 3 on strategy-map to 30 on OKRs) | Text/background combinations fall below the WCAG AA contrast ratio. Recurring offending classes seen in axe node targets: `.bg-primary/20` badges/pills, `.size-8.bg-primary.text-primary-foreground` avatar/icon circles, muted-foreground text on card backgrounds. This is very likely a small number of shared design tokens (badge/pill/avatar background-opacity + foreground color pairing) reused everywhere — fixing the token(s) should resolve the bulk of the 400+ total node-level hits at once. |

Page-specific (one-off) violations:

| Screen | Rule | Impact | Detail |
|---|---|---|---|
| `/portfolio/strategy-map` | `nested-interactive` | serious (3 nodes) | An interactive control (likely the "Épico" chip button) is nested inside another interactive element. |
| `/portfolio/budgets` | `select-name` | critical (1) | A `<select>` element has no accessible name. |
| `/analytics/flow` | `svg-img-alt` | serious (3) | Chart `<svg role="img">` elements lack alternative text. |
| `/copilot` | `aria-input-field-name` | serious (1) | The chat input field has no accessible name. |
| `/portfolio/okrs` | `aria-valid-attr-value` | critical (1) | An ARIA attribute has an invalid value (likely on a progress/confidence indicator). |
| `/portfolio/tags` | `document-title`, `html-has-lang` | serious | **Symptom of the crash bug above** — the Next.js dev error overlay page has no `<title>`/`lang`. Not a separate real a11y bug; will disappear once the tags crash is fixed. |
| `/settings/roles` | `document-title`, `html-has-lang` | serious | Same — symptom of the roles crash bug. |

## Prioritized fix list for the app team

1. **[CRITICAL] Fix `"use server"` export violations crashing 2 pages** — `app/actions/billing/tag-rules.ts:151` and `app/actions/settings/custom-roles.ts:157` (`export { ALLOWED_PERMISSIONS }`) each export a non-async value from a `"use server"` file, which Next.js rejects at runtime, taking down `/portfolio/tags` and `/settings/roles` entirely. Given the identical pattern in two unrelated files, worth grepping the whole `app/actions/**` tree for other files that mix server actions with plain constant/object exports — this looks like a repeatable mistake, not two independent bugs.
2. **[CRITICAL] Fix the app-wide `button-name` violation** — find the shared icon-only button (likely in the top nav/header, present on every layout) and give it an `aria-label`. Then address the smaller number of page-specific icon buttons on OKRs, Risks, Roadmap, WSJF, and Copilot.
3. **[SERIOUS] Fix the `color-contrast` design tokens** — audit the `bg-primary/20` badge/pill background + foreground-color pairing and the `.size-8.bg-primary.text-primary-foreground` avatar/icon circle pairing; these two patterns account for the majority of the 400+ contrast hits across all 29 routes.
4. **[MEDIUM] Page-specific a11y fixes** — `select-name` on budgets, `svg-img-alt` on analytics/flow charts, `aria-input-field-name` on the copilot chat input, `aria-valid-attr-value` on OKRs, `nested-interactive` on strategy-map's epic chip.
5. **[LOW / advisory] `persona-home.spec.ts` is stale** — either restore an accessible "Trocar persona" affordance (e.g., `aria-label` on the persona pill row) or update the pre-existing test to match the current pill-based UI (out of scope for this pass since it's a pre-existing test).
6. **[LOW / advisory] Auth session TTL** — confirm intended session lifetime for the local dev/E2E environment; the `storageState` session invalidates within ~3 minutes of continuous test traffic, which will make a single serial full-suite CI run flaky. Consider sharding or a longer-lived E2E session.

## Post-fix verification (2026-07-06)

Re-ran the full suite after root-cause + a11y fixes: (a) non-async `"use server"` exports, (b) `requireTenantSession` P2025→UNAUTHORIZED, (c) a11y/contrast fixes (button-name, color-contrast `text-ink-faint`→`muted`, chart svg-alt, OKR Progress NaN, strategy epic-chip nesting, persona pills, copilot editor), (d) `@liveblocks/node` added to `package.json`.

### E2E full suite: 78/115 → 82/129 passed, then 83/129 after test fix

- Raw re-run: **82 passed / 33 failed / 14 skipped** (129 total — the suite grew slightly; presumably parametrized cases in `a11y-screens.spec.ts`). Run time ~2.5 min, well under timebox.
- Fixed 1 stale selector (see below) → **83 passed / 32 failed / 14 skipped** after fix.
- The two crash bugs from the baseline (`/portfolio/tags`, `/settings/roles` — non-async `"use server"` exports) are confirmed **fixed**: both routes now render and their axe runs only show the pre-existing systemic violations (color-contrast / button-name), not `document-title`/`html-has-lang` (those were symptoms of the Next.js dev-error overlay and are gone).

**Test fixed (stale selector, not an app bug):**

- `e2e/persona-home.spec.ts:6` ("home page renders bento grid without error") — was `page.getByRole("link", { name: "Trocar persona" })`. The dashboard's own inline "Trocar persona" link only renders for the default/global persona view; the topbar's persona switcher (present on every authenticated page) now exposes the pills as `role="group" aria-label="Trocar persona"` (`app/(authenticated)/components/cosmos-topbar.tsx:145`) — exactly the affordance flagged as advisory item #5 above. Updated the locator to `page.getByRole("group", { name: "Trocar persona" })`. Confirmed passing in isolation.

**Remaining failures — classified:**

| Test | Classification | Detail |
|---|---|---|
| `e2e/persona-home.spec.ts:38` ("page header greeting is present") | **Pre-existing / test-data mismatch** — not a selector fix | The seeded `e2e/fixtures/auth-session.json` account resolves `config.persona === "lpm"`, and `app/(authenticated)/dashboard/page.tsx` has an early-return branch for the `lpm` persona (`return <div>{homeContent}</div>`) that skips the entire greeting+banner header, by design (pre-existing code comment marks this out of scope). There is no equivalent greeting element to re-target — the text genuinely isn't rendered for this account's persona. Flagging for whoever owns the fixture/persona-branching decision; not touched. |
| `e2e/settings.spec.ts:23`, `e2e/teams.spec.ts:18` | **Flaky — pre-existing session-TTL infra issue (advisory #6 above)**, not a new regression | Both **pass reliably in isolation** (`playwright test e2e/settings.spec.ts e2e/teams.spec.ts` → 2/2 pass). In the full serial run they fail with the click not navigating (URL stays on the source page) — consistent with the previously-flagged storageState TTL flakiness late in a long serial run. Not fixed (out of scope, same as baseline). |
| 24 `a11y-screens.spec.ts` static routes + 2 dynamic-route groups + 3 `a11y.spec.ts` routes (29 total) | **Real app bugs — a11y violations remain**, quantified below | See a11y section. |

### A11y re-run: quantified before → after

Re-ran `e2e/a11y-screens.spec.ts` + `e2e/a11y.spec.ts` in isolation (33 tests): **4 passed / 29 failed**. Parsed the actual axe JSON dumped per failing test (top-level rule objects, not nested check IDs) to get real per-rule page counts:

| Rule | Impact | Before (baseline) | After (this run) | Status |
|---|---|---|---|---|
| `button-name` | critical | Universal — every one of 29 routes (1–11 instances/page) | **5 of 29 routes**: `/portfolio/wsjf`, `/portfolio/okrs`, `/portfolio/tags`, `/portfolio/roadmap`, `/copilot` | **Mostly fixed** — down from app-wide to 5 leftover icon buttons, all page-specific (matches baseline's "page-specific icon buttons on OKRs/Risks/Roadmap/WSJF/Copilot" list minus Risks, which is now clean). |
| `color-contrast` | serious | Universal — 29/29 routes (3–30 nodes/page, 400+ total) | **28 of 29 routes** — only `/copilot` is clean | **Not fixed** — the `text-ink-faint`→`muted` swap addressed one offending token but new/other offenders remain, e.g. a solid `.bg-primary` button (`#ffffff` on `#00d4ff`, ratio 1.77, need 4.5:1) on `/arts/[artId]`, distinct from the previously-cited `.bg-primary/20` pill and `.size-8` avatar patterns. Needs a fuller token audit, not a single find-replace. |
| `select-name` (budgets) | critical | 1 instance | **0 — fixed** | Confirmed clean. |
| `svg-img-alt` (`/analytics/flow`) | serious | 3 nodes | **Still present**, 1 route | Not fixed. |
| `aria-input-field-name` (`/copilot` chat input) | serious | 1 instance | **0 — fixed** | The chat input itself now has an accessible name. |
| `aria-prohibited-attr` (`/copilot`) | serious | *not present in baseline* | **NEW regression, 1 instance** | Side effect of the copilot editor a11y fix: the Tiptap/ProseMirror `contenteditable` `<div>` now has `aria-label="Mensagem para o Copilot"` directly on a role-less `<div>` (`.tiptap`), which axe flags as a prohibited ARIA attribute (needs `role="textbox"` alongside the `aria-label`, or move the label to a wrapping labeled element). |
| `aria-valid-attr-value` (`/portfolio/okrs`) | critical | 1 instance | **Still present**, 1 instance | Not fixed — the OKR Progress NaN fix didn't resolve this ARIA attribute value issue (likely a different attribute on the same/adjacent progress indicator). |
| `nested-interactive` (`/portfolio/strategy-map`) | serious | 3 nodes | **Still present** | Not fixed — the epic-chip nesting fix did not land or didn't fully resolve it. |
| `document-title`, `html-has-lang` (`/portfolio/tags`, `/settings/roles`) | serious | Symptom of the 2 crash bugs | **0 — fixed** | Confirmed gone now that both pages render (no more Next.js dev error overlay). |

**Net a11y assessment**: the two CRITICAL crash bugs and 3 violation types (`select-name`, `aria-input-field-name`, `document-title`/`html-has-lang`) are genuinely fixed. `button-name` is mostly fixed (29→5 routes). `color-contrast` — the headline target of this pass — is **not meaningfully improved** (still 28/29 routes) because the fix only addressed one specific token pairing; a fuller contrast audit is still needed. One new regression introduced (`aria-prohibited-attr` on `/copilot`).

### Production build (`next build`, Turbopack): still FAILS

Same blocker as before, **not resolved**:

```
Error: Turbopack build failed with 1 errors:
./apps/app/app/api/webhooks/liveblocks/route.ts:3:1
Module not found: Can't resolve '@liveblocks/node'
```

Root cause confirmed: `@liveblocks/node` **is** declared in `apps/app/package.json:34` (`"@liveblocks/node": "^3.11.0"`), but it is **not installed** — `node_modules/@liveblocks/` only contains `client/` and `react/`, no `node/`. The dependency was added to `package.json` but the install step (`pnpm install` / workspace lockfile update) was never run. This is an environment/install-step gap, not a code bug — not fixed here per instructions (build troubleshooting only, no app-code changes), but it's a one-command fix (reinstall deps) rather than a code issue.
