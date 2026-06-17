# Stories 021-025: PI Planning Flow

**Date:** 2026-06-10
**Branch:** feat/kanban-portfolio-ai
**Tests:** 117 passing (features + stories + sprints + delivery + portfolio)

## Implemented (all pre-existing + new AC-008)

### Story-021 — Feature Backlog, Readiness Gate & Story Decomposition
- AC-001: ART-scoped feature ID via `artSequenceCounter` — `features/readiness.ts`
- AC-002: EPIC_LINK_REQUIRED validation — `features/readiness.ts`
- AC-003/004/005: Readiness checklist + RTE override — `features/readiness.ts`
- AC-006: Copilot decomposition → COPILOT_SUGGESTION origin — `stories/split.ts`
- AC-007: Split Wizard archives SPLIT_INTO + creates lineage — `stories/split.ts`
- AC-008 ✨ NEW: `evaluateStoryInvest` — GREEN/AMBER/RED badge, INVEST gate on READY

### Story-022 — Sprint Lifecycle, Board & Async Standup
- Sprint CRUD, lifecycle transitions, standup entries — `sprints/lifecycle.ts`

### Story-023 — Sprint Review, Retrospective & PI Objectives PPM
- `computePIPPM`, sprint review actions, retrospective — `sprints/review.ts`, `sprints/retrospective.ts`

### Story-024 — Defects, Impediments & Anomaly Escalation
- Defect + impediment CRUD with anomaly escalation — `delivery/defects.ts`, `delivery/impediments.ts`

### Story-025 — Strategic Themes, Lean Budget & Portfolio Health Report
- Strategic themes, lean budget, portfolio analysis batch — `portfolio/themes.ts`, `portfolio/leanBudget.ts`, `portfolio/analysis.ts`

## Key Design: INVEST Evaluator (AC-008)
`evaluateStoryInvest(story)` is a pure function in `app/actions/stories/invest.ts`.
Criteria levels: `ERROR` (blocks READY) = Estimable + Testable; `WARN` (AMBER) = Small + Negotiable + Valuable; `INFO` = Independent.
`updateStory` gates `status=READY` — throws `INVEST_BLOCK: <hint>` if any ERROR criterion fails.
