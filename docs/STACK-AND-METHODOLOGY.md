# Cosmos — Stack & Feature Methodology

Tech stack, and the methodology/technique behind each product feature, with source references.

**Last Updated**: 2026-07-08

---

## Tech Stack

**Frontend**
- Next.js 15 (App Router) + React, TypeScript 5.9
- shadcn/ui + Tailwind CSS (`packages/design-system`)
- Tiptap (rich text)
- Liveblocks (realtime collab, cursors, CRDT)
- XState (state machines)
- Vercel AI SDK (`ai` + `@ai-sdk/*`) for chat/copilot UI

**Backend**
- Prisma ORM + PostgreSQL (Neon serverless, `@prisma/adapter-neon` + `pg`)
- better-auth (multi-tenant auth, `@repo/auth`)
- Server Actions (`safeAction` HOF pattern, `@repo/actions`)
- Stripe (+ `@stripe/agent-toolkit`) for billing
- RBAC package (`@repo/rbac`)
- Webhooks package

**AI**
- Anthropic (`@ai-sdk/anthropic`, `@anthropic-ai/sdk`), Google (`@ai-sdk/google`), OpenAI (`@ai-sdk/openai`) — multi-provider
- Langfuse (LLM observability/tracing)

**Infra / Platform**
- Monorepo: pnpm + Turborepo
- Deploy: Vercel (next-forge base, `@vercel/toolbar`, `@vercel/blob`)
- Storage: Supabase Storage + Vercel Blob
- Rate limit: Upstash Redis
- Feature flags: Vercel Flags SDK
- Observability: Sentry + Logtail (BetterStack)
- AWS SDK (Cost Explorer + Pricing) for FinOps

**Quality/Testing**
- Biome (via ultracite) — lint/format
- Vitest (unit) + Playwright (E2E)

Base: **Next Forge 5.3.2**.

---

## Feature → Methodology Mapping

| # | Feature | Methodology / Technique | Source | How it's implemented |
|---|---|---|---|---|
| 1 | Epic Prioritization | **WSJF** (Weighted Shortest Job First) | `packages/safe-engine/src/wsjf.ts:1-32`; `apps/app/app/actions/wsjf/score.ts:122-123`; `docs/prd.md` story-015 | `calculateWSJF({bv,tc,rr,js}) = (bv+tc+rr)/js`. Cost scored on Modified Fibonacci `[1,2,3,5,8,13,20]` (`findInvalidFibonacci`, `wsjf/score.ts:31`) |
| 2 | Portfolio Kanban | **SAFe Portfolio Kanban** (funnel-based epic lifecycle) | `docs/srd-epic-006.md:10`; `packages/safe-engine/src/machines/epic-lifecycle.ts` | XState machine: FUNNEL→ANALYZING→PORTFOLIO_BACKLOG→IMPLEMENTING→DONE/REJECTED, WIP limits per column, governance gates (INVEST score, lean budget) before promotion |
| 3 | Team Kanban / Sprint Board | **SAFe Team Kanban** | `apps/app/app/(authenticated)/teams/[teamId]/kanban/`; `docs/srd-epic-006.md` FR-023 | TODO/IN_PROGRESS/IN_REVIEW/DONE, real-time via Liveblocks/Yjs CRDT, soft/hard WIP limits, overcommitment/anomaly guards |
| 4 | User Story Quality Gate | **INVEST** (Independent, Negotiable, Valuable, Estimable, Small, Testable) | `apps/app/app/actions/stories/invest-utils.ts`, `invest.ts`; `docs/srd-epic-006.md` FR-021 | Six-criterion automated check on story save (I/N=WARNING, V/E/T=ERROR blocks READY status); SM override with audit trail; also applied at epic level via AI (`analyze-invest.ts:93`) |
| 5 | PI Planning Confidence Vote | **SAFe Fist of Five** | `docs/srd-epic-006.md:15,202`; `confidence-vote-panel.tsx`; `packages/safe-engine/src/confidenceVoteMachine.ts` | 1-5 anonymous vote, aggregate score with configurable reveal threshold (default ≥50% participation), commitment threshold gate (default 3.0), XState OPEN→TALLYING→REWORK→APPROVED |
| 6 | PI Planning workspace | **SAFe PI Planning event** (2-day ART ceremony, 8-12 wk cadence) | `docs/pi-planning/PRD.md:16-24`; `docs/srd-epic-006.md` FR-013 (PIPlan DRAFT→PLANNING→COMMITTED→EXECUTING→CLOSED) | Context & Agenda, Team Breakout (load vs capacity), Program Board, PI Objectives, ROAM risks, Confidence Vote |
| 7 | Program Board | **SAFe Program Board** | `docs/pi-planning/PRD.md` §12.1; `docs/srd-epic-006.md` story-020 | Grid of teams × sprints, feature cards, cross-team dependency arrows (SVG overlay, conflict highlighting), milestone markers |
| 8 | PI Objectives / Business Value | **SAFe PI Objectives + Program Predictability Measure (PPM)** | `docs/srd-epic-006.md` FR-016 | Committed vs stretch objectives, Business-Owner value score (1-10); PPM = `Σ(achievedValue/plannedValue × businessValue)/Σ(businessValue)` excluding stretch |
| 9 | Risk Management | **ROAM** (Resolved, Owned, Accepted, Mitigated) | `docs/srd-epic-006.md` FR-018; `apps/app/app/actions/risks/roam-transition.ts` | 2×2 drag board, quick-poll majority classification, hard-block on un-ROAMed risk before PI commitment |
| 10 | Flow Metrics Dashboard | **SAFe 6D Flow Metrics** (velocity/time/efficiency/load/distribution + cycle/lead time, throughput, WIP) | `docs/srd-epic-007.md` FR-010; `docs/superpowers/plans/2026-05-26-t04-flow-metrics-ui.md` | Cycle-time box plots, outlier detection via median + 2×IQR, ART-level weighted aggregation, PI-over-PI benchmarking |
| 11 | Throughput Forecasting | **Monte Carlo simulation** | `docs/srd-epic-007.md` FR-010; `apps/app/lib/analytics/monte-carlo.ts`; `flowMetrics.ts:10,63` | 1,000-iteration probabilistic forecast over historical throughput samples, percentile output bands (p25/p50/p70/p85/p95-style), cached 1h |
| 12 | Cumulative Flow Diagram (Portfolio) | **CFD** (Kanban/Lean flow visualization) | `analytics/flow/components/portfolio-cfd-chart.tsx`; `app/actions/analytics/portfolio-cfd.ts` | Stacked-area chart of work-item counts per status over time. *Little's Law not explicitly cited in code/docs — inferred from structure only* |
| 13 | Velocity & Capacity Analytics | **SAFe Predictability Measure** (team level) | `docs/srd-epic-007.md` FR-011 | Committed/completed/accepted bar chart, rolling averages, explicit ≥80% SAFe benchmark |
| 14 | Measure & Grow / Competency Assessment | **SAFe 7 Core Competencies of Business Agility** | `competency-radar.tsx:26-31` | Radar chart of assessed maturity (Agile Product Delivery, Enterprise Solution Delivery, Organizational Agility, Continuous Learning Culture, Lean-Agile Leadership, Team & Technical Agility, Lean Portfolio Management), assessor-validated + improvement-action tracking |
| 15 | Anomaly / Flow Intelligence Detection | Rule-based + statistical thresholds (SPC-style, >2σ) | `docs/srd-epic-007.md` FR-001/002 (R-VEL/R-WIP/R-IMP/R-DEP/R-OBJ/R-RISK/R-EPIC/R-STALE/R-CYCLE/R-FLOW/R-OKR); `docs/srd-epic-006.md` FR-023 | Nightly cron scans flow/velocity/dependency data against versioned thresholds (e.g. >2σ velocity drop, >30% estimation drift) |
| 16 | Lean Budgets | **SAFe Lean-Agile Budgeting** (guardrails) | `docs/srd-epic-006.md` FR-015; `docs/lean-budget/LEAN_BUDGET.md`, `PRD.md` | Per-ART-per-PI CapEx%/OpEx% split (=100), participatory budgeting via epic allocation, soft/hard caps + variance guardrails |
| 17 | Strategic Themes / Roadmap | **SAFe Strategic Themes + 3-Horizon planning** | `docs/srd-epic-007.md` FR-026 | Themes tagged Near/Mid/Far horizon (H1/H2/H3), target-weight bands, concentration alerts, WSJF-weighted alignment heatmaps |
| 18 | OKRs | **Objectives and Key Results** | `docs/prd.md` Goal 6; `docs/srd-epic-007.md` FR-025 | 1-5 key results per objective, quarterly cadence, webhook-driven KR updates, linear-projection "At Risk" flags, cascade Portfolio→ART→Team |
| 19 | Strategy Map / Traceability | Goal-tree traceability DAG (internal technique) | `docs/srd-epic-007.md` FR-027 | Directed-acyclic-graph canvas: Theme→OKR→Epic→Feature→Story→Sprint, orphan/broken-link ("alignment gap") detection |
| 20 | Solution Train / Large Solution | **SAFe Large Solution level** (Solution Train, LACE) | `docs/prd.md` Epic 8; `docs/srd-epic-008.md` story-039 | Solution-level Program Board and ROAM board above ART level, `LACE_MEMBER` role |
| 21 | DevOps Integration Metrics | **DORA metrics** (Deployment Frequency, Lead Time for Changes, Change Failure Rate, MTTR) | `app/actions/integrations/sync/github-pull.ts:1,221` (story-025); `docs/prd.md` story-025 | Deployment events recorded on GitHub webhook ingestion, feeding DORA metrics into the Continuous Delivery Pipeline competency |
| 22 | FinOps Cost Model | **FOCUS 1.1** (FinOps Open Cost and Usage Specification) | `docs/prd.md`; `docs/srd-epic-007.md` FR-012/013 | Standardized `BillingEntry` schema ingesting AWS Cost Explorer data (FOCUS 1.1 compliant), tied to epic cost attribution feeding Lean Budget guardrails |
| 23 | AI Copilot / RAG | **Hybrid retrieval via Reciprocal Rank Fusion (RRF)** over pgvector + Postgres FTS | `packages/database/vector-search.ts:19-23,69`; `docs/superpowers/plans/2026-05-26-t03-rag-pi-planning.md:9` | Cosine similarity (pgvector `<=>`) fused with `plainto_tsquery`/`ts_rank` full-text search (`to_tsvector('portuguese', ...)`) via RRF (`1/(k+rank)`, k=60), role-aware context assembly, tool-calling with confirmation gates |
| 24 | BPMN Workflow Modeling | BPMN 2.0 → State-machine (statechart) compiler (internal technique) | `docs/srd-epic-007.md` FR-030/031 | bpmn-js 18 modeler, deterministic catalogue-driven compiler from BPMN diagrams to runtime XState machines |
| 25 | Governance / Approval Workflows | Formal state-machine-gated approvals (SAFe-adjacent, not a named external framework) | `docs/prd.md` story-016; `docs/srd-epic-006.md` FR-009/010 | Approval requests gated on epic-lifecycle transitions (e.g. INVEST score + budget guard) before advancing |
| 26 | Multi-tenant Security Model | PostgreSQL RLS + FORCE RLS (defense-in-depth, architectural not SAFe) | `docs/prd.md`; `.claude/COMMON_MISTAKES.md` #1 | Every table RLS-scoped to `tenantId`/`orgId`, `requireTenantSession` enforced server-side, audited (SOC2 CC6.1, LGPD Art. 18 cited) |

*Note on Little's Law: no direct textual reference found in `docs/` or flow-metrics/CFD code. The CFD/flow-metrics implementation is consistent with the WIP = Throughput × Cycle Time relationship, but this is inferred from structure/naming only.*

---

## Design System — Core Principles

Two explicitly documented design layers (`docs/design/DESIGN-COSMOS-PRODUCT.md:6,11`, "Two-layer identity"):

### 1. Marketing layer (`docs/design.md`)
- Dark-first, near-pure-black canvas (`#010102`), Linear-inspired density
- Single accent color discipline: lavender/indigo `#5e6ad2` as the *only* accent — no other brand colors, no atmospheric gradients
- Typography: Linear Display / Text (SF Pro-style), negative tracking (`-3.0px` display-xl / `-0.025em` page titles)
- "Dados como protagonista" (data as protagonist) — product screenshots dominate over decorative illustration
- Borders as elevation: 1px hairline borders define a 4-level surface hierarchy rather than heavy shadows

### 2. Product UI layer (`docs/design/DESIGN-COSMOS-PRODUCT.md`, `docs/design-system-description.md`)
Governs authenticated dashboard/analytics surfaces:
- Canvas shifts to deep navy `#070b14` ("mais profundidade perceptual para dados") — intentional divergence from marketing's near-black
- Two-voice typography split: **Manrope** for UI labels/badges/eyebrows vs **JetBrains Mono** exclusively for numeric/KPI values. Explicit rule: never mix Manrope/JetBrains with Linear Display/Text in the same component
- Semantic 3-tone data system (green/red/amber) reserved exclusively for data-state surfaces — lavender remains the sole brand/nav/CTA accent (strict separation of brand color vs. data-state color)
- Rich per-tone KPI card language: radial gradients, "letterpress" (engraved) icons, glow-on-hover, animated ECG signal line as a "living data" motif, dot-texture overlays — all `aria-hidden` and gated behind `prefers-reduced-motion`/`motion-safe:`
- Larger radius for data cards (18px) vs marketing cards (12px) — data cards described as "more organic"
- 4-level surface hierarchy: canvas → surface → surface-2 → surface-3 → sidebar

### Cross-cutting UX/accessibility stance (`docs/design/DESIGN-EXCELLENCE-CHECKLIST.md`)
- "Software como obra de arte. Cada pixel com propósito" (software as a work of art; every pixel with purpose)
- Motion is "funcional primeiro" — indicates state change, not decoration; sub-200ms micro-interactions target for RTE/LPM personas (explicitly called out as impatient with latency)
- 4px spacing grid; fixed minimal radius/shadow token sets requiring explicit justification for any addition (anti-proliferation rule)
- WCAG AA contrast target (e.g. `#93a1b3` label ≥4.5:1, `DESIGN-COSMOS-PRODUCT.md:230`)
- Information never conveyed by color alone — badges always carry semantic text alongside color
- Persona-driven design: RTE, LPM, PO, SM, DevOps explicitly named as the audience shaping density and information-hierarchy decisions
