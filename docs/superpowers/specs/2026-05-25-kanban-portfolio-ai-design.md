# ✦ Cosmos / Portfolio Kanban
## PRD, SRD & Guia de Implementação
**v0.2 · Maio 2026 · Status: Prototyping**

> "O kanban que analisa seus épicos enquanto você os move." — Única ferramenta SAFe que combina UX Linear com análise IA passiva visível diretamente nos cards.

---

## Índice
1. PRD: Product Requirements Document
   - 1.1 Personas
   - 1.2 Features & User Stories
   - 1.3 Matriz de Prioridade
   - 1.4 Métricas de Sucesso
2. SRD: System Requirements Document
   - 2.1 Arquitetura
   - 2.2 Modelo de Dados
   - 2.3 APIs
   - 2.4 Integração IA
   - 2.5 Real-time & WebSocket
   - 2.6 Requisitos Não-Funcionais
3. Guia de Implementação
   - 3.1 Stack Tecnológica
   - 3.2 Arquitetura de Componentes
   - 3.3 Fases de Implementação
   - 3.4 Padrões de Código
   - 3.5 Testes

---

## 1 — PRD: Product Requirements Document

### 1.1 Personas

| Persona | Papel | Dor Principal | Valor Cosmos |
|---------|-------|--------------|--------------|
| Rafael (RTE) | Release Train Engineer | Jira é lento, não mostra saúde do portfólio de épicos em um glance | Board com AI scores passivos, WSJF e OKRs visíveis no card |
| Ana (PM) | Product Manager | Escrever épicos bem-definidos é demorado, não sabe se está completo | AI INVEST scoring + suggestions em tempo real na criação |
| Carlos (Arch) | Solution Architect | Dependências entre épicos são invisíveis até quebrarem | Backlink graph + theme filters cruzados |
| Marta (Design) | Design Lead | Ferramentas enterprise são feias e desmotivam o time | Linear-quality UI que o time quer usar |

### 1.2 Features & User Stories

#### F1 — Kanban Board · P0 — Must Have

Board horizontal com colunas SAFe (Backlog → Done), drag-and-drop entre colunas, scroll vertical por coluna, WIP limits com warning visual.

**US-001 · Visualizar portfólio**
> Como RTE, quero ver todos os épicos organizados por estágio do Lean Portfolio Management para ter visibilidade completa do fluxo.
- Board renderiza 5 colunas: Backlog, In Analysis, Portfolio Backlog, Implementing, Done
- Cada coluna mostra header com nome, contagem de épicos e badge de WIP limit
- Colunas scrollam verticalmente de forma independente

**US-002 · Mover épicos entre estágios**
> Como RTE, quero arrastar épicos entre colunas para atualizar seu estágio no pipeline.
- Cards são draggable com visual feedback (opacity 40%, rotate 1.5deg, purple ring)
- Coluna-alvo destaca com border dashed quando card é arrastado sobre ela
- Drop atualiza o estágio do épico em tempo real
- Se WIP limit é excedido, mostrar warning visual (não bloquear)

**US-003 · Filtrar por tema estratégico**
> Como PM, quero filtrar épicos por tema estratégico para focar no meu domínio.
- Toolbar com chips coloridos por tema (Platform, Growth, Security, UX, Data)
- Multi-select: combinar temas
- "All" reseta filtros
- Cards não-matching são ocultados (não apenas dimmed)
- Busca textual complementar no mesmo toolbar

---

#### F2 — Card Anatomy (Hybrid Density) · P0 — Must Have

Card com progressive disclosure: compacto → hover expande → click abre painel completo. AI score sempre visível como diferencial.

**US-004 · Visualizar saúde do épico no card**
> Como RTE, quero ver o score INVEST de cada épico sem clicar, para identificar épicos mal definidos rapidamente.
- Card mostra: título (13px, max 2 linhas), theme badge, status badge
- Barra INVEST sempre visível: label "✦ INVEST", percentage, gradient bar
- Cores da barra: <50% laranja+⚠, 50-74% roxo neutro, 75%+ roxo/verde
- Footer: contagem de features, WSJF score, OKRs linkados

**US-005 · Expandir detalhes on hover**
> Como PM, quero ver breakdown BV/TC/RR, assignees e due date ao passar o mouse, sem abrir o card.
- Hover: border brightens para #3a3a4f, card sobe 1px com shadow
- Seção expandida: BV, TC, RR (monospace), avatares de assignees (max 3), data de vencimento
- Transição suave (0.25s cubic-bezier)
- Card com score <50% tem borda com tint amarelado permanente

---

#### F3 — AI Analysis Layer (Passiva) · P0 — Must Have

**US-006 · Score automático INVEST**
> Como PM, quero que o sistema avalie automaticamente meus épicos nos critérios INVEST para identificar gaps na especificação.
- Score calculado via LLM ao salvar/modificar título + descrição + acceptance criteria
- Cache por hash do conteúdo (não recalcula sem mudança)
- 6 critérios individuais: Independent, Negotiable, Valuable, Estimable, Small, Testable
- Score composto exibido no card como barra de progresso

**US-007 · Painel de análise detalhada**
> Como PM, quero clicar no card e ver breakdown completo INVEST com sugestões concretas de melhoria.
- Side panel slide-in (380px) com backdrop blur
- Breakdown: 6 barras individuais com scores percentuais
- Seção "Sugestões IA" com texto acionável em português
- Botão "✦ Melhorar com IA" gera draft de nova descrição
- Grid de métricas SAFe: WSJF, Features, OKRs, BV, TC, RR

**US-008 · Análise em batch**
> Como RTE, quero analisar todos os épicos de uma vez para preparar o PI Planning.
- Botão "✦ Analyze All" no toolbar
- Shimmer animation nos score bars de todos os cards durante processamento
- Fila de processamento assíncrona (não bloquear UI)
- Notificação ao concluir batch

---

#### F4 — Task Creation Panel · P0 — Must Have

**US-009 · Criar épico com modal completo**
> Como PM, quero criar épicos com todos os metadados SAFe em um modal bem organizado.
- Modal 520px centrado com backdrop blur
- Type selector dropdown (Epic / Feature / Story)
- Título input (18px, bold)
- 3 AI suggestion chips: Suggest title, Find similar, Refine scope
- Template chips: SAFe Epic, Tech Debt, Compliance, Innovation, + Create
- Meta grid 2 colunas: Assignee, WSJF, Team, OKRs, Co-authors, Type
- Footer: Cancel + Create [Type] com gradient button

**US-010 · AI Action Buttons (Open with AI)**
> Como PM, quero enviar o contexto do épico para diferentes IAs para obter perspectivas variadas.
- 5 botões circulares (36×36px) com cores de marca
- Hover: expande para direita mostrando frase única
- Claude (orange): "Let's rock!", Claude Code (navy): "No mistakes!", ChatGPT (green): "Let's do it faster!", Gemini (blue): "Think deeper!", Perplexity (gray): "Search the world!"
- Click copia contexto do épico + abre IA selecionada

---

#### F5 — Editor Notion-like · P1 — Should Have

**US-011 · Editar descrição com blocos estruturados**
> Como PM, quero editar a descrição do épico em um editor de blocos (estilo Notion) para estruturar melhor a informação.
- Tipos de bloco: paragraph, h1, h2, h3, bullet, todo (checkbox), quote, code, divider
- Markdown shortcuts: ## → h2, - → bullet, [ ] → todo, > → quote
- Slash commands: `/` abre menu dropdown com tipos de bloco, filtro por digitação
- Enter cria novo bloco, Backspace em bloco vazio deleta
- Block handles (+ e ⋮⋮) aparecem on hover no lado esquerdo
- Arrow keys navegam entre blocos

**US-012 · Templates de descrição por tipo**
> Como PM, quero que a descrição venha pré-estruturada com um template quando seleciono o tipo da task.
- Epic → Hipótese de Negócio, Resultados, MVPs, Métricas, Riscos
- Feature → Objetivo, Critérios de Aceite, Dependências, Estimativa, Notas Técnicas
- Story → User Story (Como/Quero/Para), Critérios, Definição de Pronto
- Prompt "Use [Type] template" com atalho Tab quando descrição está vazia
- Troca de tipo auto-aplica template se descrição está vazia ou era template anterior

**US-013 · Salvar template customizado**
> Como PM, quero salvar minha estrutura customizada como template padrão para reusar.
- Após editar descrição, toast: "Tornar este o padrão para [Type]?"
- Botão Salvar persiste como template default do workspace
- Checkbox "Não perguntar novamente" para dismiss permanente
- Templates salvos aparecem na lista de template chips

---

#### F6 — Transcrição · P1 — Should Have

**US-014 · Importar transcrição de reunião**
> Como PM, quero colar a transcrição de uma reunião e extrair automaticamente a estrutura do épico.
- Seção collapsible "Transcrição" no painel de criação
- Textarea para colar texto de meeting notes, calls ou brainstorms
- Botão "✦ Extrair estrutura" usa LLM para parse → blocos estruturados na descrição
- Botão "✦ Resumir" condensa transcrição
- Contador de caracteres visível

---

#### F7 — Multiplayer · P2 — Nice to Have

**US-015 · Presença em tempo real**
> Como RTE, quero ver quem está online e onde estão olhando no board.
- Cursores nomeados e coloridos flutuando sobre o board
- Indicador "N online" no top bar com dot verde
- Cursor mostra nome do usuário em tooltip colorido
- Posições atualizadas via WebSocket em tempo real

---

### 1.3 Matriz de Prioridade

| Feature | Prioridade | Esforço | Impacto | Sprint Target |
|---------|-----------|---------|---------|--------------|
| F1 — Kanban Board | P0 | M | Alto | Sprint 1-2 |
| F2 — Card Anatomy | P0 | M | Alto | Sprint 1-2 |
| F3 — AI Analysis | P0 | L | Muito Alto | Sprint 2-3 |
| F4 — Creation Panel | P0 | M | Alto | Sprint 3-4 |
| F5 — Editor Notion-like | P1 | L | Alto | Sprint 4-5 |
| F6 — Transcrição | P1 | M | Médio | Sprint 5 |
| F7 — Multiplayer | P2 | L | Médio | Sprint 6+ |

### 1.4 Métricas de Sucesso

| Métrica | Baseline (Jira) | Target Cosmos | Como Medir |
|---------|----------------|--------------|-----------|
| Tempo para criar épico completo | 15-20 min | < 5 min | Timestamp criação → primeiro save completo |
| % épicos com INVEST score > 70% | N/A | > 60% | Score médio no board |
| Adoção de templates | N/A | > 80% dos épicos | % criados com template vs blank |
| NPS interno (time ágil) | -20 (Jira) | > +50 | Survey trimestral |
| Épicos movidos por sessão | 3-5 | 8-12 | Analytics de drag events |

---

## 2 — SRD: System Requirements Document

### 2.1 Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (SPA)                       │
│  React 18 + TypeScript + Zustand + TanStack Query          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │  Board   │ │  Cards   │ │ Creation │ │  Editor  │      │
│  │  Module  │ │  Module  │ │  Panel   │ │  Module  │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
├─────────────────────────────────────────────────────────────┤
│                     API Gateway (REST + WS)                 │
│  Next.js Server Actions + Socket.io / Liveblocks           │
├──────────┬──────────┬──────────┬────────────────────────────┤
│  Auth    │ Epics    │ AI       │ Real-time                  │
│  Service │ Service  │ Service  │ Service                    │
│  (Clerk) │ (CRUD)   │ (LLM)   │ (Presence + Cursors)       │
├──────────┴──────────┴──────────┴────────────────────────────┤
│                        Data Layer                           │
│  PostgreSQL + Prisma (main) · Redis (cache/presence)       │
└─────────────────────────────────────────────────────────────┘
│                     External Services                       │
│  Claude API (INVEST scoring) · Clerk · Sentry · Liveblocks │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Modelo de Dados

#### Epic

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | PK, auto-generated |
| title | varchar(255) | Título do épico, max 2 linhas |
| description | jsonb | Array de blocos (editor Notion-like) |
| description_md | text | Markdown gerado dos blocos (para search) |
| theme_id | uuid → Theme | Tema estratégico vinculado |
| column_id | uuid → Column | Coluna atual no board |
| position | integer | Ordem dentro da coluna |
| type | enum | 'epic' \| 'feature' \| 'story' |
| status | varchar(50) | Draft, Defined, Approved, In Progress, Done |
| wsjf_score | decimal(4,1) | Weighted Shortest Job First |
| business_value | integer | BV score (1-10) |
| time_criticality | integer | TC score (1-10) |
| risk_reduction | integer | RR/OE score (1-10) |
| invest_score | integer | 0-100, calculado por AI |
| invest_breakdown | jsonb | { I, N, V, E, S, T } scores individuais |
| invest_hash | varchar(64) | SHA-256 do conteúdo analisado (cache) |
| feature_count | integer | Contagem de features vinculadas |
| okr_ids | uuid[] | OKRs vinculados |
| assignee_ids | uuid[] | Usuários atribuídos |
| due_date | date | Data limite |
| template_id | uuid → Template | Template usado na criação (nullable) |
| transcription | text | Transcrição de reunião (nullable) |
| created_by | uuid → User | Criador |
| created_at | timestamp | Data de criação |
| updated_at | timestamp | Última modificação |

#### Column

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | PK |
| title | varchar(100) | Nome da coluna |
| position | integer | Ordem no board |
| wip_limit | integer? | Limite WIP (null = sem limite) |
| board_id | uuid → Board | Board pai |

#### Theme

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | PK |
| label | varchar(50) | Nome: Platform, Growth, Security, UX, Data |
| color | varchar(7) | Hex color (#7c6af7) |
| bg_color | varchar(30) | Background com alpha |

#### Template

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | PK |
| name | varchar(100) | Nome do template |
| type | enum | 'epic' \| 'feature' \| 'story' |
| blocks | jsonb | Array de blocos do editor |
| is_default | boolean | Template padrão para o tipo |
| workspace_id | uuid | Workspace owner |
| created_by | uuid → User | Quem criou |

### 2.3 APIs

#### REST Endpoints

| Method | Path | Descrição | Auth |
|--------|------|-----------|------|
| GET | /api/boards/:id | Board completo com colunas e épicos | Bearer |
| POST | /api/epics | Criar épico (retorna com INVEST score) | Bearer |
| PATCH | /api/epics/:id | Atualizar campos do épico | Bearer |
| PATCH | /api/epics/:id/column | Mover épico entre colunas | Bearer |
| DELETE | /api/epics/:id | Remover épico | Bearer |
| POST | /api/epics/:id/analyze | Trigger AI analysis para um épico | Bearer |
| POST | /api/boards/:id/analyze-all | Batch analysis de todos os épicos | Bearer |
| GET | /api/templates | Listar templates do workspace | Bearer |
| POST | /api/templates | Salvar template customizado | Bearer |
| POST | /api/ai/improve | Gerar descrição melhorada via AI | Bearer |
| POST | /api/ai/extract | Extrair estrutura de transcrição | Bearer |

### 2.4 Integração IA

#### Prompt de Análise INVEST

- **Input**: `{ title, description_md, acceptance_criteria }`
- **Output**: `{ overall: 0-100, breakdown: { I, N, V, E, S, T }, suggestions: string[] }`
- **Cache**: SHA-256(title + description_md + criteria) → Redis TTL 24h

| Operação | Model | Latência Target | Cache |
|----------|-------|----------------|-------|
| INVEST Score | Claude Haiku | < 2s | Redis (hash-based, 24h TTL) |
| Improve Description | Claude Sonnet | < 5s | Não |
| Generate AC | Claude Sonnet | < 4s | Não |
| Extract from Transcription | Claude Sonnet | < 8s | Não |
| Suggest Title | Claude Haiku | < 1.5s | Não |

### 2.5 Real-time & WebSocket

#### Eventos WebSocket

| Evento | Direção | Payload | Descrição |
|--------|---------|---------|-----------|
| cursor:move | Client → Server | `{ x, y, boardId }` | Posição do cursor no board |
| cursor:broadcast | Server → Clients | `{ userId, name, color, x, y }` | Broadcast para outros usuários |
| epic:moved | Server → Clients | `{ epicId, fromCol, toCol, position }` | Épico movido por outro usuário |
| epic:updated | Server → Clients | `{ epicId, changes }` | Épico editado por outro usuário |
| epic:created | Server → Clients | `{ epic }` | Novo épico criado |
| presence:join | Server → Clients | `{ userId, name, color }` | Usuário entrou no board |
| presence:leave | Server → Clients | `{ userId }` | Usuário saiu do board |
| analysis:complete | Server → Client | `{ epicId, score, breakdown }` | AI analysis concluída |

### 2.6 Requisitos Não-Funcionais

| Categoria | Requisito | Target |
|-----------|-----------|--------|
| Performance | First Contentful Paint | < 1.2s |
| Performance | Time to Interactive | < 2.5s |
| Performance | Drag-and-drop latência | < 16ms (60fps) |
| Performance | Board com 100+ épicos | Scroll suave, sem jank |
| Escalabilidade | Concurrent users per board | 50+ |
| Escalabilidade | Total épicos por workspace | 10.000+ |
| Disponibilidade | Uptime SLA | 99.9% |
| Segurança | Auth | JWT + refresh tokens, RBAC |
| Segurança | Data isolation | Multi-tenant, row-level security |
| Acessibilidade | WCAG | AA (keyboard nav, screen readers) |
| i18n | Idiomas | PT-BR (default), EN |

---

## 3 — Guia de Implementação

### 3.1 Stack Tecnológica

| Camada | Tecnologia | Justificativa |
|--------|-----------|--------------|
| Frontend | React 18 + TypeScript | Ecosystem maduro, concurrent features para drag-and-drop suave |
| State | Zustand + TanStack Query | Zustand para UI state (drag, filters), TanStack para server state (épicos) |
| Styling | Tailwind CSS + CSS Modules | Utility-first para velocidade, modules para componentes complexos (editor) |
| DnD | @dnd-kit/core | Acessível, performante, touch-friendly |
| Editor | TipTap (ProseMirror) | Block editor extensível, slash commands built-in, collaborative-ready |
| Real-time | Liveblocks | Presença + cursors + sync (já integrado no projeto) |
| Backend | Next.js Server Actions | Já no projeto, type-safe, edge-ready |
| Database | PostgreSQL + Prisma | JSONB para blocos, RLS para multi-tenancy (já no projeto) |
| Cache | Redis | AI score cache (hash-based), presence data, rate limiting |
| AI | Anthropic Claude API | Haiku para scoring rápido, Sonnet para generation |
| Auth | Clerk | Enterprise SSO, já integrado no projeto |
| Deploy | Vercel | Já configurado no projeto |

### 3.2 Arquitetura de Componentes

```
apps/app/app/(authenticated)/dashboard/portfolio/
├── components/
│   ├── kanban-board.tsx           # Board container + DnD context (existente)
│   ├── kanban-column.tsx          # Coluna individual + droppable (existente)
│   ├── kanban-card.tsx            # Card com progressive disclosure (existente, expandir)
│   ├── column-header.tsx          # Header com count + WIP badge
│   ├── add-epic-inline.tsx        # Quick-add inline form
│   ├── invest-score-bar.tsx       # Barra AI passiva (novo)
│   ├── card-hover-expand.tsx      # BV/TC/RR + avatares + date (novo)
│   ├── detail-panel.tsx           # Side panel slide-in (novo)
│   ├── invest-breakdown.tsx       # 6 critérios com barras (novo)
│   ├── ai-suggestions.tsx         # Sugestões textuais (novo)
│   ├── create-epic-panel.tsx      # Modal de criação (novo)
│   ├── type-selector.tsx          # Dropdown Epic/Feature/Story (novo)
│   ├── template-chips.tsx         # Chips de template (novo)
│   ├── meta-grid.tsx              # Grid 2-col de metadados (novo)
│   ├── ai-action-buttons.tsx      # 5 circular AI buttons (novo)
│   ├── transcription-section.tsx  # Collapsible transcription (novo)
│   ├── notion-editor.tsx          # Editor container (novo)
│   ├── slash-command-menu.tsx     # Dropdown de comandos / (novo)
│   ├── ghost-cursor.tsx           # Cursor flutuante multiplayer (existente)
│   └── filter-toolbar.tsx         # Theme chips + search + analyze (existente, expandir)
├── hooks/
│   ├── use-ai-analysis.ts         # Mutation: trigger analysis
│   ├── use-templates.ts           # Templates CRUD
│   └── use-drag-epic.ts           # DnD state + optimistic updates
└── page.tsx                       # Board page
```

### 3.3 Fases de Implementação

#### Fase 1 — Core Board + Cards
Setup, layout do board, colunas, cards estáticos. Drag-and-drop com @dnd-kit. Theme filter toolbar. Design system tokens.
**Semanas 1-3 · 2 devs**

#### Fase 2 — Backend + Persistência
Server Actions (já no projeto), PostgreSQL schema adicional (invest_score, invest_breakdown, invest_hash, description jsonb, template_id). CRUD completo.
**Semanas 3-5 · 2 devs**

#### Fase 3 — AI Analysis Layer
Integração Claude API para INVEST scoring. Cache Redis por hash. Score bar nos cards. Side panel com breakdown + sugestões. Batch analysis.
**Semanas 5-7 · 1 dev + 1 AI/ML**

#### Fase 4 — Creation Panel + Editor
Modal de criação com type selector, meta grid, template chips. Editor de blocos (TipTap) com slash commands, markdown shortcuts, placeholder text. Templates por tipo.
**Semanas 7-10 · 2 devs**

#### Fase 5 — AI Features (Creation)
AI suggestion chips (título, similar, escopo). Inline AI buttons (improve, generate AC, check INVEST). Transcription extraction. AI action buttons circulares.
**Semanas 10-12 · 1 dev + 1 AI/ML**

#### Fase 6 — Polish + Performance
Animations polish, responsive, keyboard shortcuts, onboarding. Performance (virtualized lists se 100+ épicos). Liveblocks sync refinement.
**Semanas 12-14 · 2 devs**

> **MVP funcional (Fases 1-3): 7 semanas**
> **Timeline total: 14 semanas (3.5 meses)** com squad de 2-3 devs + 1 AI/ML engineer.

### 3.4 Padrões de Código

#### Bloco do Editor

```typescript
interface EditorBlock {
  id: string;
  type: 'paragraph' | 'h1' | 'h2' | 'h3' | 'bullet' | 'todo' | 'quote' | 'code' | 'divider';
  content: string;
  checked?: boolean;     // for 'todo' type
  language?: string;     // for 'code' type
  metadata?: Record<string, unknown>;
}

interface Template {
  id: string;
  name: string;
  type: 'epic' | 'feature' | 'story';
  blocks: EditorBlock[];
  isDefault: boolean;
  workspaceId: string;
}
```

#### AI Analysis Response

```typescript
interface InvestAnalysis {
  overall: number;       // 0-100
  breakdown: {
    independent: number;  // 0-100
    negotiable: number;
    valuable: number;
    estimable: number;
    small: number;
    testable: number;
  };
  suggestions: string[];  // Actionable improvement suggestions in PT-BR
  hash: string;           // Content hash for cache invalidation
  analyzedAt: string;     // ISO timestamp
}
```

#### Optimistic Update Pattern (Drag-and-Drop)

```typescript
// hooks/use-drag-epic.ts
function useDragEpic() {
  const queryClient = useQueryClient();

  const moveEpic = useMutation({
    mutationFn: (data: { epicId: string; toColumn: string; position: number }) =>
      api.patch(`/epics/${data.epicId}/column`, data),

    // Optimistic: update UI immediately
    onMutate: async (data) => {
      await queryClient.cancelQueries(['board']);
      const prev = queryClient.getQueryData(['board']);
      queryClient.setQueryData(['board'], (old) =>
        moveEpicInBoard(old, data.epicId, data.toColumn, data.position)
      );
      return { prev };
    },

    // Rollback on error
    onError: (_err, _data, ctx) => {
      queryClient.setQueryData(['board'], ctx?.prev);
    },

    // Sync with server response
    onSettled: () => queryClient.invalidateQueries(['board']),
  });

  return moveEpic;
}
```

### 3.5 Testes

| Camada | Ferramenta | Foco | Cobertura Target |
|--------|-----------|------|-----------------|
| Unit | Vitest | Utils (mdToBlocks, scoreColor), stores, hooks isolados | 90% |
| Component | Testing Library | Card renders, Board layout, Editor block types | 80% |
| Integration | Playwright | Drag-and-drop flow, Create epic flow, AI analysis | Key flows |
| API | Vitest + Supertest | CRUD endpoints, AI integration, WebSocket events | 85% |
| Visual | Chromatic / Percy | Card states, score colors, hover expand, dark theme | Core components |

---

## ⚠ Questões em Aberto

- [ ] **INVEST scoring**: mostrar INVEST+STAR+Granularidade como tabs no side panel, ou só INVEST?
- [ ] **Side panel**: full-width drawer ou split 60/40 com kanban visível?
- [ ] **Quick-add**: inline (Trello-style) ou sempre modal (Linear-style)?
- [ ] **WIP limits**: hard block (impedir drop) ou soft warning (permitir com destaque)?
- [ ] **Backlink graph** (Obsidian-style): Sprint 1 ou backlog para v2?
- [ ] **Editor**: TipTap customizado ou implementação própria com contentEditable?
- [ ] **Multi-AI buttons**: integração real com cada IA via API, ou link externo com contexto copiado?
