# Cosmos Design System — Descrição para Claude Design

## Tokens de Design

### Cores (Light Mode)
- Canvas (fundo geral): `#f4f5f8`
- Surface (cards): `#ffffff`
- Surface-2 (headers, hover): `#f6f7f9`
- Surface-3 (separadores): `#eef0f4`
- Sidebar: `#fbfbfd`
- Borda sutil (hairline): `#e7e9ee`
- Borda forte: `#d8dbe2`
- Texto principal: `#11151f`
- Texto secundário: `#586173`
- Texto sutil: `#8b94a4`
- Texto fraco: `#aeb6c2`
- Accent (brand): `#5e6ad2` (índigo Linear)
- Verde: `#16a34a` | Vermelho: `#e11d48` | Amber: `#d97706` | Azul: `#2563eb` | Roxo: `#7c3aed`

### Cores (Dark Mode)
- Canvas: `#070b14` | Surface: `#0e1422` | Surface-2: `#131b2c`
- Sidebar: `#0a0f1b`
- Texto: `#eef2f8` | Secundário: `#93a1b3`
- Accent dark: `#7c87ff`

### Sombras
- Card rest: `0 1px 2px rgba(16,22,40,.05), 0 4px 14px -8px rgba(16,22,40,.10)`
- Card hover: `0 2px 4px rgba(16,22,40,.06), 0 18px 36px -20px rgba(94,106,210,.30)`

### Raios
- `xs=6px` `sm=8px` `md=10px` `lg=14px` `xl=18px` `pill=999px`

### Tipografia
- Título de página: `26px bold tracking-[-0.025em]`
- Título de seção: `14.5px semibold tracking-[-0.01em]`
- Label KPI: `12.5px muted`
- Valor KPI: `38px bold mono tracking-[-0.02em]`
- Badge/chip: `11.5px bold tracking-[0.01em]`
- Metadado pequeno: `10–11px mono`

---

## 1. App Shell (Layout Autenticado)

**Estrutura:**
```
<html data-theme="light|dark">
  <body>
    <SidebarProvider>         ← gerencia estado aberto/fechado (cookie)
      <Sidebar variant="inset">  ← sidebar à esquerda, ~240px
      <SidebarInset>             ← conteúdo principal, flex-1
```

**Sidebar — `GlobalSidebar`**
- Header: `WorkspaceSwitcher` (logo + nome do workspace, dropdown de troca de tenant)
- Barra de busca (`Search`) logo abaixo do header
- Nav principal: 7 grupos colapsáveis com ícone + label + `ChevronRight` que rotaciona ao expandir
  - Portfolio / ART Board / Times / Analytics / Workflows / Large Solution / Settings / Integrações
  - Sub-itens: sem ícone, apenas texto, indentados
- Nav secundária (empurrada pro fundo com `mt-auto`): Webhooks, Notificações, Perfil, Suporte, Feedback
- Footer: `CopilotTriggerButton` + botão link fullscreen | `UserButton` (avatar+nome) + `ModeToggle` + `NotificationsTrigger`

---

## 2. Page Template

Padrão usado em todas as páginas autenticadas.

```
<div class="flex w-full min-w-0 flex-col h-full">          ← shell

  <header class="border-b px-6 py-5">                     ← pageHeader
    <h1 class="text-[1.625rem] font-bold tracking-[-0.025em]">Título</h1>
    <p class="mt-1 text-sm text-muted-foreground">Subtítulo</p>
    <div class="mt-2.5 h-[3px] w-10 rounded-full bg-primary" />  ← accentBar
  </header>

  <div class="min-w-0 flex-1 overflow-y-auto p-6">         ← bodyScroll
    {conteúdo da página}
  </div>

</div>
```

**Problema atual:** accent bar é um traço curto fixo de 40px — pouco impacto visual. Poderia ser mais expressiva com gradiente ou animação no enter.

---

## 3. KPI Card (`KpiCard`)

**Dimensões:** `min-h-[152px]`, `rounded-[18px]`, `p-[20px_22px]`, `border border-hairline`

**Estrutura interna (flex-col):**
```
[Fundo radial-gradient sutil do tone color — invisível em repouso, intensifica no hover]

  [Topo]
    Label: 12.5px, text-ink-muted, uppercase tracking largo
    Ícone (opcional): badge quadrado rounded-[10px], cor do tone, 16px

  [Meio — mt-auto]
    Valor: 38px bold mono, cor do tone (diferente em light/dark)
    Unidade (opcional): 24px semibold, opacity-80

  [Rodapé]
    Delta badge: pill, bg-green/red-soft, cor-text, ↑↓ + valor
    Hint: 12px text-muted-foreground
```

**Hover state:** glow ring `0 0 0 2px rgba(tone,.55)` + `0 8px 40px -4px rgba(tone,.65)` + `0 20px 60px -12px rgba(tone,.35)`

**Tones disponíveis:** `accent` (índigo) | `green` | `red` | `amber` | `blue` | `purple`

**Problema atual:** a distinção entre dark/light no valor usa `aria-hidden` duplicado — visualmente inconsistente. A barra de delta poderia ter um sparkline inline.

---

## 4. Section Card (`SectionCard`)

**Estrutura:**
```
<section class="overflow-hidden rounded-lg border border-hairline bg-surface shadow-[card-shadow]">

  <header class="flex items-center gap-3 border-b bg-surface-2 px-[18px] py-[13px]">
    [Ícone opcional — shrink-0 text-ink-muted]
    <div>
      <div class="font-display font-semibold text-[14.5px] text-ink tracking-[-0.01em]">
        Título
      </div>
      <div class="text-[12.5px] text-ink-muted truncate">Descrição</div>
    </div>
    [Action opcional — ml-auto shrink-0]
  </header>

  <div class="p-[18px]">
    {children}
  </div>

</section>
```

**Problema atual:** header usa `bg-surface-2` com `border-b border-hairline` — sutil demais, o header quase se dissolve na surface do card. Poderia ter uma linha de accent no topo (3px) para cada tipo de seção.

---

## 5. Kanban Card (`KanbanCard`)

**Dimensões:** `rounded-lg border border-hairline bg-card shadow-[card-shadow]`

**Estrutura interna:**
```
[Opcional: barra de cor do tema estratégico — h-0.5 w-full rounded-t-lg]
[InvestScoreBar — barra horizontal de score INVEST, rounded-none]

<div class="px-3 pt-2.5 pb-2">

  [Título — button 13px font-medium, hover:text-primary]

  [Metadata row — flex-wrap gap-2]
    Feature count: mono 10px text-muted
    INVEST badge: rounded pill, verde/amber/vermelho baseado em score
    Type badge (se != EPIC): rounded bg-indigo-50, mono 9px uppercase
    WSJF score: rounded border-border/60 bg-muted/40, mono 10px
    ⚠ BLOCKED: 9px red-600 semibold

  [WSJF breakdown — aparece no hover/focus, AnimatePresence]
    grid 4 cols: BV | TC | RR | JS — cada um 9px label + 11px mono valor

  [OKR indicator — se linkedOKRCount > 0]
    ◆ N OKRs — 9px text-indigo-500

  [Rodapé — border-t border-border/40 px-3 py-1.5]
    Link "Épico" (ExternalLink 3w) | Link "Features" (LayoutGrid 3w)
    ambos 11px text-muted hover:text-foreground

</div>
```

**Estados:**
- Drag: `rotate-1 opacity-50 shadow-lg`
- Hover: `-translate-y-[2px] border-hairline-strong shadow-[hover-shadow]`
- INVEST warning: borda `border-yellow-400/60` quando score < 50

**Problema atual:** card tem muita informação densa sem hierarquia clara. WSJF breakdown em hover é inteligente mas pouco descobrível. InvestScoreBar visualmente forte mas sem label ao lado.

---

## 6. Kanban Column

**Estrutura:**
```
<div class="flex flex-col rounded-md border border-border bg-card">

  <div [drag handle] class="flex items-center justify-center py-1 cursor-grab border-b border-border/40">
    <GripVertical 3w text-muted-foreground/30 group-hover:text-muted-foreground/60 />
  </div>

  <div class="flex min-h-0 flex-1 flex-col">
    <Link href="/epics/{id}" class="flex flex-col gap-2 px-3 py-2.5">
      [título do épico, status badge, etc.]
    </Link>
  </div>

</div>
```

---

## 7. CosmosButton

**Variantes:**
| Variante | Background | Borda | Texto |
|----------|-----------|-------|-------|
| `primary` | `#5e6ad2` (accent-c) | accent-c | white |
| `secondary` | surface | hairline-strong | ink |
| `ghost` | transparent | transparent | ink-muted |
| `soft` | accent-soft | accent/20% | accent-text |
| `danger` | red-soft | red/20% | red-text |

**Tamanhos:**
- `sm`: `px-3 py-[5px] text-[12.5px] rounded-sm`
- `md`: `px-[14px] py-2 text-sm rounded-md`
- `lg`: `px-[18px] py-[11px] text-[14.5px] rounded-md`

**Primary box-shadow:** `0 1px 2px rgba(accent,.4), 0 4px 12px -6px rgba(accent,.5)`

---

## 8. Badge (Cosmos)

**Forma:** `rounded-pill px-[9px] py-[3px] font-bold text-[11.5px] tracking-[0.01em]`

**Tones:** `green` | `red` | `amber` | `blue` | `purple` | `accent` | `neutral`

Para cada tone:
- `bg = {tone}-soft`
- `color = {tone}-text`
- `border = rgba({tone}-rgb,.22)`

Dot opcional: `w-1.5 h-1.5 rounded-full` na mesma cor do texto.

---

## Hierarquia de Superfícies

Do mais fundo ao mais elevado:

```
canvas (#f4f5f8)          ← fundo da página, bg-muted/20
  └─ surface (#fff)       ← cards, section cards
       └─ surface-2       ← headers de seção, hover states
            └─ surface-3  ← chips, inputs, separadores
                 └─ sidebar (#fbfbfd)  ← levemente mais clara que canvas
```

**Dark mode equivalente:**
```
canvas (#070b14)
  └─ surface (#0e1422)
       └─ surface-2 (#131b2c)
            └─ surface-3 (#18223a)
                 └─ sidebar (#0a0f1b)
```

---

## Problemas Identificados para Melhorar

1. **Page headers** — accent bar de 40px muito pequena, pouco impacto visual
2. **Section Card headers** — muito sutil, se mistura com o body do card
3. **KPI Cards dark mode** — gradiente de fundo existe mas pouco expressivo em comparação com o hover state
4. **Kanban Card** — hierarquia tipográfica precisa: título > metadados > ações, muito denso
5. **Sidebar nav** — grupos colapsáveis sem animação de background no item ativo
6. **Espaçamento geral** — `p-6` em bodyScroll + `px-5/6` em headers cria ritmo ok, mas gap entre KPI cards e seções abaixo poderia usar mais respiro
