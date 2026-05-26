# ✦ Cosmos / Portfolio Kanban
## PRD, SRD & Guia de Implementação
**v0.3 · Maio 2026 · Status: Prototyping**

> "O kanban que analisa seus épicos enquanto você os move." — Única ferramenta SAFe que combina UX Linear com análise IA passiva visível diretamente nos cards.

---

## Decisões de Design (Open Questions → Fechadas)

| # | Questão | Decisão |
|---|---------|---------|
| 1 | INVEST+STAR+Granularidade: tabs ou só INVEST? | **Tabs no Side Panel** (INVEST, STAR, Granularidade) |
| 2 | Side panel layout? | **Full Width Drawer** — conteúdo rico (descrição, resultados) tem prioridade sobre compacteza |
| 3 | Quick-add: inline ou modal? | **Modal Linear-style** |
| 4 | WIP limits: hard block ou soft warning? | **Soft warning** — permite drop mas destaca visualmente |
| 5 | Backlink graph: Sprint 1 ou v2? | **Sprint 1** — dependências visíveis são críticas no SAFe |
| 6 | Editor: TipTap ou custom? | **TipTap** com markdown shortcuts nativos |
| 7 | AI buttons: link externo ou prompt customizável? | **Prompt especializado** por provider + contexto completo da task |

### Nova Feature: AI Playground (Artifacts Library)
Seção dedicada dentro do Cosmos onde ficam todos os artefatos gerados com IA (PRDs, specs, diagramas, playbooks). Ver F8 abaixo.

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

**US-007 · Full Width Drawer — visão completa da task**
> Como PM, quero clicar no card e ver a task completa em um drawer largo, com foco em conteúdo (descrição, resultados, contexto) e análise IA em abas separadas.

**Layout do Drawer:**
```
┌────────────────────────────────────────────────────────────────┐
│  [◈ Epic]  Migração para microserviços          [Edit] [✕]    │
│  ● Platform · In Analysis · WSJF 8.2 · 4 feats · 2 OKRs      │
├──────────────────────────────────────────────────────────────  │
│  [📄 Descrição]  [✦ Análise IA]  [🔗 Dependências]  [📎 Mais] │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ABA DESCRIÇÃO (default):                                      │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ [editor TipTap — blocos ricos]                           │ │
│  │ ## Hipótese de Negócio                                   │ │
│  │ Migrar o monolito usando Strangler Fig Pattern...        │ │
│  │                                                          │ │
│  │ ## Resultados Esperados                                  │ │
│  │ ☑ Redução 40% latência P99                               │ │
│  │ ☑ Deploy independente por domínio                        │ │
│  │                                                          │ │
│  │ ## Acceptance Criteria                                   │ │
│  │ > Given auth service isolated...                         │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ⚠  "Esta task parece grande demais para um único épico."     │
│     Verifique a aba Análise IA → critério Small (38%).        │
└────────────────────────────────────────────────────────────────┘
```

**Regras do drawer:**
- Abre em full width (100vw) com overlay escurecido, não empurra o board
- Aba default: **Descrição** (não análise — conteúdo é o que importa)
- Warning "task grande demais" aparece fixo no rodapé da aba Descrição quando Small < 50%, com link direto para aba Análise IA
- Drawer preserva scroll position do board ao abrir/fechar

**Aba Análise IA — 3 sub-tabs:**
```
[INVEST ✦] [STAR] [Granularidade]
```
- **INVEST**: 6 barras individuais, score por critério, sugestões em PT-BR, "✦ Melhorar com IA"
- **STAR**: Situation/Task/Action/Result scoring do acceptance criteria
- **Granularidade**: épico grande? features bem divididas? recomendação de split

**Aba Dependências:**
- Lista de épicos bloqueados / que bloqueiam esta task
- Mini-grafo visual de dependências (D3 ou React Flow, collapsible)
- Botão "+ Add dependency" com busca por título
- Badge no card do board quando há dependências bloqueantes

**Aba Mais:**
- Assignees + co-autores (edit inline)
- Histórico de mudanças (timeline compacta)
- Transcrição original (se importada)
- Artefatos IA gerados para esta task (link para AI Playground)

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

**US-010 · AI Action Buttons — Prompt Especializado por Provider**
> Como PM, quero enviar um prompt especializado e contextualizado para diferentes IAs, não apenas o texto da task copiado.

**Conceito:** Cada botão IA não abre um chat genérico. Ele **monta um prompt especializado** baseado em:
1. Tipo da task (Epic / Feature / Story)
2. Contexto completo da task (título, descrição, AC, WSJF, OKRs, tema)
3. Referências do projeto (design system, arquitetura, stack técnica)
4. Template de prompt específico por provider

**Prompt por provider:**

| Provider | Especialização do Prompt | Exemplo de instrução |
|----------|------------------------|---------------------|
| Claude | Análise holística + plano de implementação SAFe | "Analise este épico SAFe considerando o contexto do portfolio..." |
| Claude Code | Prompt de engenharia: implementação técnica, código, arquitetura | "Você é um senior engineer. Implemente as tasks técnicas deste épico..." |
| ChatGPT | Criatividade + alternativas de abordagem | "Explore 3 abordagens alternativas para este épico considerando..." |
| Gemini | Research + benchmarks + mercado | "Pesquise benchmarks e melhores práticas para este tipo de épico..." |
| Perplexity | Busca de referências, documentação, cases | "Encontre documentação, cases e referências para implementar..." |

**Contexto injetado automaticamente no prompt:**
```
--- CONTEXTO DO PROJETO ---
Workspace: {workspaceName}
Stack: {techStack from settings}
Design System: {designSystemRef if type=UI}
Arquitetura: {archRef if type=technical}

--- CONTEXTO DA TASK ---
Tipo: Epic · Status: In Analysis
Título: {title}
Descrição: {description_md}
Acceptance Criteria: {ac}
WSJF: {score} (BV:{bv} TC:{tc} RR:{rr})
OKRs vinculados: {okrList}
Tema Estratégico: {theme}
INVEST Score: {score}% (pontos fracos: {weakCriteria})

--- REFERÊNCIAS ---
{design_system_doc if applicable}
{architecture_doc if applicable}
```

**Comportamento do click:**
1. Monta o prompt completo
2. Copia para clipboard
3. Abre a IA na URL correta (claude.ai, chatgpt.com, etc.)
4. Toast: "Prompt copiado — cole na IA. Salvei uma cópia no AI Playground."
5. Salva artefato no AI Playground da task (histórico de prompts)

**Visual:** Mantém design circular expand-on-hover conforme mockup anterior.

**Configuração de contexto** (workspace settings):
- Tech stack declarada
- Link para design system (Figma, Storybook)
- Link para docs de arquitetura
- Prompt base customizável por tipo de task (Epic/Feature/Story)

---

### US-010b · Geração de Prompt com RAG + Delivery Multi-IDE

**Fluxo completo ao clicar em um AI Action Button:**

#### Fase 1 — UX de geração (blur + spinner)

```
┌──────────────────────────────────────────────────────────┐
│  [card ou drawer inteiro em blur: filter: blur(4px)]     │
│                                                          │
│              ◐  Analisando contexto da task...           │
│         → Buscando documentos relevantes no workspace    │
│         → Aplicando técnicas de prompt engineering       │
│         → Montando contexto para Claude Code             │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

Mensagens de loading rotacionam (não genéricas):
- "Lendo o épico e seus critérios INVEST..."
- "Buscando docs similares no seu workspace..."
- "Formatando Few-Shot examples para Claude Code..."
- "Quase lá — otimizando para máxima performance..."

#### Fase 2 — RAG: busca vetorial de documentos relevantes

**Vector DB**: pgvector (Supabase) ou Pinecone (se escalar).
- Índice gerado de: PRDs, specs, design system docs, arquitetura, playbooks do AI Playground
- Query: embedding do título + descrição + tipo da task
- Threshold de relevância: cosine similarity > 0.75

**Ao encontrar docs relevantes → pergunta ao usuário:**
```
┌─────────────────────────────────────────────────────┐
│  ✦ Encontrei 3 documentos que podem enriquecer      │
│    o contexto deste prompt:                         │
│                                                     │
│  ☑  Design System Guidelines v2.3                  │
│  ☑  Arquitetura de Microserviços (C4 Model)        │
│  ☐  WSJF Scoring Playbook (menos relevante)        │
│                                                     │
│  [Adicionar selecionados]  [Pular]                  │
└─────────────────────────────────────────────────────┘
```

#### Fase 3 — Geração do Prompt (Claude Haiku)

**Model**: Claude Haiku (leve, rápido, < 1.5s)
**Técnicas aplicadas por provider:**

| Provider / Target | Técnica principal | Estrutura |
|-------------------|------------------|-----------|
| Claude / Claude Code | Chain-of-Thought + XML tags | `<task>`, `<context>`, `<instructions>` |
| ChatGPT / Cursor | Few-Shot + role definition | System + User prompt |
| Gemini | Zero-Shot CoT | "Think step by step..." |
| Groq (LLaMA) | System Prompt separado + instruction tuning | `[INST]...[/INST]` format |
| Windsurf / Cline / Roo | Markdown estruturado + código de referência | Headers + code blocks |
| Perplexity | Query direta otimizada + fontes solicitadas | Question format |

**Prompt de geração (Haiku instrução interna):**
```
Você é um especialista em prompt engineering para [TARGET_PROVIDER].
Use técnicas de [TECHNIQUE] para criar um prompt especializado que:
1. Contextualize a task SAFe completamente
2. Instrua a IA a gerar [output_type] para este tipo de épico
3. Inclua os documentos RAG relevantes como referência
4. Siga o formato de prompt que performa melhor em [TARGET_PROVIDER]

Task: {title} | Tipo: {type} | Score INVEST: {score}
Docs RAG incluídos: {rag_docs}
```

#### Fase 4 — Delivery: copia + abre o target

**Targets suportados:**

| Target | Como abre | Comando |
|--------|-----------|---------|
| Claude Code (CLI) | Terminal com prompt pré-carregado | `claude "{prompt_file_path}"` |
| Cursor | Abre Cursor + paste no chat | AppleScript / PowerShell + deep link |
| Windsurf | Abre Windsurf + paste no chat | Deep link `windsurf://chat?prompt={encoded}` |
| Cline / Roo | VS Code extension command | `vscode://Cline/chat?prompt={encoded}` |
| Claude.ai | Abre browser com prompt | `https://claude.ai/new?prompt={encoded}` |
| ChatGPT | Abre browser com prompt | `https://chatgpt.com/?prompt={encoded}` |

**macOS — AppleScript para IDEs:**
```applescript
-- Abrir Cursor e colar prompt
tell application "Cursor" to activate
delay 0.5
tell application "System Events"
  keystroke "k" using command down  -- abre chat
  delay 0.3
  keystroke "v" using command down  -- cola prompt
end tell
```

**Windows — PowerShell:**
```powershell
# Abrir Cursor e colar prompt
Add-Type -AssemblyName System.Windows.Forms
Start-Process "cursor" -ArgumentList "--new-window"
Start-Sleep -Milliseconds 800
[System.Windows.Forms.SendKeys]::SendWait("^k")  # Ctrl+K = chat
Start-Sleep -Milliseconds 300
[System.Windows.Forms.SendKeys]::SendWait("^v")  # Ctrl+V = paste
```

**Claude Code — via CLI diretamente:**
```bash
# Escreve prompt em arquivo temp + invoca claude
echo "$PROMPT_CONTENT" > /tmp/cosmos-prompt-{taskId}.md
claude --print /tmp/cosmos-prompt-{taskId}.md | pbcopy  # macOS
claude --print /tmp/cosmos-prompt-{taskId}.md | clip    # Windows
```

**Toast final:**
```
✦ Prompt gerado e enviado para Cursor
  [Ver prompt completo]  [Salvar no Playground]
```

#### Armazenamento
- Prompt gerado → salvo no AI Playground vinculado à task
- Hash do prompt → evita regerar se task não mudou
- Histórico: usuário vê todos os prompts gerados para aquela task

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

#### F8 — AI Playground (Artifacts Library) · P1 — Should Have

**US-016 · Biblioteca de artefatos gerados com IA**
> Como PM/RTE, quero ter um lugar centralizado dentro do Cosmos onde ficam todos os artefatos gerados com IA, organizados por categoria, para consulta e reuso.

**Conceito:**
O AI Playground é uma seção `/playground` no Cosmos — uma pasta inteligente de outputs de IA vinculados ao workspace. Toda vez que a IA gera algo relevante (PRD, spec, diagrama, plano, código de referência), o artefato vai para cá automaticamente ou por ação do usuário.

**Estrutura de pastas (exemplo):**
```
AI Playground/
├── PRDs/
│   ├── 2026-05-25 · Kanban Portfolio AI (gerado via Claude)
│   ├── 2026-05-20 · FinOps Lean Budget (gerado via Claude Code)
│   └── ...
├── Specs/
│   ├── Arquitetura de Microserviços · Epic-047
│   └── ...
├── Playbooks/
│   ├── WSJF Scoring Guide (gerado via GPT)
│   ├── SAFe PI Planning Checklist
│   └── ...
├── Diagramas/
│   ├── C4 Model · Platform Domain (Gemini)
│   └── ...
└── Por Epic/
    ├── Epic-047 · Microserviços/
    │   ├── Prompt usado (Claude Code, 2026-05-25)
    │   ├── Plano de implementação gerado
    │   └── Diagrama de dependências
    └── ...
```

**Fluxos de entrada no Playground:**
1. **AI Action Button** → "Salvar no Playground" automático após enviar prompt
2. **"✦ Melhorar com IA"** no drawer → output salvo como artefato da task
3. **Import manual** → upload de qualquer arquivo gerado externamente
4. **Transcrição processada** → salva transcrição + estrutura extraída como artefato

**Features do Playground:**
- Visualização em lista ou grid com thumbnails
- Filtro por: categoria, epic vinculada, provider de IA, data, autor
- Busca full-text no conteúdo dos artefatos
- Preview inline (markdown renderizado, imagem, código)
- Download / Copy / Compartilhar link
- Vinculação bidirecional: artefato → epic, epic → artefatos
- Versioning: novo output não sobrescreve, cria nova versão

**Acesso:**
- Menu lateral principal: `✦ AI Playground`
- No drawer da task: aba "Mais" mostra artefatos vinculados àquele épico
- Badge no card do board quando épico tem artefatos no Playground

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

## ✅ Decisões Fechadas

| Questão | Decisão |
|---------|---------|
| Scoring tabs | Tabs: INVEST / STAR / Granularidade no Full Width Drawer |
| Side panel layout | Full Width Drawer (conteúdo > compacteza) |
| Quick-add | Modal Linear-style |
| WIP limits | Soft warning (permite drop, destaca visualmente) |
| Backlink graph | Sprint 1 — dependências são críticas no SAFe |
| Editor | TipTap com markdown shortcuts nativos |
| AI buttons | Prompt especializado por provider + contexto completo |

## ✅ Decisão: AI Playground Storage

### Estratégia de Storage em Camadas

```
┌─────────────────────────────────────────────────────────┐
│                   STORAGE TIERS                         │
├──────────────┬──────────────┬───────────────────────────┤
│  Tier 0      │  Tier 1      │  Tier 2                   │
│  Supabase    │  AWS S3      │  AWS S3 (pago)            │
│  Free        │  Startup     │  conforme escala           │
│  1GB         │  Credits     │                           │
│  Grátis      │  $0 (crédito)│  ~$0.023/GB/mês           │
└──────────────┴──────────────┴───────────────────────────┘
```

**Tier 0 — Supabase Storage (agora, grátis)**
- Supabase free tier: 1GB storage + 2GB bandwidth/mês grátis
- Armazena: markdown (.md), JSON (prompts, outputs estruturados), texto
- Formato comprimido: gzip antes de upload (~60-80% menor)
- Ideal para: PRDs, specs, playbooks, transcrições, prompts salvos
- Já integrado no projeto (mesmo Supabase do banco)

**Tier 1 — AWS S3 via Startup Credits (próximo passo)**
- **AWS Activate**: até $100K em créditos para startups
  - Apply: https://aws.amazon.com/activate/
  - Requisito: empresa constituída, early-stage
  - S3 free tier: 5GB + 20K GETs + 2K PUTs/mês (12 meses)
- Usado para: arquivos maiores (diagramas, imagens, exports PDF)
- Bucket: `cosmos-ai-playground-{workspaceId}` por tenant

**Tier 2 — Escala paga (quando necessário)**
- S3 Standard: $0.023/GB/mês — muito barato para artefatos de texto
- 10.000 workspaces × 50MB médio = 500GB = ~$11.50/mês

### Arquitetura de Storage

```typescript
// Routing por tipo de arquivo
function getStorageProvider(artifact: ArtifactType): 'supabase' | 's3' {
  const textTypes = ['markdown', 'json', 'prompt', 'transcription'];
  return textTypes.includes(artifact.contentType) ? 'supabase' : 's3';
}

// Compressão antes de upload
async function uploadArtifact(content: string, meta: ArtifactMeta) {
  const compressed = await gzip(Buffer.from(content, 'utf-8'));
  const savings = 1 - (compressed.length / Buffer.byteLength(content));
  // savings típico: 65-80% para markdown/JSON
}
```

### Referências de Créditos para Aplicar

| Programa | Valor | Requisito | Link |
|----------|-------|-----------|------|
| AWS Activate (Founders) | $1K–$100K | Early-stage startup | aws.amazon.com/activate |
| AWS Activate (Portfolio) | até $100K | Via aceleradoras parceiras | Idem |
| NVIDIA Inception | GPU credits + suporte | AI startup | nvidia.com/en-us/startups |
| Google for Startups | $200K GCP credits | Early-stage | cloud.google.com/startup |
| Anthropic Startup Program | API credits | AI-native product | anthropic.com/startups |
| Vercel Startup Program | Pro grátis | Startup validado | vercel.com/contact/startup |
| Supabase Startup | Pro $0/6 meses | Aplicar via YC/aceleradora | supabase.com/blog/supabase-for-startups |

> **Prioridade de aplicação**: AWS Activate → Anthropic → NVIDIA Inception → Supabase Startup

---

## ⚠ Questões em Aberto

- [ ] **Prompt templates**: editáveis por workspace admin ou fixos por tipo?
- [ ] **Dependências**: só entre épicos do mesmo board, ou cross-board também?
- [ ] **Grafo de dependências**: D3 custom ou React Flow (mais rico, mais pesado)?
- [ ] **Versioning de artefatos**: Git-like (full history) ou apenas "último + anterior"?
- [ ] **AI Playground**: rota `/playground` separada ou modal/drawer dentro do board?
