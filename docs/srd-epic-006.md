I now have comprehensive coverage of the entire PRD. I have enough to write a thorough SRD covering all capabilities: Portfolio Kanban, Epic Lifecycle state machine, INVEST/AI assist, WSJF, governance, PI Planning, Confidence Vote, ROAM, Features/Stories decomposition, Sprint Delivery (Standup/Burndown/Review/Retro), Defects, Impediments, and cross-team dependencies. Let me write the SRD now.

# SRD — Epic 006: Enhanced Portfolio & ART

## Overview

Epic 006 delivers the Portfolio + Agile Release Train (ART) execution backbone of Cosmos/Nebuloz: the SAFe 6.0 surfaces that connect strategic intent to team-level delivery. It is the platform's flagship acquisition wedge (PI Planning) and its primary portfolio-tier monetization driver (R$120–200K/year licensing).

**Scope (480h):**
1. **Portfolio Kanban + Epic Lifecycle** — six-state SAFe Portfolio Kanban (FUNNEL → ANALYZING → PORTFOLIO_BACKLOG → IMPLEMENTING → DONE/REJECTED) with an XState-enforced state machine, transition guards, WIP limits, lean business case, strategic themes, lean budgets, and roadmap.
2. **WSJF Prioritization** — portfolio (epic) and ART (feature) WSJF scoring with collaborative sessions and immutable history.
3. **INVEST Quality Gate + AI Assist** — INVEST scoring (epic + story level), portfolio batch analysis, acceptance-criteria generation, description improvement, title suggestion.
4. **Epic Governance** — multi-step approval workflows, GovernedEpic gating, immutable DecisionLog audit trail.
5. **PI Planning Console** — ART setup, PI plan lifecycle, PI objectives, program board, participant management, real-time PISession facilitation.
6. **Confidence Vote** — multi-round anonymous fist-of-five voting with per-PI history and threshold-gated commitment.
7. **ROAM Risk Management** — risk register, ROAM board, AI risk surfacing, escalation.
8. **Features & Stories Decomposition** — feature backlog, readiness gating, story decomposition, vertical-slice splitting, traceability.
9. **Sprint Delivery** — sprint lifecycle, async standup, burndown/velocity, sprint review, retrospective, task management, defect tracking, impediment management.

**Personas served:** RTE/STE, Portfolio Manager/CPO, CTO/VP Eng, Product Manager, Product Owner, Scrum Master, System Architect, Business Owner, Finance Partner/CFO, Developer/Team Member, Org Admin, External Observer.

**Architecture:** XState 5 (state machines), Inngest 4.4 (background AI + crons), Vercel AI SDK 5.0 (streaming), Liveblocks 3.11 (real-time, orgId-scoped rooms), pgvector + Upstash Redis (RAG + rate limit/cache), Prisma 7 + PostgreSQL with RLS scoped to `orgId`. All bounded contexts (`art-core`, `planning`, `portfolio`, `flow-intelligence`, `system`) already exist; this epic extends them.

---

## Functional Requirements

### FR-001: Portfolio Kanban Board
- **Description:** Central six-column Kanban visualizing all epics across all ARTs the user can access, with configurable per-column WIP limits, color-coded strategic-theme badges, WSJF/budget/feature-count card metadata, filtering (ART, theme, owner, horizon, WSJF range, budget status), URL-persisted filter state, and real-time drag-and-drop state transitions broadcast via Liveblocks.
- **Actors:** Portfolio Manager/CPO, RTE, Enterprise Architect, Business Owner, CTO.
- **Priority:** Must Have
- **Dependencies:** FR-002 (state machine), FR-006 (WSJF), FR-014 (themes), FR-015 (lean budget), `get-portfolio` flow (FR-005).
- **ACs:**
  - Given a portfolio with 12 epics across 4 states, When a user with `portfolio:read` loads the board, Then all 12 epics render in correct columns within 2s and WIP header counts match actual counts.
  - Given a column with WIP limit 5 holding 5 epics, When a 6th is dragged in, Then a WIP-violation modal appears and the move only completes if the user confirms with `portfolio:wip-override`.
  - Given two users viewing the board, When one moves an epic FUNNEL→ANALYZING, Then the second sees it within 1s without refresh.
  - Given a move to REJECTED with no reason, Then the transition is blocked and the reason field (10–500 chars) is flagged required.

### FR-002: Epic Lifecycle State Machine
- **Description:** XState 5 machine enforcing the directed transition graph; all transitions execute through the `epics` server action in a Prisma transaction that writes `StateTransitionHistory` (append-only) and publishes `epic/status.changed`. Invalid transitions return HTTP 422 `INVALID_TRANSITION`; failed guards return `GUARD_FAILED` / `APPROVAL_REQUIRED`; terminal-state exits return `TERMINAL_STATE`; insufficient role returns 403 `INSUFFICIENT_ROLE`. A DB trigger blocks any status write that bypasses allowed pairs.
- **Actors:** RTE, PM (limited: FUNNEL↔ANALYZING only), Portfolio Manager, Business Owner, System (AI auto-transitions, `userId=null`).
- **Priority:** Must Have
- **Dependencies:** FR-007 (INVEST guard), FR-009 (governance guard), FR-015 (budget guard).
- **ACs:**
  - Given a FUNNEL epic, When a CONTRIBUTOR attempts FUNNEL→PORTFOLIO_BACKLOG directly, Then API returns 422 `INVALID_TRANSITION` and status is unchanged.
  - Given an ANALYZING epic with `investScore=null`, When RTE attempts →PORTFOLIO_BACKLOG, Then 422 `GUARD_FAILED` listing `investScore`.
  - Given a successful FUNNEL→ANALYZING, Then a `StateTransitionHistory` row is inserted with fromStatus, toStatus, transitionedAt, userId.
  - Given a DONE epic, When any outbound transition is attempted, Then 422 `TERMINAL_STATE`.
  - **Transition guards:** ANALYZING→PORTFOLIO_BACKLOG requires `investScore≥threshold`, `hypothesis≥50 chars`, ≥1 business outcome, non-empty `mvp`. PORTFOLIO_BACKLOG→IMPLEMENTING requires (if workflow configured) `GovernedEpic.status=APPROVED`, `leanBudgetAllocation>0`, ≥1 linked Feature, valid active `strategicThemeId`. IMPLEMENTING→DONE requires ≥1 CLOSED PI cycle with epic features + ≥1 measured leading indicator. Any→REJECTED requires `reason≥20 chars` written to `DecisionLogEntry`.

### FR-003: Epic Lean Business Case
- **Description:** Structured business-case form (hypothesis, ≤5 business outcomes, ≤5 leading indicators, NFRs, MVP, size S/M/L/XL) with 800ms-debounce autosave, hypothesis-structure soft validation, Copilot "Draft for me", version snapshots (last 50 retained), and a progress panel aggregating feature/story/PI-objective/budget data with required hypothesis-resolution (VALIDATED/PARTIALLY_VALIDATED/INVALIDATED) at DONE.
- **Actors:** Epic Owner (PM/CPO), Enterprise Architect, Business Owner, RTE, Copilot.
- **Priority:** Must Have
- **Dependencies:** FR-002, FR-022 (Copilot), FR-015 (budget burn widget).
- **ACs:**
  - Given a Copilot-drafted hypothesis is saved, Then a version snapshot is stored and accessible from epic audit history showing prev/new per field.
  - Given a DONE epic, When the user closes detail without setting hypothesis resolution, Then a blocking prompt requires VALIDATED/PARTIALLY_VALIDATED/INVALIDATED.
  - Given an epic with 3 features, 2 complete, Then the progress panel shows 66% with per-feature status.

### FR-004: Governed Epic Workflow (epic-level toggle)
- **Description:** Marking an epic as governed (requires `portfolio:govern`) shows a lock badge, requires a configured org governance reviewer, and gates state transitions behind a secondary approval (notification + approval action) with approval history on the timeline and alternate-approver designation when the reviewer is OOO.
- **Actors:** CPO, Org Admin, RTE, governance reviewer.
- **Priority:** Should Have
- **Dependencies:** FR-009 (approval execution), FR-002.
- **ACs:**
  - Given a governed epic in PORTFOLIO_BACKLOG, When the owner drags it to IMPLEMENTING, Then a governance approval workflow triggers, the epic does not move until approval, and the reviewer is notified within 5s.
  - Given no org reviewer configured, When governed-epic creation is attempted, Then it is blocked with a setup prompt.

### FR-005: get-portfolio Composition Flow
- **Description:** `portfolio-kanban` action composing epics + theme joins + per-ART/PI LeanBudget summary + feature counts + latest CostSnapshot burn + per-state WIP counts in a single payload, with ART-level access enforcement, pagination beyond 500 epics (50/column/page), cross-ART swim-lane view with DependencyLink connectors, an epic rollup metrics popover, and async export (PDF/XLSX/CSV) rate-limited to 10/user/hour.
- **Actors:** RTE, Portfolio Manager, CPO, CTO.
- **Priority:** Must Have
- **Dependencies:** FR-001, FR-024 (dependencies), FinOps `BillingEntryAllocation`/`CostSnapshot`.
- **ACs:**
  - Given 3 ARTs and 45 epics, When the portfolio loads, Then all render in correct columns, WIP counts are accurate, and p95 page render < 1.5s.
  - Given two cross-ART epics with an IDENTIFIED DependencyLink, When Cross-ART View is active, Then a connector line renders and hover shows the dependency description.
  - Given active filters, When Export>CSV is chosen, Then the system prompts filtered-vs-all before download.

### FR-006: WSJF Scoring Engine (Epic + Feature)
- **Description:** Modified-Fibonacci (1,2,3,5,8,13,20) WSJF calculator at portfolio (epic) and ART (feature) levels: real-time `CoD=userValue+timeValue+riskReduction`, `wsjfScore=CoD/jobSize`, `normalizedScore=wsjfScore/max*100`, per-component justification notes, jobSize≥1 enforcement, confidence (LOW/MEDIUM/HIGH), immutable append-only `ScoringEvent` history, automatic backlog re-rank, AI-suggested scores (flagged `source=COPILOT`), and SA job-size locking.
- **Actors:** PM (primary), RTE, Business Owner, SA, PO, Copilot.
- **Priority:** Must Have
- **Dependencies:** FR-007 (two-axis quality/priority view), FR-019 (feature backlog).
- **ACs:**
  - Given userValue=8, timeValue=5, riskReduction=3, jobSize=5, Then displayed WSJF = (8+5+3)/5 = 3.20.
  - Given jobSize=0, When save is attempted, Then a validation error blocks the save and `wsjfScore` is unchanged.
  - Given a score change, Then a `ScoringEvent` is appended (immutable) and normalized re-sort across the full ART backlog completes < 500ms for ≤500 features.
  - Given SA-locked jobSize, When PM edits it, Then the field is read-only with locker tooltip and a request-unlock notification path.

### FR-007: INVEST Quality Gate (Epic-level AI)
- **Description:** `analyze-invest` scores an epic on the six INVEST criteria (composite 0–100, weighted V=30/E=20/N=15/S=15/I=10/T=10, configurable) via streamed `streamText`, persisting `Epic.investScore` + per-criterion JSON, auto-advancing FUNNEL→ANALYZING, enforcing content thresholds (description ≥100 chars → 422 `INSUFFICIENT_CONTENT`), Upstash rate limits (per-org tier, 429 with retry-after), 24h content-hash cache (`cached:true`), and RTE manual override (logged to `DecisionLogEntry`). Drives the ANALYZING→PORTFOLIO_BACKLOG guard.
- **Actors:** PM (primary), RTE, Business Owner, System (auto on ANALYZING).
- **Priority:** Must Have
- **Dependencies:** FR-002 (guard), FR-022 (AI infra).
- **ACs:**
  - Given a 150-char description + valid hypothesis, When analyze-INVEST runs, Then all six criteria return integer 0–100 plus composite within 30s (non-cached).
  - Given an 80-char description, Then 422 `INSUFFICIENT_CONTENT` naming `description`, score unchanged.
  - Given exhausted monthly AI credits, Then 429 with `retryAfter` at next billing period + upgrade prompt.
  - Given a prior analysis 2h ago with no field changes, When re-run without `forceRefresh`, Then cached result returns < 500ms with `cached:true`.
  - Given an RTE manual override, Then a `DecisionLogEntry` records prev/new score + justification.

### FR-008: Analyze All Epics (Portfolio Health Report)
- **Description:** `analyze-all-epics` batch Inngest job (HTTP 202 + jobId, Upstash distributed lock for per-ART dedup → 409 on concurrent), processing epics in batches of 10 (cached reused, ≥3-epic minimum), producing a score-distribution histogram, ascending-quality ranked list, per-criterion aggregate (lowest dimension), PI-planning-readiness list (score<70 configurable), theme-alignment gaps, INVEST×WSJF scatter quadrants, and `PARTIAL_SUCCESS` handling. Persists `PortfolioAnalysisReport` (90-day retention) with weekly cron + change-diff section.
- **Actors:** RTE (primary), Portfolio Manager, System Admin.
- **Priority:** Should Have
- **Dependencies:** FR-007, FR-006, Inngest crons.
- **ACs:**
  - Given an ART with 25 non-terminal epics, When triggered, Then HTTP 202 < 500ms with jobId and completion < 5 min.
  - Given a running analysis for ART-A, When a second is triggered, Then 409 with running jobId + ETA.
  - Given 5/30 epics fail on content, Then those 5 are marked "analysis unavailable" and status = `PARTIAL_SUCCESS`.
  - Given the readiness list changed vs. prior week, Then a "Changes Since Last Analysis" section is appended.

### FR-009: Epic Governance & Approval Execution
- **Description:** Multi-step (≤10) sequential/parallel approval workflows (`approverRole`, `requiresAll`, `slaHours`), DND-ordered steps, ART assignment, GovernedEpic submission (`PENDING`→`IN_REVIEW`, `currentStepIndex=0`), step advancement on `requiresAll` satisfaction, approve/reject/request-changes (reset to step 0), SLA reminders (Inngest at 80%/breach), self-approval prevention, immutable template after first use, and RTE emergency bypass (gated by `allowApprovalBypass`, ≥100-char justification, BYPASSED requests, full notification fan-out).
- **Actors:** Org Admin (workflow config), RTE, Portfolio Manager, assigned approvers (RTE/BO/PM/SA/Finance).
- **Priority:** Must Have
- **Dependencies:** FR-002 (gate), FR-010 (DecisionLog), `ApprovalWorkflow`/`GovernedEpic`/`ApprovalRequest`/`ApprovalStepInstance`.
- **ACs:**
  - Given a 3-step workflow saved, Then 3 `ApprovalStepInstance` rows exist with order 0,1,2.
  - Given a submitted epic, Then `GovernedEpic.status=PENDING`, `currentStepIndex=0`, and `ApprovalRequest` rows exist only for step 0.
  - Given step 0 `requiresAll=true` with 2 approvers and only A approved, Then index stays 0 and step 1 requests are not created.
  - Given a rejection at step 1 of 3, Then `GovernedEpic.status=REJECTED` and step 2 requests are not created.
  - Given `allowApprovalBypass=false`, When bypass is attempted, Then the button is hidden and the API returns 403.

### FR-010: Decision Log & Audit Trail
- **Description:** Immutable, append-only `DecisionLogEntry` table (RLS SELECT for ORG_ADMIN/RTE/PORTFOLIO_MANAGER only; no UPDATE/DELETE at DB level) capturing every approval, rejection, bypass, reconsideration, and INVEST override with user/timestamp/rationale; PDF + JSON export (itself audit-logged), and tombstoned retention for hard-deleted epics.
- **Actors:** Org Admin, Portfolio Manager, RTE, external auditor (via export).
- **Priority:** Must Have
- **Dependencies:** FR-009, FR-007.
- **ACs:**
  - Given an epic with 2 governance submissions (rejected then approved), When exported, Then the log contains both submissions, all approver decisions, the rejection reason, and final approval with timestamps + user IDs.
  - Given a delete attempt on a `DecisionLogEntry`, Then 405 (no delete route exists).
  - Given a PDF export, Then it contains epic title, ART/org name, chronological entries, and a footer with export timestamp + exporting user.

### FR-011: Generate Acceptance Criteria / Improve Description / Suggest Title
- **Description:** Three streamed AI assists: `generate-acceptance-criteria` (5–8 GWT items, ≤10 cap, editable cards, `source:ai|human`, `locked` flag, versioned ≤20, NFR-derived AC), `improve-description` (split-pane diff, original version snapshot, sets `investScoreOutdated`, fact-preservation, bulk 2–20 review queue), `suggest-title` (3–5 ≤80-char outcome-oriented chips, 0.1x credit, negative-language post-filter, not persisted).
- **Actors:** PM, RTE, SA, Business Owner (read AC).
- **Priority:** Should Have
- **Dependencies:** FR-022 (AI infra), FR-002 (terminal-state block).
- **ACs:**
  - Given a 200-char description + hypothesis, When generate-AC runs, Then ≥5 items with non-empty given/when/then stream within 45s.
  - Given the PM edits one AI AC item before saving, Then the edited item is `source=human` and unedited remain `source=ai`.
  - Given improve-description applied with a prior INVEST score, Then a re-analyze banner appears and `investScoreOutdated=true`.
  - Given a DONE epic, When improve-description is attempted, Then 422 `TERMINAL_STATE`.
  - Given a 50-char description + no hypothesis, When suggest-title runs, Then 422 `INSUFFICIENT_CONTENT`.

### FR-012: ART Setup & Configuration
- **Description:** Create/configure ARTs (unique case-insensitive name, strategic themes, PI cadence 8–13 wks, sprint length 1–2 wks, IP-sprint toggle, derived sprint count), add teams (one ART per team, default velocity/capacity, SM assignment, aggregate ART capacity), and modify cadence (blocked once a PI is COMMITTED/EXECUTING). Soft-delete preserves history.
- **Actors:** RTE (primary), STE, SA-Admin, Business Owner (read).
- **Priority:** Must Have
- **Dependencies:** FR-014 (themes), `ART`/`Team`/`Sprint`.
- **ACs:**
  - Given ART_ADMIN submits a valid ART form, Then an ART is created with status `INACTIVE` and redirect to detail.
  - Given a duplicate ART name, Then 409 with inline "An ART with this name already exists."
  - Given an ART with no teams, When a PI Planning session is opened, Then it's blocked with "At least one team must be added before planning can begin."
  - Given a COMMITTED PI Plan, When sprint length change is attempted, Then it is blocked.

### FR-013: PI Plan Lifecycle Management
- **Description:** PIPlan state machine DRAFT→PLANNING→COMMITTED→EXECUTING→CLOSED (forward-only; revert only by ART_ADMIN/ORG_ADMIN, audit-logged). Auto sprint generation, participant/Scrum-Master pre-checks at PLANNING, commitment gate (all objectives have plannedValue, all risks ROAMed, confidence ≥ threshold; force-commit override needs ≥20-char reason), Inngest-driven EXECUTING transition + close reminders, `achievedValue` computation at close.
- **Actors:** RTE, PM, SA, Business Owner, SM, Developer.
- **Priority:** Must Have
- **Dependencies:** FR-016 (objectives), FR-017 (confidence), FR-018 (ROAM).
- **ACs:**
  - Given a valid PI Plan creation, Then Sprint records are auto-created per ART cadence and status is `DRAFT`.
  - Given DRAFT with all preconditions, When "Open for Planning" is clicked, Then participants are notified within 30s and status → PLANNING.
  - Given a final confidence score 2.4 (< 3.0), When commit is attempted, Then current-vs-required is shown and commit is blocked without override.
  - Given a commitment override with ≥20-char reason, Then the plan commits and the reason is stored in the audit log.

### FR-014: Strategic Theme Alignment
- **Description:** Org-scoped themes (title, color, horizon Near/Mid/Far, ART associations, ≤7 active per org unless `strategy:override`), single-select epic assignment, archive (non-cascading), Strategy Map (investment distribution by count/budget/story points), target weights (sum 100%, ±concentration alerts default 60%).
- **Actors:** CTO/CPO/CEO, Portfolio Manager, Business Owner, RTE.
- **Priority:** Should Have
- **Dependencies:** FR-001, FR-005, OKR linkage.
- **ACs:**
  - Given themes with 4/6/2 epics, When Strategy Map "Epic Count" is viewed, Then bars show 33%/50%/17%.
  - Given an archived theme, When a new epic is created, Then the archived theme is absent from the dropdown but existing epics retain it in read-only.
  - Given 7 active themes and no `strategy:override`, When an 8th is created, Then it's blocked with a max-7 message.

### FR-015: Lean Budget Mechanics
- **Description:** Per-ART-per-PI `LeanBudget` (CapEx%+OpEx%=100, BRL default, immutable once PI CLOSED, one per ART/PI → 409 on dup), epic allocation (soft over-allocation warning, FUNNEL tentative, FinOps actual-vs-planned via `BillingEntryAllocation`/`CostSnapshot`), portfolio dashboard (green/yellow/red health, time-series burn), guardrails (soft/hard caps + CapEx/OpEx variance → `CostAnomaly` + notification, ≤1 soft notice/24h/ART), and immutable reallocation events.
- **Actors:** CFO/Finance, CTO/CPO, Portfolio Manager, RTE, Business Owner.
- **Priority:** Should Have
- **Dependencies:** FR-002 (budget guard), FinOps models, `CostAnomaly`.
- **ACs:**
  - Given an ART PI budget R$500k with R$450k allocated, When R$100k more is allocated, Then a R$50k over-allocation warning shows but save is allowed on confirm.
  - Given CapEx/OpEx targets 60/40 ±10% and actual 75/25, Then a MEDIUM `CostAnomaly` is created and the Portfolio Manager is notified.
  - Given a CLOSED PI Plan, When budgets are opened, Then controls are read-only.
  - Given a reallocation where source has R$100k allocated / R$110k consumed, Then the reallocation is blocked ("Resolve the budget variance first").

### FR-016: PI Objectives Management
- **Description:** Per-team objectives (≤500-char description, `stretch` flag, `plannedValue`), real-time Business-Owner value scoring (1–10, contested-flag when divergence >3, rationale for <4/>8), achieved-value capture at close, and SAFe PPM = Σ(achievedValue/plannedValue × businessValue)/Σ(businessValue) excluding stretch.
- **Actors:** PO, Business Owner, RTE, SA, Team Members.
- **Priority:** Must Have
- **Dependencies:** FR-013, FR-027 (sprint review feeds achievedValue), OKR linkage.
- **ACs:**
  - Given two BOs scoring the same objective diverging >3 points, Then it's flagged "contested" with an RTE alert.
  - Given a BO score entry, Then other participants see it within 500ms without refresh.
  - Given a closed PI with achieved values, Then PPM = weighted average of (achievedValue/plannedValue) across non-stretch committed objectives.

### FR-017: Confidence Voting (Multi-Round, Anonymous, History)
- **Description:** `ConfidenceVoteSession` opened in FINAL_PLAN: full-screen 1–5 fist-of-five overlay for non-OBSERVER participants, anonymous at the data layer (only aggregate per-score tallies stored — no user↔vote mapping), live participation count, ≥50% (configurable, min 25%) reveal gate, histogram + `aggregateScore=Σ/count`, multi-round support (`round=n`) with full per-PI history, threshold gate (default 3.0, per-ART configurable) blocking commitment, ≤10 rounds before facilitator note, immutable closed rounds, cross-PI trend chart.
- **Actors:** RTE/Facilitator, all non-OBSERVER participants, Business Owner.
- **Priority:** Must Have
- **Dependencies:** FR-013 (commit gate), FR-021 (PISession), Analytics.
- **ACs:**
  - Given an RTE opens a vote, Then all non-OBSERVER participants see the overlay within 2s.
  - Given a vote is cast, Then no record links the vote to the user — only aggregate counts are persisted.
  - Given aggregate 2.4 (< 3.0), When commit is attempted, Then "Confidence score 2.4 is below the required 3.0 threshold" blocks commit without override.
  - Given a 2nd round closes, Then both rounds' results are stored and shown on the trend chart.
  - Given 3 completed PIs, Then the cross-PI trend shows three data points (final-round score per PI) with dates and scores.

### FR-018: ROAM Risk Management
- **Description:** ROAM risk register and collaborative Kanban (Resolved/Owned/Accepted/Mitigated + Unclassified lane), risk creation (category Technical/Business/Dependency/External/Compliance/Capacity, severity, links), real-time quick-poll classification (60s timer, majority + RTE override), OWNED requires owner, MITIGATED requires ≥30-char plan, RESOLVED requires resolution note, AI risk surfacing from standup blockers/retro/velocity anomalies (`source:AI_SUGGESTED`, confidence), staleness escalation to portfolio, heatmap dashboard, and the COMMITTED hard-block on any IDENTIFIED risk.
- **Actors:** RTE (primary), SA, PM, Business Owner, SM, Copilot.
- **Priority:** Must Have
- **Dependencies:** FR-013 (commit gate), FR-029 (impediment escalation), FR-022 (AI), `Risk` model.
- **ACs:**
  - Given a risk raised in session, Then it appears on the RTE facilitation panel under "Needs ROAM Classification" within 1s.
  - Given an OWNED risk without an owner, When commit is attempted, Then commit is blocked listing the unowned risks.
  - Given a risk moved to Resolved without a resolution description, Then the transition is rejected with a validation error.
  - Given a risk OWNED past `dueDate`, When the staleness cron runs, Then it's flagged Overdue, owner+RTE are notified, and severity ≥4 escalates to portfolio.

### FR-019: Feature Backlog Management & Readiness Gate
- **Description:** ART-scoped Features (≤1 parent Epic required, ART-scoped immutable ID, status DEFINED→REFINED/READY→IMPLEMENTING→DONE/REJECTED), WSJF-ranked table/Kanban with manual rank override (scoped to `piPlanId`), Copilot feature-idea generation from epic hypothesis, Linear/GitHub import, and a configurable Readiness Checklist (WSJF present + confidence≥MEDIUM, ≥3 AC, epic linkage, team assigned, no unresolved blocking dependency, no open critical risk) with required-criterion gating and RTE override.
- **Actors:** PM, RTE, PO, SA, Business Owner.
- **Priority:** Must Have
- **Dependencies:** FR-006 (WSJF), FR-024 (dependencies), FR-018 (risks), FR-021 (program board).
- **ACs:**
  - Given Title+Description+Epic link submitted, Then a Feature is created with ART-scoped ID, status DEFINED, null wsjf fields, updated `Epic.features[]`, and an epic-owner notification.
  - Given a Feature without an Epic link, Then validation fails "Feature must be linked to an Epic" and no record is created.
  - Given a Feature missing WSJF + team, When the readiness check runs, Then exactly 2 required criteria fail, each with a fix hint, and "Ready for PI Planning" is disabled.

### FR-020: Story Decomposition & Vertical-Slice Splitting
- **Description:** Decompose Features into Stories (≤1 parent Feature, inherited team/epic context, "As a/I want/so that", Fibonacci 1–13, auto-INVEST on save), Copilot decomposition (3–8 INVEST-grouped drafts, `origin=COPILOT_SUGGESTION`), and a Split Wizard (Workflow Steps / Personas / Happy-Path vs Edge / Data Variations) that archives the original as `SPLIT_INTO` with `splitIntoStoryIds[]`, ≥2 new stories, re-estimation, and preserved lineage.
- **Actors:** PO (primary), Developer, SM, PM, Copilot.
- **Priority:** Must Have
- **Dependencies:** FR-019, FR-021 (INVEST validation), FR-023 (sprint board).
- **ACs:**
  - Given a Story saved, Then `Story.featureId` is set, team inherited, INVEST check runs and attaches results, and `Feature.stories[]` updates.
  - Given a 13-point Story saved, Then a non-blocking INVEST split warning shows, the Story saves, and SM is notified.
  - Given a DONE Story, When split is attempted, Then the Split Wizard is disabled ("Completed stories cannot be split").

### FR-021: INVEST Quality Validation (Story-level)
- **Description:** Six-criterion automated check on every Story save (I/N=WARNING, V/E/T=ERROR), `investResult{score, criteria[], evaluatedAt}`, GREEN/AMBER/RED badge, ERROR-level blocks READY, append-only evaluation history, SM "Accepted as-is" override (sprint-scoped), team INVEST Health Dashboard (pass rate, per-criterion trends, worst criterion, improvement velocity, retro integration), Negotiability/prescription pattern flagging (extensible per-org library), and cross-PI INVEST trend chart.
- **Actors:** PO, SM, Developer, RTE, Agile Coach.
- **Priority:** Must Have
- **Dependencies:** FR-020, FR-028 (retro integration), nightly re-evaluation cron.
- **ACs:**
  - Given a Story "Fix bug" with no AC and no points, Then `investResult.score=0%`, V/E/T failure messages are specific, and READY is blocked.
  - Given an SM "Accepted as-is" override on Negotiable for S-101, Then N shows "Overridden", score = passing/5, and the override reason + SM userId are in history.
  - Given a description "must use React", Then N fails with the phrase highlighted and a fix suggestion.

### FR-022: SAFe Copilot & AI Infrastructure
- **Description:** Shared AI execution model: server-action trigger → Vercel AI SDK `streamText` (Claude Sonnet default, per-org override) → SSE streaming → React 19 `use`/Suspense, Inngest background jobs for batch, Upstash sliding-window rate limits per tier, 24h content-hash cache, RAG via pgvector (PI knowledge, standup, retro indexed), and structured audit logging (orgId, epicId, feature, model, tokens, latencyMs, cached). Server-side-only prompt construction with PII redaction/HTML stripping.
- **Actors:** All AI-assist consumers (PM, RTE, SA, PO, SM, BO).
- **Priority:** Must Have
- **Dependencies:** FR-007, FR-008, FR-011, FR-018, FR-020, FR-026/FR-028 (Copilot summaries).
- **ACs:**
  - Given two users with the same epic open, When A triggers analyze-INVEST, Then B sees the streaming analysis in real time without refresh.
  - Given any AI invocation, Then a structured audit log row is written with model, token counts, latency, and cache flag.
  - Given an org-overridden model provider, Then `streamText` routes to the configured provider.

### FR-023: Sprint Lifecycle & Board
- **Description:** Per-team `Sprint` lifecycle PLANNING→ACTIVE→REVIEW→CLOSED (one ACTIVE/team, duration 1–4 wks, unique auto-increment number), overcommitment guard (>20% → override + anomaly), carryover handling (`originSprintId` preserved), velocity = accepted points at close, background velocity recalc (`VELOCITY_DROP` anomaly at >2σ), Kanban board (TODO/IN_PROGRESS/IN_REVIEW/DONE, real-time Liveblocks, soft/hard WIP limits), task management (estimatedHours 0.5–40, progress bar), and mid-sprint re-estimation (`ESTIMATION_DRIFT` at >30%).
- **Actors:** SM (primary), PO, Developer, RTE.
- **Priority:** Must Have
- **Dependencies:** FR-013 (PI plan context), `Sprint`/`Story`/`Task`/`TeamCapacitySnapshot`, `flow-intelligence` anomalies.
- **ACs:**
  - Given dates overlapping an active sprint for the same team, When created, Then a validation error names the conflicting sprint and the new sprint is not persisted.
  - Given activation >20% over capacity with override, Then the sprint activates, the justification is stored, and a MEDIUM anomaly is raised.
  - Given a sprint closes with velocity >2σ below the 5-sprint average, Then a HIGH `VELOCITY_DROP` Anomaly surfaces in the ART anomaly dashboard.
  - Given a card dropped on a column at WIP max, Then the move is permitted with a warning badge and no blocking error.

### FR-024: Feature/Cross-Team Dependencies
- **Description:** `DependencyLink` (DEPENDS_ON/BLOCKS, from/to feature + team, status IDENTIFIED→IN_PROGRESS→RESOLVED), program-board SVG connectors (color by status, ≤200 before summary mode), circular-dependency prevention, cross-ART escalation to STE, auto-Risk generation for blocking late-sprint dependencies, and "dependencies at risk" overlay.
- **Actors:** PM, SA, RTE, STE.
- **Priority:** Should Have
- **Dependencies:** FR-019, FR-021/FR-025 (program board), FR-018 (auto-risk).
- **ACs:**
  - Given a DEPENDS_ON link F-A→F-B saved, Then a DependencyLink with status IDENTIFIED is created, a board connector renders, and F-B's team is notified.
  - Given a chain A→B→C and an attempt to add C→A, Then the submission is rejected with a circular-dependency error showing the full chain.
  - Given F-A in Sprint 3 depends on F-B in Sprint 4, Then the dependency line renders red as "at risk".

### FR-025: Program Board
- **Description:** Real-time collaborative canvas (Liveblocks presence + cursors, DND-Kit) of team rows × sprint columns (+ IP + Backlog), feature-card drag with capacity validation (soft warnings), dependency lines, ROAM risk badges, capacity bars (yellow 80%/red 100%, points/business-days toggle), Story Map overlay, read-only when COMMITTED/CLOSED, and filtering.
- **Actors:** RTE, PO/PM, SA, Business Owner, Team Members (read during planning).
- **Priority:** Must Have
- **Dependencies:** FR-013, FR-019, FR-024, Liveblocks.
- **ACs:**
  - Given 6 teams × 5 sprints in PLANNING, When opened, Then the grid renders < 3s with cards, dependency lines, and live cursors.
  - Given a drop exceeding team capacity, Then the feature is assigned (not blocked) and an orange capacity warning appears immediately.
  - Given participant A drags a feature, Then participant B sees the move within 500ms.

### FR-026: PI Session Facilitation & Participant Management
- **Description:** `PISession` OPEN→BREAKOUT→DRAFT_PLAN→FINAL_PLAN→CLOSED (facilitator-only forward transitions), facilitation panel (phase controls, timers, online count, broadcasts, RTE check-ins), collaborative TipTap session notes (persistent), ephemeral announcements (24h purge), AI session-summary generation, and participant management (roles FACILITATOR/PRODUCT_OWNER/SCRUM_MASTER/TEAM_MEMBER/BUSINESS_OWNER/SYSTEM_ARCHITECT/OBSERVER, bulk invite, exactly-one facilitator, ≤500 participants, role-change audit).
- **Actors:** RTE/Facilitator, PO/PM, SM, BO, SA, all participants.
- **Priority:** Must Have
- **Dependencies:** FR-013, FR-017, FR-022, `PIParticipant`/`PISession`.
- **ACs:**
  - Given 50 connected participants, When the RTE opens the session, Then all see "Planning session is now open" within 2s.
  - Given an RTE inviting a user already a participant, Then "Already a participant" shows and no duplicate is created.
  - Given a FINAL_PLAN session is closed, Then an AI session summary is created and available to all participants within 60s.
  - Given a Business Owner downgraded to OBSERVER, When they attempt to score an objective, Then it's rejected "Insufficient permissions."

### FR-027: Async Standup & Sprint Review
- **Description:** One `StandupEntry`/member/day/team (yesterday/today/blockers, prefill, editable until midnight then immutable), blocker→impediment fuzzy match (≥0.8 cosine via vector index) with create/link, team digest (silent-member detection on working days, blocker summary), Copilot sprint-health summary (≥3 entries, GREEN/AMBER/RED + recommended SAFe actions); and `SprintReview` (one/sprint, PO accept/reject with reasons, `acceptedPoints≤completedPoints`, velocity = accepted points, additive `PIObjective.achievedValue` without double-count, guest stakeholder feedback, immutable except 7-day demoNotes append).
- **Actors:** Developer, SM, PO, RTE, Business Owner, Copilot.
- **Priority:** Must Have
- **Dependencies:** FR-023, FR-016 (achievedValue), FR-029 (impediments), FR-022.
- **ACs:**
  - Given a blocker fuzzy-matching an open impediment ≥0.8, Then the entry links to that Impediment with a badge in the digest.
  - Given a member with no entry by 10:00 local, Then they appear in the "silent" panel and the SM can nudge them.
  - Given a Copilot sprint-health request with <3 entries, Then the response states insufficient data and gives no rating.
  - Given a PO accepts 30 of 40 completed points, Then `acceptedPoints=30`, `completedPoints=40`, and velocity = 30.

### FR-028: Retrospectives
- **Description:** Per-sprint `Retrospective` (wellItems/improveItems/actionItems, real-time Liveblocks board, anonymous input phase configurable, SM-timed reveal, dot-voting default 3/member, action items require description≥10 + team-member owner + future due date), carried-forward incomplete actions, completion tracking + staleness notifications, Copilot pattern analysis (≥3 retros: recurring themes, repeated-incomplete actions, anomaly correlation; one-click promote to actionItem `source=COPILOT`), and 14-day read-only lock.
- **Actors:** SM, Developer/Team Member, RTE, Agile Coach, Copilot.
- **Priority:** Should Have
- **Dependencies:** FR-023, FR-022, vector KB.
- **ACs:**
  - Given anonymous input phase before reveal, Then item text is visible but the author is hidden from all participants including the SM.
  - Given 2 open action items from the prior retro, When the current retro opens, Then both appear in "carried forward" with owner/due-date/status.
  - Given a Copilot retro analysis with 5 retros, Then the response includes ≥3 recurring themes, ≥1 hypothesised root cause per theme, and a list of actions appearing in ≥2 retros uncompleted.

### FR-029: Defect & Impediment Management
- **Description:** `Defect` (severity LOW–CRITICAL, reproducible, status OPEN→IN_PROGRESS→IN_REVIEW→CLOSED, separate swimlane, excluded from velocity, CRITICAL → `CRITICAL_DEFECT` anomaly + SM/RTE notify, reopen with reason preserving `originSprintId`, severity-downgrade restricted to SM/PO, 48h staleness). `Impediment` (severity, owner-always, OPEN→ESCALATED→RESOLVED, ≥20-char resolution note, escalate-to-PI-Risk creating a `Risk` with `category=IMPEDIMENT`, bidirectional link, resolution-time aging, RTE all-team visibility, CRITICAL 24h `IMPEDIMENT_AGING` anomaly).
- **Actors:** Developer/QA, SM, PO, RTE.
- **Priority:** Must Have
- **Dependencies:** FR-023, FR-027 (standup→impediment), FR-018 (escalation), `flow-intelligence` anomalies.
- **ACs:**
  - Given a CRITICAL defect saved, Then a `CRITICAL_DEFECT` Anomaly is created, SM is notified immediately, and RTE gets an ART-feed summary.
  - Given an impediment escalated with ROAM OWNED + owner + due date, Then a `Risk` (roamStatus OWNED) is created, the impediment → ESCALATED, and a bidirectional link is persisted.
  - Given an impediment resolved after 72h, Then `resolvedAt` is stored, resolution time = 72h, and all referencing standup-entry members are notified.

### FR-030: Roadmap Integration
- **Description:** `RoadmapItem` linking epics (PORTFOLIO_BACKLOG/IMPLEMENTING only) to quarter/year with confidence (High/Med/Low) and notes; at most one active item per epic (updates archive prior); quarterly grid timeline (current + 6 forward) grouped by ART or theme with progress bars.
- **Actors:** Portfolio Manager, PM, executives.
- **Priority:** Nice to Have
- **Dependencies:** FR-001, FR-014.
- **ACs:**
  - Given an epic on the roadmap for Q3 2026, When updated to Q4 2026, Then the prior RoadmapItem is archived, a new one created, and the epic moves to the Q4 column.
  - Given 5 epics in Q2 2026 across 2 ARTs, When grouped "By Strategic Theme", Then each theme's epics group in a lane with column counts.
  - Given a FUNNEL/REJECTED epic, When roadmap add is attempted, Then it's blocked.

---

## Non-Functional Requirements

**Performance**
- Portfolio load p95 < 1.5s for ≤500 epics / 10 ARTs; WIP counts accurate.
- WSJF compute + backlog re-sort < 500ms for ≤500 features; normalized re-sort without full reload.
- Story-save INVEST check < 200ms (synchronous, blocks save confirmation).
- Program board (50+ features, 20+ dependency lines) initial paint < 3s on standard broadband.
- Real-time propagation: board moves/vote reveal/score updates < 500ms; collaborative scoring ≤20 concurrent users, reveal < 300ms.
- Copilot Story decomposition P95 < 8s (RAG budget); INVEST analysis < 30s non-cached, < 500ms cached.
- Burndown recalc debounced at 5s; velocity recalc as Inngest background job.

**Security & Multi-Tenancy**
- Every new table carries RLS scoped to `orgId`; no cross-tenant access. `DecisionLogEntry` and confidence-vote tallies have stricter RLS (no UPDATE/DELETE).
- Confidence votes are anonymous at the data layer — no user↔vote persistence.
- Third-party credentials AES-256-GCM. AI prompts built server-side only with HTML stripping + PII redaction.
- Permission checks (FR permission matrices) enforced server-side for all real-time operations; client enforcement is cosmetic only. Re-validate drag/drop and inline edits on the server.
- All WSJF, INVEST, governance, lifecycle, participant, ROAM, and budget actions written to the org-level `AuditLog` with before/after values (SOC2/LGPD/SOX-compatible format).

**Scalability**
- ≤500 epics/org (paginated beyond), ≤500 features/ART, ≤50 stories/feature, ≤500 PI participants, ≤200 open risks/ART/PI, ≤200 dependency connectors rendered, ≤20 epics + ≤15 participants per WSJF session.
- Batch INVEST: chunked Inngest fan-out for >200 epics; per-ART distributed lock.

**Localization (deep)**
- Full SAFe terminology and UI in PT-BR and ES in addition to EN (ceremony names, ROAM, WSJF labels, state names, notifications, exports).
- Tenant-configurable ceremony/artifact labels (hybrid SAFe-like support) without altering underlying state machine.

**Reliability/Audit**
- `StateTransitionHistory`, `ScoringEvent`, INVEST evaluation history, `DecisionLogEntry`, reallocation events, scope-change events: append-only/immutable.
- Retention: INVEST history ≥24 months; Portfolio Health Reports 90 days (configurable); description version history for epic lifetime; standup 365 days then archived-queryable.

---

## Data Entities

**Extend existing (reference by name; add fields):**
- `Epic` (art-core): `portfolioRank`, `wsjfScore`, `investScore`, `investScoreOverridden`, `investScoreOutdated`, `investCriteria` (JSON), `hypothesis`, `businessOutcomes[]`, `leadingIndicators[]`, `nfrs`, `mvp`, `sizeEstimate`, `acceptanceCriteria[]` (JSON `{id,given,when,then,source,locked}`), `strategicThemeId`, `leanBudgetAllocation`, `governedEpic` flag, `descriptionVersions[]`, `rejectionReason`, `hypothesisResolution`.
- `Feature` (art-core): `wsjf` object (`userValue`,`timeValue`,`riskReduction`,`jobSize`,`costOfDelay`,`wsjfScore`,`normalizedScore`,`confidence`,`scoredBy`,`scoredAt`), `manualRankOverride` (+`piPlanId` scope), `readinessScore`, `jobSizeLockedBy`, `origin`.
- `Story` (art-core): `investResult` (JSON `{score,criteria[],evaluatedAt}`), `investOverrides[]`, `splitIntoStoryIds[]`, `originStoryId`, `origin`, status incl. `SPLIT_INTO`.
- `PIPlan`/`PIObjective`/`PIParticipant`/`Sprint`/`SprintReview`/`Retrospective`/`StandupEntry`/`Impediment`/`Defect`/`Risk`/`RoadmapItem`/`StrategicTheme`/`LeanBudget`/`DependencyLink`/`TeamCapacitySnapshot` (art-core) extended per FRs (status enums, ROAM fields, anomaly links, `source=EXTERNAL`/`readOnly` for Mode B, `originSprintId`, `confidence`, `targetWeights`).
- `ConfidenceVoteSession`/`PISession`/`PIKnowledgeVector` (planning): `round`, aggregate tallies (per-score 1–5 counts only), `participationRate`, `facilitatorNote`, session phase, TipTap notes, ephemeral announcements TTL.
- `GovernedEpic`/`ApprovalWorkflow`/`ApprovalRequest`/`ApprovalStepInstance`/`DecisionLogEntry` (portfolio): `currentStepIndex`, `requiresAll`, `slaHours`, `order`, `bypassedBy`/`bypassReason`, decision/status enums, tombstone flag.
- `Anomaly`/`StateTransitionHistory`/`FlowMetricSnapshot`/`AnomalyDetectionRun` (flow-intelligence): new anomaly types `VELOCITY_DROP`, `SCOPE_CREEP`, `ESTIMATION_DRIFT`, `CRITICAL_DEFECT`, `QUALITY_GATE_BREACH`, `IMPEDIMENT_AGING`; `StateTransitionHistory` system-actor support.
- `AuditLog`/`Notification`/`CopilotSession`/`CopilotMessage` (system): AI invocation audit fields (model, tokens, latency, cached).
- `CostAnomaly`/`BillingEntryAllocation`/`CostSnapshot` (finops): epic-tagged allocation joins, guardrail-breach `CostAnomaly`.

**New models:**
- `PortfolioAnalysisReport` (portfolio): `artId`, `ranAt`, `epicCount`, `reportJson`, `completionStatus`, retention TTL.
- `ScoringEvent` (art-core, append-only): `featureId`/`epicId`, component values, `source`, `userId`, `timestamp`.
- `ConfidenceVoteTally` (planning): `sessionId`, `round`, per-score counts, `aggregateScore`, `participationRate` (no user mapping).
- `ThemeInvestmentTarget` (portfolio): `strategicThemeId`, `weightPct`, concentration threshold.
- `LeanBudgetReallocation` (finops, immutable): `fromEpicId`, `toEpicId`, `amount`, `reason`, `actor`, `timestamp`.

---

## API Surface (`apps/app/app/api/`)

- `api/portfolio` (GET) — `get-portfolio` composed payload (epics, themes, budgets, feature counts, cost snapshots, WIP counts).
- `api/portfolio/export` (POST) — async PDF/XLSX/CSV (rate-limited 10/user/hr).
- `api/epics/[id]` (GET/PATCH) — epic detail incl. investScore, acceptanceCriteria.
- `api/epics/[id]/transition` (POST) — state-machine transition (422 guard errors).
- `api/ai-prompt` (POST, SSE) — unified AI features (`analyze-invest`, `analyze-all-epics`, `generate-acceptance-criteria`, `generate-ac-from-nfrs`, `improve-description`, `suggest-title`); returns 202+jobId for batch.
- `api/copilot/chat` (POST, SSE) — sprint-health, retro-pattern, risk-surfacing RAG chat.
- `api/governance/workflows` (GET/POST/PATCH) and `api/governance/[epicId]/decisions` (GET, export — 405 on delete).
- `api/decision-log/export` (POST) — PDF/JSON (audit-logged).
- `api/pi-plans/[id]` (lifecycle), `api/pi-sessions/[id]` (phase transitions), `api/confidence-votes` (open/close/round, anonymous tallies).
- `api/risks` + `api/risks/[id]/roam` + `api/risks/[id]/escalate`.
- `api/sprints/[id]` (lifecycle, close), `api/standups`, `api/sprint-reviews`, `api/retrospectives`, `api/defects`, `api/impediments` (+ escalate).
- `api/collaboration/auth` (Liveblocks orgId-scoped token).
- Inngest handlers: `api/inngest` registering `auto-invest-analysis`, `portfolio-analysis-batch`, weekly portfolio cron, `staleness-check`, velocity-recalc, SLA-reminder, anomaly-scheduler, AI risk-surfacing.

## Server Actions (`apps/app/app/actions/`)

- `actions/epics` — CRUD, XState transitions, INVEST override, business-case versioning.
- `actions/portfolio-kanban` — get-portfolio composition, WIP, reorder, export.
- `actions/lean-budget` — budget set/edit, allocate, guardrails, reallocate.
- `actions/strategy-map` — themes CRUD/archive, target weights.
- `actions/wsjf` — epic + feature scoring, sessions, ScoringEvent.
- `actions/ai-prompt` — AI feature dispatch, rate limit, cache, audit.
- `actions/governance` — workflow config, submit, approve/reject/request-changes, bypass, decision log.
- `actions/pi-planning` — ART setup, PI lifecycle, participants, sessions.
- `actions/pi-objectives` — objectives, BO scoring, achievedValue, PPM.
- `actions/confidence-vote` — open/close/round, anonymous aggregation, history.
- `actions/risks` — create, ROAM classify, escalate, AI-suggest.
- `actions/features` — CRUD, readiness gate, dependencies.
- `actions/stories` — decompose, split, INVEST validate.
- `actions/sprints` — lifecycle, board, tasks, re-estimation.
- `actions/standup`, `actions/sprint-review`, `actions/retrospective`, `actions/defects`, `actions/impediments`, `actions/roadmap`.

---

## Market Research ACs Integration

- **AC-MKT-1 (configurable ceremony/artifact names per tenant — hybrid SAFe):** Addressed by NFR Localization (tenant-configurable labels decoupled from the state machine) and FR-026/FR-012 — display labels for PISession phases, ceremonies, and ART artifacts resolve through a per-tenant terminology map; underlying enums (FR-002 XState, FR-013 PIPlan) remain canonical for portfolio roll-up consistency.
- **AC-MKT-2 (PT-BR + ES deep localization):** NFR Localization mandates full SAFe terminology (WSJF, ROAM, INVEST, state names, notifications, exports) in PT-BR and ES; applies across FR-001, FR-007, FR-017, FR-018, and all notification/export surfaces.
- **AC-MKT-3 (block ANALYZING→PORTFOLIO_BACKLOG without INVEST ≥ threshold):** Directly the FR-002 transition guard backed by FR-007 — guard requires `investScore≥threshold` (or RTE-overridden score), returning 422 `GUARD_FAILED`; the threshold is the configurable PI-Planning-readiness value from FR-008.
- **AC-MKT-4 (Confidence Vote history stored per PI for predictability correlation):** FR-017 + new `ConfidenceVoteTally` model persist every round's aggregate per PI (immutable, anonymous), surfaced in the cross-PI trend chart and correlated with PPM (FR-016) and ART health in Analytics.
- **AC-MKT-5 (hybrid sync/async PI Planning):** FR-026 PISession supports async-prep + sync facilitation — async participant invitations/pre-reads, async ROAM classification (FR-018 alt flow), async WSJF scoring (FR-006), and async standup (FR-027) feed the synchronous facilitated session; the facilitator console orchestrates both modes within one persistent workspace.

---

Files referenced (absolute): PRD source at `/tmp/prd-epic006.md`. Target implementation paths: API under `/Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz/apps/app/app/api/`, server actions under `/Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz/apps/app/app/actions/`.
