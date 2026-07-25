# Cosmos Full Implementation — Program Index

> Program to implement `cosmos.html` (canonical design, Claude Design project `691f7fe5`) end-to-end against `Requisitos-Funcionais-Cosmos.md`, following the RF doc §9 priority tiers. Each tier is a **separate, independently shippable plan**.

**Goal:** Turn the 9 rendered cosmos screens (static demo data) + remaining ComingSoon screens into a fully functional, real-data, multi-tenant SAFe LPM platform matching design + functional requirements.

---

## Verified Current State (2026-07-19)

**Done / production-grade:**
- **Auth**: `requireTenantSession`, `requireRole` (`packages/auth/server.ts`) — better-auth, multi-tenant via `activeTenantId`, 2FA, `MemberRole` enum, `TenantContext {userId,tenantId,role,user}`, `AuthError`.
- **Schema**: COMPLETE. Every domain model exists (Epic w/ denormalized board read-model, Feature, Story, Task, OKR, KeyResult, Risk, Team, PIObjective, ConfidenceVoteSession/Tally, FlowMetricSnapshot, StrategicTheme, StrategyPillar, LeanBudget, Anomaly, DependencyLink, RoadmapItem, DecisionLogEntry, GovernedEpic, Sprint, Retrospective, ART, Integration, WebhookEndpoint, Copilot, Notification, …).
- **Kanban** (`/cosmos/kanban`): fully wired to real data — `listEpics`/`moveEpic`/`createEpic` server actions (`requireTenantSession` + `requireRole` + audit log + `revalidateTag`). **This is the wiring template for every other screen.**
- **Shell / kit / registry / modal infra**: `components/cosmos/{shell,kit,modal,icons}.tsx`, screen `registry.tsx`, `[[...seg]]` route (supports `/cosmos/<id>/<param>`).
- **9 screens rendered** (design-faithful, static `lib/cosmos-data.ts`): dashboard, kanban (real), wsjf, teams, okrs, risks, flow, program, piplanning.

**Gaps:**
- **Dev auth**: `listEpicsDev`/`moveEpicDev`/`createEpicDev` scaffolds exist because dev has no session. Retire via real dev session.
- **Static data**: 8 screens read `cosmos-data.ts` instead of tenant-scoped Prisma.
- **Missing screens**: Epic Detail, Feature Detail, + all ComingSoon (themes, strategy, budgets, roadmap, governance, decisions, dependencies, capacity, velocity, measure, workflows, solution, integrations, settings, copilot, executive).
- **Missing interactions** (RF): creation/edit modals, drag persistence, command palette (⌘K), live presence, toasts, EntityLinkField, empty-state CTAs.

---

## Wiring Pattern (every screen follows this)

1. **Read-model server action** in `app/(cosmos)/actions/<domain>.ts`:
   ```ts
   export async function list<Domain>(): Promise<Result<View[]>> {
     const ctx = await requireTenantSession(await headers());
     // tenant-scoped Prisma query → map to screen View type
   }
   ```
2. **Mutations** gated by `requireRole([...], ctx)` + `logAudit` + `revalidateTag`.
3. **Screen** consumes the action (server component fetch or client action call), replacing the `cosmos-data.ts` import.
4. **Modals** (creation/edit) follow RF-94: live preview + `EntityLinkField`.

---

## Tiers → Plans (§9 order)

| Tier | Plan file | Screens / scope | Primary models |
|------|-----------|-----------------|----------------|
| **0 · Foundation completion** | `2026-07-19-cosmos-t0-foundation.md` (**Plan 1, detailed**) | Real dev auth (retire `*Dev`); design-token consolidation; **Epic Detail** + **Feature Detail** screens | Epic, Feature |
| **1 · Portfolio core data** | `…-t1-portfolio.md` (author when reached) | Wire dashboard, wsjf, themes, strategy, okrs, budgets to real data + their modals | Epic, StrategicTheme, StrategyPillar, OKR, KeyResult, LeanBudget |
| **2 · Execution** | `…-t2-execution.md` | Wire program, piplanning, dependencies, risks, capacity, roadmap + modals | PIPlan, PIObjective, ConfidenceVote, DependencyLink, Risk, Team, RoadmapItem |
| **3 · Governance & Teams** | `…-t3-governance.md` | governance + gates, decisions, teams, team detail | GovernedEpic, DecisionLogEntry, Team, TeamCapacitySnapshot |
| **4 · Analytics** | `…-t4-analytics.md` | flow, velocity, measure & grow | FlowMetricSnapshot, Sprint, CompetencyAssessment |
| **5 · Platform** | `…-t5-platform.md` | integrations/webhooks, settings (RBAC UI/SSO/audit), workflows, solution, copilot, board snapshot | Integration, WebhookEndpoint, TenantSSOConfig, SolutionTrain, CopilotSession |
| **X · Cross-cutting** | `…-tx-crosscutting.md` | RF-90..97: ⌘K palette, live presence (Liveblocks/RNF-10), toasts, EntityLinkField, empty states, tour | — |

**Rule:** each tier plan is authored + approved + executed before the next. Cross-cutting (X) lands incrementally alongside tiers as its primitives are first needed (toasts + EntityLinkField in Tier 0/1).

---

## Execution
Author Plan 1 → approve → execute (subagent-driven per task) → verify → author Plan 2. Repeat.
