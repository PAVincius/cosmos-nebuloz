# Seed scripts

This directory seeds a Postgres database for local development and E2E
testing. It has no automated "correctness" contract of its own — the
contract lives in `verify:seed` (below), which is what should be trusted
over reading this file if the two ever disagree.

## Which script do I run?

| Script | Command | What it does | When to use it |
|---|---|---|---|
| `seed-e2e.ts` | `pnpm seed:e2e` | The main seed. **Wipes and recreates** the `cosmos-dev` tenant end to end: users for all 7 roles, ART/Team/Sprints, PI Plan, Epic→Feature→Story→Task chain, integrations, FinOps, governance, tenant config, flow history. This is what the Playwright fixture (`e2e/fixtures/auth-session.json`) and day-to-day local dev both run against. | Default choice. Run this first, then `pnpm verify:seed` to confirm it landed correctly. |
| `seed-tenants.ts` | `pnpm seed:tenants` | Creates **4 additional tenants** on distinct plans (Nebuloz/UNIVERSE, TechCorp/NEBULA, Startup XP/GALAXY, AgileFirst/ORBIT) for exercising feature-flag/plan-tier behavior. **This is the only place a second tenant comes from.** Seed 10 of the seed-completo plan deliberately did not duplicate this mechanism inside `seed-e2e.ts` — if you need multi-tenant isolation to be demonstrable (e.g. the last `verify:seed` assertion, "há pelo menos dois tenants de cliente com Epic"), run this. | When you need more than one tenant present — isolation testing, plan/flag testing, or to satisfy the multi-tenant `verify:seed` assertion. |
| `seed-portfolio.ts` | `pnpm seed:portfolio` | Adds portfolio-level data (Strategic Themes → OKRs, Epics/Features, WSJF) on top of an existing tenant, without touching auth/team/sprint setup. | Rarely needed standalone now that `seed-e2e.ts` covers portfolio data; kept for targeted portfolio-only reseeds. |
| `seed-admin.ts` | `pnpm seed:admin` | Creates just the admin user (`admin@cosmos.local`) + a "COSMOS Dev" tenant, via Better Auth's own `auth.$context`, so the password hash is one Better Auth itself can verify. | When you need a minimal login without the rest of `seed-e2e.ts`'s data. |
| `seed-safe-full.ts` (`packages/database`) | `pnpm --filter @repo/database seed:safe` (or `cd packages/database && pnpm seed:safe`) | An idempotent/non-destructive seed variant living in the database package, distinct from the app-level scripts. Check its own header comment before relying on it — it is maintained separately from `seed-e2e.ts` and can drift. | When you specifically need a seed that does not delete existing data first. |
| `seed-personas.ts` | — | Persona-focused seed data, used by some E2E swarm/labs tooling. | Only if a specific test explicitly requires it. |
| `seed-okr-tree-demo.ts` | — | Standalone OKR tree demo data. | Demo/manual exploration of the OKR tree UI in isolation. |
| `seed-demo-full.ts` | — | An older/alternate full-demo seed, predates `seed-e2e.ts`'s current scope. Not part of the documented E2E path. | Legacy; prefer `seed-e2e.ts` unless you know why you need this one instead. |

Everything else in this directory (`audit-raw-sql-drift.ts`, `docker-start.sh`,
`flow-status-chains.ts`, `list-users.ts`, `q.js`, `reset-pw.ts`, `skip-ci.js`,
`upgrade-plan.ts`, `ux-swarm.ts`) supports the seed/dev workflow but is not
itself a seed entrypoint. `flow-status-chains.ts` in particular is imported
by both `seed-e2e.ts` and `verify-seed.ts` — see the trap below for why it's
a separate module instead of living inside `seed-e2e.ts`.

## `verify:seed` — the plan's actual success criterion

```
pnpm verify:seed
```

Run this after any seed. It connects to the same database and asserts, via
Prisma, that specific rows and relationships exist for the seeded tenant
(`cosmos-dev` by default — override with `SEED_TENANT_SLUG`). It does not
test application code; it tests that **the seeded database contains what
every screen and every flow needs to render non-empty and be demoable**.
It exits 1 if any assertion fails, so it can gate CI. One assertion (the
two-tenant isolation check, below) is intentionally an exception: on a
fresh database where only `pnpm seed:e2e` has run, it reports a warning
instead of failing — see the "Which script do I run?" table above.

This is the central artefact of the "seed completo" plan (`.superpowers/sdd/2026-07-27-seed-completo/`).
The plan ran in ten tasks, each adding new seed data (Integrations, the
Epic→Feature→Story→Task chain, Large Solution, strategy/roadmap, FinOps,
governance/PI Planning, tenant configuration, StateTransitionHistory, a
second tenant for isolation checks). **Every one of those tasks added its
assertions to `verify-seed.ts` before writing the seed code that satisfies
them, and a task was only considered done once its new assertions passed.**
That ordering matters: `verify-seed.ts` is not a test suite bolted on
after the fact, it is the spec the seed code was written against. If you
add new seed data, add its assertion here first — otherwise there is
nothing enforcing that the seed keeps producing it on the next run.

The file is organized in one commented section per task (`// ─── Task N: ... ───`),
in the order the plan executed them, ending with a block of **unconditional
cross-tenant foreign-key leak checks** (Task 10) that run regardless of
whether a second tenant exists, because they catch the most expensive class
of bug this seed can introduce: a row in one tenant's data pointing at a
row that belongs to another tenant.

At the time of the Task 11 closeout, `verify:seed` passes all 71 assertions
against the `cosmos-dev` tenant when both `pnpm seed:e2e` and
`pnpm seed:tenants` have run (two client tenants present). Running
`pnpm seed:e2e` alone — the default path this table recommends — passes
70 and reports 1 warning (the two-tenant isolation check); it still exits
0.

## Credentials

All of the following are **development fixtures only** — do not reuse them
outside local/CI environments.

- `admin@cosmos.local` — tenant admin (created by `seed-admin.ts` and also
  present via `seed-e2e.ts`).
- One login per SAFe role, all at `@cosmos.local`:
  `ste@cosmos.local`, `rte@cosmos.local`, `po@cosmos.local`,
  `sm@cosmos.local`, `dev@cosmos.local`, `member@cosmos.local`.
- Password for all of the above: the `E2E_PASSWORD` env var, defaulting to
  `Cosmos@2026!` if unset.

## Three traps

1. **`seed-e2e.ts` has no entrypoint guard.** It calls `main()` at module
   top level unconditionally — there is no `require.main === module` /
   `import.meta.url` check. Importing *anything* from `seed-e2e.ts` (even a
   single constant) runs the whole seed as a side effect, and the seed
   begins by **deleting** the tenant's existing data. This is exactly why
   `STATUS_CHAINS` was extracted into `scripts/flow-status-chains.ts`
   instead of being exported from `seed-e2e.ts` and imported by
   `verify-seed.ts` — importing it directly would have wiped the database
   every time you ran the verifier. A fix (adding a real entrypoint guard)
   is tracked separately; until then, never import from `seed-e2e.ts`.

2. **The seed wipes and recreates `ART`, `Feature`, `Epic`, and `Story` on
   every run.** Any column elsewhere in the schema that stores one of
   those ids **without** a Prisma `@relation` (i.e. a bare string column,
   not a foreign key Prisma tracks) goes stale silently after a reseed —
   the row still has an id, but it now points at nothing, or at a
   different row than before. Five models were caught by exactly this
   during the plan. If you add new seed code that writes an id belonging
   to one of these tables, classify the column first: is it a tracked
   `@relation`, or a bare id that needs to be re-resolved after every
   reseed?

3. **RLS is active on 128 tables, and the seed only works because it
   connects as a `BYPASSRLS` superuser.** In this dev environment,
   `DATABASE_URL` connects as `postgres`, which is `rolsuper=true,
   rolbypassrls=true` — confirmed via `SELECT rolname, rolsuper,
   rolbypassrls FROM pg_roles`. If a seed or `verify:seed` query starts
   silently returning zero rows where you expected data, check which role
   the connection is using before you go looking for a data bug — a
   non-bypassing role would see nothing regardless of what's actually in
   the table.
