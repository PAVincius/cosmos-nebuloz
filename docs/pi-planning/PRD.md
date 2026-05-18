# PRD – Feature: Workspace de PI Planning (ART/PI)

## 1. Visão Geral

### 1.1. Resumo

A feature **"Workspace de PI Planning"** fornece um ambiente integrado para planejar Program Increments em nível de ART no COSMOS, cobrindo:

- contexto do PI (visão, roadmap, objetivos de negócio);
- planejamento de iterações por time (Team Breakout);
- Program Board com features, dependências e milestones;
- objetivos de PI (time e ART);
- riscos program-level com ROAM;
- confidence vote e consolidação dos artefatos de saída.

### 1.2. Contexto SAFe

PI Planning é o evento central do SAFe (cadência 8–12 semanas) onde ARTs alinham times e stakeholders a uma missão e plano compartilhado. Saídas esperadas:

- plano do PI (features por sprint/time);
- objetivos de PI;
- riscos identificados e tratados;
- visão clara de dependências e milestones;
- voto de confiança do ART.

---

## 2. Problema / Oportunidade

### 2.1. Problema

- Ferramentas atuais (Jira + Miro + Excel + slides) fragmentam PI Planning em múltiplos lugares.
- Program Board, dependências e riscos ficam pouco rastreáveis após o evento.
- Manter o plano vivo durante o PI é trabalhoso, especialmente em remoto/híbrido.

### 2.2. Oportunidade

Um workspace único de PI Planning:
- reduz atrito entre planejamento e execução;
- mantém Program Board, objetivos e riscos integrados com backlogs e Kanbans;
- cria narrativa forte de mercado para o COSMOS como "o lugar onde o PI realmente acontece".

---

## 3. Objetivos e Métricas de Sucesso

### 3.1. Objetivos

- Permitir que um ART conduza PI Planning completo dentro do COSMOS (presencial/remoto).
- Gerar automaticamente artefatos padrão de saída (Program Board, objetivos, riscos ROAM, confidence vote).
- Conectar o plano do PI a execução (Kanban, dashboards de fluxo).

### 3.2. Métricas

- Nº de ARTs usando workspace vs ferramentas externas.
- Tempo médio para consolidar o plano do PI (início → "PI committed").
- Taxa de riscos program-level com dono e status ROAM definido ao final do evento.
- NPS de RTEs/POs sobre a experiência de PI Planning no COSMOS.

---

## 4. Escopo

### 4.1. IN (versão inicial)

- Criação automática de workspace para cada ART + PI.
- Visões: Contexto & Agenda, Team Breakout, Program Board, Objetivos de PI, Riscos ROAM, Confidence Vote.
- Integração com sprint boards, backlog de features/capabilities e OKRs de PI/time.

### 4.2. OUT (posterior)

- Colaboração avançada (cursor-presence, sticky-notes em tempo real tipo Miro).
- Simulações de capacidade ("what-if" de redistribuição de carga entre times).
- AI assistant para sugerir riscos, dependências e perfis de carga.

---

## 5. Personas e Casos de Uso

### 5.1. Personas

| Persona | Necessidade principal |
|---|---|
| **RTE** | Facilitar PI Planning; visão integrada do ART; gerenciar riscos e dependências |
| **Product Management** | Apresentar contexto de negócio e priorizar features para o PI |
| **System Architect** | Trazer arquitetura e NFRs; identificar dependências técnicas |
| **Times ágeis** | Planejar iterações, identificar dependências, definir objetivos de PI |
| **Business Owners** | Avaliar comprometimento e risco para o negócio |

### 5.2. Casos de Uso

1. RTE cria/abre workspace do PI para um ART.
2. POs/PMs apresentam contexto, visão e roadmap no workspace.
3. Times fazem Team Breakout, planejam sprints e levantam dependências.
4. RTE e times constroem Program Board (features, dependências, milestones).
5. Riscos program-level são capturados e classificados via ROAM.
6. Times definem objetivos de PI e o ART faz o confidence vote.
7. Plano final é "congelado" como baseline para uso durante o PI.

---

## 6. Fluxos (alto nível)

### 6.1. Abertura do Workspace

1. RTE seleciona ART e período do PI.
2. Sistema solicita: nº de iterações, datas, opção de copiar contexto do PI anterior.
3. COSMOS cria workspace com estrutura base.

### 6.2. Contexto & Agenda

1. Product Management preenche: business context, visão & roadmap, features/capabilities candidatas.
2. RTE configura agenda (slots de apresentação, breakouts, riscos, confidence vote).

### 6.3. Team Breakout

1. Cada time acessa sua área: vê features do PI, arrasta para sprints, explode em stories.
2. Times ajustam capacidade por sprint (override ou baseado em histórico).
3. Sistema mostra load vs capacity com highlight de over/underload.

### 6.4. Program Board

1. COSMOS projeta cards de features por time/sprint a partir dos planos de Team Breakout.
2. Usuários criam/editam dependências com campos obrigatórios.
3. Conflitos (needed-by vs committed) são destacados automaticamente.

### 6.5. Objetivos de PI

1. Cada time define objetivos committed + stretch, vinculando a features/stories/OKRs.
2. RTE/PM consolidam objetivos de ART.

### 6.6. Riscos ROAM e Confidence Vote

1. Times e RTE registram riscos program-level, categorizam em ROAM com dono e data alvo.
2. Cada time realiza confidence vote 1–5; RTE facilita ajuste se confiança baixa.
3. Resultado e comentários são logados e vinculados ao plano do PI.

---

## 7. Requisitos Funcionais

| RF | Descrição |
|---|---|
| **RF-01** | Criar `PiWorkspace` por combinação (ART, PI) com datas, nº de iterações e participantes |
| **RF-02** | Cadastrar business context, visão, roadmap de PI e agenda de PI Planning |
| **RF-03** | Por time: visualizar features do PI, planejar histórias por sprint, informar capacidade, ver load vs capacity |
| **RF-04** | Gerar Program Board (times × sprints); CRUD de dependências (requesting team, providing team, needed-by, committed); ícones de milestone; highlight de conflitos |
| **RF-05** | Cadastrar Objetivos de PI por time e ART (tipo committed/stretch; links a features/stories/OKRs) |
| **RF-06** | Registrar riscos program-level com descrição, owner, impacto, categoria ROAM, data alvo; board com quadrantes arrastáveis |
| **RF-07** | Registrar votação de confiança por time (1–5 + comentário); calcular médias; registrar histórico por PI |
| **RF-08** | Ao finalizar PI Planning: congelar workspace (leitura); sincronizar plano com backlogs/sprint boards/dashboards |

---

## 8. Requisitos Não Funcionais

| Atributo | Requisito |
|---|---|
| **Usabilidade** | Interface otimizada para uso intenso durante 2 dias (poucos cliques, legibilidade) |
| **Colaboração** | Múltiplos usuários simultâneos no workspace com baixa latência (< 500ms para operações de DnD e ROAM) |
| **Resiliência** | Auto-save frequente (a cada mudança + debounce 2s) para evitar perda de dados durante o evento |
| **Performance** | Program Board com 10 times × 5 sprints × 50+ features deve renderizar sem jank; DnD smooth 60fps |
| **Acessibilidade** | WCAG 2.1 AA; DnD operável por teclado; modo tabela alternativo para Program Board |

---

## 9. Dependências

- Módulos de ART/PI/Teams definidos no COSMOS.
- Módulo de backlog e sprint boards dos times.
- Módulos de OKRs e Lean Budget para integrações.

---

## 10. Riscos e Mitigações

| Risco | Mitigação |
|---|---|
| Complexidade de UI para PI Planning remoto | V1 mais simples (Program Board + Team Breakout + Riscos); colaboração avançada em V2 |
| Duplicidade com ferramentas visuais (Miro/Mural) | Focar na vantagem de dados vivos integrados (boards, dependências, riscos e objetivos em um só lugar) |
| Performance do Program Board com muitos times/features | Memoização agressiva de `FeatureCard`; SVG overlay para dependências (não DOM); lazy mount por tab |
| Conflitos de edição simultânea em colaboração | Otimistic updates + invalidação por WebSocket/polling; mostrar "editado por [user]" em conflito |

---

## 11. Critérios de Aceitação

1. RTE consegue criar workspace de PI, configurar datas e ver contexto/agenda.
2. Times planejam suas sprints no Team Breakout com load vs capacity visível.
3. Program Board mostra features, dependências e milestones; conflitos destacados em vermelho.
4. Objetivos de PI e riscos ROAM são registrados e consultáveis após o evento.
5. Confidence vote é registrado e vinculado ao plano final do PI.

---

## 12. Especificações de Frontend

### 12.1. Telas e componentes

#### Workspace Principal

| Componente | Tipo | Responsabilidade |
|---|---|---|
| `PiPlanningWorkspace` | Client Component | Hub central de estado via Context + Reducer |
| `PiHeader` | Client Component | Seletor ART/PI, datas, status (draft/active/completed), ações (finalizar PI, exportar) |
| `PiTabNav` | Client Component | Radix Tabs com `role="tablist"` / `aria-selected` |

#### Aba: Contexto & Agenda

| Componente | Tipo | Responsabilidade |
|---|---|---|
| `ContextAgendaView` | Server Component | Carrega contexto inicial; sub-seções editáveis client-side |
| `BusinessContextEditor` | Client Component | Rich text editável (business context dos BOs) |
| `ProductVisionEditor` | Client Component | Visão + roadmap de features candidatas |
| `AgendaTimeline` | Client Component | Blocos de tempo do evento (2 dias); arrastar para reordenar |

#### Aba: Team Breakout

| Componente | Tipo | Responsabilidade |
|---|---|---|
| `TeamBreakoutView` | Client Component | Accordion de times; cada time expande sua área |
| `TeamBreakoutPanel` | Client Component | Visão de sprints + features + capacidade de um time |
| `TeamCapacityBar` | Client Component | Barra visual load vs capacity (verde/âmbar/vermelho) |
| `SprintLane` | Client Component | Droppable lane; recebe `FeatureCard` via @dnd-kit |
| `StoryCard` | Client Component (memo) | Card de story; draggable entre lanes |

#### Aba: Program Board

| Componente | Tipo | Responsabilidade |
|---|---|---|
| `ProgramBoard` | Client Component (lazy) | Grid times × sprints; gerencia posições e dependências |
| `ProgramBoardGrid` | Client Component | Tabela CSS grid; células são Droppable |
| `FeatureCard` | Client Component (memo) | Card draggável; exibe time, sprint, title, indicadores |
| `DependencyOverlay` | Client Component | SVG absoluto sobre grid; desenha setas entre cards |
| `DependencyArrow` | Client Component | Seta individual; `stroke-red-500` se conflito |
| `MilestoneMarker` | Client Component | Ícone diamante na linha de header por sprint |
| `DependencyForm` | Client Component | Formulário inline ao criar/editar dependência |

#### Aba: Objetivos de PI

| Componente | Tipo | Responsabilidade |
|---|---|---|
| `PiObjectivesView` | Client Component | Lista de painéis por time + painel ART |
| `TeamObjectivesPanel` | Client Component | Objectives committed/stretch; formulário inline |
| `ArtObjectivesSummary` | Client Component | Consolidado de objectives de ART |

#### Aba: Riscos (ROAM)

| Componente | Tipo | Responsabilidade |
|---|---|---|
| `RoamBoard` | Client Component (lazy) | 2×2 grid; cada quadrante é Droppable |
| `RoamQuadrant` | Client Component | Quadrante (Resolved/Owned/Accepted/Mitigated) |
| `RiskCard` | Client Component (memo) | Card draggável; exibe dono, data, severidade |
| `RiskForm` | Client Component | Formulário de captura de risco + campos ROAM |

#### Aba: Vote

| Componente | Tipo | Responsabilidade |
|---|---|---|
| `ConfidenceVotePanel` | Client Component (lazy) | Orquestra votos por time + summary ART |
| `TeamVoteCard` | Client Component | Botões 1–5 (mão/fingers); campo de comentário |
| `ArtVoteSummary` | Client Component | Média geral; badge de status; botão replanejamento se < 3 |

### 12.2. Estado do workspace

```
PiPlanningWorkspace (Context + Reducer)
├── Server state (React Query)
│   ├── workspace metadata     (staleTime: 60s)
│   ├── features & placements  (staleTime: 5s — colaborativo)
│   ├── dependencies           (staleTime: 5s)
│   ├── risks                  (staleTime: 10s)
│   └── votes                  (staleTime: 10s)
│
└── UI state (workspaceReducer)
    ├── tab ativa
    ├── features em memória (posições otimistas antes de persistir)
    ├── rascunho de dependência (ao criar nova)
    ├── draft de risco
    └── votos locais (antes de submeter)
```

### 12.3. Fluxo DnD no Program Board

```
FeatureCard drag start
  → DndContext.onDragStart → set isDragging=true no card
  → FeatureCard opacity reduzida (feedback visual)

drop em SprintLane/ProgramBoardCell
  → DndContext.onDragEnd
  → dispatch MOVE_FEATURE (otimistic update no reducer)
  → mutation React Query → PATCH /api/pi-workspace/features/:id
  → onError → rollback (revert para posição anterior)
  → onSuccess → invalidate ['features', piId]
```

### 12.4. DependencyOverlay – cálculo de posição

```typescript
// Cada célula do grid registra seu ref no contexto
const cellRef = useCallback((node: HTMLDivElement | null) => {
  if (node) cellRefs.current[`${teamId}-${sprintId}`] = node
}, [teamId, sprintId])

// DependencyOverlay lê os bounding rects para calcular coordenadas SVG
function getArrowPoints(fromEl: HTMLElement, toEl: HTMLElement, svgEl: HTMLElement) {
  const svgRect = svgEl.getBoundingClientRect()
  const from = fromEl.getBoundingClientRect()
  const to   = toEl.getBoundingClientRect()
  return {
    x1: from.right  - svgRect.left,
    y1: from.top    - svgRect.top + from.height / 2,
    x2: to.left     - svgRect.left,
    y2: to.top      - svgRect.top + to.height / 2,
  }
}
```

### 12.5. Auto-save

```typescript
// Debounce de 2s em qualquer mudança de estado mutável
const debouncedSave = useDebouncedCallback(async (state: WorkspaceState) => {
  await patchWorkspace(piId, state)
}, 2000)

useEffect(() => {
  debouncedSave(workspaceState)
}, [workspaceState])
```

### 12.6. Tratamento de erros

- `ErrorBoundary` em torno de `ProgramBoard`, `RoamBoard` e `ConfidenceVotePanel` individualmente (falha de um não derruba o workspace).
- Toast de erro para falhas de persistência + botão "Tentar novamente" (re-trigger da mutation).
- Conflito de dependência: `role="alert"` exibido no `DependencyArrow` conflitante, descrevendo o problema.

### 12.7. Acessibilidade

- `PiTabNav`: Radix Tabs com `role="tablist"`, `aria-selected`, navegação por setas.
- `ProgramBoard`: modo tabela alternativo (`<table>`) habilitável via toggle para usuários sem mouse.
- DnD via teclado (`@dnd-kit`): Space para pegar, setas para mover, Enter para soltar, Esc para cancelar; `aria-describedby` em cada `FeatureCard` explica o atalho.
- `RoamBoard` quadrantes: `aria-label="Resolved – N riscos"`.
- `ConfidenceVotePanel`: botões `aria-label="Votar X de 5"` + indicador de voto atual.
- `ArtVoteSummary`: `aria-live="polite"` para anunciar novos votos sem interromper.
- Erros de dependência conflitante: `role="alert"` para leitura imediata por leitores de tela.
