# Cosmos Kanban Portfolio — PRD v0.2
**Date:** 2026-05-25
**Status:** Design / Pre-implementation
**Style base:** Option B — Hybrid (Linear clarity + SAFe data + passive AI score)

---

## Vision

> "O kanban que analisa seus épicos enquanto você os move."

Diferencial de mercado: única ferramenta SAFe que combina UX Linear com análise IA passiva visível diretamente nos cards + painel de criação de tasks com IA integrada nativamente.

---

## 1. Kanban Board

### 1.1 Layout Geral

```
┌────────────────────────────────────────────────────────────┐
│  [● Platform] [● Data] [● Security] [Todos]   ← filtros    │
├──────────────┬──────────────┬──────────────┬───────────────┤
│   Backlog    │ In Analysis  │   Portfolio  │ Implementing  │
│   12 épicos  │   4 épicos   │   Backlog    │   7 épicos    │
│   WIP: —     │   WIP: 5 ✓  │   5 épicos   │   WIP: 8 ⚠   │
│              │              │              │               │
│  [card]      │  [card]      │  [card]      │  [card]       │
│  [card ⚠]   │  [card]      │  [card]      │  [card]       │
│  [card]      │              │              │               │
│              │              │              │               │
│  + Add Epic  │              │              │               │
└──────────────┴──────────────┴──────────────┴───────────────┘
```

**Colunas SAFe padrão**: Backlog → In Analysis → Portfolio Backlog → Implementing → Done
**Colunas configuráveis**: RTE pode adicionar/renomear/reordenar (já existente)
**WIP limits**: soft warning (badge laranja) ou hard block (não deixa drop) — configurável por coluna

### 1.2 Theme Filter Toolbar

Chips horizontais no topo. Click filtra cards por Strategic Theme.
- "Todos" sempre presente
- Chip colorido com dot da cor do tema
- Filtro persiste na sessão (localStorage)

---

## 2. Kanban Card (Option B — Hybrid)

### 2.1 Anatomia

```
┌─────────────────────────────────────────┐
│  ⋮⋮  [drag handle — grip strip]        │
├─────────────────────────────────────────┤
│  Título do épico (13px medium, 2 linhas)│
│                                         │
│  [● Platform]   [In Analysis]           │
│   tema badge     status badge           │
│                                         │
│  ┌──── ✦ INVEST ──────────── 72% ────┐ │
│  │  ████████████████░░░░░░░░░░░░░░  │ │
│  └────────────────────────────────────┘ │
│                                         │
├─────────────────────────────────────────┤
│  4 feats · WSJF 8.2      2 OKRs  [→][⊞]│
└─────────────────────────────────────────┘
```

### 2.2 Estados do Card

| Estado | Visual |
|--------|--------|
| Default | anatomia acima |
| Hover | border brilha, expande mostrando BV/TC/RR + avatares assignees + due date |
| Dragging | opacity 50%, ring primary, ghost overlay rotado 2° |
| AI warning (score < 50%) | barra laranja + ícone ⚠ + tooltip "Especificação fraca — clique para melhorar" |
| AI ok (score ≥ 75%) | barra verde/violeta |

### 2.3 AI Score Bar (passivo, sempre visível)

- Label: `✦ INVEST` (ou `✦ STAR` ou `✦ Granularidade` — rotaciona ou exibe o mais crítico)
- Calculado por LLM ao salvar/editar título + descrição + acceptance criteria
- Cache por hash do conteúdo (não recalcula sem mudança)
- Click → abre side panel com análise completa

**Score thresholds:**
- 0–49%: barra laranja, card destaca-se levemente, ícone ⚠
- 50–74%: barra amarela/neutra
- 75–100%: barra violeta/verde

---

## 3. Task Panel (Criação / Edição)

Abre como: modal centrado (criação) ou side drawer 480px (edição inline).

### 3.1 Topbar

```
[◈ Epic ▾]   Portfolio Kanban → Backlog     [● In Analysis]
```

- **Type select**: dropdown com tipos SAFe — Epic, Enabler, Feature, Story, Spike, Bug, Tech Debt
- **Breadcrumb**: localização no board
- **Status badge**: clicável para mudar status inline

### 3.2 Título + Sugestões IA

```
[input: título livre, font 18px]

✦ Sugestões:
  [Decomposição de monolito em serviços de domínio]
  [Migração gradual BFF + API Gateway              ]
  [Strangler Fig Pattern — Phase 1                 ]
```

- Sugestões geradas por LLM ao digitar (debounce 800ms)
- 3 chips clicáveis que substituem o título
- Sugestões baseadas em: tipo da task + tema estratégico selecionado + histórico do projeto

### 3.3 Templates (Linear-style)

```
Template: [SAFe Epic] [Tech Debt] [Compliance] [Innovation] [+ Criar template ▸]
```

- Chips horizontais, scroll se muitos
- Click aplica template: preenche campos de resumo, acceptance criteria, tipo padrão
- **+ Criar template**: abre modal minimal com nome + campos a capturar
- **IA sugere template**: ao digitar título, sugere qual template melhor se encaixa

### 3.4 Meta Grid (2 colunas)

| Campo | Comportamento |
|-------|--------------|
| **Assignee** | Avatar picker. Selecionar assignee → auto-preenche Time com o time daquela pessoa |
| **Time** | Dropdown de times. Selecionar time → filtra assignees disponíveis para aquele time |
| **Co-autores** | Avatar picker múltiplo. Participantes sem ownership, sem auto-fill de time |
| **WSJF** | Exibe score calculado + breakdown BV/TC/RR/JS clicável para editar |
| **OKRs** | Multi-select de OKRs ativos do portfólio |
| **Tipo** | Echo do type select do topbar (edição inline) |

**Lógica Assignee ↔ Time:**
- Fluxo A: `seleciona assignee` → `time auto-preenche (read-only, com badge "auto")`
- Fluxo B: `seleciona time primeiro` → `assignee dropdown filtra só membros do time`
- Múltiplos assignees de times diferentes → time field mostra ambos ou "Multidisciplinar"

### 3.5 Resumo / Descrição

Rich text minimal (markdown suportado).

Botões IA inline abaixo do campo:
- `✦ Melhorar resumo` — reescreve mantendo intenção
- `✦ Gerar acceptance criteria` — drafta AC baseado no resumo
- `✦ Verificar INVEST` — mostra score critério a critério com sugestões

### 3.6 AI Action Buttons

**Posição**: rodapé do painel, antes dos botões de ação primária.
**Label**: "Abrir com IA"

**Design**: botões totalmente circulares (36×36px), cor temática por IA.
**Hover**: expande horizontalmente para direita, revelando frase única. Transição suave (250ms cubic-bezier).

| IA | Cor | Ícone | Frase hover |
|----|-----|-------|-------------|
| Claude | `#c96a2a → #d4845a` (gradient) | 🟠 | *"Let's rock!"* |
| Claude Code | `#1a1a2e` + border `#5050a0` | CC | *"No mistakes! (lol)"* |
| ChatGPT | `#0d5c3a → #1a8a58` | 🟢 | *"Let's do it faster!"* |
| Gemini | `#1a2a4a → #2a4a8a` | 💠 | *"Think deeper!"* |
| Perplexity | `#1a1a1a` + border `#555` | Px | *"Search the world!"* |

**Comportamento ao click**:
1. Copia contexto da task para clipboard (título + resumo + acceptance criteria + tipo + WSJF)
2. Abre a IA correspondente em nova aba
3. Toast: "Contexto copiado — cole na IA"

**Extensibilidade**: admin pode adicionar/remover IAs na lista via settings.

---

## 4. AI Analysis Side Panel

Abre ao clicar no score bar do card.

```
┌────────────────────────────────────────┐
│  ✦ Análise IA — Migração para micro..  │
│  ─────────────────────────────────── │
│                                        │
│  INVEST Score: 72%                     │
│  ████████████████░░░░░░░░░░            │
│                                        │
│  ✓ Independent    ████████ 80%         │
│  ✓ Negotiable     ██████   68%         │
│  ✓ Valuable       █████████ 90%        │
│  ⚠ Estimable      ████     42%  ← fraco│
│  ⚠ Small          ████     45%  ← fraco│
│  ✓ Testable       ███████  72%         │
│                                        │
│  💡 "Adicione critério de aceite       │
│      mensurável para Estimable."       │
│  💡 "Épico grande demais — considere  │
│      quebrar em 2 features menores."   │
│                                        │
│  [✦ Melhorar com IA]  [Dispensar]      │
└────────────────────────────────────────┘
```

**Abas**: INVEST | STAR | Granularidade
**"Melhorar com IA"**: gera draft de nova descrição com os problemas corrigidos

---

## 5. Template System

### 5.1 Templates built-in

| Template | Campos pré-preenchidos |
|----------|----------------------|
| SAFe Epic | Resumo: estrutura padrão SAFe, AC: Given/When/Then |
| Tech Debt | Tipo: Enabler, campos de impacto técnico |
| Compliance | Tipo: Enabler, campos regulatórios |
| Innovation | Tipo: Epic, campos de hipótese e métrica de validação |

### 5.2 Criar Template (Linear-style)

Modal minimal:
1. Nome do template
2. Checkboxes: quais campos capturar (título, resumo, tipo, AC, etc.)
3. Campos opcionais com valores default
4. Salvar → aparece nos chips imediatamente

### 5.3 Sugestão automática de template

Ao digitar título: LLM analisa e sugere template mais relevante.
Chip `✦ Usar template sugerido: Tech Debt` aparece abaixo do título.

---

## 6. Multiplayer (já implementado — manter)

- Cursores nomeados e coloridos via Liveblocks
- Movimento de cards propagado em tempo real
- Sincronização estado Liveblocks ↔ DB via `updateEpicStatus`

---

## 7. Anotações de Design

### Cores base (dark-first)

```
Background card:    #0f0f11
Border card:        #2a2a2f (default) | #3a3a4f (hover)
Text primary:       #e1e1e3
Text secondary:     #888890
Theme accent:       variável por Strategic Theme
AI purple:          #7c6af7 | #a89cff
AI bar bg:          #1a1520
AI bar border:      #4a3060
Score warning:      #f59e0b
Score ok:           #4ade80
```

### Typography

```
Card title:         13px / 500 / tracking -0.01em
Meta label:         10px / uppercase / tracking 0.06em / #555
Footer mono:        11px / monospace / #888
Panel title:        18px / 600 / tracking -0.01em
```

---

## 8. Claude Design Prompt

> Copia e cola no Claude Design / Figma Make / v0:

```
Design a SAFe portfolio kanban board for Cosmos, a dark-theme enterprise agile planning platform.

BOARD LAYOUT:
- Dark background #0f0f11
- Horizontal columns: Backlog, In Analysis, Portfolio Backlog, Implementing, Done
- Top toolbar with Strategic Theme filter chips (colored pills)
- Columns have header: name + epic count + WIP limit badge

CARD (Hybrid density — key differentiator):
- Background #111114, border #2a2a2f, border-radius 8px
- Drag handle strip at top (subtle grip icon, border-bottom)
- Epic title: 13px medium, max 2 lines, color #e1e1e3
- Badges row: theme pill (purple, e.g. "● Platform") + status pill (green, e.g. "In Analysis")
- AI INVEST score bar: always visible, compact, label "✦ INVEST", percentage right, bar color purple (#7c6af7). Orange if <50% with ⚠ icon. This is the SIGNATURE DIFFERENTIATOR — must be prominent but not loud.
- Footer: "4 feats · WSJF 8.2" left, "2 OKRs" right, two small icon links

CARD HOVER STATE:
- Border brightens to #4a4a6f
- Reveals: BV/TC/RR score breakdown + 2 assignee avatar circles + due date

TASK CREATION PANEL (modal, 480px wide):
- Topbar: type selector dropdown (Epic/Feature/Story) + breadcrumb + status badge
- Title input (18px, minimal) with 3 AI suggestion chips below it
- Template chips row (Linear-style horizontal): SAFe Epic | Tech Debt | Compliance | Innovation | + Create template
- 2-column meta grid: Assignee (avatar picker), Team (auto-fill), Co-authors, WSJF, OKRs, Type
- Description rich text area with 3 AI inline buttons below: "✦ Improve summary", "✦ Generate AC", "✦ Check INVEST"
- AI Action Buttons row (label "Open with AI"):
  * 5 fully circular buttons (36×36px), each with brand color
  * On hover: expands RIGHT showing unique phrase per AI
  * Claude (orange gradient): "Let's rock!"
  * Claude Code (dark navy + purple border): "No mistakes! (lol)"
  * ChatGPT (green): "Let's do it faster!"
  * Gemini (blue): "Think deeper!"
  * Perplexity (dark gray): "Search the world!"
- Footer: Cancel + Create Epic buttons

MULTIPLAYER: Colored named cursor overlays floating above board.

FEEL: Users are migrating FROM Jira. This must feel like relief — "finally beautiful AND complete". Linear's clarity, Notion's warmth, an AI copilot baked in. Dark, elegant, purposeful. NOT enterprise software aesthetics.

Show 3 screens:
1. Full board view (4 columns, 3-4 cards each, one card with orange ⚠ AI score)
2. Card hover state (expanded details)
3. Task creation panel (open, filled with example data, AI buttons expanded on Claude Code)
```

---

## 9. Open Questions

- [ ] AI score no card: INVEST só, ou rotaciona entre INVEST/STAR/Granularidade?
- [ ] Side panel análise IA: full drawer ou split 60/40 (kanban visível)?
- [ ] Quick-add inline tipo Trello vs modal tipo Linear?
- [ ] Backlink graph (Obsidian-style) — Sprint 1 ou backlog?
- [ ] WIP limits: hard block ou soft warning?
- [ ] AI buttons: copiar contexto + abrir URL, ou integração nativa via API?
- [ ] Templates: escopo por workspace, ou por usuário também?
