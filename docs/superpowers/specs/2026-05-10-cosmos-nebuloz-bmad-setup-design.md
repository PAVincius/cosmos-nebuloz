# COSMOS Nebuloz — BMAD Setup & PRD Migration Design

**Date:** 2026-05-10  
**Status:** Approved  
**Project:** cosmos-nebuloz (Next-Forge v5.3.2)  
**Source specs:** cosmos/docs/, cosmos/specs/

---

## 1. Context

cosmos-nebuloz is the Next-Forge v5.3.2 foundation that replaces the previous Blazity-based cosmos
repo as the implementation base for the COSMOS platform — a SAFe 6.0 Full management tool.

**Source material extracted from cosmos:**
- Business case, OKRs, roadmap (8 epics / 28 tasks / 24 months / 3,280h)
- Feature-briefs for epics 6–8 (latest completed specs)
- Execution log (task-001 through task-008-3 decisions)
- Architecture: Next-Forge + Turborepo + pnpm + Prisma + Better Auth + Vercel

**ADR policy:** Feature-briefs are used directly as authoritative decision records. No formal ADR
conversion required.

---

## 2. BMAD Installation

Install BMAD Method (Build Me A Dream) into `.bmad-core/` at repo root.

```
cosmos-nebuloz/
├── .bmad-core/
│   ├── agents/
│   │   ├── orchestrator.md
│   │   ├── analyst.md
│   │   ├── architect.md
│   │   ├── po.md
│   │   ├── dev.md
│   │   ├── sm.md
│   │   └── qa.md
│   ├── tasks/
│   │   ├── create-prd.md
│   │   ├── create-srd.md
│   │   ├── create-architecture.md
│   │   ├── create-story.md
│   │   └── execute-story.md
│   └── templates/
│       ├── prd-tmpl.md
│       ├── srd-tmpl.md
│       ├── architecture-tmpl.md
│       ├── story-tmpl.md
│       └── design-tmpl.md
├── docs/
│   ├── prd.md                  ← main PRD (Section 3 below)
│   ├── srd.md                  ← System Requirements Doc (derived from PRD)
│   ├── architecture.md         ← tech stack decisions
│   ├── design.md               ← UI/UX layout (provided by user)
│   └── stories/
│       ├── epic-001/           ← Foundation & Next-Forge Setup
│       ├── epic-002/           ← Auth & Multi-Tenancy
│       ├── epic-003/           ← Portfolio Management
│       ├── epic-004/           ← ART Management
│       ├── epic-005/           ← Team Level Management
│       ├── epic-006/           ← Enhanced Portfolio & ART
│       ├── epic-007/           ← Solution Train & Advanced Features
│       └── epic-008/           ← Enterprise & Scale
├── .claude/
└── [next-forge packages: apps/, packages/, tooling/]
```

**Source:** Official BMAD-METHOD repository (bmadcode/BMAD-METHOD).  
**Install method:** Copy `.bmad-core/` structure + customize agents for SAFe terminology.

---

## 3. PRD — COSMOS Platform

### Vision
**COSMOS** (*Collaborative Orchestration System for Managing Organizational Scaled-agility*)
is a multi-tenant SaaS platform for complete SAFe 6.0 Full management — accelerating agile
transformation at scale via strategic alignment, continuous value flow, and disciplined SAFe ritual
execution.

### Problem Statement
No unified tool orchestrates SAFe rituals (PI Planning, Scrum of Scrums, Solution Demos),
portfolio management, ART coordination, WSJF prioritization, and DevOps integration in a single
multi-tenant platform.

### Target Users
| Role | Primary Need |
|------|-------------|
| Lean Portfolio Managers | Portfolio Kanban, WSJF, OKR alignment |
| Release Train Engineers (RTEs) | ART cadence, PI Planning automation |
| Solution Train Engineers (STEs) | Solution Train coordination |
| Product Owners | Backlog refinement, story tracking |
| Scrum Masters | Team metrics, impediment management |
| DevOps Teams | CI/CD integration, deployment tracking |

### Strategic Goals
1. Implement SAFe 6.0 Full with high framework adherence
2. Manage portfolios, solution trains, ARTs, and agile teams in one platform
3. Automate SAFe rituals: PI Planning, Scrum of Scrums, Solution Demos
4. WSJF-based prioritization + ROAM collaborative risk management
5. Integrate with DevOps/ALM tools (Jira, Azure DevOps, GitHub Actions)
6. OKR alignment and continuous learning culture

### Epics & Scope

| # | Epic | Hours | Phase |
|---|------|-------|-------|
| 1 | Foundation & Next-Forge Setup | 320h | Weeks 1–8 |
| 2 | Auth & Multi-Tenancy | 240h | Weeks 9–14 |
| 3 | Portfolio Management | 400h | Weeks 15–22 |
| 4 | ART Management | 360h | Weeks 23–30 |
| 5 | Team Level Management | 280h | Weeks 31–36 |
| 6 | Enhanced Portfolio & ART | 480h | Weeks 37–42 |
| 7 | Solution Train & Advanced Features | 560h | Weeks 43–56 |
| 8 | Enterprise & Scale | 640h | Weeks 57–68 |
| **Total** | | **3,280h** | **24 months** |

### Tech Stack
- **Framework:** Next-Forge v5.3.2 (Turborepo + pnpm workspaces)
- **Frontend:** Next.js 15 App Router, Tailwind CSS, shadcn/ui
- **Backend:** Next.js API Routes, Prisma ORM
- **Database:** PostgreSQL (multi-tenant with tenant isolation)
- **Auth:** Better Auth (multi-tenant, RBAC)
- **Testing:** Vitest, Playwright E2E
- **Linting:** Biome v2 + Ultracite
- **Deployment:** Vercel
- **Monitoring:** Sentry

### Integrations (Phase 3+)
- Jira (bidirectional sync — Epic, Feature, Story)
- Azure DevOps (bidirectional sync + webhooks)
- GitHub Actions (CI/CD pipeline tracking)
- Generic CI/CD webhook receiver

### Success Metrics
- PI Planning setup: < 2h from blank
- Multi-tenant data isolation: 100% (zero cross-tenant leakage)
- Integration sync latency: < 30s
- Test coverage: ≥ 80%
- Build time (Turbo cache warm): < 60s

---

## 4. SRD Phase (Before Coding)

Before any implementation, the **analyst** agent produces `docs/srd.md` from the PRD:

- Functional requirements per epic (numbered, traceable)
- Non-functional requirements (security, performance, scalability)
- Constraints (SAFe compliance, multi-tenancy, auth isolation)
- Acceptance criteria per requirement
- Data models at entity level (not schema level)
- API surface at route level (not implementation level)

SRD gates implementation — no epic starts without its SRD section approved.

---

## 5. Design Phase

User provides `docs/design.md` with UI/UX layout before architect phase begins.

The **architect** agent uses `design.md` + `srd.md` to produce:
- Package boundary decisions (which Next-Forge package owns what)
- Prisma schema per epic
- API route contracts
- Component hierarchy per page/feature

---

## 6. Specialist Agents

### Agent Roster

| Agent | File | SAFe Mapping | Responsibility |
|-------|------|-------------|----------------|
| `orchestrator` | `orchestrator.md` | Program Manager | Coordinates pipeline, spawns agents, tracks epic status |
| `analyst` | `analyst.md` | Business Analyst | Writes SRD from PRD, defines acceptance criteria |
| `architect` | `architect.md` | Solution Architect | Tech decisions, Prisma schemas, API contracts, design.md |
| `po` | `po.md` | Product Owner / RTE | Story decomposition, WSJF prioritization, backlog |
| `dev` | `dev.md` | Developer | Implementation within Ralph loops |
| `sm` | `sm.md` | Scrum Master / RTE | Tracks story progress, removes impediments |
| `qa` | `qa.md` | QA Engineer | Vitest specs, E2E tests, acceptance validation |

### Agent Customizations for SAFe
- All agents understand SAFe terminology: Epic, Feature, Story, PI, ART, STE, RTE
- `po` agent knows WSJF formula and applies it to story prioritization
- `sm` agent tracks ROAM risks and PI objectives
- `architect` agent enforces multi-tenant isolation patterns

---

## 7. Execution Pipeline

### Per-Epic Flow
```
Orchestrator
  → Analyst: write SRD section for epic
  → Architect: produce design.md + package decisions + Prisma schema
  → PO: decompose epic into stories (docs/stories/epic-NNN/)
  → For each story:
      Ralph loop:
        Dev agent: implement story
        QA agent: write + run tests
        if tests fail → loop back to Dev
        if tests pass → SM review → mark story done
  → Orchestrator: epic complete → start next epic
```

### Ralph Loop Configuration (per story)
```
/ralph-loop:
  agent: dev
  story: docs/stories/epic-NNN/story-NNN.md
  validation: qa agent runs vitest + playwright
  max_iterations: 10
  on_success: update story status → done
  on_failure: sm agent logs impediment
```

### Story File Format (docs/stories/epic-NNN/story-NNN.md)
```markdown
# Story: [title]
**Epic:** epic-NNN
**Status:** pending | in_progress | done
**WSJF Score:** [calculated by PO]

## Description
[user story format: As a [role], I want [feature], so that [benefit]]

## Acceptance Criteria
- [ ] criterion 1
- [ ] criterion 2

## Technical Notes
[from architect agent]

## Test Plan
[from qa agent]
```

---

## 8. Implementation Order

1. **Install BMAD** — clone `.bmad-core/` structure, customize agents for SAFe
2. **Write PRD** — port cosmos specs into `docs/prd.md` (this document is the source)
3. **Analyst runs SRD** — analyst agent produces `docs/srd.md`
4. **User provides design.md** — UI/UX layout added to `docs/design.md`
5. **Architect phase** — tech decisions, schemas, API contracts
6. **PO decomposes stories** — per epic into `docs/stories/`
7. **Ralph loops begin** — epic-001 first, sequential per dependency order
8. **QA gates** — no epic ships without ≥ 80% coverage

---

## 9. Out of Scope (this design)

- Actual BMAD agent file content (written in implementation plan)
- Prisma schema specifics (Architect agent produces these)
- UI component library selection (in design.md)
- Deployment pipeline config (Epic 8)
- Actual story decomposition (PO agent runs after SRD)

---

## 10. Next Steps

- Implementation Plan instantiated via the `writing-plans` skill (see `implementation_plan.md` artifact)
- Awaiting approval to execute the migration of specs and instantiation of BMAD setup.
