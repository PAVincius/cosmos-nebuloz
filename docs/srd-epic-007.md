I now have comprehensive coverage of the PRD. The PRD covers Flow Intelligence, Analytics, FinOps, Integrations, Copilot, OKRs/Strategic Themes/Roadmap, and BPMN. The LACE and Solution Train large-solution context is referenced in the technical models but the deep PRD body focuses on these modules. I have enough to write the SRD now.

# SRD — Epic 007: Solution Train & Advanced Features

## Overview

Epic 007 (560h) delivers the advanced intelligence, financial, integration, and AI capabilities that distinguish Cosmos/Nebuloz from incumbent SAFe tools (Jira Align, Rally, VersionOne). It is the "prove-the-value + sit-above-the-toolchain" layer of the platform: continuous flow intelligence, executive-grade analytics, cloud cost attribution, bidirectional SAFe-aware integrations, a tenant-grounded RAG copilot, strategy-to-execution traceability, and codified custom workflows.

**Scope (seven capability clusters):**
1. **Flow Intelligence** — 6D flow metrics, scheduled anomaly detection (rule + ML-assisted), staleness detection, capability/skill-gap planning, pair synergy, LLM narrative generation, immutable state-transition history.
2. **Analytics & Reporting** — Flow Metrics, Velocity & Capacity (predictability, Monte Carlo forecasting), ROI & Budget Intelligence, Measure & Grow (competency), Executive Dashboard, scheduled reports, read-only analytics API.
3. **FinOps** — AWS Cost Explorer ingestion (FOCUS 1.1 compliant `BillingEntry`), tag-rules engine, cost snapshots, epic-level cost attribution, cost anomaly detection, budget plans, commitment discounts, personnel cost, currency handling.
4. **Integrations** — Linear SAFe-aware two-way sync, GitHub SAFe-aware sync (DORA), webhook ingestion pipeline, sync logs/cursors, configuration UI.
5. **LACE SAFe AI Copilot** — RAG (pgvector hybrid search), role-aware context assembly, tool-calling (confirmation-gated mutations), prompt library, document upload, on-prem/per-tenant model provider, session security.
6. **OKRs, Strategic Themes & Roadmap** — OKR management + snapshots, strategic themes (3-horizon), strategy map, roadmap items + scenario planning, strategy-to-execution traceability, alignment gap detection.
7. **BPMN Workflow Modeling** — BpmnDefinition persistence, BPMN-js 18 canvas, BPMN→XState catalogue, workflow runtime, context/conditions, versioning + in-flight migration, process analytics.

**Personas served:** RTE, Scrum Master (SM), Product Owner (PO), Product Manager (PM), System Architect (SA), Business Owner (BO), Portfolio Manager (PM-Portfolio), CTO/CFO, Platform Engineer/Admin, Finance/HR Admin, LACE member, Developer, Compliance Officer, VIEWER.

**Estimated effort:** 560h across 7 clusters (~80h/cluster average; Copilot and FinOps weighted higher).

---

## Functional Requirements

### FR-001: Anomaly Detection Engine
- **Description:** Scheduled (nightly cron `GET /api/cron/anomaly-scheduler` via Inngest + post-PI-close trigger) and on-demand rule-based + ML-assisted pipeline evaluating teams, sprints, features, epics, objectives, risks, dependencies, impediments against a versioned rule set. Produces `AnomalyDetectionRun` + `Anomaly` records, deduplicated against open/unsuppressed records within a 24h window.
- **Actors:** RTE (primary), SA, SM, PO/PM, BO.
- **Priority:** Must Have
- **Dependencies:** existing `AnomalyDetectionRun`, `Anomaly`, `FlowMetricSnapshot` models; `@repo/notifications`; Inngest; feature flag `flow-intelligence`.
- **ACs:**
  - Given a nightly cron fires at 02:00 UTC, When the org has an active PI Plan with in-flight sprints, Then an `AnomalyDetectionRun` is created with `ranAt` within 5 min and `itemsEvaluated > 0`.
  - Given an unresolved anomaly from run N, When run N+1 detects the same `type + entityId`, Then no duplicate `Anomaly` is created and the existing record's `runId` is not mutated.
  - Given a HIGH anomaly is created, When the team SM and ART RTE have in-app notifications enabled, Then both receive a deep-linked notification within 60 seconds.
  - Given a manual run is triggered while a scheduled run is in progress, When the request is received, Then a 409 is returned and no second Inngest job is enqueued.
  - Given a run is processing 9,500 entities, When the Inngest timer reaches 115s, Then a partial-completion record is written, notifications dispatched for found anomalies, and a continuation job scheduled.

### FR-002: Anomaly Rule Set, Thresholds & Classification
- **Description:** Versioned, extensible rule catalogue (R-VEL, R-WIP, R-IMP, R-DEP, R-OBJ, R-RISK, R-EPIC, R-STALE, R-CYCLE, R-FLOW, R-OKR) with org-level threshold overrides within platform min/max bounds; CRITICAL rules non-disablable; circular-dependency DFS (depth ≤10).
- **Actors:** RTE, SA, Platform Admin.
- **Priority:** Must Have
- **Dependencies:** FR-001; settings store; changelog/audit.
- **ACs:**
  - Given an RTE sets velocity variance threshold to 30%, When a sprint is 25% below rolling average, Then no R-VEL-01 anomaly is generated.
  - Given an org-level override is reset to default, When the next run executes, Then the override record is deleted and the platform default is applied.
  - Given a CRITICAL rule (R-IMP-02) fires, When owner and RTE are identified, Then both are notified within 60s regardless of lower-severity preferences.
  - Given a threshold set outside platform bounds, When saved, Then a validation error is shown and no override persists.

### FR-003: Staleness Detection
- **Description:** Independent nightly job (`GET /api/cron/staleness-check`, 03:00 UTC) flagging entities exceeding per-type staleness thresholds (business days for operational, calendar days for strategic). Creates `STALE_*` LOW anomalies, writes staleness aggregates to `FlowMetricSnapshot`, supports nudge action + CSV export.
- **Actors:** SM (primary), PO/PM, RTE, Dev.
- **Priority:** Must Have
- **Dependencies:** `StalenessAuditLog`, `FlowMetricSnapshot`, `Anomaly`; `@repo/notifications`.
- **ACs:**
  - Given a story IN_PROGRESS for 6 business days with no change, When staleness runs, Then a `STALE_STORY` LOW anomaly is created if none open exists.
  - Given a story transitions to DONE, When staleness runs next day, Then it is excluded and any existing `STALE_STORY` anomaly is auto-resolved.
  - Given the SM uses "Nudge Team" on 3 stale stories, When the action completes, Then each assignee receives a deep-linked notification within 30s.

### FR-004: Flow Metric Snapshots & Trend Analysis
- **Description:** Point-in-time capture of cycle time, lead time, throughput, WIP, flow efficiency at team/ART/portfolio levels (`FlowMetricSnapshot`), rendered as Recharts trends with prior-PI benchmark overlay, anomaly markers, comparative PI benchmarking. ART aggregations use median (cycle/lead), sum (throughput/WIP), harmonic mean (flow efficiency).
- **Actors:** RTE, SM, SA, BO.
- **Priority:** Must Have
- **Dependencies:** FR-001, FR-003, `StateTransitionHistory`.
- **ACs:**
  - Given a team with 6 sprint snapshots in a PI, When the Flow Metrics view loads, Then all 5 charts render with ≥6 points and the prior-PI benchmark line is visible.
  - Given an anomaly event on a date, When the cycle time chart for that period renders, Then a marker appears at the correct date.
  - Given an RTE compares PI-3 and PI-4, When a team's avg cycle time increased >20%, Then that team's row is highlighted red.

### FR-005: Capability Planning & Skill Gap Analysis
- **Description:** Computes PI skill demand (skill × level × story-point weight) vs supply (`PersonSkillProfile`, `CompetencyAssessment`) for ARTs; flags CRITICAL gaps (demand ≥3, max supply ≤2); supplier mitigation; self & assessor-validated assessments; `ImprovementAction` suggestions; PDF gap report.
- **Actors:** RTE, SA, SM, Dev, Platform Admin.
- **Priority:** Should Have
- **Dependencies:** `PersonSkillProfile`, `CompetencyAssessment`, `ImprovementAction`, `Supplier`; `Feature`/`Capability` skill metadata.
- **ACs:**
  - Given a feature tagged "Kubernetes Orchestration" level 3, When no participant has currentLevel ≥3, Then a CRITICAL gap appears for that feature.
  - Given a self-assessment at level 2 with target 4, When saved, Then ≥1 `ImprovementAction` suggestion from the platform library is displayed.
  - Given <50% of participants have profiles, When generating the gap report, Then a warning banner with missing count and "Invite All" button appears.

### FR-006: Pair Synergy Analysis
- **Description:** Opt-in (org default disabled) composite synergy score (0.0–1.0) per team pair from co-assignment, GitHub cross-review/co-commit, standup blocker co-mentions (decaying 50%/sprint), retro co-assignments; computed in nightly post-processing over last 6 sprints; privacy-scoped (members see only own scores).
- **Actors:** SM (primary), RTE, Team Member.
- **Priority:** Nice to Have
- **Dependencies:** `PairSynergy`, `GroupSynergy`; GitHub integration (FR-018); FR-001 post-processing.
- **ACs:**
  - Given two members co-assigned in 5 of 6 sprints with no negative signals, When scores compute, Then `PairSynergy.score ≥ 0.7`.
  - Given a member views their profile Synergy section, When it renders, Then only their own scores with named colleagues are visible.
  - Given an SM accepts a pairing recommendation for Story A (members X, Y), When the sprint is saved, Then Story A's `assignees[]` includes both X and Y.

### FR-007: Narrative Generation
- **Description:** AI synthesis (`POST /api/copilot/chat`, `safe-copilot` action) of sprint/PI/executive narratives from structured anomaly/metric/staleness data; prose + top-N findings with severity + recommended action; editable; tone parameter; template fallback on AI failure/budget exhaustion; executive jargon translation when "SAFe terminology for executives" disabled.
- **Actors:** RTE, SM, PM/PO, BO.
- **Priority:** Should Have
- **Dependencies:** FR-001, FR-004; `@repo/ai`; copilot token budget.
- **ACs:**
  - Given a CLOSED sprint, When the SM clicks "Generate Sprint Summary" and AI succeeds, Then the narrative renders within 10s with ≥1 finding carrying a severity label.
  - Given the AI service is unavailable, When the SM generates a summary, Then a template narrative renders within 3s with an "AI generation unavailable" banner.
  - Given "SAFe terminology for executives" is disabled, When an executive summary is generated, Then output contains no "ART", "PI", "velocity", or "WSJF".

### FR-008: State-Transition History
- **Description:** Append-only immutable audit trail of Epic status changes (`StateTransitionHistory`); server-enforced allowed-transition graph; mandatory reason on REJECTED; time-in-status timeline; pattern anomalies (oscillation, excessive dwell, backward transition); 7-year regulatory retention; SolutionEpic roll-up.
- **Actors:** PO/PM, RTE, Auditor/Compliance Officer, BO.
- **Priority:** Must Have
- **Dependencies:** `StateTransitionHistory`, `Epic`, `SolutionEpic`; `@repo/audit`.
- **ACs:**
  - Given a PM transitions an epic FUNNEL→PORTFOLIO_BACKLOG, Then a record with correct from/to, `transitionedAt` within 1s, and the PM's `userId` is created.
  - Given a PM attempts DONE→IMPLEMENTING, When the action validates, Then a 422 is returned and no record is created.
  - Given an epic oscillates PORTFOLIO_BACKLOG↔IMPLEMENTING three times, When the run evaluates it, Then an `EPIC_OSCILLATION` HIGH anomaly is created.

### FR-009: Flow Intelligence Copilot Integration & Plan Gating
- **Description:** All flow data indexed into the vector knowledge base for NL queries; module gated behind `flow-intelligence` flag with plan tiers (Starter: anomaly+staleness; Growth: snapshots+narrative; Enterprise: capability+synergy+audit export).
- **Actors:** all FI personas.
- **Priority:** Should Have
- **Dependencies:** FR-001–008, FR-021 (RAG), `@repo/feature-flags`.
- **ACs:**
  - Given indexed FI data, When a user asks "What anomalies are open for the Platform ART?", Then the copilot lists open anomalies with entity links.
  - Given a Starter-plan org, When navigating to Capability Planning, Then access is denied with an upgrade prompt to Growth.
  - Given Enterprise plan, When exporting the state-transition audit, Then the export includes all immutable records.

### FR-010: Flow Metrics Dashboard
- **Description:** Analytics surface for 6D SAFe flow metrics (flow velocity/time/efficiency/load/distribution + cycle/lead/throughput/WIP) at team/ART/portfolio level; weighted ART aggregation by team size; WIP cap indicators; cycle-time drill-down (box plot, scatter, outliers via median+2×IQR); Monte Carlo throughput forecasting (1,000 iterations, cached 1h).
- **Actors:** RTE, Portfolio Manager, BO, SM, SA, PM.
- **Priority:** Must Have
- **Dependencies:** FR-004, `StateTransitionHistory`; Upstash Redis.
- **ACs:**
  - Given an RTE opens Flow Metrics for the current PI, Then 5 metric cards render within 2s with non-null values.
  - Given two ARTs of different team sizes, When portfolio aggregate computes, Then cycle time is a weighted (by member count) average, not a simple mean.
  - Given an ART with 8 sprints, When a throughput forecast for 50 features runs, Then 50th/70th/85th/95th percentile dates are displayed.

### FR-011: Velocity & Capacity Analytics
- **Description:** Sprint velocity trend (committed/completed/accepted), rolling-average overlay, predictability = accepted/committed; capacity utilization heatmap (team×sprint, configurable color bands, over-utilization always red); PI predictability score (stretch excluded, immutable on PI close, ≥80% SAFe benchmark); low-predictability anomaly.
- **Actors:** RTE, SM, BO, Portfolio Manager.
- **Priority:** Must Have
- **Dependencies:** `Sprint`, `TeamCapacitySnapshot`, `SprintReview`, `PIObjective`; FR-001.
- **ACs:**
  - Given 6 completed sprints, When the velocity trend opens, Then a grouped bar chart (committed/completed/accepted) renders per sprint.
  - Given committed points = 0 in a sprint, When predictability renders, Then it shows "N/A" (no division by zero).
  - Given predictability <70% for 3 consecutive sprints, Then a `LOW_PREDICTABILITY` HIGH anomaly is created.

### FR-012: ROI & Budget Intelligence
- **Description:** Lean budget vs actual AWS spend (waterfall, variance, strategic-theme breakdown, >10% guardrail red + anomaly); cost-per-point trend with projection; Epic ROI hypothesis tracking (hypothesis→leading indicators→outcomes, confidence score, AI/template ROI card, role-gated PDF export).
- **Actors:** BO, Portfolio Manager, RTE, CFO, Epic Owner.
- **Priority:** Must Have
- **Dependencies:** `LeanBudget`, FR-013 (CostSnapshot), `Epic` ROI fields; FR-007.
- **ACs:**
  - Given two ARTs with LeanBudget and active AWS integration, When Budget Overview opens, Then a waterfall with allocated vs actual per ART renders.
  - Given actual spend exceeds allocated by 12%, Then the ART row is highlighted red with an anomaly badge.
  - Given an Epic with 3 outcomes (2 confirmed), When the ROI tab is viewed, Then hypothesis confidence = 67% with green checkmarks on confirmed outcomes.

### FR-013: Member-Level Metrics & Measure & Grow
- **Description:** Privacy-guarded per-contributor stats (throughput, cycle time, defect rate HIGH/CRITICAL only, standup cadence) for SM coaching (no leaderboards, 403 for non-SM); team skill heatmap (assessor-validated levels, anonymized for non-SM/RTE); individual growth trajectory (linear projection); improvement action completion rate + weekly digest.
- **Actors:** SM, RTE, Team Member, HR/People Manager.
- **Priority:** Should Have
- **Dependencies:** `CompetencyAssessment`, `ImprovementAction`, `PersonSkillProfile`, `PairSynergy`; FR-006.
- **ACs:**
  - Given an RTE (not SM) requests John's individual stats, Then a 403 is returned and no data exposed.
  - Given a DEVELOPER views the team heatmap, Then individual columns are anonymized and only team averages are visible.
  - Given a team "Beta" with 40% action completion, Then its bar is red with a status breakdown on hover.

### FR-014: Executive Dashboard, Scheduled Reports & Analytics API
- **Description:** Six-KPI executive dashboard (predictability, flow efficiency, cycle time, cost-per-point, action completion, active ARTs), ART summary table with composite health indicator, portfolio charts, anomaly feed, server-side PDF export (rate-limited 10/h); scheduled reports via Inngest (5 report types, retention 24mo); read-only analytics REST API (token-scoped, 1,000 req/h, PII excluded unless scoped, all access audited SOC2 CC6.1); contextual anomaly surfacing.
- **Actors:** BO, Portfolio Manager, CTO/CPTO, RTE, VIEWER.
- **Priority:** Must Have
- **Dependencies:** FR-010–013; `@repo/audit`, `@repo/rate-limit`; Upstash Redis (5-min cache).
- **ACs:**
  - Given a Portfolio Manager with 4 active ARTs, When the dashboard opens, Then 6 KPI tiles, a 4-row ART table, and 3 charts render within 3s.
  - Given an ART with predictability 65%, declining throughput, and 2 CRITICAL anomalies, Then the health indicator is red.
  - Given a monthly Executive Summary schedule is saved, Then an Inngest job registers and a confirmation notification is sent.
  - Given an analytics API token without `include_member_pii` scope, When member stats are requested, Then PII fields are excluded.

### FR-015: AWS Cost Explorer Ingestion Pipeline (FOCUS 1.1)
- **Description:** Nightly Inngest pipeline (`GET /api/cron/billing-sync-dispatch`) pulling `GetCostAndUsage` (DAILY, grouped by SERVICE/REGION/tags) into FOCUS 1.1-compliant `BillingEntry` rows, idempotent upsert on `(orgId, date, provider, service, region, tagHash)`; manual sync; 14-month backfill chunked into 30-day windows; multi-account independent sync; read-only `ce:GetCostAndUsage` IAM only.
- **Actors:** System (cron), RTE, Platform Engineer, BO, CTO/CFO.
- **Priority:** Must Have
- **Dependencies:** `BillingEntry`, `BillingSyncRun`, `Integration`; AWS SDK; AES-256-GCM credential encryption.
- **ACs:**
  - Given a valid AWS account with `ce:GetCostAndUsage`, When the nightly cron fires, Then prior-day `BillingEntry` rows are upserted within 15 min, `lastSyncedAt` updated, with no duplicates per composite key.
  - Given a 429 throttle, When the pipeline retries, Then exponential backoff (start 2s, ≤5 retries) applies before `lastSyncStatus = ERROR` and an RTE notification.
  - Given a 6-month backfill, When it completes, Then `CostSnapshot` records exist per month and re-running creates no duplicates.

### FR-016: Tag Rules Engine, Cost Snapshots & Commitment Discounts
- **Description:** Glob/regex tag rules (priority-ordered, first-match-wins, dry-run preview, attribution-rate dashboard, max 500/org) creating `BillingEntryAllocation` (percentage splits sum 100%); periodic `CostSnapshot` (daily/weekly/monthly, immutable after 72h grace, byTeam/byEpic/byService maps); `CommitmentDiscount` (RI/Savings Plan, net-cost adjustment, original amount preserved, overlap cap 99%, expiry alert).
- **Actors:** RTE/Platform Engineer, BO, FinOps Analyst.
- **Priority:** Must Have
- **Dependencies:** FR-015; `TagRule`, `BillingEntryAllocation`, `CostSnapshot`, `CommitmentDiscount`, `CurrencyRate`.
- **ACs:**
  - Given a rule "epic-payments-*"→epicId=42, When a `BillingEntry` with tags.Epic="epic-payments-q3" arrives, Then a `BillingEntryAllocation` to epicId=42 at 100% is created.
  - Given priority=10 "team-*"→teamId=5 and priority=20 "team-payments-*"→teamId=7, When tags.Team="team-payments-api" is processed, Then teamId=5 wins and no teamId=7 allocation is created.
  - Given a 20% Savings Plan for a date range, When entries process, Then `BillingEntryAllocation` reflects discounted amounts while original `BillingEntry.amount` is preserved.

### FR-017: Epic Cost Attribution, Cost Anomaly, Budget Plans, Personnel Cost & Currency
- **Description:** Epic cost panel (lifetime/PI/30-day spend, budget bar vs `leanBudgetAllocation`, top services, dispute), portfolio kanban cost badges, cost-to-value scatter, attribution audit log; cost anomaly detection (14-day baseline, severity bands, suppression rules); `BudgetPlan` (ORG/ART/PI scope, multi-threshold hysteresis alerts); `PersonCost` (restricted `billing:admin`, total-cost-of-epic); ISO 4217 display currency (read-time conversion, source immutable, daily rate refresh).
- **Actors:** BO, RTE, Portfolio Manager, CTO, FinOps Analyst, Finance/HR Admin, Org Admin.
- **Priority:** Must Have
- **Dependencies:** FR-015/016; `CostAnomaly`, `BudgetPlan`, `PersonCost`, `CurrencyRate`, `StateTransitionHistory` (IMPLEMENTING date); `@repo/security`.
- **ACs:**
  - Given an Epic with allocations $12,450 and budget $15,000, Then the panel shows 83% utilization with an amber bar and top-3 services.
  - Given an epic spends $200/day for 14 days then spikes to $650, When detection runs, Then a `CostAnomaly` HIGH (225% over baseline) is created and RTE+owner notified within 5 min.
  - Given a `BudgetPlan` at $10,000 with thresholds 70/90/100, When spend reaches $7,200, Then only the 70% alert fires and `thresholdCrossedAt` is recorded.
  - Given display currency EUR and a 100 USD entry, When the view renders, Then the converted amount uses that date's rate and source USD is unchanged in the DB.

### FR-018: Integration Lifecycle & Linear SAFe-Aware Two-Way Sync
- **Description:** `Integration` lifecycle (PENDING/ACTIVE/ERROR/PAUSED/REVOKED via XState), OAuth PKCE, encrypted `config`; Linear bidirectional sync (Linear wins status/assignee/cycle; Cosmos wins SAFe hierarchy/WSJF/feature mapping; field-level merge policy), full-pull (cursor-resumable, 250/page), inbound webhook (`POST /api/webhooks/linear`, HMAC, <200ms ack, Inngest processing), outbound push, conflict resolution UI. **Portfolio view works without forcing Linear team migration.**
- **Actors:** Org Admin/OWNER, RTE, PM/PO, SA, Developer.
- **Priority:** Must Have
- **Dependencies:** `Integration`, `SyncLog`, `LinearSync`; `@repo/webhooks`, `@repo/security`; Inngest; Liveblocks.
- **ACs:**
  - Given a developer sets a Linear issue to "Done", When the webhook processes, Then the mapped Cosmos Story status changes within 5s.
  - Given a webhook with invalid HMAC, When handled, Then HTTP 401 is returned, no data modified, and an AuditLog entry written within 1s.
  - Given a PAUSED integration, When a Linear webhook arrives, Then it is stored in the dead-letter queue, HTTP 200 returned, and no Cosmos data modified.
  - Given an org adopts Cosmos for portfolio views, When Linear teams are not migrated, Then portfolio/PI views remain fully functional and synced items appear without team migration.

### FR-019: GitHub SAFe-Aware Sync & DORA
- **Description:** GitHub App install, PR/issue/commit/deployment webhook ingestion (`POST /api/webhooks/github`, HMAC-SHA256); magic-keyword PR↔Story linking (`Closes COSMOS-[ID]`, branch `cosmos/[ID]`); deployment-status→DEPLOYED + `Feature.deployedAt`; DORA metrics; outbound `cosmos:*`-namespaced labels/milestones only; unlinked-PR panel.
- **Actors:** Developer, PO/PM, RTE, SA.
- **Priority:** Must Have
- **Dependencies:** FR-018 infra; `GitHubSync`; FR-010 (flow metrics).
- **ACs:**
  - Given a merged PR "Closes COSMOS-42", When processed, Then Story 42 has a linked PR with `status=MERGED` and `prStatus=MERGED` within 5s.
  - Given a production `deployment_status` success, When processed, Then linked Stories are DEPLOYED and `Feature.deployedAt` set if all children deployed.
  - Given a PR with no Cosmos ID, When processed, Then it appears in the Unlinked PRs panel within 10s (not dropped silently).

### FR-020: Webhook Ingestion Pipeline, Sync Logs & Configuration
- **Description:** Sub-200ms ack handlers (HMAC→Zod→Redis idempotency `SETNX` 48h→Inngest enqueue), dead-letter queue management (5-retry backoff, retry/discard UI), 15-min webhook health monitoring + auto-re-registration; `SyncLog` model (immutable, resumable cursors, PARTIAL no-rollback); scheduled delta sync (every 4h, 5-min overlap); field/team/repo mapping UI (versioned, last-5 restorable); per-IP rate limit 1,000/min.
- **Actors:** System, RTE/Admin, Support Engineer, Auditor.
- **Priority:** Must Have
- **Dependencies:** FR-018/019; `SyncLog`; `@repo/rate-limit`, `@repo/audit`; Upstash Redis.
- **ACs:**
  - Given the same event ID twice within 48h, When the second arrives, Then HTTP 200 returns within 100ms and no duplicate data is written.
  - Given a worker fails 5 times, When the final attempt fails, Then the event appears in the DLQ UI within 30s and the RTE is notified.
  - Given a full-pull interrupted at cursor 500/2,000, When the retry fires, Then it resumes from item 501 and final `itemsProcessed = 2,000`.
  - Given an admin sets `Story.status` policy to COSMOS_WINS, When a Linear webhook updates that status, Then Cosmos is not overwritten and the SyncLog records a SKIPPED event.

### FR-021: Copilot Sessions & Knowledge Indexer (RAG)
- **Description:** `CopilotSession`/`CopilotMessage` persistence (org+user scoped, auto-named, window: last 20 turns/12k tokens, summarization beyond 100 msgs, soft-delete 30d, export); nightly + incremental + manual reindex (`GET /api/cron/reindex-knowledge`) into `PIKnowledgeVector` (pgvector 1536-dim, 512-token chunks/64 overlap, per-entity templates); hybrid retrieval (vector + BM25 → RRF k=60, role down-rank 0.5×, top-8/top-12); citation deep-links.
- **Actors:** all authenticated roles, RTE, PO/PM, SM, SA, VIEWER.
- **Priority:** Must Have
- **Dependencies:** `CopilotSession`, `CopilotMessage`, `PIKnowledgeVector`; `@repo/ai`, pgvector, Inngest, Upstash (reindex lock 15-min TTL).
- **ACs:**
  - Given a session with 25 prior turns, When a new message is sent, Then the model receives the last 20 turns plus the current message.
  - Given a Risk ROAM status change OWNED→RESOLVED, When the incremental reindex fires within 60s, Then the next query reflects the resolved status.
  - Given a tenant with 500 entities, When a full reindex runs, Then it completes within 10 min with no data loss.
  - Given two tenants with indexed objectives, When Org A queries, Then no Org B `PIKnowledgeVector` records are retrievable (verified by query plan).

### FR-022: Role-Aware Context Assembly
- **Description:** Per-role context schema (RTE/PM/PO/SA/SM/Dev/BO/LACE → primary+secondary entity types) assembled from `TenantMember.role` + route context (artId/teamId/piPlanId/sprintId/epicId); inline entity context pills; ADMIN/OWNER role override (audited); P95 assembly <800ms (cached fallback on miss).
- **Actors:** all SAFe roles.
- **Priority:** Must Have
- **Dependencies:** FR-021; `TenantMember`; `@repo/audit`.
- **ACs:**
  - Given an SM on Team Falcon asks "What blocked us this sprint?", Then the response includes only Team Falcon's impediments and standup blockers.
  - Given a Business Owner asks "Are we getting value for our lean budget?", Then the response includes `LeanBudget` allocation vs PI objective `achievedValue` for the current PI.
  - Given an ADMIN invokes an RTE-perspective role override, Then an `AuditLog` entry with `action: copilot_role_override` is written.

### FR-023: Copilot Tool-Calling & Agentic Actions
- **Description:** Role-gated mutating tools (create_story/feature/risk/impediment, update_roam_status, score_wsjf, generate_pi_objective_draft, etc.) with mandatory confirmation cards; read-only tools (search_knowledge, summarize_entity, compare_sprints, calculate_capacity) without confirmation; multi-step plans (≤5 steps, partial-completion handling); all mutations audited with `source: copilot`; VIEWER read-only.
- **Actors:** RTE, PO/PM, SM, SA, all roles (read-only), VIEWER.
- **Priority:** Must Have
- **Dependencies:** FR-021/022; existing entity server actions; `@repo/audit`.
- **ACs:**
  - Given a PO confirms a "create story" tool call, Then the story is created and appears in the backlog within 1s.
  - Given a VIEWER asks to create a story, Then no confirmation card is shown, no tool call attempted, and the model explains the restriction.
  - Given a multi-step workflow where step 1 succeeds and step 2 fails, Then step 1's entity is retained, the AuditLog records partial completion, and the model explains what was/wasn't completed.

### FR-024: Prompt Library, Document Upload & Copilot Security
- **Description:** Role-specific suggested prompt chips (UC-14-16); ENTERPRISE custom templates (injection-guarded); document upload (`POST /api/copilot/upload`, PDF/DOCX/PPTX/MD/TXT, plan-gated quotas, SHA-256 dedup, chunked+embedded as `chunkType:DOCUMENT`, role visibility); layered system prompt (32k budget); session security (orgId DB-level filtering, server-side model calls, encrypted-at-rest messages, GDPR erasure ≤72h, rate limits 60/user-min & 500/tenant-min, injection guard); per-tenant model provider (ENTERPRISE, on-prem/DPA).
- **Actors:** all Copilot users, ADMIN/OWNER, RTE/PM/SA.
- **Priority:** Must Have
- **Dependencies:** FR-021; `@repo/security`, `@repo/rate-limit`, `@repo/audit`; Vercel Blob/S3.
- **ACs:**
  - Given an SM opens a new session from the Sprint Board, Then ≥3 role-specific suggestion chips relevant to sprint ceremonies are displayed.
  - Given a custom template containing "Ignore previous instructions", When saved, Then the save is rejected and an `AuditLog` entry is written.
  - Given an ADMIN uploads a 10-page PDF roadmap, When processing completes, Then its chunks are retrievable in copilot queries within 5 min.
  - Given a user exceeds 60 requests/minute, Then subsequent requests return HTTP 429 with `X-RateLimit-Remaining: 0` and `Retry-After`.

### FR-025: OKR Management & Snapshots
- **Description:** ART/team-scoped OKRs (1–5 key results, units %, count, $, ratio, custom; quarter/year; theme linkage; max 10/ART/quarter); manual + automated (webhook-driven) key-result updates with `KeyResultSnapshot` (source MANUAL/AUTOMATED, daily dedup for manual); trend charts + linear projection ("At Risk" badge); threshold notifications (25/50/75/100%); quarter-close auto-archive with final achievement.
- **Actors:** RTE, BO, Portfolio Manager, PM, PO, Copilot.
- **Priority:** Must Have
- **Dependencies:** `OKR`, `KeyResult` (+snapshots); FR-018/019 (webhook metric rules); `@repo/notifications`.
- **ACs:**
  - Given a valid new OKR (objective, ≥1 KR with target+unit, quarter/year), When submitted by an RTE, Then it persists and appears in the ART OKR list within 2s.
  - Given a KR at 74%, When updated to 76%, Then a threshold notification dispatches to RTE+BO within 5s.
  - Given a GitHub webhook with a matching metric rule, When processed, Then a `source=AUTOMATED` snapshot is created and the KR value updates without manual entry.
  - Given a PO (not RTE) attempts to create an ART-level OKR, Then a permission error is returned and no record persists.

### FR-026: Strategic Themes & Alignment
- **Description:** Portfolio-owned `StrategicTheme` (3-horizon H1/H2/H3, unique color, max 20 active/org, ART linkage cascading to epics/OKRs); create/edit (color propagation), archive with forced-unlink confirmation; theme-to-ART alignment heatmap (WSJF concentration, "Unaligned" pseudo-row); horizon balance donut with configurable target bands.
- **Actors:** Portfolio Manager/VP Strategy, BO, RTE, Copilot.
- **Priority:** Must Have
- **Dependencies:** `StrategicTheme`, `Epic.strategicThemeId`, `OKR`, `RoadmapItem`.
- **ACs:**
  - Given a theme created with H2, valid color, and ≥1 ART, Then it persists and appears in the ART epic-creation dropdown immediately.
  - Given a theme color change linked to 4 epics, Then all 4 epic cards and roadmap items update within 3s without reload.
  - Given target bands H1:70/H2:20/H3:10 and current H1:85/H2:12/H3:3, Then all three segments are flagged out-of-band.

### FR-027: Strategy Map & Strategy-to-Execution Traceability
- **Description:** Read-only DAG canvas (Theme→OKR→Epic→Feature, theme-color nodes, WSJF/confidence sizing, orphan/disconnected nodes, ≤200 nodes auto-collapse, filter by theme/horizon, PNG/SVG/PDF export with AI summary); full traceability chain `Theme→OKR→Epic→Feature→Story→Sprint` (top-down "Trace to Delivery", bottom-up "Why does this matter?", broken-link gap icons, Copilot report generation, on-demand <3s computation).
- **Actors:** BO, Portfolio Manager, RTE, CTO/VP Eng, Developer, Copilot.
- **Priority:** Should Have
- **Dependencies:** FR-025/026; `Epic`, `Feature`, `Story`, `Sprint`; FR-021/023.
- **ACs:**
  - Given an ART with 2 themes, 3 OKRs, 6 epics, 14 features, When the map opens, Then a layered DAG renders within 4s.
  - Given a story→feature→epic→theme→OKR chain, When the developer clicks "Why does this matter?", Then the breadcrumb shows all 5 levels with titles and statuses.
  - Given an epic with no `strategicThemeId`, When the bottom-up breadcrumb reaches it, Then a broken-link "Alignment gap" message is shown.

### FR-028: Roadmap Items & Scenario Planning
- **Description:** `RoadmapItem` (epic↔quarter/year, confidence 0–100 with visual encoding, theme color/WSJF inheritance, max 25/ART/quarter); drag-from-Unscheduled, capacity warnings (>120% velocity, configurable), dependency conflict alerts; portfolio multi-ART timeline; scenario planning (deep-copy, compare diff, promote-to-base with archived rollback, max 5/ART/year); PNG/PDF/CSV export.
- **Actors:** Portfolio Manager, RTE, BO, PM, Copilot.
- **Priority:** Should Have
- **Dependencies:** `RoadmapItem`, `Epic`, `DependencyLink`, `StrategicTheme`; FR-011 (velocity).
- **ACs:**
  - Given an unscheduled epic dragged to Q3 2027, Then a `RoadmapItem` (quarter=3, year=2027, confidence=50) is created and the card appears within 1s.
  - Given a confidence change 80→30, Then the card switches to outline-only and a notification dispatches to the BO within 5s.
  - Given a base roadmap of 8 items, When a scenario removes 2 and Compare opens, Then exactly 2 items are marked "Removed in scenario".

### FR-029: Alignment Gap Detection & Alerts
- **Description:** Automated scan (via `anomaly-scheduler`, daily 06:00 UTC, + manual) of 6 gap rules (unlinked epic, OKR-at-risk, blocked high-confidence roadmap item, theme starvation, budget-without-theme, OKR orphan) producing prioritized alerts; acknowledge/dismiss-with-reason (audited); auto-resolve on condition clearance; CRITICAL email; max 50 open/ART.
- **Actors:** RTE, Portfolio Manager, Copilot.
- **Priority:** Should Have
- **Dependencies:** FR-025/026/028; FR-001 scheduler; `@repo/notifications`, `@repo/audit`.
- **ACs:**
  - Given an IMPLEMENTING epic with `strategicThemeId = null`, When the daily scan runs, Then an `UNLINKED_EPIC` HIGH alert is created with an Epic-module banner.
  - Given a KR at 30% with 20 days left and no IMPLEMENTING epic on its theme, Then an `OKR_AT_RISK` CRITICAL alert is created and the RTE receives email.
  - Given an OPEN unlinked-epic alert, When a theme is assigned, Then the alert auto-resolves within 60s.

### FR-030: BpmnDefinition Persistence & BPMN-js Canvas Editor
- **Description:** `BpmnDefinition` (gzip XML ≤2MB, append-only versioning, team overrides org, one active per owner+entityType, locked-node support); BPMN-js 18 modeler with constrained Cosmos palette, `cosmos:*` moddle extension, Liveblocks co-editing (≤20 concurrent), local autosave, diff-against-active; create/activate (compliance-lock approval gate)/fork-from-baseline.
- **Actors:** SM, RTE, SA, Compliance Officer, Platform Admin, Developer (reviewer).
- **Priority:** Should Have
- **Dependencies:** `BpmnDefinition`, `StateTransitionHistory`, `ApprovalRequest`; BPMN-js 18, Liveblocks; `@repo/collaboration`.
- **ACs:**
  - Given `WORKFLOW_WRITE` permission and valid unique-named XML, When saved, Then a `BpmnDefinition` with `active:false`, `version:1`, correct `entityType` is created.
  - Given a disconnected gateway, When saving, Then a validation error identifying the gateway by BPMN `id` is returned and nothing persists.
  - Given two co-editors, When User A moves a node, Then User B sees A's presence cursor reposition within 500ms.
  - Given an active definition and a draft adding 1 node/removing 1 flow, When "Diff Against Active" runs, Then the added node is green, removed flow red, and the side panel lists exactly 2 changes.

### FR-031: BPMN→XState Compilation, Runtime & Context
- **Description:** Deterministic catalogue-driven compiler (BPMN element→XState node/edge; rejects out-of-catalogue elements; unreachable-state warnings; sandboxed `createMachine()` validation; namespaced machine IDs); stateless per-transition actor reconstruction; transactional state writes + `StateTransitionHistory`; SLA-breach escalation (via staleness-check, ≤500 items/run); webhook wait-state release (idempotent); sandboxed condition expressions (50ms cap, standard context variables + `custom.*`).
- **Actors:** Platform Engineering, SM/RTE, Developer, System, External System.
- **Priority:** Should Have
- **Dependencies:** FR-030; XState 5; `StateTransitionHistory`; FR-019/018 webhooks; Inngest staleness-check.
- **ACs:**
  - Given a BPMN diagram (StartEvent, 3 Tasks, 1 ExclusiveGateway with 2 conditional outflows, 2 EndEvents), When compiled, Then a valid XState v5 config with matching `initial` and 5 states is produced.
  - Given a guarded transition requiring an assignee fired with no assignees, Then the server action returns 403 and `workflowState` is unchanged.
  - Given a story "Awaiting Review" with `cosmos:slaHours=48` entered 72h ago, When staleness-check runs, Then it transitions to the escalation state, a HIGH anomaly is created, and the SM is notified.
  - Given a `wait` story with `cosmos:waitEvent="github.pr.merged"` and matching `prId`, When the merged-PR webhook fires, Then it transitions out and a `StateTransitionHistory` entry with `externalRef` is created.

### FR-032: BPMN Versioning, In-Flight Migration & Process Analytics
- **Description:** Per-item `workflowVersion`; no auto-migration until terminal/explicit/threshold-exceeded (default 3, `OrgWorkflowMigrationMap` reuse); manual migration (state-mapping table, batched Inngest, append-only history, unmapped-state block); auto-migration of stale items; process analytics (dwell-time heatmap, backflow analysis, both reading `StateTransitionHistory`/`FlowMetricSnapshot`).
- **Actors:** RTE, SM, Admin.
- **Priority:** Nice to Have
- **Dependencies:** FR-030/031; `StateTransitionHistory`, `FlowMetricSnapshot`, `OrgWorkflowMigrationMap`; Inngest.
- **ACs:**
  - Given 50 in-flight v2 stories and an active v3 definition, When manual migration runs with a valid mapping, Then all 50 update `workflowVersion`→3 and 50 `StateTransitionHistory` entries are inserted.
  - Given a mapping omitting an old-version state, When confirming, Then confirmation is blocked and the unmapped state is highlighted.
  - Given a v1 item with active v5 (gap 4 > threshold 3), When staleness-check runs, Then it auto-migrates using the stored mapping and an INFO anomaly is created.

---

## Non-Functional Requirements

**Performance**
- Anomaly detection ≤120s for ≤10,000 entities/org/run; staleness job ≤50,000 entities/org (partitioned beyond).
- Full FinOps pipeline (dispatch→anomaly) ≤10 min for ≤10,000 daily entries; billing upsert ≤15 min.
- Webhook ack <200ms (idempotency duplicate path <100ms); Linear status sync ≤5s; outbound push ≤10s.
- Copilot context assembly P95 <800ms; team narrative ≤10s, PI ≤20s (template fallback at thresholds); read-only tools <500ms; full reindex (500 entities) ≤10 min.
- Dashboards: Flow Metrics ≤2s, Executive ≤3s; strategy map ≤4s; traceability chain (depth ≤5) <3s.
- Monte Carlo cached 1h; heatmaps cached 15-min TTL; portfolio dashboard cached 5-min TTL; exchange rates 25h TTL.

**Security & Multi-Tenancy**
- Every table RLS-scoped to `orgId`; no cross-tenant access; vector queries filtered at DB level (app-level is secondary check).
- Third-party credentials (OAuth tokens, webhook secrets, AWS IAM) AES-256-GCM at rest with per-tenant key in secrets manager, never logged/returned (masked `****{last4}`).
- HMAC signature validation non-optional on all webhooks; `cosmos:*`-namespace-only writes to GitHub; AWS read-only IAM.
- Copilot messages encrypted at rest; server-side-only model calls; no tenant data for training (DPA required for ENTERPRISE); GDPR erasure ≤72h; prompt-injection guard on inputs and templates.
- `PersonCost` restricted to `billing:admin`; coaching notes encrypted; individual stats never in leaderboards; member PII excluded from analytics API unless explicitly scoped.

**Compliance & Audit**
- `StateTransitionHistory`, `SyncLog`, integration lifecycle, copilot sessions/tool calls/uploads, analytics export/API access, role overrides, gap-alert dismissals all written to immutable audit trail (SOC2 CC6.1, LGPD/SOX-compatible format).
- Retention: anomalies 365d soft / 730d hard; state-transition 7y; sync logs 90d/1y/7y by plan; cost anomalies 12mo; snapshots 24mo (cold storage beyond); narratives 90d; scenario archive 90d.

**Scalability**
- Inngest fan-out per tenant/account; failures isolated per org; DLQ with Sentry alerting; resumable cursors; partial-progress retention.
- Rate limits: webhooks 1,000/min per IP & per integration; analytics API 1,000/h/org; copilot 60/user-min & 500/tenant-min; PDF export 10/user/h.

**Localization**
- SAFe terminology configurable per tenant (PT-BR/ES deep localization, executive-jargon translation); currency display per ISO 4217 (≥30 currencies at launch).

---

## Data Entities

**Extend existing models (do not recreate):**
- `Anomaly` — add suppression fields (`suppressed`, `suppressionReason`, `suppressionExpiresAt`), `escalatedFrom`, `resolutionNote`, pattern types (`EPIC_OSCILLATION`, `EPIC_DWELL_EXCESSIVE`, `EPIC_BACKWARD_TRANSITION`, `STALE_*`, `LOW_PREDICTABILITY`, FinOps types).
- `AnomalyDetectionRun` — `source` (CRON/MANUAL), `ruleEngineVersion`, `itemsEvaluated`, `anomaliesFound`, `partialCompletion`.
- `FlowMetricSnapshot` — staleness aggregates, `source`, flow-distribution map.
- `StateTransitionHistory` — `externalRef`, `reason`, ensure immutability constraint (INSERT-only).
- `Epic` — ROI fields (`hypothesis`, `businessOutcomes`, `leadingIndicators`, `wsjfScore`, `investScore`, `leanBudgetAllocation`), `workflowState`/`workflowContext`/`workflowVersion`.
- `Story`/`Task`/`Defect`/`Impediment` — `workflowState`, `workflowContext`, `workflowVersion`, `pullRequests[]`, `prStatus`, `externalId`.
- `CompetencyAssessment` — `assessorId`, `currentLevel`/`targetLevel`, `assessedAt`, self-vs-validated distinction.
- `BillingEntry` — FOCUS 1.1 conformant columns (provider, service, region, billed/effective cost, currency, tagHash, raw tag map).
- `Integration` — XState lifecycle status, encrypted `config`, `lastSyncAt`/`lastSyncStatus`, field-mapping versions.
- `OKR`/`KeyResult` — theme linkage, `confidence`, `finalAchievement`, weights.
- `StrategicTheme` — `horizon`, `color`, `arts[]`.
- `RoadmapItem` — `confidence`, `scenarioName`, `notes`.
- `BpmnDefinition` — `compiledMachine` JSON column, `cosmos:locked` support.

**New models:**
- `BillingEntryAllocation`, `CostSnapshot`, `TagRule`, `BudgetPlan`, `CommitmentDiscount`, `PersonCost`, `CurrencyRate`, `BillingSyncRun`, `CostAnomaly` (finops bounded context — confirm if scaffolded; extend if present).
- `KeyResultSnapshot` (id, keyResultId, value, recordedAt, recordedBy, source).
- `AlignmentGapAlert` (type, severity, artId, entityType, entityId, message, status, dismissalReason, detectedAt, resolvedAt).
- `OrgWorkflowMigrationMap` (owner, entityType, fromVersion, toVersion, mapping JSON).
- `Document` / `CopilotDocument` (orgId, name, mimeType, sizeBytes, sha256, uploadedBy, processingStatus, chunkCount) + `PIKnowledgeVector` chunkType `DOCUMENT`.
- `ScheduledReport` (type, cadence, recipients, lastRunAt, artifactRef).
- `AnomalySuppressionRule` (FinOps recurring false-positive patterns).

---

## API Surface (under `apps/app/app/api/`)

- `cron/anomaly-scheduler`, `cron/staleness-check`, `cron/billing-sync-dispatch`, `cron/reindex-knowledge` (Inngest cron handlers).
- `copilot/chat`, `copilot/upload` (RAG chat + document ingestion).
- `webhooks/linear`, `webhooks/github` (HMAC-verified ingestion).
- `integrations/billing/sync`, `integrations/billing/sync/[jobId]/status` (manual FinOps sync + polling).
- `billing/snapshots/[period]/breakdown` (drill-down).
- `health/billing` (pipeline health).
- `features` (feature-flag evaluation).
- `analytics/*` read-only REST API (token-scoped, paginated, `snapshotAt` freshness, audited) for BI export.
- `reports/*` (scheduled report generation/download, pre-signed 7-day links).

## Server Actions (under `apps/app/app/actions/`)

- `flow-intelligence.ts` (anomaly run trigger, suppress/resolve/escalate, staleness nudge).
- `flow-metrics.ts` (snapshot read/aggregate, DORA computation, forecasting).
- `analytics.ts` (dashboards, exports), `reports.ts` (schedule CRUD).
- `finops.ts` / `billing.ts` (tag rules, budget plans, commitment discounts, personnel cost, currency, cost attribution, dispute).
- `integrations.ts` (lifecycle connect/pause/resume/revoke, field/team/repo mapping, conflict resolution, sync re-run, DLQ).
- `safe-copilot.ts` (sessions CRUD/export, role context, tool dispatch, reindex trigger, document management, prompt templates).
- `okrs.ts`, `key-results.ts` (OKR/KR CRUD, snapshots, archive, automated metric rules).
- `strategic-themes.ts` (theme CRUD, ART linkage, alignment heatmap, horizon balance).
- `strategy-map.ts` (DAG data, export), `traceability.ts` (chain computation, Copilot report).
- `roadmap.ts` (roadmap items, scenarios, capacity/dependency checks, export).
- `alignment-gaps.ts` (scan trigger, acknowledge/dismiss, auto-resolve).
- `workflows.ts` / `bpmn.ts` (definition CRUD, activation, fork, compile, diff).
- `workflow-runtime.ts` (transitions, SLA escalation, wait-state release, migration), `workflow-analytics.ts` (dwell/backflow).

---

## Market Research ACs Integration

- **AC-MKT-6 (BillingEntry FOCUS 1.1 compliance):** Addressed in **FR-015** — `BillingEntry` columns conform to the FOCUS 1.1 multi-cloud billing standard (provider, service, region, billed/effective cost, currency, tag map), with source currency immutable (FR-017) and idempotent composite-key upsert. NFR mandates FOCUS-conformant schema; verified by ingestion ACs.

- **AC-MKT-7 (role-specific suggested prompt chips):** Addressed in **FR-024** (UC-14-16) — prompt library serves 3–5 role-filtered chips (RTE/LPM/SM/Dev) above the input, sourced from `TenantMember.role` + current module context. AC: "an SM opens a new session from the Sprint Board → ≥3 role-specific chips relevant to sprint ceremonies."

- **AC-MKT-8 (max 3 HIGH/CRITICAL active anomalies per tenant; cooldown after dismiss):** Addressed in **FR-001/FR-002** dedup + suppression model and **FR-017** cost-anomaly suppression — implemented as: detection caps active HIGH/CRITICAL surfaced anomalies at 3 per tenant (excess queued/batched per BR-10-03/AC-10-01 digest rules), and dismissed/suppressed anomalies enter a cooldown window (24h dedup minimum, configurable suppression expiry) preventing re-raise of the same `type+entityId`. AC: a dismissed anomaly does not regenerate for the same entity-day combination during cooldown.

- **AC-MKT-9 (Portfolio view functional without forcing Linear team migration):** Addressed in **FR-018** — Cosmos sits above Linear; portfolio/PI views and SAFe hierarchy operate on synced data without requiring Linear teams to migrate. AC: "an org adopts Cosmos for portfolio views → portfolio/PI views remain fully functional with synced items appearing without team migration." Unmapped Linear teams land in a holding area rather than blocking portfolio function.

- **AC-MKT-10 (flow anomaly narrative includes recommended SAFe-specific action):** Addressed in **FR-002** (every rule carries a `Suggested Action`, e.g., "SM to run emergency retrospective", "RTE escalation; capacity review") and **FR-007** (narratives render each finding with severity + recommended SAFe action). AC: "AI generation succeeds → narrative includes ≥1 finding with a severity label and a recommended SAFe-specific action."
