# PI_PLANNING_WORKSPACE – Workspace de PI Planning do ART

## 1. Propósito

O **Workspace de PI Planning** do COSMOS é o ambiente único onde:

- todos os times de um ART (ou Solution Train) planejam o próximo PI de forma colaborativa;
- visão de negócio, roadmap, capacidades, dependências e riscos são visualizados em tempo real;
- artefatos de saída do PI Planning (Objetivos, Program Board, riscos ROAM, compromissos e confidence vote) ficam consolidados.

Suporta PI Planning presencial, remoto e híbrido, seguindo a cadência de 8–12 semanas do SAFe.

---

## 2. Escopo do Workspace

### 2.1. Nível de atuação

- Nível: **ART / Solution Train**.
- Horizonte: 1 **Program Increment (PI)** (ex.: 10 semanas, 5 iterações).
- Participantes: RTE, Product Management, System Architect, times ágeis, stakeholders, Business Owners.

### 2.2. Artefatos cobertos

| Artefato | Descrição |
|---|---|
| **Contexto do PI** | Visão de negócio, roadmap, objetivos de portfólio/tema estratégico, capacidades/épicos prioritários |
| **Team Breakout** | Planejamento de sprints por time (stories, carga, capacidade) |
| **Program Board** | Features/capabilities por iteração/time; dependências entre times; marcos/milestones |
| **Objetivos de PI** | Objetivos de time e ART; classificação committed/stretch |
| **Riscos ROAM** | Captura, categorização, dono e status (Resolved, Owned, Accepted, Mitigated) |
| **Confidence Vote** | Votação 1–5 por time e ART; registro de resultado |

---

## 3. Estrutura visual do Workspace

### 3.1. Layout macro

```
┌─────────────────────────────────────────────────────────────────┐
│  Header: [ART selector] [PI selector] [datas] [status] [ações]  │
├─────────────────────────────────────────────────────────────────┤
│  Tabs: Contexto│Team Breakout│Program Board│Objetivos│Riscos│Vote│
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│                    [conteúdo da aba ativa]                       │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2. Tabs do workspace

- `Contexto & Agenda`
- `Team Breakout`
- `Program Board`
- `Objetivos de PI`
- `Riscos (ROAM)`
- `Resumo & Confidence Vote`

---

## 4. Team Breakout – Planejamento por Time

### 4.1. Backlog de PI do Time

Para cada time:
- Lista de features/capabilities selecionadas para o PI.
- Story backlog por iteração (Sprint 1..N): histórias, estimativas, carga por sprint, capacidade planejada vs usada.
- Integração com Sprint Kanban do time (board de execução).

### 4.2. Dados por sprint

| Dado | Descrição |
|---|---|
| Capacidade | Horas, story points ou FTEs por sprint |
| Carga planejada | Total de pontos/horas comprometidos |
| Velocidade histórica | Média de entregas dos últimos PIs |
| Indicador load | Visual de over/underload (barra colorida, heatmap) |

---

## 5. Program Board – Features, Dependências e Marcos

### 5.1. Estrutura

- **Eixo X**: Iterações do PI (Sprint 1..N + IP Iteration).
- **Eixo Y**: Times do ART.
- **Cards**: Features/Capabilities planejadas por time e sprint.
- **Dependências**: linhas/setas conectando cards de times/sprints diferentes.
- **Milestones**: marcadores no topo (diamantes) em iterações específicas.

### 5.2. Lógica de dependências

| Campo | Descrição |
|---|---|
| `requesting_team` | Time que precisa da entrega |
| `providing_team` | Time responsável por entregar |
| `related_feature` | Feature ou épico associado |
| `needed_by_iteration` | Quando o time solicitante precisa |
| `commitment_iteration` | Quando o time fornecedor promete |

**Conflito**: `commitment_iteration > needed_by_iteration` → destaque vermelho + warning.

---

## 6. Objetivos de PI

### 6.1. Objetivos do Time

Por time:
- Lista de objetivos qualitativos.
- Tipo: `committed` ou `uncommitted/stretch`.
- Link para features/stories do plano.
- Medidas de sucesso (KRs ou indicadores).

### 6.2. Objetivos de ART

- Resumo consolidado dos objetivos do ART.
- Visibilidade de PI Objectives no nível de programa.

---

## 7. Riscos Program-Level com ROAM

### 7.1. Captura e categorização

| Campo | Descrição |
|---|---|
| `descricao` | Descrição clara do risco |
| `nivel` | `team` ou `program` |
| `dono` | Responsável pelo risco |
| `data_alvo` | Data limite para resolução/mitigação |
| `status_roam` | `resolved`, `owned`, `accepted`, `mitigated` |
| `links` | Features/épicos/objetivos relacionados |

### 7.2. Integração com execução

Riscos program-level migrados para:
- roadmap de riscos do ART;
- relatórios de Scrum of Scrums / ART Sync durante o PI.

---

## 8. Confidence Vote e saída do PI Planning

### 8.1. Confidence Vote

- **Por time**: votação 1–5 (fingers) + comentário; registro de média.
- **Por ART**: votação consolidada; se confiança baixa → replanejamento facilitado pelo RTE.

### 8.2. Artefatos finais

- Program Board final (features, dependências, milestones).
- Objetivos de PI por time e ART.
- Riscos ROAM com donos e planos.
- Registros de capacity/load por sprint/time.
- Resultado do confidence vote e decisões associadas.

---

## 9. Integrações com outros módulos do COSMOS

| Módulo | Integração |
|---|---|
| ART / Teams / PIs | Workspace criado para cada combinação ART + PI |
| Backlog & Sprint Kanban | Stories do plano refletidas no board de execução |
| OKRs e Temas Estratégicos | Objetivos de PI mapeados para OKRs de PI/Time |
| Lean Budget | Program Board filtrado por value stream e custo associado |

---

## 10. Frontend – Arquitetura de Componentes

### 10.1. Hierarquia de componentes

```
PiPlanningWorkspace               ← Client Component (hub de estado)
├── PiHeader                      ← seletor ART/PI, datas, status, ações globais
├── PiTabNav                      ← navegação por abas (Radix Tabs)
│
├── [tab: Contexto]
│   └── ContextAgendaView         ← Server Component inicial, editável client-side
│       ├── BusinessContextEditor
│       ├── ProductVisionEditor
│       └── AgendaTimeline
│
├── [tab: Team Breakout]
│   └── TeamBreakoutView          ← grade de times
│       └── TeamBreakoutPanel (× N times)
│           ├── TeamCapacityBar   ← load vs capacity visual
│           └── SprintLane (× N sprints)
│               └── StoryCard (draggable – @dnd-kit)
│
├── [tab: Program Board]
│   └── ProgramBoard              ← componente mais complexo (ver 10.3)
│       ├── ProgramBoardGrid
│       ├── FeatureCard (× N, memo)
│       ├── DependencyOverlay     ← SVG sobre o grid
│       └── MilestoneMarkers
│
├── [tab: Objetivos]
│   └── PiObjectivesView
│       ├── TeamObjectivesPanel (× N)
│       └── ArtObjectivesSummary
│
├── [tab: Riscos]
│   └── RoamBoard                 ← 4 quadrantes drag-and-drop
│       └── RiskCard (draggable – @dnd-kit)
│
└── [tab: Vote]
    └── ConfidenceVotePanel
        ├── TeamVoteCard (× N)
        └── ArtVoteSummary
```

### 10.2. Estratégia de dados

```typescript
// Workspace carrega dados críticos no server (layout shift zero)
export default async function PiPlanningWorkspace({ params }: Props) {
  const [workspace, teams, features] = await Promise.all([
    getPiWorkspace(params.piId),
    getArtTeams(params.artId),
    getPiFeatures(params.piId),
  ])
  return <PiPlanningClient workspace={workspace} teams={teams} features={features} />
}

// Estado mutável durante o evento → React Query com WebSocket invalidation
const { data: dependencies } = useQuery({
  queryKey: ['dependencies', piId],
  queryFn: () => getPiDependencies(piId),
  staleTime: 5_000,   // board é colaborativo; dados ficam stale rápido
  refetchInterval: 10_000,
})
```

### 10.3. Program Board – Implementação

O Program Board é o componente mais crítico de performance do workspace. Considerações:

**DnD**: usar `@dnd-kit/core` (acessível, sem scroll-jank) para arrastar `FeatureCard` entre células `(team, sprint)`.

**Dependências (SVG overlay)**:
```typescript
// DependencyOverlay usa refs das células do grid para calcular coordenadas
export function DependencyOverlay({ dependencies, cellRefs }: Props) {
  return (
    <svg className="pointer-events-none absolute inset-0 z-10">
      {dependencies.map(dep => {
        const from = cellRefs[`${dep.providingTeam}-${dep.commitmentIteration}`]?.current
        const to   = cellRefs[`${dep.requestingTeam}-${dep.neededByIteration}`]?.current
        if (!from || !to) return null
        const conflict = dep.commitmentIteration > dep.neededByIteration
        return <DependencyArrow key={dep.id} from={from} to={to} conflict={conflict} />
      })}
    </svg>
  )
}
```

**Memoização agressiva** — cada `FeatureCard` renderiza apenas quando suas props mudam:
```typescript
export const FeatureCard = React.memo<FeatureCardProps>(({ feature, isDragging }) => (
  <div className={cn('feature-card', isDragging && 'opacity-50 ring-2 ring-blue-500')}>
    <span>{feature.title}</span>
    <TeamBadge team={feature.team} />
  </div>
))
FeatureCard.displayName = 'FeatureCard'
```

### 10.4. State management – Workspace

```typescript
// Estado global do workspace via Context + Reducer
// (evita prop-drilling em árvore profunda de abas/painéis)

type WorkspaceAction =
  | { type: 'MOVE_FEATURE'; featureId: string; teamId: string; sprintId: string }
  | { type: 'ADD_DEPENDENCY'; dep: DependencyDraft }
  | { type: 'ROAM_RISK'; riskId: string; status: RoamStatus }
  | { type: 'SUBMIT_VOTE'; teamId: string; score: number; comment: string }
  | { type: 'SET_TAB'; tab: WorkspaceTab }

function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case 'MOVE_FEATURE':
      return {
        ...state,
        features: state.features.map(f =>
          f.id === action.featureId
            ? { ...f, teamId: action.teamId, sprintId: action.sprintId }
            : f
        ),
      }
    case 'ROAM_RISK':
      return {
        ...state,
        risks: state.risks.map(r =>
          r.id === action.riskId ? { ...r, status: action.status } : r
        ),
      }
    // ...
    default:
      return state
  }
}
```

### 10.5. RoamBoard – Quadrantes DnD

```typescript
const ROAM_QUADRANTS: RoamStatus[] = ['resolved', 'owned', 'accepted', 'mitigated']

export function RoamBoard({ risks }: { risks: Risk[] }) {
  const { dispatch } = useWorkspace()

  return (
    <DndContext onDragEnd={({ active, over }) => {
      if (over) dispatch({ type: 'ROAM_RISK', riskId: active.id as string, status: over.id as RoamStatus })
    }}>
      <div className="grid grid-cols-2 gap-4">
        {ROAM_QUADRANTS.map(status => (
          <RoamQuadrant key={status} status={status} risks={risks.filter(r => r.status === status)} />
        ))}
      </div>
    </DndContext>
  )
}
```

### 10.6. ConfidenceVotePanel

- Cada time vota 1–5 com slider ou botões de "mão" (icons).
- Resultado do time exibido em tempo real (média + breakdown).
- ART vote summary usa `aria-live="polite"` para anunciar quando novo voto entra.
- Botão "Reabrir planejamento" habilitado se média ART < 3 (configurable threshold).

```typescript
function ArtVoteSummary({ votes }: { votes: TeamVote[] }) {
  const avg = votes.reduce((sum, v) => sum + v.score, 0) / votes.length
  const needsReplanning = avg < 3

  return (
    <div role="status" aria-live="polite">
      <span>Média ART: {avg.toFixed(1)} / 5</span>
      {needsReplanning && (
        <Alert variant="warning">Confiança baixa — considere replanejamento.</Alert>
      )}
    </div>
  )
}
```

### 10.7. Performance – Code splitting

```typescript
// Program Board é pesado (DnD + SVG + muitos cards) — carrega lazy
const ProgramBoard    = lazy(() => import('./ProgramBoard'))
const RoamBoard       = lazy(() => import('./RoamBoard'))
const ConfidenceVote  = lazy(() => import('./ConfidenceVotePanel'))

// Cada tab monta seu componente só ao ser acessada pela primeira vez
```

### 10.8. Acessibilidade

- `PiTabNav` usa `role="tablist"` / `role="tab"` / `aria-selected` (Radix Tabs já fornece).
- `ProgramBoard` expõe modo de tabela alternativo (`role="grid"`) para usuários sem mouse.
- `@dnd-kit` suporta DnD via teclado nativamente; garantir `aria-describedby` nos draggables explicando o shortcut (Space para pegar, setas para mover, Enter para soltar).
- `RoamBoard` quadrantes com `aria-label="Resolved – N riscos"`.
- `ConfidenceVotePanel` botões de voto com `aria-label="Votar X de 5"`.
- Erros de dependência conflitante com `role="alert"` para leitura imediata.
