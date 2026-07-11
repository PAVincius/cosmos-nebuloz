# SRD — Epic 008: Enterprise & Scale

## Overview

Epic 008 (640h) provides the foundational enterprise infrastructure that makes Cosmos/Nebuloz deployable to security-conscious, compliance-regulated, and large-scale SAFe organizations. It layers across all other epics and delivers: real-time collaborative infrastructure hardening (Liveblocks security + CRDT), large Solution Train management, enterprise governance controls, tenant administration, and all cross-cutting security primitives (RBAC, audit logging, webhooks, API keys, SOC2/LGPD compliance, rate limiting, credential management, PII-safe observability).

**Scope (640h across 10 clusters):**
1. **Liveblocks Security & Real-Time Hardening** — org-scoped authentication handshake, presence + cursors, CRDT PI planning board, program board dependency collaboration, confidence vote, cross-surface rooms, dual-write consistency.
2. **Solution Train Management** — STE/LACE management, Capability management, Solution Epic + Lean Business Case governance, solution-level ROAM, large-solution RBAC, supplier management, solution-level program board.
3. **Enterprise Governance Controls** — approval workflow config, governed epic submission, SLA tracking + escalation, decision log governance dashboard + audit hooks, portfolio kanban governance gate.
4. **Tenant & Org Administration** — tenant/org settings, member management + invitations, profile + 2FA/TOTP, admin security policies, notification system.
5. **Global Search & Feature Flags** — global search (command palette, keyboard shortcuts), feature flags + per-user overrides, webhook management + API keys.
6. **Audit Logging & Compliance** — full audit trail, SOC2/LGPD controls, LGPD data subject rights, compliance dashboard, data retention policies.
7. **RBAC & Permission Enforcement** — role hierarchy, permission matrix enforcement, field-level RLS, custom roles, permission checks at every layer.
8. **Secret & Credential Management** — AES-256-GCM encryption, key rotation, vault integration, masked display.
9. **Rate Limiting & Abuse Prevention** — multi-tier rate limiting (per-user, per-org, per-IP), abuse detection, DDoS mitigation.
10. **Cross-Cutting Security Wrapper** — `withSecureAction` HOF, ESLint enforcement, webhook signature verification, PII-safe observability.

**Personas served:** Org Admin, Platform Admin/SRE, Security Officer/CISO, CTO/CPTO, RTE/STE, LACE member, Supplier/Partner, Developer (all roles), Compliance Officer, DPO (Data Protection Officer), External Auditor.

---

## Functional Requirements

### FR-801: Liveblocks Authentication Handshake & Room Security
- **Description:** Secure Liveblocks auth via `POST /api/collaboration/auth` using `@liveblocks/node` `authorize()`, orgId-scoped rooms (room ID = `{orgId}:{surface}:{entityId}`), permission-based access (read/write based on `TenantMember.role` + `piPlanId`/`artId`/`teamId` context), Better Auth session validation, anti-spoofing middleware validation, metadata injection (`userId`, `orgId`, `role`, `displayName`), and room creation on-demand.
- **Actors:** All authenticated users accessing real-time surfaces.
- **Priority:** Must Have
- **Dependencies:** `@liveblocks/node`, Better Auth, `TenantMember`, room-access matrix.
- **ACs:**
  - Given a valid session, When auth is called for `{orgId}:pi-planning:{piPlanId}`, Then Liveblocks token is returned with correct permissions within 300ms.
  - Given a user from Org A attempting to access Org B's room, Then auth returns 403 and no Liveblocks token is issued.
  - Given a VIEWER-role user accessing a PI planning room, Then Liveblocks token grants `read-only` permissions and drag mutations are server-rejected.
  - Given a spoofed `orgId` in request body differing from session, Then middleware returns 401.

### FR-802: Presence, Cursors & Awareness
- **Description:** Real-time presence across all collaborative surfaces (Portfolio Kanban, PI Planning, Program Board, Retrospective, BPMN Editor): user presence badge (name, avatar, role color), cursor tracking (throttled 50ms debounce), "others" list (max 20 shown + overflow count), last-seen timestamp, idle detection (3min → ghost state), session cleanup on disconnect, and cross-surface presence aggregation for ART/PI dashboard.
- **Actors:** All users on collaborative surfaces.
- **Priority:** Must Have
- **Dependencies:** FR-801, `@liveblocks/react`, surface-specific components.
- **ACs:**
  - Given User A opens Portfolio Kanban, Then User B already on the board sees A's avatar within 1s.
  - Given 25 users present, When the presence panel renders, Then 20 avatars + "+5 others" are shown, not 25 individual badges.
  - Given User A is idle 3+ minutes, Then their cursor ghost-state and avatar are visually dimmed and labeled "away".

### FR-803: CRDT PI Planning Board
- **Description:** Liveblocks CRDT (Yjs) for the PI Planning Board canvas: conflict-free concurrent edits on feature placement (team×sprint assignments), presence-aware drag-and-drop (DND-Kit), optimistic UI with server reconciliation, dual-write (Liveblocks storage + Prisma transaction within 500ms of drop), divergence detection (periodic checksum comparison), background reconciliation job (Inngest, 15-min interval), and undo/redo stack (≤50 ops/user).
- **Actors:** RTE, PM, PO, SA, SM, Team Members during PI Planning.
- **Priority:** Must Have
- **Dependencies:** FR-801/802, Liveblocks Storage (Yjs), DND-Kit, `PIPlanFeatureAssignment`; Inngest.
- **ACs:**
  - Given User A and User B drag the same feature simultaneously, When both drops resolve, Then exactly one final position is persisted and both clients converge within 2s.
  - Given a feature dragged to Sprint 3 Team Alpha, When DB write succeeds, Then `PIPlanFeatureAssignment` record reflects the new assignment and the board shows it within 500ms.
  - Given a DB write fails, When the optimistic UI has already moved the card, Then the card snaps back to its prior position and a toast explains the failure.
  - Given 20 concurrent users on the same PI Planning board, When all are dragging features, Then no deadlocks occur and all settle within 5s.

### FR-804: Program Board Dependency Collaboration
- **Description:** Real-time collaborative DependencyLink management on the Program Board: create/update/resolve dependency lines via contextual modal (server-validated, no circular deps), drag-connector handles, Liveblocks CRDT broadcast of link changes, live dependency line redraws on feature move, status color coding (IDENTIFIED=yellow/IN_PROGRESS=blue/RESOLVED=green), and critical-path highlighting.
- **Actors:** PM, SA, RTE, Team Members.
- **Priority:** Must Have
- **Dependencies:** FR-803, `DependencyLink`, circular-dep DFS (server-side).
- **ACs:**
  - Given User A creates a dependency F-10→F-20, Then User B sees the connector line within 500ms without reload.
  - Given an attempt to create a circular dependency (A→B→C and C→A), Then the server rejects with 422 and no connector is drawn.
  - Given F-10 is resolved, When User B is viewing the board, Then the connector color changes to green within 500ms.

### FR-805: Confidence Vote Real-Time Overlay
- **Description:** `ConfidenceVoteSession` opened by the facilitator with Liveblocks presence broadcasting: full-screen 1–5 fist-of-five overlay delivered to all non-OBSERVER participants via Liveblocks broadcast (not storage), server-side aggregation (no individual votes in Liveblocks storage/history), reveal gated at ≥50% participation (configurable), live tally counts (no per-user reveal until gate), facilitator-only close action.
- **Actors:** Facilitator/RTE, all non-OBSERVER PI participants.
- **Priority:** Must Have
- **Dependencies:** FR-801, `ConfidenceVoteSession`/`ConfidenceVoteTally`, `PIParticipant`.
- **ACs:**
  - Given facilitator opens vote, Then all non-OBSERVER participants (≤500 connected) see the overlay within 2s.
  - Given 40% participation, When facilitator attempts to reveal, Then the action is blocked with "Only 40% of participants have voted (minimum 50% required)."
  - Given a vote is cast, Then no vote-to-user mapping appears in Liveblocks storage or presence metadata; only aggregate counts update on server.

### FR-806: Cross-Surface Rooms & Session Management
- **Description:** Distinct room namespaces per surface type (portfolio-kanban, pi-planning-board, program-board, retro-board, bpmn-editor), room lifecycle (auto-create on first auth, cleanup after 24h empty), per-room connection limit (200 for PI planning, 50 for retro/BPMN), room metadata (artId, piPlanId, orgId), and ART-level cross-surface presence aggregation API.
- **Actors:** All authenticated users.
- **Priority:** Must Have
- **Dependencies:** FR-801, Liveblocks Rooms API.
- **ACs:**
  - Given org has 3 active PI Planning boards, When each opens, Then 3 separate room IDs exist with correct metadata.
  - Given connection #201 attempts to join a PI planning room at limit 200, Then auth returns 429 with "Room at capacity" and the user sees a read-only fallback.
  - Given a room empty for 25h, When cleanup job runs, Then Liveblocks room is archived and no error is thrown if already purged.

### FR-807: Dual-Write Consistency & Reconciliation
- **Description:** Every Liveblocks mutation that changes SAFe data requires a server-side Prisma write within 500ms (enforced via Liveblocks webhook `storageUpdated` → Inngest handler → Prisma transaction); divergence detection via periodic board-checksum comparison (Liveblocks CRDT state hash vs DB aggregate hash, 15-min interval); background reconciliation (Prisma wins on conflict, Liveblocks patched, full divergence log).
- **Actors:** System.
- **Priority:** Must Have
- **Dependencies:** FR-803, Liveblocks webhooks, Inngest, `BoardReconciliationLog`.
- **ACs:**
  - Given a feature placement in Liveblocks, When the `storageUpdated` webhook fires, Then Prisma is updated within 500ms and the reconciliation log shows no divergence.
  - Given a divergence detected (Liveblocks has 45 assignments, DB has 43), When reconciliation runs, Then DB state is applied to Liveblocks and a `BoardReconciliationLog` entry is created.
  - Given a Prisma write failure on 3 consecutive attempts, Then the RTE is notified "Board sync issue - please refresh" and the divergence is flagged for manual review.

### FR-808: Solution Train Management (STE & LACE)
- **Description:** Solution Train organizational model: `SolutionTrain` entity (name, vision, value-stream), STE assignment (one-per-ST, plus backups), `ART` membership in ST, Solution PI cadence (n×ART PI, synchronized PI dates), LACE (Lean-Agile Center of Excellence) membership (`LaceMember`, roles: STE/EAM/BC/RTE/SM), LACE meeting management (`LaceMeeting`, recurrence, agenda, attendees, action items with due dates), LACE dashboard (metrics, action item completion, capability gap roll-up).
- **Actors:** STE, Enterprise Agile Coach, RTE, Business Owner, LACE members.
- **Priority:** Should Have
- **Dependencies:** `SolutionTrain`, `LaceMeeting`, `LaceActionItem`, `LaceFocusArea`, `LaceMember`; `ART`.
- **ACs:**
  - Given an STE creates a Solution Train with valid name + vision, When saved, Then the ST persists with `status=ACTIVE` and the STE is assigned as primary.
  - Given a LACE meeting scheduled for next Monday with 3 agenda items, When an attendee opens it, Then all agenda items, attendee list, and recurrence details are visible.
  - Given a LACE action item overdue, When the LACE dashboard loads, Then the item is flagged red with days-overdue count and owner name.

### FR-809: Capability Management
- **Description:** Solution-level `Capability` (analogous to Feature at Solution level): linked to Solution Epic, ART delivery mapping (which ARTs deliver which portions), `CapabilityReadinessChecklist` (WSJF, ≥3 AC, SA-validated NFRs, ART assignments, risk-free), capacity estimation across multiple ARTs, and solution-level WSJF.
- **Actors:** STE, SA, RTE, PM.
- **Priority:** Should Have
- **Dependencies:** `Capability`, `SolutionEpic`, `ART`; FR-006 WSJF infra.
- **ACs:**
  - Given a Capability "Payment Gateway Integration" with 3 ART deliverables, When ART-2 marks its deliverable ready, Then the Capability shows 1/3 ART-ready with progress bar.
  - Given a Capability without SA validation, When readiness check runs, Then SA-validation criterion is flagged failed with a "Request SA review" button.
  - Given WSJF scored at Capability level, Then the CoD and jobSize use the same Fibonacci scale and formula as Epic WSJF.

### FR-810: Solution Epic & Lean Business Case Governance
- **Description:** `SolutionEpic` extending `Epic` with Solution-Train scope (linked to multiple ARTs, larger funding model), Solution-level Lean Business Case (same structure + system-impact statement, cross-ART dependency matrix), governance at Solution level (STE + key stakeholder approval chain, separate from ART-level governance), and Solution-Epic-to-Epic decomposition traceability.
- **Actors:** STE, Portfolio Manager, CPO, Business Owner, RTE.
- **Priority:** Should Have
- **Dependencies:** `SolutionEpic`, `Epic`, FR-009 governance infra; FR-003 LBC infra.
- **ACs:**
  - Given a Solution Epic submitted for approval, Then STE and Business Owners of all linked ARTs receive approval notifications.
  - Given a Solution Epic approved, When decomposed into ART-level Epics, Then each child Epic's `parentSolutionEpicId` is set and the traceability tree renders.
  - Given a Solution Epic LBC requiring cross-ART dependency matrix, When saved incomplete, Then the ANALYZING→PORTFOLIO_BACKLOG guard blocks and lists the missing ART dependencies.

### FR-811: LACE Member Management & Supplier Management
- **Description:** LACE member invitation (existing `TenantMember` or external email), role assignment within LACE context, LACE-focus areas (`LaceFocusArea`: capability building, coaching, transformation, metrics), LACE meeting minutes export; `Supplier` management (external partner/vendor, `SupplierDeliverable` with expected date + status, `Integration` link for webhook ingestion, supplier portal read-only access token).
- **Actors:** STE, Org Admin, Enterprise Agile Coach, Supplier/Partner.
- **Priority:** Should Have
- **Dependencies:** `LaceMember`, `LaceFocusArea`, `Supplier`, `SupplierDeliverable`, `Integration`.
- **ACs:**
  - Given an STE invites a new external LACE member, Then an invitation email is sent and the member appears as PENDING in the LACE dashboard.
  - Given a Supplier with 3 deliverables (2 on-time, 1 late), When the supplier dashboard opens, Then the 1 late deliverable is highlighted red.
  - Given a supplier portal access token, When used to access non-supplier data, Then 403 is returned.

### FR-812: Solution-Level Program Board & ROAM
- **Description:** Solution-level Program Board: Capability rows × Solution-Sprint columns (derived from synchronized ART PIs), cross-ART dependency visualization, risk/ROAM integration at solution level, STE-facilitated board view, and aggregated capacity warnings (multi-ART). Solution ROAM board: risks spanning multiple ARTs escalated here, STE-classified, cross-ART impact matrix.
- **Actors:** STE, SA, RTE, PM, Business Owner.
- **Priority:** Should Have
- **Dependencies:** FR-809, FR-804 dependency infra; `Risk` escalation.
- **ACs:**
  - Given 2 ARTs in a Solution Train each with 5-sprint PIs, When the Solution Program Board opens, Then 5 solution-sprint columns show with ART sub-rows.
  - Given a Risk escalated from ART-1, When it appears on the Solution ROAM board, Then it shows originating ART, original sprint context, and cross-ART impact checkboxes.

### FR-813: Large Solution RBAC
- **Description:** Permission model extensions for Solution Train: `STE` role (above RTE, below ORG_ADMIN), `LACE_MEMBER` context role (can access LACE dashboards, no mutation on ART-level entities), `SUPPLIER_VIEWER` (read-only scoped to assigned deliverables), solution-level resource checks in middleware, and cross-ART visibility grants (RTEs can view but not edit sibling ARTs' data within same ST).
- **Actors:** Org Admin, STE, RTE, LACE Member, Supplier.
- **Priority:** Should Have
- **Dependencies:** `TenantMember`, `SolutionTrainMember`, middleware RBAC.
- **ACs:**
  - Given a RTE for ART-1 in a Solution Train, When viewing ART-2's Program Board (same ST), Then read-only access is granted.
  - Given a SUPPLIER_VIEWER token, When querying non-assigned deliverables, Then 403 with "Access denied: supplier visibility scope" is returned.
  - Given STE attempts to approve an ART-level GovernedEpic (not Solution-level), Then they can approve as they have ≥ RTE permissions within the ST.

### FR-814: Approval Workflow Configuration
- **Description:** Org-scoped `ApprovalWorkflow` builder (visual step editor, DND ordering, ≤10 steps, approver role assignment, `requiresAll` toggle, `slaHours` per step, step types: SINGLE_APPROVER/GROUP_ANY/GROUP_ALL/EXTERNAL_NOTIFY), workflow versioning (immutable after first use, fork-to-edit), multi-context workflows (Epic/GovernedEpic/SolutionEpic/Capability), workflow deletion guard (no active GovernedEpics), template library (SAFe pre-built).
- **Actors:** Org Admin, Portfolio Manager, RTE.
- **Priority:** Must Have
- **Dependencies:** `ApprovalWorkflow`, `GovernedEpic`, `ApprovalStepInstance`; FR-009.
- **ACs:**
  - Given an Org Admin creates a 3-step workflow with valid config, Then 3 `ApprovalStepDefinition` rows are created, workflow status=DRAFT, not yet immutable.
  - Given a workflow is first used (a GovernedEpic submits against it), Then all edit controls are disabled with "Workflow is in use — fork to modify."
  - Given a deletion attempt on a workflow with 2 active GovernedEpics, Then 409 is returned listing the active epic IDs.
  - Given a GROUP_ALL step with 3 approvers and 2 approvals received, Then step does not advance and the 3rd approver sees their pending action.

### FR-815: Governed Epic Submission & SLA Tracking
- **Description:** Epic governance gate: `GovernedEpic` submission from PORTFOLIO_BACKLOG status (requires `GovernedEpic.workflowId`), workflow step instantiation (`ApprovalStepInstance`), SLA tracking per step (`slaHours`, `stepStartedAt`, `slaBreachAt` = `stepStartedAt + slaHoursMs`), proactive reminders (Inngest at 80% elapsed, breach notification), SLA breach status (`SLA_BREACHED` on `ApprovalStepInstance`), escalation path (OWNER → RTE → ORG_ADMIN cascade), and SLA performance report.
- **Actors:** Epic Owner, Governance Reviewer, RTE, Org Admin.
- **Priority:** Must Have
- **Dependencies:** FR-814, `ApprovalStepInstance`, Inngest, `@repo/notifications`.
- **ACs:**
  - Given a GovernedEpic submitted, Then step 0 `ApprovalStepInstance.stepStartedAt` = submission time and `slaBreachAt` = `stepStartedAt + slaHours*3600*1000`.
  - Given 80% of SLA elapsed, When the reminder job fires, Then the assigned approver receives a "Pending review — SLA at 80%" notification with a deep link.
  - Given SLA breach occurs, Then `ApprovalStepInstance.status = SLA_BREACHED`, the RTE is escalated to, and a HIGH anomaly is created.
  - Given SLA performance report requested, Then it shows avg SLA compliance % per step, breached-count, and p95 approval time.

### FR-816: Decision Log Governance & Audit Hooks
- **Description:** `DecisionLogEntry` governance surface: view-only table (RTE/ORG_ADMIN/PORTFOLIO_MANAGER), full timeline per GovernedEpic (submission, approvals, rejections, bypasses, INVEST overrides, comments), immutable enforced at DB (INSERT-only trigger, no UPDATE/DELETE routes), PDF + JSON export (audit-logged), governance metrics (avg approval time, approval rate, bypass rate, bottleneck analysis), and 7-year retention policy.
- **Actors:** Portfolio Manager, Org Admin, External Auditor, Compliance Officer.
- **Priority:** Must Have
- **Dependencies:** `DecisionLogEntry`, `GovernedEpic`, DB triggers, `@repo/audit`.
- **ACs:**
  - Given an admin attempts `DELETE /api/governance/decision-log/{id}`, Then HTTP 405 is returned and no deletion occurs.
  - Given a PDF export of an epic's decision log, Then it contains all entries in chronological order with user IDs, timestamps, rationale, and an export metadata footer.
  - Given a BYPASSED approval entry, Then the PDF export includes the bypass justification (full text) and bypassing user.

### FR-817: Portfolio Kanban Governance Gate
- **Description:** Visual governance gate overlay on Portfolio Kanban: "Awaiting Approval" banner on governed epics in PORTFOLIO_BACKLOG, column-level drag lock for governed epics (prevents drag to IMPLEMENTING unless `GovernedEpic.status=APPROVED`), governance status filter, RTE override drag (requires `portfolio:govern` + 100-char justification), and governance health widget (# awaiting, avg wait time, SLA-at-risk count).
- **Actors:** Portfolio Manager, RTE, Governance Reviewer.
- **Priority:** Must Have
- **Dependencies:** FR-801/803 (Liveblocks drag), FR-814/815 (GovernedEpic), FR-001 (Kanban board).
- **ACs:**
  - Given a governed epic with `GovernedEpic.status=PENDING`, When displayed on the Kanban, Then a lock icon + "Awaiting Approval (Step 1/3)" banner renders on the card.
  - Given a drag attempt of a governed epic to IMPLEMENTING with status≠APPROVED, Then the drag is cancelled server-side, a toast explains, and the card snaps back.
  - Given the governance health widget, Then it shows 3 metrics: # awaiting approval, average wait (days), and SLA-at-risk count (within 24h of breach).

### FR-818: Tenant & Org Settings
- **Description:** Org-level configuration: org name/logo/timezone/locale (PT-BR/ES/EN), billing plan display, SAFe terminology customization (ceremony names, artifact labels per tenant, stored in `TenantTerminology`), PI cadence defaults, feature flag visibility management, data retention policy config (per-entity overrides within plan limits), onboarding wizard (ART + first team + invite members + integration connect), and white-label hostname support (ENTERPRISE).
- **Actors:** Org Admin, Platform Admin.
- **Priority:** Must Have
- **Dependencies:** `Tenant`/`TenantSettings`; `@repo/feature-flags`; billing plan gating.
- **ACs:**
  - Given an Org Admin changes "PI" terminology to "Program Cycle", Then all UI labels, notifications, and exports use "Program Cycle" for that tenant.
  - Given an onboarding wizard completion (ART + team + ≥1 member + integration), Then the welcome screen dismisses and a confirmation email is sent to the Org Admin.
  - Given a STARTER plan tenant attempts to set retention >365 days, Then the field is capped and an upgrade prompt appears.

### FR-819: Member Management & Invitations
- **Description:** Member invitation (email, role, ART assignment), bulk invite (CSV, ≤100/batch, deduplicated), invite expiry (7 days, resend action), pending invite management (cancel/resend), role change (with permission checks, self-demotion block, last-admin guard), member removal (soft-delete, reassignment of open work items, session revocation within 60s), and member directory (search, filter by role/ART/status, export).
- **Actors:** Org Admin, RTE.
- **Priority:** Must Have
- **Dependencies:** `TenantMember`, `Invitation`; Better Auth session management; `@repo/notifications`.
- **ACs:**
  - Given an Org Admin removes member M, When removal is confirmed, Then M's active sessions are invalidated within 60s and open Impediments/Stories are flagged unassigned.
  - Given a last-admin demotion attempt, Then 409 "Cannot remove last admin" and no role change occurs.
  - Given a bulk invite CSV with 10 valid + 2 duplicate + 1 invalid-email rows, Then 10 invites are sent, 2 are marked "already a member", 1 is marked "invalid email", and a summary report downloads.

### FR-820: Profile, 2FA & TOTP
- **Description:** User profile management (name, avatar, display preferences, notification preferences, timezone, locale), TOTP 2FA via Better Auth (`totp` plugin): QR code enrollment (`POST /api/auth/totp/enable`), backup codes (8, one-time), recovery flow, admin-enforced 2FA policy (grace period configurable), 2FA bypass for SSO-authenticated sessions (configurable), session listing with device/IP/last-seen, session revocation (individual + "all other devices"), and security events log.
- **Actors:** All authenticated users (self), Org Admin (policy enforcement).
- **Priority:** Must Have
- **Dependencies:** Better Auth `totp` plugin, `TenantSecurityPolicy`; `@repo/auth`.
- **ACs:**
  - Given a user scans the QR and submits a valid TOTP code, Then 2FA is enabled, 8 backup codes are displayed once, and all existing sessions except current are invalidated.
  - Given a policy `require2FA=true` with `grace_period=7_days` and a user with 2FA disabled, When they log in on day 8, Then login is blocked until 2FA is enrolled.
  - Given a user revokes a specific session, Then that session's token is invalidated within 10s and the device loses access.

### FR-821: Admin Security Policies
- **Description:** `TenantSecurityPolicy` configuration: `require2FA` (with grace period), `sessionDuration` (1h–30d, default 8h), `allowedIpRanges` (CIDR, enforced at middleware, empty=allow all), `maxFailedLogins` (5–20, lockout duration 15min–24h), `passwordMinLength`/`requireSpecialChars`/`requireNumbers` (for non-SSO), `ssoRequired` (force all users to SSO provider), `apiKeyExpiry` (30–365d), and `enforceSecureActions` (blocks non-`withSecureAction`-wrapped mutations at runtime, feature-flag gated). All changes audit-logged.
- **Actors:** Org Admin, Platform Admin.
- **Priority:** Must Have
- **Dependencies:** `TenantSecurityPolicy`; middleware; Better Auth; `@repo/audit`.
- **ACs:**
  - Given `allowedIpRanges = ["10.0.0.0/8"]` and a request from 203.0.113.42, Then HTTP 403 "Access denied: IP not in allowed range" and an AuditLog entry with the blocked IP.
  - Given `maxFailedLogins=5` and 5 consecutive failures from user U, Then U's account is locked for `lockoutDuration` and an admin notification fires.
  - Given `ssoRequired=true` and a user attempts email/password login, Then 403 "SSO authentication required for this organization."

### FR-822: Notification System
- **Description:** In-app notification center (bell icon, unread count badge, paginated list, mark-read/all-read, deep links), user notification preferences (per-category: GOVERNANCE/ANOMALY/SPRINT/BOARD/SYSTEM, per-channel: IN_APP/EMAIL/SLACK, granularity per-severity), org-wide announcement broadcasts (ORG_ADMIN only, pinned ≤3, TTL configurable), notification deduplication (same type+entityId within 1h), digest mode (hourly/daily batching for LOW/INFO), and `NotificationPolicy` (org-level channel defaults + override limits).
- **Actors:** All users (preferences), Org Admin (policy + broadcasts), System (dispatch).
- **Priority:** Must Have
- **Dependencies:** `Notification`, `NotificationPreference`, `NotificationPolicy`; `@repo/notifications`; optional Slack webhook.
- **ACs:**
  - Given a HIGH anomaly fires, When the user has IN_APP+EMAIL enabled for ANOMALY HIGH, Then both channels receive the notification within 60s.
  - Given the same anomaly re-fires within 1h, When the dedup check runs, Then no second notification is sent; the existing notification's `updatedAt` is refreshed.
  - Given a user sets ANOMALY LOW to digest daily, When 10 LOW anomalies fire, Then a single digest email is queued at the next digest window, not 10 individual emails.
  - Given an Org Admin broadcasts an announcement "Planned maintenance", When sent, Then all org users with IN_APP enabled see it pinned within 10s.

### FR-823: Global Search
- **Description:** Command-palette global search (`Ctrl+K` / `Cmd+K`): cross-entity search (Epics, Features, Stories, Risks, Sprints, Users, ARTs, PI Plans, Objectives, OKRs) with type prefixes (`epic:`, `feature:`, `risk:`), keyboard navigation, recent history (last 20, per-user, localStorage-backed), fuzzy full-text search via PostgreSQL `tsvector` (weighted columns, GIN index), org-scoped results (RLS-enforced), role-filtered visibility, response < 200ms (cached), keyboard shortcuts registered globally.
- **Actors:** All authenticated users.
- **Priority:** Must Have
- **Dependencies:** `tsvector` GIN indexes on all searchable entities; `@repo/search`; Upstash Redis (200ms SLA cache).
- **ACs:**
  - Given a user types "payment gateway" in the command palette, Then ≥1 relevant results appear within 200ms and span multiple entity types.
  - Given a VIEWER role user, When searching, Then Story/Feature results from ARTs they're not assigned to are excluded.
  - Given `epic:payment`, Then only Epic-type results are returned.
  - Given a cross-tenant search attempt (manipulated API call), Then results are bounded to the session's `orgId`.

### FR-824: Feature Flags, Webhooks & API Keys
- **Description:** `FeatureFlag` management (global defaults + per-org overrides + per-user overrides via `FeatureFlagOverride`, plan gating, killswitch); `WebhookEndpoint` management (URL, event subscriptions, HMAC secret generation, active/paused, retry policy 5-attempt exponential, `WebhookDeliveryLog` with request/response), webhook test delivery (synthetic event), delivery retry UI; `ApiKey` management (prefix `cmbk_live_`/`cmbk_test_`, SHA-256 hashed storage, plaintext shown once, expiry, scope array, `ApiKeyUsageLog`, per-IP rate limit 1,000/min).
- **Actors:** Org Admin, Platform Admin, Developer.
- **Priority:** Must Have
- **Dependencies:** `FeatureFlag`, `FeatureFlagOverride`, `WebhookEndpoint`, `WebhookDeliveryLog`, `ApiKey`, `ApiKeyUsageLog`; `@repo/security`; Upstash Redis.
- **ACs:**
  - Given a feature flag disabled globally but overridden to enabled for Org A, When Org A checks the flag, Then true is returned; Org B returns false.
  - Given a webhook delivery fails (5xx), When retried 5 times with exponential backoff, Then the 6th attempt is not made and `WebhookDeliveryLog.status = FAILED_PERMANENTLY`.
  - Given an API key is created, Then the plaintext value is displayed once only; subsequent GETs return the masked form `cmbk_live_****{last4}`.
  - Given an expired API key, When used for authentication, Then 401 "API key expired" is returned.

### FR-825: Audit Logging & Compliance
- **Description:** Comprehensive `AuditLog` (immutable, append-only, INSERT-only table trigger): every state transition, permission change, member change, credential access, governance action, AI invocation, export, API key usage, admin security policy change, data deletion, webhook delivery; structured fields (`orgId`, `actorId`, `actorIp`, `action`, `resourceType`, `resourceId`, `before` JSON, `after` JSON, `timestamp`, `sessionId`, `traceId`); SOC2-ready export (JSONL, CSV, date range, action filter); 7-year retention; real-time audit feed for Org Admins.
- **Actors:** Org Admin, External Auditor, Compliance Officer.
- **Priority:** Must Have
- **Dependencies:** `AuditLog`; DB INSERT trigger; `@repo/audit`; all server actions.
- **ACs:**
  - Given an admin changes a member's role, Then an `AuditLog` entry with `action=member.role_changed`, `before.role`, `after.role`, `actorId`, `timestamp` is created.
  - Given any `DELETE` on `AuditLog` is attempted, Then the DB trigger rejects it and HTTP 405 is returned.
  - Given a SOC2 export for 2026-Q1, Then the JSONL file contains all entries in that date range, sorted by timestamp, with no gaps in `traceId` sequences.
  - Given a high-volume org (1M entries/month), When the audit feed loads, Then the last 100 entries render within 2s via cursor-paginated API.

### FR-826: LGPD/SOC2 Controls & Data Subject Rights
- **Description:** LGPD compliance: data subject rights portal (access, rectification, erasure, portability), `DataSubjectRequest` lifecycle (PENDING→IN_PROGRESS→COMPLETED, 30-day SLA, LGPD Art. 18), PII field registry (`piiFields` metadata on Prisma models), anonymization pipeline (replace PII with hashed token, preserve audit trail integrity via pseudonymization not deletion, ≤72h processing), portability export (JSON, machine-readable, scoped to subject's data); SOC2 controls: access review cadence, separation of duties checks, encryption-at-rest verification, penetration test evidence storage.
- **Actors:** Data Subject (any user), DPO, Org Admin, Compliance Officer.
- **Priority:** Must Have
- **Dependencies:** `DataSubjectRequest`; `AuditLog` (immutable, pseudonymization-safe); `@repo/security`; Inngest (DSR pipeline).
- **ACs:**
  - Given a user submits an erasure request, Then a `DataSubjectRequest` PENDING is created, a confirmation email is sent, and processing completes ≤72h.
  - Given erasure processing completes, When the audit trail is checked, Then PII fields are replaced with `{subject_anonymized_[hash]}` but structural records (approvals, state transitions) remain intact.
  - Given a portability export request, When downloaded, Then the JSON contains only data directly provided by or attributable to the subject (not org-wide data).

### FR-827: Tenant Data Isolation
- **Description:** Multi-layer data isolation: PostgreSQL Row Level Security (RLS) on all tables with `FORCE ROW LEVEL SECURITY`, policy `USING (org_id = current_setting('app.current_org_id'))`, Prisma middleware setting `app.current_org_id` per request, no cross-tenant joins in application code, index-only scans on `(orgId, primaryKey)` composite indexes, tenant-aware connection pooling (PgBouncer `session` mode for SET commands), and periodic cross-tenant isolation audit (automated query: `EXPLAIN ANALYZE` + org_id filter verification).
- **Actors:** System, Platform SRE.
- **Priority:** Must Have
- **Dependencies:** All Prisma models; PostgreSQL RLS; PgBouncer; `@repo/database` Prisma client middleware.
- **ACs:**
  - Given two tenants A and B with same Epic IDs, When Tenant A's session queries `/api/epics`, Then exactly and only Tenant A's epics are returned (verified by EXPLAIN plan showing RLS filter).
  - Given a raw SQL query without setting `app.current_org_id`, Then RLS denies all row access (zero rows returned, no error).
  - Given a monthly isolation audit, Then the audit report shows RLS active on all tables and no policies bypassed.

### FR-828: RBAC & Permission Enforcement Matrix
- **Description:** Role hierarchy: OWNER > ORG_ADMIN > RTE > PM > SA > SM > PO > DEVELOPER > VIEWER, plus contextual roles (FACILITATOR, BUSINESS_OWNER, LACE_MEMBER, SUPPLIER_VIEWER), custom roles (ENTERPRISE plan). Permission matrix enforced at: middleware (route-level), server actions (`withSecureAction` wrapper), Prisma middleware (field-level on sensitive fields), and Liveblocks auth (room-level). Permission checks: `can(role, action, resource, context?)` function in `@repo/rbac`, fully typed.
- **Actors:** All roles; Org Admin (role assignment, custom roles); Platform Admin.
- **Priority:** Must Have
- **Dependencies:** `TenantMember`, `TenantRolePermission`, `@repo/rbac`; middleware; `withSecureAction`; Liveblocks auth.
- **ACs:**
  - Given a VIEWER calls any mutation server action, Then `withSecureAction` rejects with 403 before any business logic executes.
  - Given an ENTERPRISE org creates a custom "PRODUCT_LEAD" role with `epic:write` + `feature:write` + `story:read`, When a PRODUCT_LEAD creates an Epic, Then success; When they attempt story mutation, Then 403.
  - Given a DEVELOPER attempts to downgrade another member's role, Then 403 "Insufficient permissions: requires ORG_ADMIN."

### FR-829: Secret & Credential Management
- **Description:** AES-256-GCM encryption for all third-party credentials (`Integration.config`, `ApiKey` secrets, TOTP secrets, OAuth tokens): per-org derived key from master key (HKDF-SHA256), stored in `CredentialVault` (or Secrets Manager on ENTERPRISE), never returned in API responses (masked `{encrypted}` placeholder), key rotation (re-encrypt in background Inngest job, zero-downtime, `keyVersion` tracked), credential access logged in `AuditLog`, and vault health check endpoint.
- **Actors:** System, Platform Admin, Org Admin.
- **Priority:** Must Have
- **Dependencies:** `CredentialVault`, `Integration`; `@repo/security`; Node.js `crypto`; Inngest (rotation); `@repo/audit`.
- **ACs:**
  - Given an AWS credential is stored, When retrieved via the API for display, Then only `****{last4}` is returned in the response body.
  - Given key rotation is triggered, When it completes for 50 credentials, Then all 50 have `keyVersion = n+1`, decryption succeeds, and the old key version is invalidated after a 24h grace period.
  - Given a credential access, Then an `AuditLog` entry with `action=credential.accessed`, `resourceId`, `actorId`, `actorIp` is written within 1s.

### FR-830: Rate Limiting & Abuse Prevention
- **Description:** Multi-tier Upstash Redis rate limiting: per-user sliding window (global 120/min, AI 60/min, export 10/h, bulk ops 5/min), per-org (API 1,000/min, webhooks 500/min, AI 200/min), per-IP (unauthenticated 60/min, auth endpoints 20/min), per-integration-source (Linear 100/min, GitHub 200/min), DDoS burst protection (token bucket, 10× burst), rate-limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`), and anomaly-based abuse detection (spike >5× baseline within 60s → temporary ban + alert).
- **Actors:** All users, external integrations, anonymous users.
- **Priority:** Must Have
- **Dependencies:** Upstash Redis; `@repo/rate-limit`; middleware; `@repo/audit`.
- **ACs:**
  - Given a user sends 61 requests/minute (global limit 60), Then the 61st returns 429 with `Retry-After` and `X-RateLimit-Remaining: 0`.
  - Given an IP exceeds 20/min on auth endpoints, Then subsequent requests receive 429 and the IP is logged in the abuse detection log.
  - Given an org's API traffic spikes 6× baseline within 60s, Then a temporary 5-min ban activates, platform admin is alerted, and an `AuditLog` entry records the ban.

### FR-831: Webhook Signature Verification
- **Description:** HMAC-SHA256 verification on all incoming webhooks (Linear: `linear-signature` header, GitHub: `X-Hub-Signature-256`, custom: `X-Cosmos-Signature`). Verification is: compute `HMAC-SHA256(raw_body, secret)` → constant-time compare with header value. Failure = 401, `AuditLog` entry, Sentry alert. Raw body buffered before parsing (no double-parse). Replay protection: `timestamp` within ±300s (Linear), `X-GitHub-Delivery` UUID idempotency (GitHub). Signature secret rotation UI with dual-validation grace period.
- **Actors:** System, external webhook sources.
- **Priority:** Must Have
- **Dependencies:** `@repo/webhooks`; `@repo/security`; `@repo/audit`; Sentry.
- **ACs:**
  - Given a Linear webhook with a valid signature, When the handler processes, Then HTTP 200 within 200ms and Inngest job enqueued.
  - Given an invalid signature, Then HTTP 401, no data modification, `AuditLog` entry with `action=webhook.signature_invalid`, and Sentry alert within 30s.
  - Given a GitHub delivery UUID seen within the last 48h, When the same UUID arrives, Then HTTP 200 (idempotent ack) within 100ms and no duplicate processing.
  - Given a webhook timestamp outside ±300s window, Then HTTP 401 "Request timestamp outside acceptable window."

### FR-832: PII-Safe Observability
- **Description:** Structured logging (`pino`) with automatic PII redaction (email, name, phone, IP in log body via `pino-redact`, path-based config), OpenTelemetry tracing (spans include `orgId`, `artId`, `piPlanId` but not user PII), Sentry error reporting (scrub PII from breadcrumbs + context, `orgId`-only user context), performance metrics (p95/p99 latency per route, DB query time, AI call latency, Liveblocks event latency), and a platform SRE health dashboard (error rate, latency trend, active connections, DB pool utilization, queue depth).
- **Actors:** Platform SRE, Security Officer, Compliance Officer.
- **Priority:** Must Have
- **Dependencies:** `pino`/`pino-redact`; `@opentelemetry/sdk-node`; `@sentry/nextjs`; `@repo/observability`.
- **ACs:**
  - Given a server error involving a user's email in a DB constraint, When logged, Then the log output contains no email address (replaced with `[Redacted]`).
  - Given a Sentry error event, When viewed in the Sentry dashboard, Then the user context shows `orgId` only, no name/email/IP.
  - Given a p95 latency spike >2s on `/api/portfolio`, Then a Sentry performance alert fires and appears in the SRE dashboard within 5 min.

### FR-833: `withSecureAction` HOF & ESLint Enforcement
- **Description:** `withSecureAction<T>(config, handler)` HOF (in `@repo/security`): validates Better Auth session, checks `TenantMember` role vs config `requiredRole`, sets `app.current_org_id` Prisma context, validates request schema (Zod), wraps in Prisma transaction if `transactional:true`, catches and normalizes errors (validation→422, permission→403, not-found→404, conflict→409, internal→500), writes `AuditLog` entry, and returns typed result. ESLint rule `require-secure-action-wrapper` (custom plugin): errors if any `async function` in `app/actions/**` not wrapped in `withSecureAction`. CI gate: `pnpm lint` must pass.
- **Actors:** All server action developers, CI/CD.
- **Priority:** Must Have
- **Dependencies:** `@repo/security`; Better Auth; Prisma; Zod; `@repo/audit`; ESLint custom plugin.
- **ACs:**
  - Given a server action not wrapped with `withSecureAction`, When `pnpm lint` runs, Then the ESLint rule fails with "Server action must be wrapped with withSecureAction" and CI fails.
  - Given a valid session + correct role + valid Zod schema, When a server action is called, Then `app.current_org_id` is set before any DB operation.
  - Given an unauthorized role calling a server action, Then `withSecureAction` returns `{success: false, error: "Insufficient permissions", code: 403}` without executing the handler.
  - Given a transactional action where the handler throws after 2 DB writes, Then both writes are rolled back and the error is normalized to a 500 response.

---

## Non-Functional Requirements

**Performance**
- Auth handshake (Liveblocks token) < 300ms. Real-time propagation < 500ms for all collaborative surfaces. Board reconciliation check < 5s for boards with ≤500 assignments.
- Global search < 200ms (cached via Upstash Redis). Audit log render (last 100 entries) < 2s. Member directory render < 1s for ≤1,000 members.
- Rate limit check overhead < 5ms (Upstash Redis latency). `withSecureAction` overhead < 10ms (session check + audit write).
- Notification dispatch < 60s (in-app), < 120s (email). Session revocation < 10s.

**Security (CRITICAL)**
- All credentials AES-256-GCM with per-org derived keys; never returned in plaintext after storage.
- All incoming webhooks HMAC-verified before any processing. Constant-time comparison (timing-attack prevention).
- RLS active with `FORCE ROW LEVEL SECURITY` on all tables; Prisma middleware sets `app.current_org_id` on every connection.
- `withSecureAction` wrapping enforced via ESLint rule on all server actions; CI blocks merges without compliance.
- LGPD erasure pipeline replaces PII with pseudonymized tokens within 72h; audit trail integrity preserved.
- Sentry + structured logs contain zero PII; `pino-redact` path-based config on all log pipelines.
- TOTP secrets stored encrypted; backup codes single-use hashed (bcrypt); session tokens rotated on privilege escalation.

**Compliance**
- `AuditLog` INSERT-only (DB trigger rejects UPDATE/DELETE); 7-year retention; SOC2 CC6.1/CC6.3/CC7.2 evidence export.
- `DecisionLogEntry` same INSERT-only enforcement; tombstone on entity deletion.
- `DataSubjectRequest` SLA ≤30 calendar days (LGPD Art. 18); 72h processing for erasure; machine-readable portability export.
- All admin security policy changes audit-logged within 1s of commit.

**Scalability**
- Rate limiting distributed via Upstash Redis (no single-node); per-org + per-user + per-IP independent limits.
- Liveblocks room connections: PI Planning ≤200, Retro/BPMN ≤50, Portfolio ≤100. Overflow → read-only graceful degradation.
- RBAC `can()` function cached per session (Upstash Redis, 60s TTL); custom roles materialized at request time.
- Webhook signature verification stateless (no DB lookup); idempotency key dedup via Upstash `SETNX` 48h TTL.
- LGPD anonymization pipeline: Inngest fan-out, ≤1,000 records/batch, resumable cursor, completes within 72h for any dataset size.

**Observability**
- OpenTelemetry trace IDs on all API routes, server actions, Inngest jobs, and Liveblocks webhook handlers.
- Sentry performance monitoring: p95/p99 per route, AI call latency, DB query time.
- Platform SRE dashboard: error rate, latency, active Liveblocks connections, DB pool utilization, queue depth, rate-limit breach frequency.

---

## Data Entities

**New models (add to respective bounded-context schemas):**
- `security.prisma`: `TenantSecurityPolicy` (orgId, require2FA, graceperiod, sessionDuration, allowedIpRanges, maxFailedLogins, lockoutDuration, passwordPolicy, ssoRequired, apiKeyExpiry, enforceSecureActions, auditRetentionDays), `ApiKey` (orgId, name, keyHash, prefix, scope[], expiresAt, lastUsedAt, createdBy), `AccessReviewReport` (orgId, reviewedAt, findings JSON, reviewer), `TenantRolePermission` (orgId, roleName, permissions[]), `DataSubjectRequest` (orgId, subjectId, type ERASURE/ACCESS/PORTABILITY/RECTIFICATION, status, submittedAt, processedAt, exportUrl), `CredentialVault` (orgId, keyVersion, encryptedKey, rotatedAt), `FeatureFlagOverride` (orgId, userId, flagKey, value, expiresAt).
- `notifications.prisma`: `NotificationPreference` (userId, orgId, category, channel, severity, enabled), `NotificationPolicy` (orgId, defaultChannels, overrideLimits JSON, digestSchedule).
- `webhooks.prisma`: `WebhookEndpoint` (orgId, url, secret, events[], active, retryPolicy, createdBy), `WebhookDeliveryLog` (endpointId, eventType, requestBody, responseCode, responseBody, attemptCount, nextRetryAt, status), `ApiKeyUsageLog` (keyId, timestamp, endpoint, ipAddress, statusCode).
- `large-solution.prisma`: `SolutionTrain` (orgId, name, vision, valueStream, status), `SolutionTrainMember` (stId, userId, role STE/EAM/BC), `SupplierDeliverable` (supplierId, title, expectedDate, status, description, piPlanId), `LaceMeeting` (orgId, stId, scheduledAt, agenda, recurrence, attendees[]), `LaceActionItem` (meetingId, title, ownerId, dueDate, status, completedAt), `LaceFocusArea` (orgId, stId, focus CAPABILITY_BUILDING/COACHING/TRANSFORMATION/METRICS).
- `collaboration.prisma`: `BoardReconciliationLog` (orgId, surface, entityId, detectedAt, divergenceDetails JSON, resolvedAt, resolution PRISMA_WINS/LIVEBLOCKS_WINS/MANUAL).

**Extend existing models:**
- `GovernedEpic`: `solutionEpicId` (nullable FK), `workflowVersion`, `currentStepStartedAt`, `slaBreachAt`.
- `ApprovalRequest`: `stepType` (SINGLE_APPROVER/GROUP_ANY/GROUP_ALL/EXTERNAL_NOTIFY), `groupApprovals[]` JSON, `slaBreachedAt`.
- `DecisionLogEntry`: `tombstone` bool, `anonymizedAt`.
- `Feature`: `deployedAt`, `prStatus`.
- `Risk`: `crossArtImpact[]` JSON (for Solution-level).
- `DependencyLink`: `criticalPath` bool.
- `Tenant`: `terminologyMap` JSON, `whiteLabelHostname`, `onboardingCompletedAt`.
- `User`: `totpSecret` (encrypted), `backupCodes` (hashed[]), `lockedUntil`, `failedLoginCount`.
- `AuditLog`: `traceId`, `sessionId`, `actorIp`, `before` JSON, `after` JSON.
- `ConfidenceVoteSession`: `facilitatorNote`, `maxRounds`.
- `PIParticipant`: `isOnline`, `lastSeenAt`.

**Composite indexes (add where not existing):**
- `(orgId, createdAt)` on `AuditLog`, `Notification`, `WebhookDeliveryLog`.
- `(orgId, status)` on `GovernedEpic`, `ApprovalRequest`, `DataSubjectRequest`.
- `(orgId, type, entityId, status)` on `Anomaly` (dedup query).
- `(orgId, expiresAt)` on `ApiKey`, `FeatureFlagOverride`.

---

## API Surface (under `apps/app/app/api/`)

- `api/collaboration/auth` (POST) — Liveblocks token handshake (FR-801).
- `api/auth/totp/enable`, `api/auth/totp/verify`, `api/auth/totp/disable`, `api/auth/totp/backup-codes` — TOTP 2FA (FR-820).
- `api/admin/security-policies` (GET/PATCH) — tenant security policies (FR-821).
- `api/admin/members` (GET/POST), `api/admin/members/[id]` (PATCH/DELETE), `api/admin/invitations` (POST/DELETE) — member management (FR-819).
- `api/admin/feature-flags` (GET/PATCH), `api/admin/feature-flags/[key]/override` (POST/DELETE) — feature flags (FR-824).
- `api/admin/webhooks` (GET/POST), `api/admin/webhooks/[id]` (PATCH/DELETE), `api/admin/webhooks/[id]/test` (POST) — webhook management (FR-824).
- `api/admin/api-keys` (GET/POST), `api/admin/api-keys/[id]` (DELETE) — API key management (FR-824).
- `api/admin/audit-log` (GET, paginated, filterable), `api/admin/audit-log/export` (POST) — audit log (FR-825).
- `api/admin/data-subject-requests` (GET/POST), `api/admin/data-subject-requests/[id]` (GET) — LGPD DSR (FR-826).
- `api/governance/workflows` (GET/POST/PATCH/DELETE with guards), `api/governance/governed-epics/[id]` (GET), `api/governance/governed-epics/[id]/submit` (POST), `api/governance/governed-epics/[id]/approve` (POST), `api/governance/governed-epics/[id]/reject` (POST) — governance (FR-814/815).
- `api/governance/decision-log` (GET), `api/governance/decision-log/export` (POST), `(DELETE → 405)` — decision log (FR-816).
- `api/search` (GET, multi-entity, org-scoped) — global search (FR-823).
- `api/notifications` (GET/PATCH), `api/notifications/preferences` (GET/PUT), `api/admin/notifications/announce` (POST) — notifications (FR-822).
- `api/solution-trains` (GET/POST/PATCH), `api/solution-trains/[id]/lace` (GET/POST), `api/solution-trains/[id]/capabilities` (GET/POST) — solution train (FR-808/811).
- `api/health/vault` (GET, no auth, platform-internal) — credential vault health (FR-829).

## Server Actions (under `apps/app/app/actions/`) — all wrapped with `withSecureAction`

- `actions/collaboration.ts` — room metadata, reconciliation trigger.
- `actions/governance.ts` — workflow CRUD, GovernedEpic lifecycle, decision log.
- `actions/admin/members.ts` — invite, role change, remove.
- `actions/admin/security.ts` — security policy CRUD.
- `actions/admin/notifications.ts` — policy CRUD, broadcast.
- `actions/admin/audit.ts` — audit log query, export.
- `actions/admin/compliance.ts` — DSR submit/process, portability export, anonymization trigger.
- `actions/admin/webhooks.ts` — endpoint CRUD, delivery log, retry.
- `actions/admin/api-keys.ts` — key create/revoke.
- `actions/admin/feature-flags.ts` — flag config, overrides.
- `actions/admin/credentials.ts` — rotation trigger, vault health, masked display.
- `actions/solution-trains.ts` — ST CRUD, LACE management, supplier management, capability management.
- `actions/search.ts` — global search composition.
- `actions/profile.ts` — profile update, 2FA enrollment, session management.

---

## Market Research ACs Integration

- **AC-MKT-11 (withSecureAction HOF mandatory — ESLint rule in CI):** Directly **FR-833** — `require-secure-action-wrapper` ESLint custom plugin errors on any server action in `app/actions/**` not wrapped; CI gate (`pnpm lint`) blocks merge. ACs: lint fails on unwrapped action; `withSecureAction` sets `app.current_org_id` before DB ops; unauthorized role → `{success:false, code:403}` without handler execution.

- **AC-MKT-12 (AES-256-GCM for all credentials, never logged/returned):** Directly **FR-829** — all `Integration.config`, `ApiKey` secrets, OAuth tokens, TOTP secrets encrypted AES-256-GCM with per-org HKDF-SHA256 derived keys. API responses return masked `****{last4}`. `pino-redact` + Sentry scrub prevent credential exposure in logs/error tracking. ACs: stored credential → masked in all API responses; rotation completes with `keyVersion=n+1`; access logged in `AuditLog`.

- **AC-MKT-13 (LGPD/SOC2 audit trail: immutable, 7-year retention, DSR ≤72h):** Addressed across **FR-825** (AuditLog immutable INSERT-only), **FR-816** (DecisionLogEntry INSERT-only + 7-year retention), and **FR-826** (LGPD DSR: erasure ≤72h pipeline, data portability export, SOC2 CC6.1/CC6.3 evidence export). ACs: `DELETE` on `AuditLog` → DB trigger rejects; SOC2 JSONL export contains all entries for date range; erasure DSR completes ≤72h with PII pseudonymized and audit trail intact.
