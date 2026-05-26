# Cosmos Kanban Portfolio — Design Spec v0.1
**Date:** 2026-05-25  
**Status:** Prototyping  
**Style base:** Option B — Hybrid (Linear clarity + SAFe data + passive AI score)

---

## Vision

> "O kanban que analisa seus épicos enquanto você os move."

Diferencial de mercado: única ferramenta SAFe que combina UX Linear com análise IA passiva visível diretamente nos cards. Sem abrir painéis. Sem clicar. O score aparece enquanto o RTE planeja.

---

## Design Principles

1. **Clareza primeiro** — Linear-style: sem ruído, sem bordas desnecessárias, dark background
2. **SAFe-native** — WSJF, OKRs, temas estratégicos, features são cidadãos de primeira classe
3. **IA passiva** — scores INVEST/STAR/granularidade aparecem no card, não escondem atrás de clique
4. **Progressive disclosure** — card compacto → hover expande → click abre painel completo
5. **Multiplayer-ready** — presença de cursores, edição colaborativa são partes do design (já implementado)

---

## Card Anatomy (Option B — Hybrid)

```
┌─────────────────────────────────────────┐
│  ░░ [drag handle - top strip]           │
├─────────────────────────────────────────┤
│  ● Migração para microserviços          │
│    (título, 2 linhas máx)               │
│                                         │
│  [● Platform]  [In Analysis]            │
│   (tema badge)  (status badge)          │
│                                         │
│  ┌─ ✦ INVEST ──────────────── 72% ─┐   │
│  │  ████████████████░░░░░░░░░░░░  │   │
│  └──────────────────────────────────┘   │
│   (AI score bar — passivo, sempre vis.) │
├─────────────────────────────────────────┤
│  4 feats · WSJF 8.2    2 OKRs  [→][⊞] │
│  (footer: meta + links rápidos)         │
└─────────────────────────────────────────┘
```

### Card States
- **Default**: anatomia acima
- **Hover**: expande suavemente mostrando BV/TC/RR scores breakdown + assignee avatars + due date
- **Dragging**: opacity 50% + ring primary, ghost overlay rotado 2deg
- **AI Warning**: score < 50% → barra amarela/laranja + ícone ⚠ + tooltip "Especificação fraca"

---

## AI Analysis Layer (Passive)

Score visível no card (compacto, barra):
- **INVEST** — Independent, Negotiable, Valuable, Estimable, Small, Testable
- **STAR** — Situation, Task, Action, Result (para acceptance criteria)
- **Granularidade** — épico muito grande? features bem divididas?

Score calculado via LLM ao salvar/modificar título + description + acceptance criteria.  
Cache por hash do conteúdo (não recalcula sem mudança).

### Score Visual
- 0–49%: barra laranja + `⚠` (card destaca-se levemente)
- 50–74%: barra amarela/neutra
- 75–100%: barra verde/violeta (cor tema)

Click no score → side panel com:
- Breakdown INVEST critério a critério
- Sugestões concretas de melhoria ("Adicione critério de aceite mensurável")
- Botão "Melhorar com IA" → draft de nova descrição

---

## Board Layout

```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│   Backlog    │  In Analysis │   Portfolio  │ Implementing │
│   (n epics)  │   (n epics)  │   Backlog    │  (n epics)   │
│              │              │   (n epics)  │              │
│  [card]      │  [card]      │  [card]      │  [card]      │
│  [card]      │  [card ⚠]   │  [card]      │  [card]      │
│  [card]      │              │              │              │
│              │              │              │              │
│  + Add Epic  │              │              │              │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

### Board Features (inspirações)
| Feature | Inspiração | Descrição |
|---------|-----------|-----------|
| Theme filter toolbar | Linear | Chips por tema estratégico, filtra inline |
| Column WIP limits | Kanban clássico | Badge na coluna quando excede limite |
| Multiplayer cursors | Figma | Cursores nomeados e coloridos em tempo real |
| Backlink graph view | Obsidian | Mini-grafo de dependências entre épicos (futuro) |
| Quick-add card | Trello | Click em "+ Add Epic" no fim da coluna |
| Cycle/Sprint badge | Linear | Badge de PI Planning iteration no card |
| Bulk AI analysis | Cosmos-native | "Analisar todos" → processa fila de épicos |

---

## Color & Typography (Dark-first)

```
Background card:    #0f0f11
Border card:        #2a2a2f (default) / #3a3a4f (hover)
Text primary:       #e1e1e3
Text secondary:     #888890
Theme accent:       variável por tema estratégico
AI purple:          #7c6af7 / #a89cff
AI bar bg:          #1a1520
AI bar border:      #4a3060
Score warning:      #f59e0b
Score ok:           #4ade80
```

---

## Claude Design Prompt

> Use o prompt abaixo para prototipagem no Claude Design / Figma Make / v0:

```
Design a SAFe portfolio kanban board for Cosmos, a enterprise agile planning platform.

STYLE: Dark theme, Linear-inspired minimalism with SAFe-native data density. Background #0f0f11, card border #2a2a2f, primary text #e1e1e3, accent purple #7c6af7.

BOARD: Horizontal columns (Backlog, In Analysis, Portfolio Backlog, Implementing, Done). Each column has a header with name, epic count, and WIP limit badge. Columns scroll vertically. Top toolbar has strategic theme filter chips.

CARD (hybrid density — the key differentiator):
- Drag handle strip at top (subtle grip icon)
- Epic title (13px, medium weight, max 2 lines)
- Theme badge (colored pill, e.g. "● Platform" in purple)
- Status badge (colored pill, e.g. "In Analysis" in green)
- AI INVEST score bar: purple bar labeled "✦ INVEST" with percentage (e.g. 72%). This is always visible, passive, compact — NOT behind a click. Bar color: orange if <50%, yellow 50-74%, purple/green 75%+
- Footer: "4 feats · WSJF 8.2" on left, "2 OKRs" on right, two small icon links

HOVER STATE: Card border brightens, reveals BV/TC/RR scores and assignee avatars.

MULTIPLAYER: Small colored cursor overlays with user name tags floating above the board.

FEEL: This replaces Jira. Users should feel "finally, something that doesn't look like enterprise software" while having ALL the SAFe data they need. Think Linear meets Notion meets an AI copilot.

Show: full board view (4 columns, 3-4 cards each), one card in hover state, one card with AI warning (orange bar, ⚠ icon).
```

---

## Open Questions (para próxima sessão)
- [ ] Quais scores IA mostrar no card? (INVEST só, ou INVEST+STAR+Granularidade como tabs?)
- [ ] Side panel: full-width drawer ou split 60/40 com kanban visível?
- [ ] Quick-add inline (como Trello) ou modal (como Linear)?
- [ ] Backlink graph (Obsidian) — sprint 1 ou backlog?
- [ ] WIP limits: hard block (não deixa mover) ou soft warning?
