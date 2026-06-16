# COSMOS Platform — Product Requirements Document (PRD)

## Vision
**COSMOS** (*Collaborative Orchestration System for Managing Organizational Scaled-agility*) is a multi-tenant SaaS platform for complete SAFe 6.0 Full management. It accelerates agile transformation at scale via strategic alignment, continuous value flow, and disciplined SAFe ritual execution.

## Problem Statement
No unified tool orchestrates SAFe rituals (PI Planning, Scrum of Scrums, Solution Demos), portfolio management, ART coordination, WSJF prioritization, and DevOps integration in a single multi-tenant platform.

## Target Users
| Role | Primary Need |
|---|---|
| Lean Portfolio Managers | Portfolio Kanban, WSJF, OKR alignment |
| Release Train Engineers (RTEs) | ART cadence, PI Planning automation |
| Solution Train Engineers (STEs) | Solution Train coordination |
| Product Owners | Backlog refinement, story tracking |
| Scrum Masters | Team metrics, impediment management |
| DevOps Teams | CI/CD integration, deployment tracking |

## Strategic Goals & OKRs
1. Implement SAFe 6.0 Full with high framework adherence.
2. Manage portfolios, solution trains, ARTs, and agile teams in one platform.
3. Automate SAFe rituals: PI Planning, Scrum of Scrums, Solution Demos.
4. WSJF-based prioritization + ROAM collaborative risk management.
5. Integrate with DevOps/ALM tools (Jira, Azure DevOps, GitHub Actions).
6. OKR alignment and continuous learning culture (linked from Portfolio to ART to Team levels).

## Epics & Scope
| # | Epic | Hours | Phase |
|---|---|---|---|
| 1 | Foundation & Next-Forge Setup | 320h | Weeks 1–8 |
| 2 | Auth & Multi-Tenancy | 240h | Weeks 9–14 |
| 3 | Portfolio Management | 400h | Weeks 15–22 |
| 4 | ART Management | 360h | Weeks 23–30 |
| 5 | Team Level Management | 280h | Weeks 31–36 |
| 6 | Enhanced Portfolio & ART | 480h | Weeks 37–42 |
| 7 | Solution Train & Advanced Features | 560h | Weeks 43–56 |
| 8 | Enterprise & Scale | 640h | Weeks 57–68 |

**Total:** 3,280h / 24 months

## Success Metrics
- PI Planning setup: < 2h from blank
- Multi-tenant data isolation: 100% (zero cross-tenant leakage)
- Integration sync latency: < 30s
- Test coverage: >= 80%
- Build time (Turbo cache warm): < 60s

---

## NFR Summary (Epics 6–8)

| Metric | Target |
|--------|--------|
| Portfolio Kanban load (p95) | < 1.5s |
| WSJF sort (1000 Epics) | < 500ms |
| Story INVEST analysis | < 200ms |
| Program Board render | < 3s |
| Real-time presence broadcast | < 500ms |
| Search results | < 200ms |
| Permission check | < 5ms |
| Webhook processing (enqueue) | < 200ms |
| LGPD erasure completion | ≤ 72h |
| Session revocation on member removal | ≤ 60s |
| `withSecureAction` HOF overhead | < 10ms |

---

## Key Technical Decisions (Epics 6–8)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| State machines | XState 5 | Explicit lifecycle guards, serializable for DB |
| Real-time collaboration | Liveblocks 3.11 (Yjs CRDT) | Conflict-free merge for concurrent edits |
| Background jobs | Inngest 4.4 | Resumable, durable, fan-out, DLQ |
| AI streaming | Vercel AI SDK 5.0 `streamText` | SSE streaming, typed tool calls |
| Vector search | pgvector (1536-dim, IVFFlat) | Co-located with Prisma/PG |
| Credential encryption | AES-256-GCM + HKDF-SHA256 | Per-org key derivation |
| Cost standard | FOCUS 1.1 | Multi-cloud FinOps portability |
| Multi-tenant isolation | PostgreSQL RLS + FORCE RLS | Defense-in-depth |
| Compliance | LGPD Art. 18 + SOC2 Type I | Brazilian legal + enterprise sales |

---

## Story Index — Epic 006 (Enhanced Portfolio & ART)

**SRD:** [srd-epic-006.md](srd-epic-006.md)

| Story | Title | WSJF | Points |
|-------|-------|------|--------|
| [story-011](stories/epic-006/story-011.md) | Epic Lifecycle XState Machine & State Transitions | 14.0 | 8 |
| [story-012](stories/epic-006/story-012.md) | Portfolio Kanban with Liveblocks Real-Time Collaboration | 8.0 | 8 |
| [story-013](stories/epic-006/story-013.md) | Lean Business Case with AI Hypothesis Drafting | 5.25 | 5 |
| [story-014](stories/epic-006/story-014.md) | INVEST Quality Gate with AI Analysis & Override | 6.5 | 5 |
| [story-015](stories/epic-006/story-015.md) | WSJF Scoring Engine with Modified Fibonacci | 5.5 | 5 |
| [story-016](stories/epic-006/story-016.md) | Governance Workflows & Approval Automation | 8.0 | 8 |
| [story-017](stories/epic-006/story-017.md) | ART Setup & PI Plan Lifecycle XState Machine | 8.67 | 8 |
| [story-018](stories/epic-006/story-018.md) | Confidence Vote — Anonymous Tally & Reveal Gate | 6.25 | 5 |
| [story-019](stories/epic-006/story-019.md) | ROAM Risk Management with AI-Suggest | 6.25 | 5 |
| [story-020](stories/epic-006/story-020.md) | Program Board with DND-Kit & Cross-Team Dependencies | 8.0 | 8 |
| [story-021](stories/epic-006/story-021.md) | Feature Backlog, Readiness Gate & Story Decomposition | 7.33 | 8 |
| [story-022](stories/epic-006/story-022.md) | Sprint Lifecycle, Board & Async Standup | 7.67 | 8 |
| [story-023](stories/epic-006/story-023.md) | Sprint Review, Retrospective & PI Objectives | 5.25 | 5 |
| [story-024](stories/epic-006/story-024.md) | Defects, Impediments & Critical Anomaly Detection | 6.0 | 5 |
| [story-025](stories/epic-006/story-025.md) | Strategic Themes, Lean Budget & Portfolio Health Report | 5.5 | 5 |

**Subtotal:** 102 story points

---

## Story Index — Epic 007 (Solution Train & Advanced Features)

**SRD:** [srd-epic-007.md](srd-epic-007.md)

| Story | Title | WSJF | Points |
|-------|-------|------|--------|
| [story-021](stories/epic-007/story-021.md) | Anomaly Detection Engine with Nightly Cron | 13.0 | 8 |
| [story-022](stories/epic-007/story-022.md) | Flow Metrics Dashboard with Monte Carlo Forecasting | 11.0 | 8 |
| [story-023](stories/epic-007/story-023.md) | AWS Cost Explorer FOCUS 1.1 Pipeline | 10.0 | 8 |
| [story-024](stories/epic-007/story-024.md) | Linear SAFe-Aware Bidirectional Sync | 9.0 | 8 |
| [story-025](stories/epic-007/story-025.md) | GitHub SAFe Sync & DORA Metrics | 8.5 | 8 |
| [story-026](stories/epic-007/story-026.md) | SAFe Copilot RAG Infrastructure (pgvector + Hybrid Retrieval) | 11.0 | 13 |
| [story-027](stories/epic-007/story-027.md) | OKR Management with Progress Snapshots & Notifications | 7.0 | 8 |
| [story-028](stories/epic-007/story-028.md) | BPMN Workflow Modeling & XState Runtime | 6.0 | 13 |
| [story-029](stories/epic-007/story-029.md) | Executive Dashboard & Scheduled Reports | 8.0 | 8 |
| [story-030](stories/epic-007/story-030.md) | Epic Cost Attribution, Cost Anomaly & Budget Plans | 7.5 | 8 |
| [story-031](stories/epic-007/story-031.md) | Strategy Map DAG, Traceability & Roadmap Scenarios | 6.5 | 8 |
| [story-032](stories/epic-007/story-032.md) | Velocity/Capacity Analytics, ROI & Member Metrics | 7.0 | 8 |
| [story-033](stories/epic-007/story-033.md) | Staleness Detection, AI Narrative & Pair Synergy | 5.5 | 5 |
| [story-034](stories/epic-007/story-034.md) | Copilot Document Upload, Prompt Library & Security | 5.0 | 5 |
| [story-035](stories/epic-007/story-035.md) | Webhook Pipeline Reliability, DLQ & Sync Logs | 6.0 | 5 |

**Subtotal:** 123 story points

---

## Story Index — Epic 008 (Enterprise & Scale)

**SRD:** [srd-epic-008.md](srd-epic-008.md)

| Story | Title | WSJF | Points |
|-------|-------|------|--------|
| [story-031](stories/epic-008/story-031.md) | Liveblocks Security Hardening & CRDT PI Planning Board | 13.0 | 8 |
| [story-032](stories/epic-008/story-032.md) | `withSecureAction` HOF & ESLint Enforcement | 14.0 | 5 |
| [story-033](stories/epic-008/story-033.md) | Tenant Administration, Member Management & TOTP 2FA | 8.0 | 8 |
| [story-034](stories/epic-008/story-034.md) | Audit Logging, LGPD Compliance & Tenant Data Isolation | 12.0 | 8 |
| [story-035](stories/epic-008/story-035.md) | Rate Limiting, Webhook Signature Verification & PII-Safe Observability | 11.0 | 8 |
| [story-036](stories/epic-008/story-036.md) | Global Search, Notification System & Feature Flags | 7.0 | 8 |
| [story-037](stories/epic-008/story-037.md) | API Keys, Webhook Endpoints & Credential Vault | 7.5 | 5 |
| [story-038](stories/epic-008/story-038.md) | RBAC & Permission Enforcement | 10.0 | 8 |
| [story-039](stories/epic-008/story-039.md) | Solution Train & LACE Management | 7.0 | 8 |
| [story-040](stories/epic-008/story-040.md) | Enterprise Governance Controls | 8.5 | 8 |
| [story-041](stories/epic-008/story-041.md) | Presence, Cursors & Cross-Surface Real-Time Rooms | 9.0 | 5 |
| [story-042](stories/epic-008/story-042.md) | Program Board Dependency Collaboration & Confidence Vote Overlay | 8.0 | 8 |
| [story-043](stories/epic-008/story-043.md) | Solution-Level Program Board, ROAM & Large Solution RBAC | 6.5 | 8 |
| [story-044](stories/epic-008/story-044.md) | Onboarding, Platform Health Dashboard & Multi-Org Support | 6.0 | 5 |
| [story-045](stories/epic-008/story-045.md) | Advanced Reporting, Export & Platform Scalability | 5.5 | 8 |

**Subtotal:** 104 story points

---

## Document Index

```
docs/
├── prd.md                          ← this file (product vision + story index)
├── srd-epic-006.md                 ← detailed FR/NFR for Epic 006
├── srd-epic-007.md                 ← detailed FR/NFR for Epic 007
├── srd-epic-008.md                 ← detailed FR/NFR for Epic 008
├── architecture-epics-6-8.md      ← schema, routes, breaking changes, sequences
└── stories/
    ├── epic-006/
    │   └── story-011.md … story-025.md   (15 stories)
    ├── epic-007/
    │   └── story-021.md … story-035.md   (15 stories)
    └── epic-008/
        └── story-031.md … story-045.md   (15 stories)
```

**Total user stories (Epics 6–8):** 45
**Total story points (Epics 6–8):** 329
**Total estimated effort (Epics 6–8):** 1,680h
