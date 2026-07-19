# Cosmos — 6 screens ported (batch #5)

**Date:** 2026-07-19
**Branch:** feat/kanban-portfolio-ai

## Done
Ported 6 SAFe screens jsx→tsx, wired to registry + typed demo data.

| Screen | Route | Data |
|--------|-------|------|
| Times | /cosmos/teams | TEAMS_DIR |
| OKRs | /cosmos/okrs | OKRS |
| Riscos (ROAM matrix) | /cosmos/risks | RISKS, ROAM_TONE |
| Flow Metrics | /cosmos/flow | FLOW |
| Program Board | /cosmos/program | PI_TEAMS, SPRINTS, FEATURES, MILESTONES |
| PI Planning | /cosmos/piplanning | PI_TEAMS, PI_OBJECTIVES, CONFIDENCE_VOTE, ROAM_RISKS |

## Files
- `apps/app/lib/cosmos-data.ts` — appended typed data (batch 2 + 3) from `design/components/cosmos-data2/3.jsx`
- `apps/app/components/cosmos/screens/{teams,okrs,risks,flow,program,piplanning}.tsx` — new
- `apps/app/components/cosmos/screens/registry.tsx` — 6 entries added

## Verify
- tsc: 0 errors in cosmos/registry (24 pre-existing errors in test files, untouched)
- Routes: all 6 → HTTP 200
- Browser: teams renders full-fidelity (KPIs, squad cards, capacity bars, active nav). Console errors = CSP/posthog noise only.
- Screenshot: `cosmos-teams.png`

## Notes / next
- Method: 6 parallel porter subagents, each mechanical jsx→tsx (preserve markup/styles/values verbatim, add types + kit/cosmos-data imports).
- Minor: some screens import `Tone`/`Art` type unused after biome — harmless, biome may flag.
- Remaining ComingSoon screens (nav has ~27 ids): themes, value, strategy, budgets, tags, anomalies, roadmap, governance, decisions, dependencies, capacity, velocity, measure, workflows, solution, integrations, settings, executive. Source jsx exists in `design/components/` for most — same port recipe.
- Dashboard/WSJF still use static EPICS/WSJF_ITEMS (not real DB). Wiring to real data = separate increment.
