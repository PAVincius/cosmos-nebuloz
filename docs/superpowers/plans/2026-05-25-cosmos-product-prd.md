# Cosmos — Product Requirements Document (Estado Atual)

> **Finalidade:** Documento de referência técnica para pesquisa de mercado.
> Mapeia todos os módulos, entidades, relações e pontos de atenção do Cosmos
> conforme implementado em **2026-05-25** (branch `feat/kanban-portfolio-ai`).

---

## 1. Visão Geral do Produto

**Cosmos** é uma plataforma SaaS de gestão de portfólio e entrega ágil em escala,
alinhada ao framework SAFe (Scaled Agile Framework). O produto atende empresas que
precisam conectar estratégia de portfólio (temas, OKRs, orçamentos) com execução
de times (sprints, histórias, tasks) e inteligência contínua (flow metrics,
anomaly detection, Copilot AI).

### 1.1 Tenant e Planos

| Plano | Código |
|---|---|
| Orbit | ORBIT |
| Galaxy | GALAXY |
| Nebula | NEBULA |
| Universe | UNIVERSE |

### 1.2 Roles de Usuário

`ADMIN` | `STE` | `RTE` | `SM` | `PO` | `DEV` | `MEMBER`

Mapeados diretamente aos papéis SAFe: STE (Solution Train Engineer), RTE (Release
Train Engineer), SM (Scrum Master), PO (Product Owner).

---

## 2. Arquitetura Técnica

### 2.1 Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 15 (App Router), React, Shadcn/ui, Framer Motion, DnD Kit |
| Backend | Next.js Server Actions, Zod validation |
| ORM | Prisma (multi-file schema, `prismaSchemaFolder`) |
| Database | PostgreSQL + extensão `pgvector` (Supabase) |
| Auth | Better Auth (sessions, accounts, verification, 2FA) |
| Real-time | Liveblocks (CRDT via Yjs) |
| AI | Anthropic Claude (Copilot), pgvector RAG (1536 dims) |
| BPMN | bpmn-io / bpmn-js |
| Analytics | PostHog |
| Monorepo | Turborepo + pnpm workspaces |
| CI/CD | Vercel |
| Integrations | Linear, GitHub, Jira, Azure DevOps, Asana, AWS/GCP/Azure Billing |

### 2.2 Pacotes Internos

```
packages/
  ai/           — wrapper Anthropic (keys, provider)
  analytics/    — PostHog client + server
  audit/        — serviço de audit log
  auth/         — Better Auth (client, server, proxy)
  cms/          — BaseHub CMS (documentação do produto)
  collaboration/ — Liveblocks (auth, hooks, room, config)
  database/     — Prisma schema (16 arquivos), seed, vector-search
  design-system/ — Shadcn/ui components
  email/        — Email service
```

### 2.3 Schema Prisma — Arquivos

```
schema/
  base.prisma          — generator + datasource
  tenant.prisma        — User, Tenant, TenantMember, Session, Account
  portfolio.prisma     — StrategicTheme, OKR, KeyResult, LeanBudget, RoadmapItem
  art-core.prisma      — ART, Team, PIPlan, Feature, Epic, Risk, RiskOKR
  planning.prisma      — PIObjective, PISession, PIParticipant, ConfidenceVoteSession
  team-delivery.prisma — Sprint, Story, Task, Defect, Impediment, Dependency, StandupEntry, Retrospective
  governance.prisma    — GovernedEpic, ApprovalWorkflow, ApprovalRequest, DecisionLogEntry
  flow-metrics.prisma  — StateTransitionHistory, FlowMetricSnapshot, CompetencyAssessment, ImprovementAction
  flow-intelligence.prisma — AnomalyDetectionRun, Anomaly, StalenessAuditLog, PersonSkillProfile
  team-capacity.prisma — TeamMemberAssignment, MemberSprintMetrics, MemberThroughputBaseline, PairSynergy, GroupSynergy, TeamCapacitySnapshot
  metrics.prisma       — PIKnowledgeVector, OnboardingProgress, MigrationConnection, ConfidenceVoteSession
  large-solution.prisma — SolutionTrain, Capability, SolutionEpic
  finops.prisma        — BillingEntry, BillingEntryAllocation, CostSnapshot, BillingSyncCursor
  system.prisma        — AuditLog, Notification, Integration, SyncLog, DependencyLink
  linear-sync.prisma   — LinearSync
  onboarding.prisma    — OnboardingProgress (também em metrics)
```

---

## 3. Domínios e Entidades

### 3.1 Domínio: Multi-Tenant Foundation

**Responsabilidade:** Identidade, autenticação, autorização, organização.

#### Entidades

| Entidade | Propósito | Campos-Chave |
|---|---|---|
| `User` | Usuário global | id, name, email, role global |
| `Tenant` | Organização/workspace | id, slug, plan, logo, metadata |
| `TenantMember` | M:N User↔Tenant | tenantId, userId, role (MemberRole) |
| `TenantInvitation` | Fluxo de convite | email, role, status, expiresAt |
| `Session` | Sessão Better Auth | token, userId, activeTenantId |
| `Account` | OAuth provider | providerId, accessToken, refreshToken |
| `Verification` | 2FA / email verify | identifier, value, expiresAt |

#### Relações

```
Tenant 1──* TenantMember *──1 User
Tenant 1──* TenantInvitation
User   1──* Session
User   1──* Account
```

---

### 3.2 Domínio: Portfolio / Estratégia

**Responsabilidade:** Temas estratégicos, OKRs, orçamento, roadmap.
Corresponde ao nível **Portfolio** do SAFe.

#### Entidades

| Entidade | Propósito | Campos-Chave |
|---|---|---|
| `StrategicTheme` | Tema estratégico do portfolio | code, title, color, horizon, status, themeType (GROWTH/EFFICIENCY/INNOVATION/COMPLIANCE/CUSTOMER_EXPERIENCE), budgetTotal |
| `OKR` | Objetivo vinculado a contexto SAFe | type (portfolio_theme/portfolio_epic/pi_art/team_pi/improvement), piPlanId?, strategicThemeId?, epicId?, artId?, teamId? |
| `KeyResult` | Resultado-chave de OKR | baseline, current, target, unit |
| `KeyResultSnapshot` | Histórico de progresso de KR | value, recordedAt |
| `LeanBudget` | Alocação orçamentária por ART/Tema/Período | amount, spent, spentDecimal, guardrails (JSON: capex, opex), period, spentSource (MANUAL/BILLING_AGGREGATE/FORECAST) |
| `RoadmapItem` | Posição de Epic no roadmap temporal | epicId?, startDate, endDate, swimlane |

#### Relações

```
StrategicTheme 1──* Epic            (estratégia → workitems)
StrategicTheme 1──* OKR             (objetivos do tema)
StrategicTheme M──N ART (ThemeART)  (tema entregue por ARTs)
StrategicTheme 1──* LeanBudget      (orçamento por tema)
StrategicTheme 1──* BillingEntry    (custo real por tema)

OKR 1──* KeyResult
KeyResult 1──* KeyResultSnapshot

LeanBudget N──1 StrategicTheme?
LeanBudget N──1 ART? (via artId)
```

#### Kanban de Portfólio (UI)

Tela em `/portfolio` apresenta Epics como cards em colunas Kanban baseadas em
`Epic.statusId`. A ação `getPortfolio` agrega:
- Epic + features count + status
- GovernedEpic (investScore, governanceStatus)
- StrategicTheme (cor, código)
- Feature (WSJF, PI commitment)
- Custo real via BillingEntryAllocation

---

### 3.3 Domínio: ART Core

**Responsabilidade:** Estrutura de Agile Release Train, PI Planning, Features, Epics de execução.

#### Entidades

| Entidade | Propósito | Campos-Chave |
|---|---|---|
| `ART` | Agile Release Train | name, cadence (semanas por PI) |
| `Team` | Time Ágil dentro do ART | artId?, velocity, sprintLengthDays, members (JSON **deprecated**) |
| `PIPlan` | Program Increment (quarter) | artId, name, startDate, endDate |
| `Epic` | Work item de portfólio | statusId, order, yjsDocumentState (Yjs CRDT), strategicThemeId?, investScore, investBreakdown (JSON), descriptionMd |
| `Feature` | Work item de ART | epicId?, piPlanId?, WSJF (bv, tc, rr, js, wsjfScore), storyPoints, externalId/Source/Url |
| `Risk` | Risco ROAM | piPlanId?, artId?, roamStatus (Resolved/Owned/Accepted/Mitigated), severity, dueDate |
| `RiskOKR` | M:N Risk↔OKR | riskId, okrId, impact (low/medium/high/critical) |
| `DependencyLink` | Dependência entre Features | blockingFeatureId, blockedFeatureId, status, type (team/art/organizational/external) |

#### Relações

```
ART 1──* PIPlan
ART 1──* Team
ART M──N StrategicTheme (ThemeART)

PIPlan 1──* Feature   (features comprometidas no PI)
PIPlan 1──* Risk
PIPlan 1──* OKR       (OKRs do PI/ART)
PIPlan 1──* PISession (cerimônias)
PIPlan 1──* PIObjective

Epic 1──* Feature
Epic N──1 StrategicTheme?
Epic 1──1 GovernedEpic?     (governance opcional)

Feature N──1 Epic?
Feature N──1 PIPlan?
Feature 1──* Story
Feature 1──* DependencyLink (como blocking ou blocked)

Risk M──N OKR (RiskOKR — impacto de risco em objetivo)
```

#### AI INVEST Scoring (Epic)

```typescript
// Cache invalidation via hash
investHash = sha256(title + descriptionMd)
investScore: Float  // 0–100 composite
investBreakdown: Json // { I, N, V, E, S, T } each 0-100 with rationale
```

Score é computado pela Copilot AI e cacheado. Invalidado quando título ou
descrição muda (hash mismatch).

---

### 3.4 Domínio: PI Planning

**Responsabilidade:** Cerimônias de PI Planning, votação de confiança, participantes.

#### Entidades

| Entidade | Propósito | Campos-Chave |
|---|---|---|
| `PIObjective` | Objetivo do time no PI | piPlanId, teamId, title, businessValue, status |
| `PISession` | Cerimônia PI (Planning ou Replan) | piPlanId, type (PLANNING/REPLAN), scheduledAt |
| `ConfidenceVoteSession` | Rodada de voto de confiança SAFe | piSessionId, roundNumber, xStateStatus, votes (JSON number[]) |
| `PIParticipant` | Quem participou do PI Planning | piPlanId, userId, role |
| `PIKnowledgeVector` | Embeddings pgvector para RAG | sourceType, sourceId, chunkIndex, textContent, embedding (vector 1536) |

#### Relações

```
PIPlan 1──* PISession
PISession 1──* ConfidenceVoteSession (múltiplas rodadas)
PIObjective N──1 PIPlan
PIObjective N──1 Team
PIKnowledgeVector N──1 Tenant (escopo de tenant)
```

#### RAG Vector Store

```
PIKnowledgeVector.sourceType:
  "risk"         → Risk.id
  "pi_objective" → PIObjective.id
  "feature"      → Feature.id
  "epic"         → Epic.id
  "okr"          → OKR.id
  "document"     → upload manual (sourceId = null)

embedding: vector(1536)  — OpenAI/Anthropic embeddings
Similarity search: cosine (raw SQL via pgvector)
```

---

### 3.5 Domínio: Team Delivery

**Responsabilidade:** Execução de sprints, histórias, tasks, cerimônias de time.

#### Entidades

| Entidade | Propósito | Campos-Chave |
|---|---|---|
| `Sprint` | Iteração do time | teamId, name, goal, startDate, endDate, status (PLANNING/ACTIVE/COMPLETED), capacity |
| `Story` | História de usuário | sprintId?, featureId?, storyPoints, acceptanceCriteria, externalId/Source/Url |
| `Task` | Tarefa atômica dentro de Story | storyId, status (TODO/IN_PROGRESS/DONE), assigneeUserId, taskType, complexity, estimateHours, actualSp |
| `TaskAssignee` | Multi-assignee por task | taskId, userId, role (primary/reviewer/pair) |
| `Defect` | Bug/defeito | tenantId, sprint? |
| `Impediment` | Bloqueador de time/ART | artId?, severity |
| `StandupEntry` | Registro de daily standup | teamId, sprintId, userId, date |
| `SprintReview` | Cerimônia de review | sprintId (unique) |
| `Retrospective` | Cerimônia de retro | sprintId (unique), wentWell (JSON), toImprove (JSON), actions (JSON) |

#### Relações

```
Team 1──* Sprint
Sprint 1──* Story
Sprint 1──1 SprintReview?
Sprint 1──1 Retrospective?

Story N──1 Feature?
Story N──1 Sprint?
Story 1──* Task

Task 1──* TaskAssignee (multi-assignee para synergy detection)
```

#### Workflow Customizável (Lace / BPMN)

- `BpmnDefinition` — definição BPMN 2.0 por time/ART
- `TeamWorkflowNode` / `TeamWorkflowEdge` — Kanban customizado por time

---

### 3.6 Domínio: Portfolio Governance (LPM)

**Responsabilidade:** Fluxo de governança de Epics, aprovações, decisões.

#### Entidades

| Entidade | Propósito | Campos-Chave |
|---|---|---|
| `GovernedEpic` | Wrapper de governança para Epic | epicId (unique), governanceStatus, investmentEstimate, valueStreamId?, themeId? |
| `ApprovalWorkflow` | Template de fluxo de aprovação | tenantId, steps config |
| `ApprovalRequest` | Instância de processo para GovernedEpic | workflowId, governedEpicId?, estado |
| `ApprovalStepInstance` | Passo individual de aprovação | approvalRequestId, stepIndex, decidorId |
| `DecisionLogEntry` | Audit trail de decisões de governança | tipo (epic_decision/budget_decision/theme_decision), targetType, targetId, decisao, justificativa, dadosSuporte (JSON) |

#### Relações

```
Epic 1──1 GovernedEpic?        (opcional — nem todo epic é governado)
GovernedEpic 1──* ApprovalRequest
ApprovalWorkflow 1──* ApprovalRequest
ApprovalRequest 1──* ApprovalStepInstance
DecisionLogEntry N──1 Tenant    (log centralizado por tenant)
```

#### Status de Governança de Epic

```
FUNNEL → ANALYZING → PORTFOLIO_BACKLOG → IMPLEMENTING → DONE → CANCELLED
```

---

### 3.7 Domínio: Flow Analytics

**Responsabilidade:** 6 Flow Metrics do SAFe, competências, ações de melhoria.

#### Entidades

| Entidade | Propósito | Campos-Chave |
|---|---|---|
| `FlowMetricSnapshot` | Snapshot das 6 métricas de flow | scope (team/art/value_stream), period (sprint/pi/quarter), periodRef, flowDistribution, flowVelocity*, flowTime*, flowLoad*, flowEfficiency, flowPredictability, isArchived, staleness tracking |
| `StateTransitionHistory` | Audit de mudanças de status em qualquer entidade | entityType, entityId, fromStatus, toStatus, transitionedAt |
| `CompetencyAssessment` | Avaliação das 7 competências SAFe por escopo | scope, competency, score (1–5), respondents (JSON userIds) |
| `ImprovementAction` | Ação de melhoria vinculada a métrica | relatedMetric, scope, status (OPEN/IN_PROGRESS/DONE/CANCELLED), dueDate |
| `PersonSkillProfile` | Competência individual (nível de pessoa) | userId, competency, skillLevel (1–5), isDraft, isVerified |

#### 6 Flow Metrics

```
1. flowDistribution   — distribuição por tipo (story/defect/feature/enabler)
2. flowVelocity       — itens entregues (total + por tipo)
3. flowTime           — tempo médio e mediano (horas)
4. flowLoad           — WIP médio e atual
5. flowEfficiency     — valor ativo / tempo total (0–1)
6. flowPredictability — delivered/planned (0–1)
```

#### 7 Competências SAFe

```
TEAM_TECHNICAL_AGILITY
AGILE_PRODUCT_DELIVERY
LEAN_PORTFOLIO_MANAGEMENT
ORGANIZATIONAL_AGILITY
ENTERPRISE_SOLUTION_DELIVERY
LEAN_AGILE_LEADERSHIP
CONTINUOUS_LEARNING_CULTURE
```

---

### 3.8 Domínio: Flow Intelligence (AI)

**Responsabilidade:** Detecção automática de anomalias, synergy detection, baselines.

#### Entidades

| Entidade | Propósito | Campos-Chave |
|---|---|---|
| `AnomalyDetectionRun` | Execução de detecção de anomalias | scope, scopeId, snapshotId (→FlowMetricSnapshot), trigger, status |
| `Anomaly` | Anomalia detectada | rule, severity, metric, delta, metadata |
| `StalenessAuditLog` | Audit de transições de staleness em snapshots | snapshotId, rulesApplied, triggeredBy |
| `TeamMemberAssignment` | Capacidade por membro por sprint | sprintId, teamId, userId, capacityFactor (0–1), hoursPerWeek |
| `MemberSprintMetrics` | SP entregues por membro por sprint (write-once) | storyPointsDelivered, storiesCompleted, defectsResolved, avgFlowTimeHours |
| `MemberThroughputBaseline` | Baseline rolling de throughput individual | windowSprints, avgSp, stdDev |
| `TeamCapacitySnapshot` | Agregação de capacidade do time por sprint | totalCapacityFactor, effectiveVelocity |
| `PairSynergy` | Padrão de colaboração entre 2 pessoas | userId1, userId2, taskType, score |
| `GroupSynergy` | Padrão de colaboração N>2 | memberHash, taskType, score |

#### Regras de Anomalia

```
VelocityCliff             — queda brusca de velocity
WIPOverload               — WIP acima do threshold
PredictabilityCollapse    — flowPredictability < baseline
CycleTimeDegradation      — flowTime aumentando trend
EfficiencyNosedive        — flowEfficiency caindo
WorkTypeImbalance         — distribuição de work types desbalanceada
StaleCompetencyAssessment — competency assessment desatualizado
ImprovementActionOverdue  — ações de melhoria vencidas
```

#### Pipeline

```
FlowMetricSnapshot criado
  → AnomalyDetectionRun triggered (snapshot_created | scheduled | manual)
    → Heuristic rules → Anomaly[] detectadas
      → LLM enrichment (narrativa + sugestão)
        → CopilotSuggestion (surface no Copilot)
```

---

### 3.9 Domínio: AI Copilot (Cosmos Copilot)

**Responsabilidade:** Assistente AI contextual, sessions de conversa, ferramentas especializadas.

#### Entidades

| Entidade | Propósito | Campos-Chave |
|---|---|---|
| `CopilotSession` | Sessão de conversa | userId?, mode, surface, title, messages (JSON cache), messageCount, lastMessageAt, pinnedAt |
| `CopilotMessage` | Mensagem individual | sessionId, role (user/assistant), content, tokens |

#### Modos de Copilot

```
mode:    global | rte | lpm | pm | team | spc
surface: pi_workspace | portfolio_dashboard | flow_dashboard | lean_budget | risk_board | global
```

#### Ferramentas do Copilot (Server Actions `/safe-copilot/tools/`)

- **Pricing Tools**: AWS Cost Explorer + GCP Cloud Billing (estimativas de custo direto no chat)
- **Flow Analysis**: leitura de FlowMetricSnapshot por scope
- **Risk Assessment**: leitura/criação de Risks no contexto de PI
- **Epic/Feature context**: busca semântica via PIKnowledgeVector (RAG pgvector)
- **OKR context**: leitura de OKRs vinculados

#### RAG no Copilot

```
User message
  → embed(message) [1536-dim vector]
    → pgvector cosine similarity search em PIKnowledgeVector (threshold ~0.75)
      → chunks relevantes (risks, objectives, features, epics, okrs, docs)
        → Context window enriquecido para Claude
```

#### UI Components

```
apps/app/app/(authenticated)/components/copilot/
  copilot-chat.tsx         — chat principal (Framer Motion messages)
  copilot-fab.tsx          — floating action button
  copilot-thread-item.tsx  — item de thread com animação
  copilot-trigger-button.tsx — botão de trigger
  copilot-icons.tsx        — ícones do Copilot
  
apps/app/app/(authenticated)/copilot/components/
  copilot-fullscreen.tsx   — modo expandido/fullscreen
```

---

### 3.10 Domínio: FinOps (Cloud Cost)

**Responsabilidade:** Sincronização de custos cloud, alocação para portfolio, snapshots.
FOCUS v1.1 compliant.

#### Entidades

| Entidade | Propósito | Campos-Chave |
|---|---|---|
| `Integration` | Configuração de conector externo | source (linear/github/jira/azure-devops/billing_aws/billing_gcp/billing_azure), config (JSON, encrypted), mapping (JSON: statusMap, typeMap, teamId, artId), status |
| `SyncLog` | Histórico de sincronização | integrationId, type (snapshot/webhook/push), status, itemsCreated/Updated/Skipped, errors (JSON) |
| `BillingEntry` | Linha de custo cloud (FOCUS v1.1) | provider, accountId, subAccountId, externalId, usageStartDate/EndDate, serviceCategory, resourceType, chargeCategory, effectiveCost, contractedCost (Decimal 18,6) |
| `BillingEntryAllocation` | Distribuição de custo para portfolio | billingEntryId, themeId?, epicId?, artId?, percentage (Decimal 5,2), allocationType |
| `CostSnapshot` | Snapshot periódico agregado de custo | periodStart, periodEnd, totalCost, breakdown (JSON) |
| `BillingSyncCursor` | Watermark para sync incremental | integrationId (unique), lastSyncedAt, cursor (JSON) |

#### Relações

```
Integration 1──* SyncLog
Integration 1──* BillingEntry
Integration 1──1 BillingSyncCursor?

BillingEntry 1──* BillingEntryAllocation
BillingEntryAllocation N──1 StrategicTheme?
BillingEntryAllocation N──1 Epic?
BillingEntryAllocation N──1 ART? (via artId)

LeanBudget.spentSource = "BILLING_AGGREGATE"
  → lê BillingEntryAllocation para calcular spent real
```

#### Fontes de Integração

```
Billing:    billing_aws | billing_gcp | billing_azure
Dev tools:  linear | github | asana | gitlab | jira | azure-devops
```

---

### 3.11 Domínio: Large Solution

**Responsabilidade:** Nível de Large Solution Train do SAFe (acima de ART único).

#### Entidades

| Entidade | Propósito | Campos-Chave |
|---|---|---|
| `SolutionTrain` | Large Solution Train | name, description |
| `Capability` | Feature de nível LST | solutionTrainId?, title, status (BACKLOG/ANALYZING/IMPLEMENTING/DONE) |
| `SolutionEpic` | Epic de nível LST | solutionTrainId?, wsjfScore |

#### Relações

```
SolutionTrain 1──* Capability
SolutionTrain 1──* SolutionEpic
```

---

### 3.12 Domínio: Integrations / LinearSync

**Responsabilidade:** Sincronização bidirecional com ferramentas externas.

#### Entidades

| Entidade | Propósito | Campos-Chave |
|---|---|---|
| `LinearSync` | Mapeamento bidirecional Cosmos↔Linear | linearId, linearType (team/project/issue/milestone/cycle), cosmosId, cosmosType (Art/Epic/Feature/PIPlan/Sprint), lastSyncedAt |

#### Mapeamento

```
Linear team      ↔ ART
Linear project   ↔ Epic / PIPlan
Linear issue     ↔ Feature / Story
Linear milestone ↔ PIPlan
Linear cycle     ↔ Sprint
```

#### Feature/Story External Fields

```typescript
externalId:     String?  // ID no sistema externo
externalSource: String?  // linear | github | asana | gitlab
externalUrl:    String?  // link direto
```

---

### 3.13 Domínio: System / Infrastructure

#### Entidades

| Entidade | Propósito | Campos-Chave |
|---|---|---|
| `AuditLog` | Audit trail global | entityType, entityId, diff (JSON), userId |
| `Notification` | Notificações in-app | userId, type, payload, read |
| `OnboardingProgress` | Wizard de onboarding | flowType (company_setup/migration_setup), currentStep, completedSteps, status |
| `MigrationConnection` | Import de ferramentas externas | source (csv/jira/azure/trello), status, discoveryData, mappingData, importReport (JSON) |

---

## 4. Mapa de Relações Cross-Domain

### 4.1 Decomposição Top-Down (Strategy → Execution)

```
StrategicTheme
  └── Epic (investScore, INVEST AI)
        └── Feature (WSJF)
              └── Story (storyPoints)
                    └── Task (taskType, complexity)
                          └── TaskAssignee (multi-assignee)
```

### 4.2 Planejamento de PI

```
ART + StrategicTheme (ThemeART M:N)
  └── PIPlan (PI quarter)
        ├── Feature[] (commitment)
        ├── PIObjective[] (team objectives)
        ├── PISession (cerimônia)
        │     └── ConfidenceVoteSession[] (rounds)
        ├── Risk[] (ROAM)
        │     └── RiskOKR (impacto em OKRs)
        └── OKR (pi_art type)
              └── KeyResult[]
                    └── KeyResultSnapshot[]
```

### 4.3 Entrega de Time

```
Team
  └── Sprint
        ├── Story[]
        │     └── Task[]
        │           └── TaskAssignee[]
        ├── SprintReview
        ├── Retrospective
        ├── TeamMemberAssignment[] (capacidade por membro)
        ├── MemberSprintMetrics[]  (entregue por membro)
        └── TeamCapacitySnapshot
```

### 4.4 Governança de Portfólio

```
Epic
  └── GovernedEpic (FUNNEL → DONE)
        └── ApprovalRequest
              └── ApprovalStepInstance[]
DecisionLogEntry (log centralizado: epic/budget/theme decisions)
```

### 4.5 Orçamento e Custo Real

```
StrategicTheme.budgetTotal (intent)
  └── LeanBudget (alocação por ART/Tema/Período)
        └── LeanBudget.spent ← BillingEntryAllocation.percentage
              └── BillingEntry (custo real cloud)
                    └── Integration (conector AWS/GCP/Azure)
```

### 4.6 Flow Intelligence Pipeline

```
StateTransitionHistory (qualquer entidade muda de status)
  └── FlowMetricSnapshot (calculado por sprint/pi/quarter)
        ├── StalenessAuditLog (staleness detection)
        └── AnomalyDetectionRun (trigger: snapshot_created)
              └── Anomaly[] (rules: VelocityCliff, WIPOverload, etc.)
                    └── CopilotSuggestion (surface no Copilot)
```

### 4.7 AI Copilot RAG

```
Epic.descriptionMd + title  →  PIKnowledgeVector (embed, chunk)
Feature.title               →  PIKnowledgeVector
Risk.description            →  PIKnowledgeVector
PIObjective.title           →  PIKnowledgeVector
OKR.title + description     →  PIKnowledgeVector
Document upload             →  PIKnowledgeVector (sourceId = null)

CopilotSession message
  → embed(query)
    → pgvector cosine search (threshold 0.75)
      → top-k chunks → Claude context
```

---

## 5. Rotas da Aplicação

```
/(authenticated)/
  analytics/
    flow/                — 6 Flow Metrics dashboard
    measure-grow/        — KPIs / Measure & Grow
    velocity/            — velocity charts
  arts/[artId]/
    pi-planning/         — PI Planning workspace
    pre-pi/              — Pre-PI checklist
    post-pi/             — Post-PI review
    program-board/       — Program Board (features por time)
    impediments/         — Impedimentos do ART
  copilot/               — Copilot fullscreen
  onboarding/
    company/             — Setup inicial da empresa
    migration/           — Import de ferramentas externas
  pi-planning/           — PI Planning global
  portfolio/
    budgets/             — Lean Budget management
    epics/               — Kanban de Portfólio
  settings/
    integrations/        — Configuração de conectores
    members/             — Gestão de membros
    workspace/           — Config do workspace
  solution-trains/[stId]/ — Large Solution Train
  suppliers/             — Gestão de fornecedores
```

---

## 6. Server Actions por Domínio

```
actions/
  arts/         — confidence-vote, get-arts, observability, pi-plans, risks
  audit/        — log de auditoria
  billing/      — snapshots, tag-rules
  capabilities/ — CRUD capabilities (LST)
  defects/      — CRUD defects
  dependencies/ — dependency links
  epics/        — create, update, update-status, get-portfolio, portfolio-cache
  features/     — CRUD, update-wsjf
  flow-intelligence/ — anomaly detection
  flow-metrics/ — snapshot creation, staleness
  governance/   — governed epics, approval workflows
  impediments/  — CRUD impediments
  integrations/ — connectors/github, connectors/linear, linear-import
  lace/         — BPMN workflows
  lean-budget/  — CRUD budgets
  measure-grow/ — KPI tracking
  notifications/ — CRUD notifications
  okrs/         — CRUD OKRs, key results
  onboarding/   — progress tracking
  portfolio-kanban/ — kanban view actions
  program-board/ — program board view
  retrospective/ — CRUD retrospectives
  risks/        — CRUD risks, ROAM
  roadmap/      — roadmap items
  safe-copilot/ — AI tools, pricing tools (AWS/GCP)
  settings/     — integrations, workspace
  solution-epics/ — CRUD solution epics
  solution-trains/ — CRUD solution trains
  sprint-review/ — CRUD sprint reviews
  sprints/      — CRUD sprints
  standup/      — daily standup
  stories/      — CRUD stories
  strategic-themes/ — CRUD themes
  strategy-map/ — strategy map canvas
  suppliers/    — CRUD suppliers
  tasks/        — CRUD tasks
  teams/        — CRUD teams
  users/        — user management
  velocity/     — velocity metrics
  wsjf/         — WSJF scoring
```

---

## 7. Points of Attention

### 🔴 Críticos (risco direto de dados ou UX)

#### P01 — `Team.members` JSON deprecated mas não removido

```prisma
members Json? // [{name, role, skills, hoursPerWeek}] @deprecated
```

O modelo `TeamMemberAssignment` substituiu esse campo, mas `Team.members` ainda
existe no schema. Se há qualquer leitura de `Team.members` no código de capacity
planning enquanto escritas vão para `TeamMemberAssignment`, os dados de capacidade
divergem silenciosamente.

**Impacto:** Cálculos de capacity snapshot e synergy detection incorretos.
**Ação:** Auditar todos os `team.members` reads no codebase e migrar.

---

#### P02 — `BillingEntry.syncLogId` sem FK formal

```prisma
syncLogId String? // optional reference to SyncLog.id — not a formal FK relation
```

Referência sem constraint. Se SyncLog for deletado, BillingEntry não limpa.
Queries que fazem join explícito nesse campo podem retornar null inesperado.

**Impacto:** Relatórios de auditoria de sync com dados órfãos.
**Ação:** Adicionar FK formal ou documentar que é referência soft.

---

#### P03 — `Feature/Story.externalId` sem FK para `Integration`

Os campos `externalId`, `externalSource`, `externalUrl` em Feature e Story são
strings livres — não há FK para a tabela `Integration`. Se uma Integration for
deletada (ou desativada), as features/stories ficam com `externalSource` apontando
para algo que não existe mais.

**Impacto:** Sync logic pode tentar reconectar a uma integration deletada.
**Ação:** Adicionar soft-delete check na integration antes de usar externalSource.

---

#### P04 — `Epic` sem FK direto para ART ou PIPlan

Para saber "em qual PI um Epic está", o caminho é:
`Epic → Feature[] → Feature.piPlanId → PIPlan`

Não existe `Epic.piPlanId`. Se um Epic tem zero Features, não há como localizá-lo
em nenhum PI via banco — apenas pelo StrategicTheme. Isso complica relatórios de
portfolio-level PI progress.

**Impacto:** Dashboard de Portfolio Kanban precisa de agregações complexas.
**Ação:** Avaliar se `Epic.piPlanId?` faz sentido como field direto ou aceitar o custo da agregação.

---

#### P05 — `OKR` links polimórficos sem constraint de "exatamente um"

```prisma
piPlanId         String?
strategicThemeId String?
epicId           String?
artId            String?
teamId           String?
```

O tipo do OKR (`portfolio_theme`, `pi_art`, etc.) determina qual FK deve estar
preenchido, mas o banco não impõe essa regra — é validação apenas na camada de
aplicação (Zod schema).

**Impacto:** OKRs com múltiplos links preenchidos ou nenhum link geram
inconsistências nos dashboards de rastreamento.
**Ação:** Adicionar `@@validate` ou constraint CHECK no banco, ou validação
explícita no Zod schema com `superRefine`.

---

### 🟡 Importantes (risco de consistência ou débito técnico)

#### P06 — `GovernedEpic` é opcional: nem todo Epic é governado

Não há constraint que force criação de `GovernedEpic` para todo Epic. Se o
fluxo de governança for mandatório no produto, a ausência de `GovernedEpic`
significa que Epics podem "escapar" do processo.

**Impacto:** Portfólio sem controle completo.
**Ação:** Criar `GovernedEpic` automaticamente em `onCreate` do Epic, ou documentar explicitamente que governança é opt-in.

---

#### P07 — Três representações de `spent` em `LeanBudget`

```prisma
spent              Float    @default(0)          // legado
spentDecimal       Decimal? @db.Decimal(18,6)    // precisão
spentManualOverride Decimal? @db.Decimal(18,6)   // override manual
```

Três campos para a mesma semântica. A migração `cebd80d` sugere transição em
andamento de `Float` para `Decimal`. UI pode estar lendo `spent` (Float) enquanto
o backend escreve em `spentDecimal`.

**Impacto:** Discrepâncias de centavos em display de orçamento.
**Ação:** Completar a migração — deprecate `spent Float`, usar apenas `spentDecimal`.

---

#### P08 — `CopilotMessage.tenantId` denormalizado

`CopilotMessage` tem `tenantId` próprio, mas já pertence a `CopilotSession` que
tem `tenantId`. Dado duplicado. Escritas precisam manter ambos em sync.

**Impacto:** Se `CopilotSession.tenantId` divergir de `CopilotMessage.tenantId`,
queries de isolamento por tenant (RLS / where clause) retornam inconsistente.
**Ação:** Ou remover `tenantId` de `CopilotMessage` (usar join via sessionId) ou garantir write sempre via session.

---

#### P09 — `PIKnowledgeVector.embedding` é `Unsupported("vector(1536)")`

```prisma
embedding Unsupported("vector(1536)")?
```

Prisma não suporta nativamente o tipo `vector`. Toda query de similaridade
cosine é raw SQL fora do type system do Prisma. Erros de tipo no vector search
só aparecem em runtime.

**Impacto:** Sem type safety em queries de RAG. Bugs difíceis de detectar sem E2E tests.
**Ação:** Manter testes de integração que exercitem o path de RAG com assert no formato do resultado.

---

#### P10 — `ConfidenceVoteSession.votes` é `Json number[]` — sem audit por votante

```prisma
votes Json @default("[]") // number[] — raw vote values
```

Não há registro de quem votou o quê — apenas os valores. SAFe formaliza votação
com Fist-to-Five por pessoa. Se o produto quiser mostrar "quem votou 3" não é
possível sem mudar o modelo.

**Impacto:** Sem rastreabilidade de voto individual.
**Ação:** Se auditoria de voto for requisito, criar `ConfidenceVote` (voteId, sessionId, userId, value) como modelo separado.

---

#### P11 — `PersonSkillProfile` sem FK para `Team`

```prisma
model PersonSkillProfile {
  userId    String
  competency String
  // sem teamId
}
```

`CompetencyAssessment` é team/ART-scoped. `PersonSkillProfile` é pessoa-scoped
mas não tem FK para `Team`. Para agregar "perfil individual → competência do
time", é necessário ir via `TeamMemberAssignment.userId` — join indireto.

**Impacto:** Queries de análise de skills por time são custosas.
**Ação:** Adicionar `teamId?` ao `PersonSkillProfile` para queries diretas.

---

#### P12 — `StrategicTheme.budgetTotal` vs `LeanBudget` — dupla representação

```prisma
model StrategicTheme {
  budgetTotal Float?   // intent total do tema
}
model LeanBudget {
  themeId String?
  amount  Float        // alocação por período
}
```

`budgetTotal` no Theme é um número único (total). `LeanBudget` pode ter múltiplos
registros por tema (por período, por ART). Não há garantia de que a soma dos
`LeanBudget.amount` por tema iguale `StrategicTheme.budgetTotal`.

**Impacto:** Dashboards de budget podem mostrar números inconsistentes.
**Ação:** Definir `budgetTotal` como computed field (soma dos LeanBudgets) ou enforced via aplicação.

---

#### P13 — `Retrospective.wentWell/toImprove/actions` são JSON sem schema

```prisma
wentWell  Json @default("[]")
toImprove Json @default("[]")
actions   Json @default("[]")
```

Estrutura dos itens de retro não é tipada no banco. Análise AI sobre dados de
retro requer parsing com fallback para qualquer shape.

**Impacto:** Dificuldade em construir analytics de retro (ex: temas recorrentes).
**Ação:** Documentar e enforcer schema via Zod no server action de escrita.

---

### 🟢 Observações Arquiteturais

#### O01 — `FlowMetricSnapshot` com staleness tracking sofisticado

O modelo inclui `isArchived`, `lastStalenessCheck`, `reevaluatedAt`, `reevaluatedBy`.
O `StalenessAuditLog` rastreia transições de estado de staleness. A cadeia
`FlowMetricSnapshot → AnomalyDetectionRun → Anomaly → Copilot` significa que a
qualidade da intelligence do Copilot é diretamente dependente da frescura dos
snapshots. Snapshots stale = anomaly detection degradada.

#### O02 — `LinearSync` como tabela de mapeamento bidirecional

Elegante design para resolver o problema de identity mapping entre sistemas.
O risco é que conflitos de sync (Linear atualiza E Cosmos atualiza o mesmo
item simultaneamente) são resolvidos na camada de aplicação — não há versionamento
ou conflict resolution no banco.

#### O03 — CRDT em Epic via Yjs (`yjsDocumentState`)

```prisma
yjsDocumentState String? // CRDT document state para sync Yjs
```

Edição colaborativa real-time de Epics via Liveblocks (Yjs). O estado CRDT é
persistido como string no banco. Isso funciona bem para recovery mas o campo pode
crescer indefinidamente conforme o histórico CRDT acumula.

#### O04 — `PIKnowledgeVector` suporta uploads de documentos (`sourceId = null`)

Além de entidades do sistema, o RAG aceita uploads de documentos externos
(PRDs, specs, playbooks). `sourceId = null` quando é upload manual. Isso é um
diferencial — o Copilot pode responder sobre documentos do cliente.

#### O05 — Synergy Detection via `TaskAssignee` + `PairSynergy`/`GroupSynergy`

O sistema detecta padrões de colaboração eficiente entre pessoas com base em
`TaskAssignee.role` (primary/reviewer/pair) + `taskType` + performance. Isso
alimenta recomendações de composição de time. É uma feature não-óbvia com alto
valor percebido em produtos de gestão de times.

---

## 8. Resumo Executivo de Entidades

| Domínio | Entidades Principais | Entidades de Suporte |
|---|---|---|
| Foundation | Tenant, User, TenantMember | Session, Account, TenantInvitation |
| Portfolio | StrategicTheme, Epic, OKR | KeyResult, LeanBudget, RoadmapItem, ThemeART |
| ART Core | ART, Team, PIPlan, Feature | Risk, DependencyLink, RiskOKR |
| PI Planning | PIObjective, PISession, ConfidenceVoteSession | PIParticipant, PIKnowledgeVector |
| Team Delivery | Sprint, Story, Task | Defect, Impediment, StandupEntry, Retrospective, SprintReview, TaskAssignee |
| Governance | GovernedEpic, ApprovalRequest | ApprovalWorkflow, ApprovalStepInstance, DecisionLogEntry |
| Flow Analytics | FlowMetricSnapshot, CompetencyAssessment | ImprovementAction, StateTransitionHistory |
| Flow Intelligence | AnomalyDetectionRun, Anomaly | TeamMemberAssignment, MemberSprintMetrics, PairSynergy, GroupSynergy |
| Copilot | CopilotSession, CopilotMessage | — |
| FinOps | BillingEntry, Integration, LeanBudget | BillingEntryAllocation, CostSnapshot, BillingSyncCursor, SyncLog |
| Large Solution | SolutionTrain, Capability, SolutionEpic | — |
| Integrations | LinearSync | MigrationConnection |
| System | AuditLog, Notification | OnboardingProgress |

**Total de modelos Prisma:** ~65 entidades

---

*Gerado em 2026-05-25. Branch: `feat/kanban-portfolio-ai`.*
