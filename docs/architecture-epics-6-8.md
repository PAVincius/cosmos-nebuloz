# Architecture Notes — Epics 006, 007, 008

These notes accompany the SRDs for Epics 006, 007, and 008. They describe the schema changes, new API routes, new server actions, component additions, breaking changes, and implementation sequences that must be executed across the three epics.

All paths relative to monorepo root: `/Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz/`.

---

## Epic 006: Enhanced Portfolio & ART

### Schema Changes (`packages/database/prisma/`)

#### `schema/art-core.prisma` — Extend existing models

```prisma
// Epic extensions
model Epic {
  // ... existing fields ...
  portfolioRank          Int?
  wsjfScore              Float?
  normalizedWsjfScore    Float?
  investScore            Int?
  investCriteria         Json?         // {I,N,V,E,S,T: {score,feedback}}
  investScoreOverridden  Boolean      @default(false)
  investScoreOutdated    Boolean      @default(false)
  hypothesis             String?
  businessOutcomes       Json?         // [{id,description,confirmed}]
  leadingIndicators      Json?         // [{id,description,metric}]
  nfrs                   String?
  mvp                    String?
  sizeEstimate           String?       // XS|S|M|L|XL
  acceptanceCriteria     Json?         // [{id,given,when,then,source,locked}]
  strategicThemeId       String?
  leanBudgetAllocation   Float?
  governedEpicFlag       Boolean      @default(false)
  descriptionVersions    Json?         // last-50 ring buffer
  rejectionReason        String?
  hypothesisResolution   String?       // VALIDATED|PARTIALLY_VALIDATED|INVALIDATED
  workflowState          String?
  workflowContext        Json?
  workflowVersion        Int?

  strategicTheme         StrategicTheme? @relation(fields: [strategicThemeId], references: [id])
  scoringEvents          ScoringEvent[]
  stateTransitions       StateTransitionHistory[]
  roadmapItems           RoadmapItem[]
}

// Feature extensions
model Feature {
  // ... existing fields ...
  wsjfUserValue          Float?
  wsjfTimeValue          Float?
  wsjfRiskReduction      Float?
  wsjfJobSize            Float?
  wsjfCostOfDelay        Float?
  wsjfScore              Float?
  wsjfNormalizedScore    Float?
  wsjfConfidence         String?       // LOW|MEDIUM|HIGH
  wsjfScoredBy           String?
  wsjfScoredAt           DateTime?
  wsjfJobSizeLockedBy    String?
  manualRankOverride     Int?
  manualRankPiPlanId     String?
  readinessScore         Int?
  origin                 String?       // COSMOS|LINEAR|GITHUB|COPILOT_SUGGESTION
  deployedAt             DateTime?
  prStatus               String?       // NONE|OPEN|MERGED|CLOSED

  scoringEvents          ScoringEvent[]
  dependencies           DependencyLink[] @relation("dependencySource")
  dependents             DependencyLink[] @relation("dependencyTarget")
}

// Story extensions
model Story {
  // ... existing fields ...
  investResult           Json?         // {score,criteria[],evaluatedAt}
  investOverrides        Json?         // [{criterion,overriddenBy,reason,sprintId}]
  splitIntoStoryIds      String[]
  originStoryId          String?
  origin                 String?       // COSMOS|COPILOT_SUGGESTION
  workflowState          String?
  workflowContext        Json?
  workflowVersion        Int?
  externalId             String?
  pullRequests           Json?         // [{prId,url,status}]
}

// New append-only ScoringEvent
model ScoringEvent {
  id              String   @id @default(cuid())
  orgId           String
  epicId          String?
  featureId       String?
  userValue       Float?
  timeValue       Float?
  riskReduction   Float?
  jobSize         Float?
  wsjfScore       Float?
  normalizedScore Float?
  source          String   // MANUAL|COPILOT
  userId          String?
  timestamp       DateTime @default(now())
  justification   String?

  epic            Epic?    @relation(fields: [epicId], references: [id])
  feature         Feature? @relation(fields: [featureId], references: [id])
  @@index([orgId, epicId])
  @@index([orgId, featureId])
}

// New StateTransitionHistory (append-only)
model StateTransitionHistory {
  id              String   @id @default(cuid())
  orgId           String
  epicId          String?
  storyId         String?
  featureId       String?
  entityType      String   // EPIC|FEATURE|STORY|SPRINT|PI_PLAN|RISK
  fromStatus      String
  toStatus        String
  transitionedAt  DateTime @default(now())
  userId          String?  // null for system/AI
  reason          String?
  externalRef     String?  // for webhook-triggered transitions

  epic            Epic?    @relation(fields: [epicId], references: [id])
  @@index([orgId, epicId, transitionedAt])
}

// DependencyLink
model DependencyLink {
  id              String   @id @default(cuid())
  orgId           String
  fromFeatureId   String
  toFeatureId     String
  fromTeamId      String?
  toTeamId        String?
  type            String   // DEPENDS_ON|BLOCKS
  status          String   @default("IDENTIFIED") // IDENTIFIED|IN_PROGRESS|RESOLVED
  criticalPath    Boolean  @default(false)
  description     String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  fromFeature     Feature  @relation("dependencySource", fields: [fromFeatureId], references: [id])
  toFeature       Feature  @relation("dependencyTarget", fields: [toFeatureId], references: [id])
  @@index([orgId, fromFeatureId])
  @@index([orgId, toFeatureId])
  @@index([orgId, status])
}

// RoadmapItem
model RoadmapItem {
  id              String   @id @default(cuid())
  orgId           String
  epicId          String
  artId           String?
  quarter         Int      // 1-4
  year            Int
  confidence      String   @default("MEDIUM") // HIGH|MEDIUM|LOW
  notes           String?
  active          Boolean  @default(true)
  archivedAt      DateTime?
  createdBy       String
  createdAt       DateTime @default(now())

  epic            Epic     @relation(fields: [epicId], references: [id])
  @@unique([epicId, active], where: { active: true })
  @@index([orgId, year, quarter])
}
```

#### `schema/planning.prisma` — Extend

```prisma
// ConfidenceVoteTally (anonymous, no user mapping)
model ConfidenceVoteTally {
  id               String   @id @default(cuid())
  orgId            String
  sessionId        String
  piPlanId         String
  round            Int      @default(1)
  score1Count      Int      @default(0)
  score2Count      Int      @default(0)
  score3Count      Int      @default(0)
  score4Count      Int      @default(0)
  score5Count      Int      @default(0)
  totalVotes       Int      @default(0)
  participantCount Int      @default(0)
  participationRate Float   @default(0)
  aggregateScore   Float?
  revealedAt       DateTime?
  closedAt         DateTime?
  facilitatorNote  String?
  createdAt        DateTime @default(now())

  @@index([sessionId, round])
  @@index([piPlanId])
}

// PIKnowledgeVector (pgvector RAG)
model PIKnowledgeVector {
  id          String   @id @default(cuid())
  orgId       String
  artId       String?
  piPlanId    String?
  entityType  String   // EPIC|FEATURE|STORY|RISK|STANDUP|RETRO|OBJECTIVE|DOCUMENT
  entityId    String
  chunkIndex  Int
  chunkType   String   @default("ENTITY") // ENTITY|DOCUMENT
  content     String
  embedding   Unsupported("vector(1536)")?
  indexedAt   DateTime @default(now())
  documentId  String?

  @@index([orgId, entityType, entityId])
}
```

#### `schema/portfolio.prisma` — Extend + New

```prisma
model PortfolioAnalysisReport {
  id                String   @id @default(cuid())
  orgId             String
  artId             String
  ranAt             DateTime @default(now())
  epicCount         Int
  completionStatus  String   // COMPLETE|PARTIAL_SUCCESS|FAILED
  reportJson        Json
  expiresAt         DateTime // 90 days
  @@index([orgId, artId, ranAt])
}

model ThemeInvestmentTarget {
  id               String  @id @default(cuid())
  orgId            String
  strategicThemeId String
  weightPct        Float
  concentrationPct Float   @default(60)
  updatedAt        DateTime @updatedAt
  @@unique([orgId, strategicThemeId])
}

// LeanBudgetReallocation (immutable append-only)
model LeanBudgetReallocation {
  id          String   @id @default(cuid())
  orgId       String
  fromEpicId  String?
  toEpicId    String?
  artId       String
  piPlanId    String
  amount      Float
  reason      String
  actor       String
  timestamp   DateTime @default(now())
  @@index([orgId, artId, piPlanId])
}
```

#### `schema/flow-intelligence.prisma` — Extend Anomaly types

Add to `AnomalyType` enum:
```
VELOCITY_DROP
SCOPE_CREEP
ESTIMATION_DRIFT
CRITICAL_DEFECT
QUALITY_GATE_BREACH
IMPEDIMENT_AGING
EPIC_OSCILLATION
EPIC_DWELL_EXCESSIVE
EPIC_BACKWARD_TRANSITION
STALE_EPIC
STALE_STORY
STALE_RISK
```

#### `schema/finops.prisma` — New model for lean budget reallocation

Already in portfolio.prisma above. Add `LeanBudget` extensions:
```prisma
// Extend existing LeanBudget
model LeanBudget {
  // existing + add:
  capexPct    Float   @default(50)
  opexPct     Float   @default(50)
  currency    String  @default("BRL")
  immutableAt DateTime?  // set when PI CLOSED
  @@unique([artId, piPlanId])
}
```

---

### New API Routes (`apps/app/app/api/`)

```
api/portfolio/route.ts                          GET — composed portfolio payload
api/portfolio/export/route.ts                   POST — async PDF/XLSX/CSV
api/epics/[id]/route.ts                         GET/PATCH
api/epics/[id]/transition/route.ts              POST — state machine
api/ai-prompt/route.ts                          POST (SSE) — all AI features
api/copilot/chat/route.ts                       POST (SSE) — sprint-health/retro RAG
api/governance/workflows/route.ts               GET/POST
api/governance/workflows/[id]/route.ts          PATCH/DELETE
api/governance/governed-epics/[id]/route.ts     GET
api/governance/governed-epics/[id]/submit/route.ts  POST
api/governance/governed-epics/[id]/approve/route.ts POST
api/governance/governed-epics/[id]/reject/route.ts  POST
api/governance/decision-log/route.ts            GET
api/governance/decision-log/export/route.ts     POST
api/pi-plans/[id]/route.ts                      GET/PATCH (lifecycle)
api/pi-plans/[id]/transition/route.ts           POST
api/pi-sessions/[id]/route.ts                   GET/PATCH (phase)
api/confidence-votes/route.ts                   POST (open)
api/confidence-votes/[sessionId]/cast/route.ts  POST
api/confidence-votes/[sessionId]/reveal/route.ts POST
api/confidence-votes/[sessionId]/close/route.ts POST
api/risks/route.ts                              GET/POST
api/risks/[id]/roam/route.ts                    POST
api/risks/[id]/escalate/route.ts                POST
api/sprints/[id]/route.ts                       GET/PATCH
api/sprints/[id]/close/route.ts                 POST
api/standups/route.ts                           GET/POST
api/sprint-reviews/route.ts                     GET/POST
api/retrospectives/route.ts                     GET/POST
api/defects/route.ts                            GET/POST
api/impediments/route.ts                        GET/POST
api/impediments/[id]/escalate/route.ts          POST
api/collaboration/auth/route.ts                 POST (Liveblocks token)
api/inngest/route.ts                            POST (Inngest handler)
```

### New Server Actions (`apps/app/app/actions/`)

```
actions/epics/index.ts
actions/epics/transitions.ts
actions/epics/business-case.ts
actions/portfolio-kanban/index.ts
actions/lean-budget/index.ts
actions/strategy-map/index.ts
actions/wsjf/index.ts
actions/wsjf/sessions.ts
actions/ai-prompt/index.ts
actions/ai-prompt/invest.ts
actions/ai-prompt/ac-generation.ts
actions/governance/index.ts
actions/governance/workflows.ts
actions/governance/decision-log.ts
actions/pi-planning/index.ts
actions/pi-planning/art-setup.ts
actions/pi-planning/participants.ts
actions/pi-objectives/index.ts
actions/confidence-vote/index.ts
actions/risks/index.ts
actions/risks/roam.ts
actions/features/index.ts
actions/features/readiness.ts
actions/features/dependencies.ts
actions/stories/index.ts
actions/stories/decompose.ts
actions/stories/split.ts
actions/sprints/index.ts
actions/sprints/board.ts
actions/sprints/tasks.ts
actions/standup/index.ts
actions/sprint-review/index.ts
actions/retrospective/index.ts
actions/defects/index.ts
actions/impediments/index.ts
actions/roadmap/index.ts
```

### New Pages & Components (`apps/app/app/(authenticated)/`)

```
portfolio/page.tsx                    PortfolioKanbanPage
portfolio/[epicId]/page.tsx           EpicDetailPage
portfolio/[epicId]/business-case/page.tsx
portfolio/analysis/page.tsx           PortfolioAnalysisReport
art/[artId]/page.tsx                  ARTOverviewPage
art/[artId]/pi-planning/page.tsx      PIPlanningConsolePage
art/[artId]/pi-planning/[piPlanId]/board/page.tsx  ProgramBoardPage
art/[artId]/pi-planning/[piPlanId]/objectives/page.tsx
art/[artId]/pi-planning/[piPlanId]/confidence-vote/page.tsx
art/[artId]/pi-planning/[piPlanId]/risks/page.tsx
art/[artId]/features/page.tsx         FeatureBacklogPage
art/[artId]/sprints/page.tsx          SprintListPage
art/[artId]/sprints/[sprintId]/page.tsx SprintBoardPage
art/[artId]/sprints/[sprintId]/standup/page.tsx
art/[artId]/sprints/[sprintId]/review/page.tsx
art/[artId]/sprints/[sprintId]/retrospective/page.tsx
art/[artId]/roadmap/page.tsx          RoadmapPage
governance/page.tsx                   GovernanceDashboardPage
governance/workflows/page.tsx
governance/decision-log/page.tsx
```

### Package Dependencies (add to `apps/app/package.json`)

```json
{
  "xstate": "^5.0.0",
  "@xstate/react": "^4.0.0",
  "@dnd-kit/core": "^6.1.0",
  "@dnd-kit/sortable": "^8.0.0",
  "@dnd-kit/utilities": "^3.2.2",
  "@liveblocks/client": "^3.11.0",
  "@liveblocks/react": "^3.11.0",
  "@liveblocks/node": "^3.11.0",
  "@tiptap/react": "^2.4.0",
  "@tiptap/starter-kit": "^2.4.0",
  "@tiptap/extension-collaboration": "^2.4.0",
  "recharts": "^2.12.0",
  "ai": "^5.0.0"
}
```

### Breaking Changes (Epic 006)

1. `Epic.status` enum expanded — migration adds new states; existing IMPLEMENTING epics require guard-state audit.
2. `Feature.wsjfScore` moved to structured fields; existing null values acceptable.
3. `Sprint` uniqueness constraint: one ACTIVE per team — existing multi-active sprints need cleanup migration.
4. `ConfidenceVote` table dropped in favor of `ConfidenceVoteTally` (anonymous aggregates only) — breaking data model change.
5. `Liveblocks` room ID convention changes from `{userId}-{piPlanId}` to `{orgId}:{surface}:{entityId}` — requires room migration.

### Implementation Sequence (Epic 006)

1. Schema migration — add all new fields/models, SET RLS policies
2. `withSecureAction` wrapper + ESLint rule (prerequisite for all actions)
3. Epic lifecycle state machine (XState 5) + StateTransitionHistory
4. Portfolio Kanban board (FR-001/002) + Liveblocks auth handshake
5. WSJF engine (FR-006) + ScoringEvent model
6. INVEST quality gate + AI infra (FR-007/022) — Inngest + Upstash
7. Strategic themes + lean budget (FR-014/015)
8. Epic governance + decision log (FR-009/010)
9. ART setup + PI Plan lifecycle (FR-012/013)
10. Confidence Vote (FR-017) — anonymous tally only
11. ROAM risk management (FR-018)
12. Program Board + DependencyLink (FR-024/025) — DND-Kit + Liveblocks CRDT
13. Feature backlog + readiness + story decomposition (FR-019/020/021)
14. Sprint lifecycle + board (FR-023)
15. Async standup + sprint review + retrospective (FR-027/028)
16. Defects + impediments + roadmap (FR-029/030)

---

## Epic 007: Solution Train & Advanced Features

### Schema Changes (`packages/database/prisma/`)

#### `schema/finops.prisma` — New models (FOCUS 1.1)

```prisma
model BillingEntry {
  id              String   @id @default(cuid())
  orgId           String
  integrationId   String
  date            DateTime @db.Date
  provider        String   // AWS|GCP|AZURE|CUSTOM
  service         String
  region          String
  billedCost      Float
  effectiveCost   Float
  currency        String   @default("USD")
  tagHash         String
  rawTags         Json
  createdAt       DateTime @default(now())
  allocations     BillingEntryAllocation[]
  @@unique([orgId, date, provider, service, region, tagHash])
  @@index([orgId, date])
}

model BillingEntryAllocation {
  id              String   @id @default(cuid())
  orgId           String
  entryId         String
  tagRuleId       String?
  epicId          String?
  artId           String?
  teamId          String?
  percentage      Float    // 0-100
  amount          Float
  createdAt       DateTime @default(now())
  entry           BillingEntry @relation(fields: [entryId], references: [id])
  @@index([orgId, epicId])
  @@index([orgId, artId])
}

model TagRule {
  id          String   @id @default(cuid())
  orgId       String
  name        String
  pattern     String   // glob or regex
  patternType String   @default("GLOB") // GLOB|REGEX
  priority    Int      // lower = higher priority
  epicId      String?
  artId       String?
  teamId      String?
  active      Boolean  @default(true)
  createdAt   DateTime @default(now())
  @@index([orgId, priority])
}

model CostSnapshot {
  id          String   @id @default(cuid())
  orgId       String
  artId       String?
  epicId      String?
  period      String   // DAILY|WEEKLY|MONTHLY
  periodKey   String   // e.g. "2026-W22" or "2026-05"
  byTeam      Json?
  byEpic      Json?
  byService   Json?
  totalAmount Float
  currency    String   @default("USD")
  createdAt   DateTime @default(now())
  immutableAt DateTime?
  @@unique([orgId, epicId, period, periodKey])
  @@index([orgId, artId, period])
}

model BudgetPlan {
  id              String   @id @default(cuid())
  orgId           String
  scope           String   // ORG|ART|PI
  artId           String?
  piPlanId        String?
  totalAmount     Float
  currency        String   @default("USD")
  threshold70     Boolean  @default(true)
  threshold90     Boolean  @default(true)
  threshold100    Boolean  @default(true)
  thresholdCrossed Json?   // {70: date, 90: date, 100: date}
  createdAt       DateTime @default(now())
  @@unique([orgId, scope, artId, piPlanId])
}

model CommitmentDiscount {
  id          String   @id @default(cuid())
  orgId       String
  integrationId String
  type        String   // RI|SAVINGS_PLAN
  service     String
  region      String?
  discountPct Float    // 0-99
  startDate   DateTime @db.Date
  endDate     DateTime @db.Date
  active      Boolean  @default(true)
  @@index([orgId, startDate, endDate])
}

model PersonCost {
  id          String   @id @default(cuid())
  orgId       String
  userId      String
  artId       String?
  month       String   // "2026-05"
  totalCost   Float
  currency    String   @default("USD")
  breakdown   Json?
  recordedBy  String
  createdAt   DateTime @default(now())
  @@unique([orgId, userId, month])
}

model CurrencyRate {
  id          String   @id @default(cuid())
  fromCurrency String
  toCurrency   String
  rate         Float
  rateDate     DateTime @db.Date
  source       String   @default("ECB")
  @@unique([fromCurrency, toCurrency, rateDate])
  @@index([rateDate])
}

model BillingSyncRun {
  id              String   @id @default(cuid())
  orgId           String
  integrationId   String
  status          String   // RUNNING|COMPLETE|ERROR|PARTIAL
  startedAt       DateTime @default(now())
  completedAt     DateTime?
  entriesProcessed Int?
  errorMessage    String?
  cursor          String?  // resumable cursor
  @@index([orgId, integrationId, startedAt])
}

model CostAnomaly {
  id              String   @id @default(cuid())
  orgId           String
  artId           String?
  epicId          String?
  type            String
  severity        String   // LOW|MEDIUM|HIGH|CRITICAL
  baselineAmount  Float?
  actualAmount    Float?
  variancePct     Float?
  detectedAt      DateTime @default(now())
  resolvedAt      DateTime?
  suppressed      Boolean  @default(false)
  suppressionRule String?
  @@index([orgId, detectedAt])
}

model AnomalySuppressionRule {
  id          String   @id @default(cuid())
  orgId       String
  anomalyType String
  entityType  String?
  entityId    String?
  reason      String
  expiresAt   DateTime?
  active      Boolean  @default(true)
  createdBy   String
  @@index([orgId, anomalyType])
}
```

#### `schema/art-core.prisma` — Extend for Large Solution + Workflow

```prisma
// Extend existing models
// Story, Task, Defect, Impediment: add workflowState, workflowContext, workflowVersion
// Feature: add deployedAt, prStatus (already in Epic-006 section)
// Add SolutionEpic relationship
model Capability {
  id              String   @id @default(cuid())
  orgId           String
  solutionEpicId  String?
  title           String
  description     String?
  status          String   @default("DEFINED")
  wsjfScore       Float?
  readinessScore  Int?
  artDeliverables Json?    // [{artId, status, points}]
  createdAt       DateTime @default(now())
  @@index([orgId, solutionEpicId])
}

model BpmnDefinition {
  id              String   @id @default(cuid())
  orgId           String
  name            String
  entityType      String   // STORY|FEATURE|EPIC|CUSTOM
  ownerType       String   // ORG|TEAM|ART
  ownerId         String
  xmlGzip         Bytes    // gzipped BPMN XML, max 2MB
  compiledMachine Json?    // XState v5 config
  version         Int      @default(1)
  active          Boolean  @default(false)
  parentId        String?  // forked from
  lockedNodes     String[] // cosmos:locked BPMN node IDs
  activatedAt     DateTime?
  activatedBy     String?
  createdAt       DateTime @default(now())
  @@index([orgId, entityType, ownerId, active])
}

model OrgWorkflowMigrationMap {
  id              String   @id @default(cuid())
  orgId           String
  definitionId    String
  fromVersion     Int
  toVersion       Int
  stateMapping    Json     // {fromState: toState}
  createdAt       DateTime @default(now())
  @@unique([orgId, definitionId, fromVersion, toVersion])
}
```

#### `schema/planning.prisma` — Extend for OKRs, KRSnapshots, ScheduledReports

```prisma
model KeyResultSnapshot {
  id           String   @id @default(cuid())
  orgId        String
  keyResultId  String
  value        Float
  recordedAt   DateTime @default(now())
  recordedBy   String?
  source       String   @default("MANUAL") // MANUAL|AUTOMATED
  note         String?
  @@index([orgId, keyResultId, recordedAt])
}

model AlignmentGapAlert {
  id              String   @id @default(cuid())
  orgId           String
  artId           String?
  type            String   // UNLINKED_EPIC|OKR_AT_RISK|BLOCKED_ROADMAP|THEME_STARVATION|BUDGET_NO_THEME|OKR_ORPHAN
  severity        String
  entityType      String
  entityId        String
  message         String
  status          String   @default("OPEN") // OPEN|ACKNOWLEDGED|DISMISSED|AUTO_RESOLVED
  dismissalReason String?
  detectedAt      DateTime @default(now())
  resolvedAt      DateTime?
  @@index([orgId, artId, status])
}

model ScheduledReport {
  id          String   @id @default(cuid())
  orgId       String
  type        String   // EXECUTIVE_SUMMARY|PI_HEALTH|FLOW_METRICS|BUDGET_INTELLIGENCE|VELOCITY
  cadence     String   // WEEKLY|MONTHLY|QUARTERLY
  recipients  String[]
  artId       String?
  lastRunAt   DateTime?
  artifactRef String?  // S3/Blob URL
  active      Boolean  @default(true)
  createdBy   String
  @@index([orgId, type, active])
}
```

#### `schema/system.prisma` — Copilot Documents

```prisma
model CopilotDocument {
  id              String   @id @default(cuid())
  orgId           String
  name            String
  mimeType        String
  sizeBytes       Int
  sha256          String
  uploadedBy      String
  processingStatus String  @default("PENDING") // PENDING|PROCESSING|COMPLETE|FAILED
  chunkCount      Int?
  errorMessage    String?
  visibleToRoles  String[] // empty = all roles
  uploadedAt      DateTime @default(now())
  @@unique([orgId, sha256])
  @@index([orgId, processingStatus])
}
```

---

### New API Routes (Epic 007)

```
api/cron/anomaly-scheduler/route.ts
api/cron/staleness-check/route.ts
api/cron/billing-sync-dispatch/route.ts
api/cron/reindex-knowledge/route.ts
api/copilot/upload/route.ts
api/webhooks/linear/route.ts
api/webhooks/github/route.ts
api/integrations/billing/sync/route.ts
api/integrations/billing/sync/[jobId]/status/route.ts
api/billing/snapshots/[period]/breakdown/route.ts
api/health/billing/route.ts
api/analytics/flow-metrics/route.ts
api/analytics/velocity/route.ts
api/analytics/roi/route.ts
api/analytics/executive/route.ts
api/reports/route.ts
api/reports/[id]/route.ts
api/reports/[id]/download/route.ts
```

### New Server Actions (Epic 007)

```
actions/flow-intelligence/index.ts
actions/flow-intelligence/anomaly.ts
actions/flow-intelligence/staleness.ts
actions/flow-metrics/index.ts
actions/flow-metrics/forecasting.ts
actions/analytics/index.ts
actions/analytics/exports.ts
actions/reports/index.ts
actions/finops/billing.ts
actions/finops/tag-rules.ts
actions/finops/budget-plans.ts
actions/finops/cost-attribution.ts
actions/finops/currency.ts
actions/integrations/index.ts
actions/integrations/linear.ts
actions/integrations/github.ts
actions/integrations/sync-log.ts
actions/safe-copilot/index.ts
actions/safe-copilot/sessions.ts
actions/safe-copilot/tools.ts
actions/safe-copilot/documents.ts
actions/safe-copilot/prompt-templates.ts
actions/okrs/index.ts
actions/key-results/index.ts
actions/strategic-themes/index.ts
actions/strategy-map/index.ts
actions/traceability/index.ts
actions/roadmap/index.ts
actions/alignment-gaps/index.ts
actions/workflows/bpmn.ts
actions/workflows/runtime.ts
actions/workflows/analytics.ts
```

### Package Dependencies (add to `apps/app/package.json` — Epic 007)

```json
{
  "@aws-sdk/client-cost-explorer": "^3.600.0",
  "bpmn-js": "^18.0.0",
  "camunda-bpmn-moddle": "^7.0.0",
  "yjs": "^13.6.0",
  "@liveblocks/yjs": "^3.11.0",
  "inngest": "^4.4.0",
  "@upstash/redis": "^1.34.0",
  "@upstash/ratelimit": "^1.2.0"
}
```

### Breaking Changes (Epic 007)

1. `Integration.config` must be re-encrypted with AES-256-GCM — one-time migration job required.
2. `LinearSync.fieldMapping` schema changed to versioned format — existing mappings need migration.
3. `ConfidenceVote` model (if exists) fully replaced by `ConfidenceVoteTally` from Epic 006.
4. `BillingEntry` new composite unique constraint — existing rows without `tagHash` need backfill migration.
5. BPMN routes require `cosmos:*` moddle extension registration at init — missing registration causes validation failures on load.
6. Webhook handlers now require `X-Cosmos-Signature` on internal events — existing integration tests need updating.
7. `pnpm lint` will fail if any action in `app/actions/**` lacks `withSecureAction` wrapper (ESLint rule activated).

### Implementation Sequence (Epic 007)

1. FinOps schema migration + BillingEntry idempotent upsert + FOCUS 1.1 validation
2. AWS Cost Explorer integration + nightly sync cron (FR-015)
3. Tag rules engine + cost snapshots (FR-016)
4. Epic cost attribution + cost anomaly (FR-017)
5. Linear integration lifecycle + bidirectional sync (FR-018)
6. GitHub integration + DORA + webhook pipeline (FR-019/020)
7. Copilot RAG infra — pgvector index + hybrid retrieval (FR-021)
8. Role-aware context + tool-calling (FR-022/023)
9. Prompt library + document upload + security (FR-024)
10. OKR + KR + snapshots + alignment (FR-025/026/027/028/029)
11. Flow Intelligence — anomaly engine + rule set (FR-001/002)
12. Staleness detection + flow metric snapshots (FR-003/004)
13. Analytics dashboards — flow metrics, velocity, ROI, executive (FR-010/011/012/013/014)
14. Scheduled reports + analytics API (FR-014)
15. BPMN canvas + persistence + versioning (FR-030/031/032)
16. Capability planning + pair synergy + narrative generation (FR-005/006/007)

---

## Epic 008: Enterprise & Scale

### Schema Changes (`packages/database/prisma/`)

#### `schema/security.prisma` — New

```prisma
model TenantSecurityPolicy {
  id                  String   @id @default(cuid())
  orgId               String   @unique
  require2FA          Boolean  @default(false)
  gracePeriodDays     Int      @default(7)
  sessionDuration     Int      @default(480)  // minutes
  allowedIpRanges     String[]
  maxFailedLogins     Int      @default(10)
  lockoutDurationMin  Int      @default(30)
  passwordMinLength   Int      @default(12)
  requireSpecialChars Boolean  @default(true)
  requireNumbers      Boolean  @default(true)
  ssoRequired         Boolean  @default(false)
  apiKeyExpiryDays    Int      @default(90)
  enforceSecureActions Boolean @default(true)
  updatedAt           DateTime @updatedAt
  updatedBy           String?
}

model ApiKey {
  id          String   @id @default(cuid())
  orgId       String
  name        String
  keyHash     String   // SHA-256 of the actual key
  prefix      String   // "cmbk_live_" or "cmbk_test_"
  lastFour    String
  scope       String[]
  expiresAt   DateTime?
  lastUsedAt  DateTime?
  revokedAt   DateTime?
  createdBy   String
  createdAt   DateTime @default(now())
  usageLogs   ApiKeyUsageLog[]
  @@index([orgId, revokedAt])
  @@index([keyHash])
}

model ApiKeyUsageLog {
  id          String   @id @default(cuid())
  keyId       String
  orgId       String
  timestamp   DateTime @default(now())
  endpoint    String
  ipAddress   String
  statusCode  Int
  key         ApiKey   @relation(fields: [keyId], references: [id])
  @@index([keyId, timestamp])
  @@index([orgId, timestamp])
}

model AccessReviewReport {
  id          String   @id @default(cuid())
  orgId       String
  reviewedAt  DateTime @default(now())
  reviewer    String
  findings    Json
  status      String   @default("OPEN") // OPEN|CLOSED
  @@index([orgId, reviewedAt])
}

model TenantRolePermission {
  id          String   @id @default(cuid())
  orgId       String
  roleName    String
  permissions String[]
  isCustom    Boolean  @default(false)
  createdAt   DateTime @default(now())
  @@unique([orgId, roleName])
}

model DataSubjectRequest {
  id              String   @id @default(cuid())
  orgId           String
  subjectId       String
  type            String   // ERASURE|ACCESS|PORTABILITY|RECTIFICATION
  status          String   @default("PENDING") // PENDING|IN_PROGRESS|COMPLETED|FAILED
  submittedAt     DateTime @default(now())
  processedAt     DateTime?
  exportUrl       String?
  errorMessage    String?
  processingLog   Json?
  @@index([orgId, status])
  @@index([subjectId])
}

model CredentialVault {
  id              String   @id @default(cuid())
  orgId           String
  resourceType    String   // INTEGRATION|API_KEY|TOTP|OAUTH
  resourceId      String
  encryptedValue  Bytes
  keyVersion      Int      @default(1)
  rotatedAt       DateTime?
  createdAt       DateTime @default(now())
  @@unique([orgId, resourceType, resourceId])
}
```

#### `schema/notifications.prisma` — New

```prisma
model NotificationPreference {
  id          String   @id @default(cuid())
  userId      String
  orgId       String
  category    String   // GOVERNANCE|ANOMALY|SPRINT|BOARD|SYSTEM|FINOPS|INTEGRATION
  channel     String   // IN_APP|EMAIL|SLACK
  severity    String?  // null = all severities
  enabled     Boolean  @default(true)
  digestMode  String?  // IMMEDIATE|HOURLY|DAILY
  updatedAt   DateTime @updatedAt
  @@unique([userId, orgId, category, channel, severity])
  @@index([orgId, userId])
}

model NotificationPolicy {
  id                String   @id @default(cuid())
  orgId             String   @unique
  defaultChannels   String[] @default(["IN_APP"])
  overrideLimits    Json?    // per-category limits
  digestSchedule    Json?    // {hourly: "0 * * * *", daily: "0 8 * * *"}
  slackWebhookUrl   String?
  updatedAt         DateTime @updatedAt
}
```

#### `schema/webhooks.prisma` — New

```prisma
model WebhookEndpoint {
  id          String   @id @default(cuid())
  orgId       String
  url         String
  secretHash  String   // HMAC secret SHA-256 stored
  events      String[]
  active      Boolean  @default(true)
  retryPolicy Json     @default("{\"maxAttempts\":5,\"backoffMs\":2000}")
  createdBy   String
  createdAt   DateTime @default(now())
  deliveries  WebhookDeliveryLog[]
  @@index([orgId, active])
}

model WebhookDeliveryLog {
  id              String   @id @default(cuid())
  endpointId      String
  orgId           String
  eventType       String
  requestBody     Json
  responseCode    Int?
  responseBody    String?
  attemptCount    Int      @default(1)
  nextRetryAt     DateTime?
  status          String   @default("PENDING") // PENDING|DELIVERED|FAILED|FAILED_PERMANENTLY
  createdAt       DateTime @default(now())
  endpoint        WebhookEndpoint @relation(fields: [endpointId], references: [id])
  @@index([orgId, status])
  @@index([endpointId, createdAt])
}

model FeatureFlagOverride {
  id          String   @id @default(cuid())
  orgId       String
  userId      String?  // null = org-level override
  flagKey     String
  value       Boolean
  reason      String?
  expiresAt   DateTime?
  createdBy   String
  createdAt   DateTime @default(now())
  @@unique([orgId, userId, flagKey])
  @@index([orgId, flagKey])
}
```

#### `schema/large-solution.prisma` — New

```prisma
model SolutionTrain {
  id          String   @id @default(cuid())
  orgId       String
  name        String
  vision      String?
  valueStream String?
  status      String   @default("ACTIVE")
  createdAt   DateTime @default(now())
  members     SolutionTrainMember[]
  @@unique([orgId, name])
}

model SolutionTrainMember {
  id              String   @id @default(cuid())
  orgId           String
  solutionTrainId String
  userId          String
  role            String   // STE|EAM|BC|RTE
  joinedAt        DateTime @default(now())
  train           SolutionTrain @relation(fields: [solutionTrainId], references: [id])
  @@unique([solutionTrainId, userId])
}

model SupplierDeliverable {
  id          String   @id @default(cuid())
  orgId       String
  supplierId  String
  title       String
  description String?
  expectedDate DateTime
  status      String   @default("PENDING") // PENDING|IN_PROGRESS|DELIVERED|LATE|CANCELLED
  piPlanId    String?
  updatedAt   DateTime @updatedAt
  @@index([orgId, supplierId])
}

model LaceMeeting {
  id              String   @id @default(cuid())
  orgId           String
  solutionTrainId String
  scheduledAt     DateTime
  agenda          Json?    // [{item, presenter, durationMin}]
  recurrence      String?  // WEEKLY|BIWEEKLY|MONTHLY|NONE
  attendees       String[]
  minutesUrl      String?
  createdBy       String
  createdAt       DateTime @default(now())
  actionItems     LaceActionItem[]
  @@index([orgId, solutionTrainId, scheduledAt])
}

model LaceActionItem {
  id          String   @id @default(cuid())
  orgId       String
  meetingId   String
  title       String
  ownerId     String
  dueDate     DateTime
  status      String   @default("OPEN") // OPEN|IN_PROGRESS|COMPLETE|CANCELLED
  completedAt DateTime?
  meeting     LaceMeeting @relation(fields: [meetingId], references: [id])
  @@index([orgId, status, dueDate])
}

model LaceFocusArea {
  id              String   @id @default(cuid())
  orgId           String
  solutionTrainId String
  focus           String   // CAPABILITY_BUILDING|COACHING|TRANSFORMATION|METRICS
  description     String?
  active          Boolean  @default(true)
  @@unique([orgId, solutionTrainId, focus])
}

model BoardReconciliationLog {
  id                String   @id @default(cuid())
  orgId             String
  surface           String   // pi-planning|program-board|portfolio-kanban
  entityId          String
  detectedAt        DateTime @default(now())
  divergenceDetails Json
  resolvedAt        DateTime?
  resolution        String?  // PRISMA_WINS|LIVEBLOCKS_WINS|MANUAL
  @@index([orgId, surface, detectedAt])
}
```

#### Extend existing models for Epic 008

```prisma
// AuditLog — extend
model AuditLog {
  // existing + add:
  traceId     String?
  sessionId   String?
  actorIp     String?
  before      Json?
  after       Json?
}

// GovernedEpic — extend
model GovernedEpic {
  // existing + add:
  solutionEpicId       String?
  workflowVersion      Int?
  currentStepStartedAt DateTime?
  slaBreachAt          DateTime?
}

// ApprovalRequest — extend
model ApprovalRequest {
  // existing + add:
  stepType        String?  // SINGLE_APPROVER|GROUP_ANY|GROUP_ALL|EXTERNAL_NOTIFY
  groupApprovals  Json?    // [{userId, decision, timestamp}]
  slaBreachedAt   DateTime?
}

// Tenant — extend
model Tenant {
  // existing + add:
  terminologyMap         Json?
  whiteLabelHostname     String?
  onboardingCompletedAt  DateTime?
}

// User — extend
model User {
  // existing + add:
  totpSecretEncrypted Bytes?
  backupCodesHashed   String[]
  lockedUntil         DateTime?
  failedLoginCount    Int      @default(0)
  lastFailedLoginAt   DateTime?
}

// PIParticipant — extend
model PIParticipant {
  // existing + add:
  isOnline   Boolean  @default(false)
  lastSeenAt DateTime?
}

// ConfidenceVoteSession — extend
model ConfidenceVoteSession {
  // existing + add:
  facilitatorNote String?
  maxRounds       Int     @default(10)
}
```

---

### Composite Indexes (add across all schemas)

```prisma
// On AuditLog
@@index([orgId, createdAt])
@@index([orgId, action])
@@index([orgId, resourceType, resourceId])

// On Notification
@@index([orgId, userId, readAt])
@@index([orgId, createdAt])

// On WebhookDeliveryLog
@@index([orgId, status, createdAt])

// On Anomaly
@@index([orgId, type, entityId, status]) // dedup query

// On ApiKey
@@index([orgId, expiresAt])
@@index([keyHash])  // fast auth lookup

// On FeatureFlagOverride
@@index([orgId, flagKey, expiresAt])

// On GovernedEpic
@@index([orgId, status])

// On DataSubjectRequest
@@index([orgId, status, submittedAt])
```

---

### New API Routes (Epic 008)

```
api/collaboration/auth/route.ts                            POST (Liveblocks — extends Epic 006)
api/auth/totp/enable/route.ts                             POST
api/auth/totp/verify/route.ts                             POST
api/auth/totp/disable/route.ts                            POST
api/auth/totp/backup-codes/route.ts                       GET
api/admin/security-policies/route.ts                      GET/PATCH
api/admin/members/route.ts                                GET/POST
api/admin/members/[id]/route.ts                           PATCH/DELETE
api/admin/invitations/route.ts                            POST/DELETE
api/admin/feature-flags/route.ts                          GET/PATCH
api/admin/feature-flags/[key]/override/route.ts           POST/DELETE
api/admin/webhooks/route.ts                               GET/POST
api/admin/webhooks/[id]/route.ts                          PATCH/DELETE
api/admin/webhooks/[id]/test/route.ts                     POST
api/admin/api-keys/route.ts                               GET/POST
api/admin/api-keys/[id]/route.ts                          DELETE
api/admin/audit-log/route.ts                              GET
api/admin/audit-log/export/route.ts                       POST
api/admin/data-subject-requests/route.ts                  GET/POST
api/admin/data-subject-requests/[id]/route.ts             GET
api/governance/decision-log/route.ts                      GET (extends Epic 006)
api/governance/decision-log/export/route.ts               POST
api/search/route.ts                                       GET
api/notifications/route.ts                                GET/PATCH
api/notifications/preferences/route.ts                    GET/PUT
api/admin/notifications/announce/route.ts                 POST
api/solution-trains/route.ts                              GET/POST
api/solution-trains/[id]/route.ts                         PATCH
api/solution-trains/[id]/lace/route.ts                    GET/POST
api/solution-trains/[id]/capabilities/route.ts            GET/POST
api/health/vault/route.ts                                 GET (platform-internal)
```

### New Server Actions (Epic 008)

```
actions/collaboration/index.ts
actions/governance/index.ts         (extends Epic 006)
actions/admin/members.ts
actions/admin/security.ts
actions/admin/notifications.ts
actions/admin/audit.ts
actions/admin/compliance.ts
actions/admin/webhooks.ts
actions/admin/api-keys.ts
actions/admin/feature-flags.ts
actions/admin/credentials.ts
actions/solution-trains/index.ts
actions/solution-trains/lace.ts
actions/solution-trains/suppliers.ts
actions/solution-trains/capabilities.ts
actions/search/index.ts
actions/profile/index.ts
actions/profile/2fa.ts
actions/profile/sessions.ts
```

### Breaking Changes (Epic 008)

1. **Middleware chain extended**: `withSecureAction` now also validates `TenantSecurityPolicy.allowedIpRanges` — existing actions need no code change but may start failing for IPs if policy is misconfigured on upgrade.
2. **`withSecureAction` HOF** becomes mandatory (ESLint rule active) — any un-wrapped actions in `app/actions/**` must be wrapped before Epic 008 deploy.
3. **`GovernedEpic` enum extended**: new status `SLA_BREACHED` added — existing enum comparisons need `switch` exhaustiveness check.
4. **Webhook raw body requirement**: all webhook routes must use `req.text()` before any JSON parse — existing `req.json()` calls will break HMAC verification.
5. **ESLint rule `require-secure-action-wrapper`** must be registered in `eslint.config.mjs` before deploy — CI fails if not present.
6. **Liveblocks room ID convention** (see Epic 006 breaking changes) must be fully migrated before Epic 008 cross-surface presence aggregation can work.
7. **`User.totpSecretEncrypted`** migration: existing null values are fine; existing plain-text TOTP secrets (if any) must be re-encrypted before activation of `require2FA` policies.

### Implementation Sequence (Epic 008)

1. `withSecureAction` HOF finalization + ESLint rule registration + CI gate (pre-requisite for all)
2. RBAC permission matrix formalization + `@repo/rbac` `can()` function (FR-828)
3. Liveblocks auth hardening + orgId-scoped rooms + room limits (FR-801/806)
4. CRDT PI Planning board + dual-write + reconciliation (FR-803/807)
5. Program Board dependency collaboration real-time (FR-804)
6. Confidence Vote real-time overlay (FR-805)
7. Presence + cursors across all surfaces (FR-802)
8. AES-256-GCM credential vault + key rotation (FR-829)
9. Webhook signature verification (FR-831)
10. Rate limiting multi-tier (FR-830)
11. PII-safe observability (FR-832)
12. Tenant security policies + IP allowlist + account lockout (FR-821)
13. Member management + invitation system (FR-819)
14. TOTP 2FA enrollment + backup codes + session management (FR-820)
15. Notification system + preferences + deduplication + digest (FR-822)
16. Global search + GIN indexes + command palette (FR-823)
17. Feature flags + webhook endpoints + API keys (FR-824)
18. Audit log + SOC2 export + INSERT-only enforcement (FR-825)
19. LGPD DSR pipeline + portability export + anonymization (FR-826)
20. Tenant data isolation audit + RLS verification (FR-827)
21. Tenant/org settings + terminology map + onboarding wizard (FR-818)
22. Decision log governance surface + PDF export (FR-816)
23. Portfolio Kanban governance gate (FR-817)
24. Governed epic SLA tracking + escalation (FR-815)
25. Approval workflow configuration + template library (FR-814)
26. Solution Train + LACE + Capability + Supplier management (FR-808–813)

---

## Cross-Cutting Architecture Decisions

### `withSecureAction` HOF Contract

```typescript
// packages/security/src/with-secure-action.ts
type SecureActionConfig<TInput> = {
  requiredRole?: Role
  requiredPermission?: string
  schema: z.ZodType<TInput>
  transactional?: boolean
  auditAction: string
  auditResourceType: string
}

async function withSecureAction<TInput, TOutput>(
  config: SecureActionConfig<TInput>,
  handler: (input: TInput, ctx: ActionContext) => Promise<TOutput>
): Promise<ActionResult<TOutput>>
```

All server actions in `apps/app/app/actions/**` MUST use this wrapper. The ESLint rule `require-secure-action-wrapper` enforces this at CI.

### Liveblocks Room Namespace Convention

```
{orgId}:portfolio-kanban:{orgId}
{orgId}:pi-planning-board:{piPlanId}
{orgId}:program-board:{piPlanId}
{orgId}:retro-board:{sprintId}
{orgId}:bpmn-editor:{definitionId}
{orgId}:confidence-vote:{sessionId}
```

Permission matrix per room type:
- `portfolio-kanban`: OWNER/ORG_ADMIN/RTE/PM → write; others → read
- `pi-planning-board`: FACILITATOR → full; SCRUM_MASTER/PRODUCT_OWNER/SA → write; TEAM_MEMBER/BO → limited write; OBSERVER → read
- `program-board`: FACILITATOR/RTE → full; PM/SA/SM/PO → write; others → read
- `retro-board`: SM → full; TEAM_MEMBER → write (own items); RTE → read
- `bpmn-editor`: WORKFLOW_WRITE permission → write; others → read
- `confidence-vote`: FACILITATOR → control; non-OBSERVER → vote; OBSERVER → no access

### AI/Copilot Rate Limit Tiers (Upstash)

| Tier | Monthly Analyses | INVEST/mo | Batch/mo | Copilot Msgs | RAG |
|------|---------|-----------|----------|------|-----|
| Starter | 50 | 200 | 1 | 100 | No |
| Growth | 500 | 2,000 | 10 | 1,000 | Basic |
| Enterprise | Unlimited | Unlimited | Unlimited | Unlimited | Full |

### pgvector Index Configuration

```sql
-- PIKnowledgeVector
CREATE INDEX idx_knowledge_vector_org ON "PIKnowledgeVector"
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Filtered by orgId (required for multi-tenant)
CREATE INDEX idx_knowledge_vector_org_type ON "PIKnowledgeVector"
  (org_id, entity_type, indexed_at);
```

Hybrid retrieval: vector (top-20) + BM25 via `pg_trgm` (top-20) → RRF k=60 → top-8 (non-admin) or top-12 (RTE/admin). Role down-rank: non-primary entity types get 0.5× RRF score.

### Inngest Job Registry (all three epics)

| Job Name | Trigger | Epic |
|----------|---------|------|
| `auto-invest-analysis` | Epic status change | 006 |
| `portfolio-analysis-batch` | Manual + weekly cron | 006 |
| `staleness-check` | Daily 03:00 UTC | 006/007 |
| `velocity-recalc` | Sprint close | 006 |
| `sla-reminder` | 80% + breach | 006 |
| `board-reconciliation` | 15-min interval | 006/008 |
| `anomaly-scheduler` | Nightly 02:00 UTC | 007 |
| `billing-sync-dispatch` | Nightly 01:00 UTC | 007 |
| `reindex-knowledge` | Nightly 04:00 UTC + incremental | 007 |
| `webhook-retry` | DLQ consumer | 007 |
| `ai-risk-surfacing` | Post-sprint close | 007 |
| `dsr-processing` | DSR submission | 008 |
| `credential-rotation` | Manual trigger | 008 |
| `alignment-gap-scan` | Daily 06:00 UTC | 007 |
| `report-generation` | Scheduled per config | 007 |

### RLS Policy Template (all new tables)

```sql
ALTER TABLE "TableName" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TableName" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "TableName"
  USING (org_id = current_setting('app.current_org_id')::text);
```

Prisma middleware sets `app.current_org_id` on every request via `prisma.$use()` in `@repo/database`.

### Anomaly Deduplication Query Pattern

```sql
SELECT id FROM "Anomaly"
WHERE org_id = $1
  AND type = $2
  AND entity_id = $3
  AND status NOT IN ('RESOLVED', 'SUPPRESSED')
  AND detected_at > NOW() - INTERVAL '24 hours'
LIMIT 1;
```

Index `(orgId, type, entityId, status)` covers this query.

### Content-Hash Cache Key (AI)

```
ai:cache:{orgId}:{feature}:{sha256(sortedInputFields)}
```

TTL: 24h. Upstash `SET NX PX 86400000`. Response includes `cached: true` if hit.
