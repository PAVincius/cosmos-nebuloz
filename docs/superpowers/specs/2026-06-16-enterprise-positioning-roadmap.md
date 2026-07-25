# Cosmos — Enterprise Positioning Roadmap

**Date:** 2026-06-16
**Branch context:** `feat/kanban-portfolio-ai`
**Source:** Strategic analysis transcript ("Nebulose/Cosmos differentiation") + codebase inventory

---

## 1. Strategic Thesis

The transcript's core argument: feature parity with Jira Align / Planview does **not** win Enterprise deals. A new vendor wins by changing the narrative from *"we also have X"* to *"we do X natively, continuously, frictionlessly."* Three narrative shifts:

1. **Invisible Governance** — compliance/finance that does not punish team agility.
2. **Multi-Vendor Hub** — orchestrating hybrid ecosystems as the *central identity*, not a side feature.
3. **Executive Translation** — predictive math (Monte Carlo) reframed as executive confidence, not statistics jargon.

**Key finding from inventory:** Cosmos already has most of the *engine*. The work is predominantly a **surface layer + narrative reframe + targeted model gaps**, not greenfield. This roadmap maps each pillar to existing code, names the real gaps, and sequences the work.

> **Sequencing caveat (from project strategy memory):** The #1 MRR blocker remains the **meeting-bot integration** (Otter/Fireflies/Fathom webhook → decisions/risks/actions), which unlocks the TOTVS live trial. These 3 pillars are *Enterprise-differentiation / sales-narrative* work. They should not displace the meeting-bot gate as the path to first paying customer. Treat this roadmap as positioning work that runs alongside, or immediately after, the meeting-bot ships. Verify current meeting-bot status before scheduling.

---

## 2. Pillar Inventory: Exists vs. Missing

### Pillar 1 — Invisible Governance

**Narrative:** "Motor de capitalização invisível" — auto-classify CapEx/OpEx from status transitions (kill manual timesheets) + shift-left security gate on the portfolio Kanban (no card advances without security requirements met). "A highway that only lets you accelerate with your seatbelt on."

| Exists | Where |
|---|---|
| Cost / budget models | `packages/database/prisma/schema/portfolio.prisma` — `CostSnapshot`, `CostAnomaly`, `BudgetPlan` |
| Lean budget actions | `apps/app/app/actions/lean-budget/` |
| Budgets UI | `apps/app/app/(authenticated)/portfolio/budgets/` |
| Portfolio Kanban | `apps/app/app/(authenticated)/dashboard/portfolio/components/{kanban-board,kanban-column,kanban-card}.tsx` |
| State transition history | `StateTransitionHistory` model (story→feature→epic transitions) |
| Audit log | `AuditLog` model |
| SOC2 vendor/compliance policy docs | `docs/compliance/soc2/policies/` |

| Missing (gaps) | Notes |
|---|---|
| **Auto-capitalization engine** | No logic that reads `StateTransitionHistory` and classifies effort as CapEx (e.g. IMPLEMENTING) vs OpEx (e.g. maintenance), producing capitalizable cost without timesheets |
| **Security gate on Kanban** | No definition-of-done / security-requirement gate blocking column advancement |
| **SOX/SOC2 as live in-product controls** | Policies exist as docs, not as enforced/auditable in-app gates surfaced to users |

### Pillar 2 — Multi-Vendor Hub

**Narrative:** Elevate vendor orchestration from a backlog item to the *central commercial pillar*. Centralize Jira/tooling data from multiple consultancies into one global progress metric ("a universal currency exchange"). Convert hours-based contracts to a unified sprint/OKR delivery cadence — pay for business value, not hours.

| Exists | Where |
|---|---|
| Supplier models | `Supplier`, `SupplierDeliverable` (links Supplier→Feature, expected/actual dates) |
| Solution Train aggregate | `SolutionTrain` (suppliers, capabilities, epics, risks at Large Solution level) |
| Integration infra | `Integration`, `SyncLog`, `LinearSync`, `GitHubSync` + connectors (Linear/GitHub/Asana/GitLab) |
| Jira client (read-only) | `apps/app/lib/migration/jira-client.ts` (discover projects, fetch issues) |
| Sync field mapping | `apps/app/app/actions/integrations/sync/sync-mapping.ts`, `conflict-resolver.ts` |
| Suppliers UI | `apps/app/app/(authenticated)/suppliers/` |
| OKR / KeyResult | `OKR`, `KeyResult`, `KeyResultSnapshot` + OKR dashboard UI |
| Feature ↔ external link | `Feature.externalId` / `externalSource` |

| Missing (gaps) | Notes |
|---|---|
| **Unified progress aggregator** | No rollup that converts external + internal work into a single normalized progress metric per portfolio/epic |
| **Contract model** | No `Contract` entity (SLA, hours-based vs sprint/OKR billing, terms, penalties) |
| **Contract→cadence conversion** | No mechanism to convert hours-based contracts into sprint/OKR delivery cadence |
| **Vendor health dashboard** | Metrics derivable but no UI for on-time %, SLA compliance, delivery velocity per supplier |
| **Jira bidirectional sync** | Only one-time import; Linear/GitHub have full bi-sync, Jira does not |
| **Supplier-of-supplier / cross-vendor dependency** | No model for vendor dependency chains |

### Pillar 3 — Executive Translation

**Narrative:** The math runs backstage; the executive sees answers. Replace "probabilistic analysis / P85 / 100k iterations" with a visual "Índice de Confiança Executiva" (red/amber/green release-date semaphore) and business-language report copy ("real-time delivery SLA assurance"). Answers the only question that matters to a C-level: *"Will my product ship on time?"*

| Exists | Where |
|---|---|
| Monte Carlo engine | `apps/app/lib/analytics/monte-carlo.ts` (P50/P70/P85/P95 throughput forecast, outlier detection) |
| Executive dashboard | `apps/app/app/(authenticated)/analytics/executive/` (KPI tiles, trend charts, ART health table) |
| Flow metrics + predictability | `flow-metrics.prisma`, `apps/app/app/actions/flow-metrics/` |
| Capacity forecast chart | `apps/app/app/(authenticated)/analytics/flow/components/capacity/capacity-forecast-chart.tsx` (p10–p90 error bars) |
| Anomaly severity colors | `flow-intelligence.prisma` (`Anomaly` severity → color-coded) |
| Scheduled reports + PDF export | `reporting.prisma` (`ScheduledReport` EXECUTIVE_SUMMARY etc.), `apps/app/app/actions/reporting/pdf-export.ts` |
| Confidence voting | `ConfidenceVoteSession` + PI planning panel |

| Missing (gaps) | Notes |
|---|---|
| **Executive Confidence Index** | No single user-facing RAG semaphore translating Monte Carlo output into a "will it ship on time" verdict per epic/release |
| **Probabilistic release-date prediction (user-facing)** | Monte Carlo computes percentiles but no surfaced "85% confident: ships by Sprint X / date Y" |
| **Business-language report copy** | Reports use technical terms; no business-impact phrasing layer (jargon → "delivery SLA assurance") |

---

## 3. Sequencing Recommendation

Ordered by **(differentiation impact ÷ build effort)** — quick demo wins first, deepest moat last.

| Order | Pillar | Effort | Why this order |
|---|---|---|---|
| **1st** | **Pillar 3 — Executive Translation** | **Low** | Engine (Monte Carlo, dashboards, reports) already exists. Work is a presentation/copy layer: Confidence Index semaphore + release-date surfacing + report copy. Highest sales-demo impact per unit of work. Ship a "wow" fast. |
| **2nd** | **Pillar 1 — Invisible Governance** | **Medium** | Cost/budget/audit/transition models exist; build the auto-capitalization engine (read `StateTransitionHistory`) + security gate on the portfolio Kanban (active branch already touches this area). Strong Enterprise differentiator. |
| **3rd** | **Pillar 2 — Multi-Vendor Hub** | **High** | Biggest strategic moat but most net-new: `Contract` model, unified progress aggregator, Jira bi-sync, vendor health dashboard. Worth doing once the quick wins are banked. |

Each pillar gets its **own** spec → plan → implementation cycle. This roadmap is the index; per-pillar specs follow.

---

## 4. Differentiator Framing (for sales / PRD copy per pillar)

- **Pillar 1:** "Compliance that doesn't tax agility." Kill timesheets; capitalization is a byproduct of normal work. Security is a guardrail, not a gate meeting.
- **Pillar 2:** "The hybrid-ecosystem orchestrator." One global progress metric across every consultancy's Jira. Pay for delivered value, not logged hours.
- **Pillar 3:** "Will it ship on time? — answered." Executive confidence semaphore; the statistics stay backstage.

---

## 5. Next Step

Drill into **Pillar 3 (Executive Translation)** first via the brainstorming → writing-plans cycle, producing its own design spec and implementation plan. Revisit sequencing if the meeting-bot MRR gate takes priority.
