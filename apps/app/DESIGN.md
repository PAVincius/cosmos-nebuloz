---
name: Casca do apps/app
description: "A casca em volta dos produtos (login, onboarding, configurações, hub de produtos e páginas-portão): shadcn/ui sobre Tailwind v4 lendo os tokens de globals.css, com cartões portados do handoff do Cosmos, escura por padrão e em PT-BR."
colors:
  accent-c: "#7c87ff"
  accent-text: "#c7ccff"
  accent-soft: "rgba(124, 135, 255, 0.14)"
  primary: "oklch(0.55 0.22 264)"
  primary-foreground: "oklch(0.985 0 0)"
  ring: "oklch(0.5 0.16 264)"
  canvas: "#070b14"
  background: "oklch(0.09 0.003 280)"
  surface: "#0e1422"
  surface-2: "#131b2c"
  surface-3: "#18223a"
  card: "oklch(0.14 0.005 280)"
  muted: "oklch(0.18 0.007 280)"
  accent: "oklch(0.23 0.009 280)"
  sidebar: "#0a0f1b"
  sidebar-foreground: "#93a1b3"
  sidebar-accent: "#131b2c"
  sidebar-accent-foreground: "#eef2f8"
  hairline: "rgba(255, 255, 255, 0.075)"
  hairline-strong: "rgba(255, 255, 255, 0.15)"
  border: "oklch(0.21 0.009 280)"
  ink: "#eef2f8"
  ink-muted: "#93a1b3"
  ink-subtle: "#8fa0ba"
  ink-faint: "#7f8ea8"
  foreground: "oklch(0.91 0.002 280)"
  muted-foreground: "oklch(0.68 0.005 280)"
  chip-bg: "rgba(255, 255, 255, 0.05)"
  destructive: "oklch(0.5 0.22 27)"
  green: "#34d399"
  green-text: "#7ff0bf"
  red: "#fb7185"
  red-text: "#fda4af"
  amber: "#fbbf24"
  amber-text: "#fcd34d"
  blue: "#60a5fa"
  blue-text: "#bfdbfe"
  purple: "#a78bfa"
  purple-text: "#ddd6fe"
  brand-panel: "#0b0e17"
  light-accent-c: "#5e6ad2"
  light-accent-text: "#4b54b8"
  light-primary: "oklch(0.52 0.2 264)"
  light-canvas: "#f4f5f8"
  light-background: "oklch(0.98 0 0)"
  light-surface: "#fff"
  light-surface-2: "#f6f7f9"
  light-surface-3: "#eef0f4"
  light-accent: "oklch(0.94 0.003 280)"
  light-sidebar: "#fbfbfd"
  light-hairline: "#e7e9ee"
  light-hairline-strong: "#d8dbe2"
  light-border: "oklch(0.88 0.004 280)"
  light-ink: "#11151f"
  light-ink-muted: "#586173"
  light-ink-subtle: "#8b94a4"
  light-ink-faint: "#aeb6c2"
  light-foreground: "oklch(0.14 0.005 280)"
  light-muted-foreground: "oklch(0.5 0.005 280)"
  light-destructive: "oklch(0.55 0.22 27)"
  light-green-text: "#15803d"
  light-red-text: "#be123c"
  light-amber-text: "#b45309"
  light-blue-text: "#1d4ed8"
  light-purple-text: "#6d28d9"
typography:
  display:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "2.1rem"
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontSize: "25px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 700
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Manrope, Geist, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.43
  label:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "10px"
    fontWeight: 700
    letterSpacing: "0.14em"
  numeral:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.02em"
rounded:
  sm: "4px"
  md: "10px"
  lg: "12px"
  xl: "16px"
  pill: "999px"
spacing:
  page: "24px"
  stack: "24px"
  card: "16px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "8px 16px"
  button-outline:
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "8px 16px"
  input:
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "4px 12px"
  nav-item:
    textColor: "{colors.sidebar-foreground}"
    rounded: "{rounded.md}"
    height: "32px"
    padding: "8px"
  nav-item-active:
    backgroundColor: "{colors.sidebar-accent}"
    textColor: "{colors.sidebar-accent-foreground}"
  sidebar:
    backgroundColor: "{colors.sidebar}"
    width: "256px"
  page-header:
    typography: "{typography.headline}"
    padding: "22px 32px 20px"
  section-card:
    backgroundColor: "{colors.surface}"
    rounded: "14px"
    padding: "{spacing.card}"
  section-card-head:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    padding: "12px 16px"
  badge:
    backgroundColor: "{colors.chip-bg}"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.pill}"
    padding: "3px 9px"
  relation-chip:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.pill}"
    padding: "4px 10px 4px 4px"
  relation-chip-hover:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.ink}"
  product-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: "20px"
  gate-card:
    backgroundColor: "{colors.surface}"
    rounded: "18px"
    padding: "28px"
    width: "560px"
  brand-panel:
    backgroundColor: "{colors.brand-panel}"
    padding: "48px"
---

# Design System: casca do apps/app

> **Escopo.** Tudo em `apps/app/**` que não fica sob uma raiz de produto. `.impeccable/config.json` declara `projectRoots: ["apps/app/components/*"]`, então `components/{charter,cosmos,meridian,scaffold,signal}` têm DESIGN.md próprio; o resto do workspace resolve para este arquivo. Na prática:
> - a casca autenticada `app/(authenticated)/**`: o layout com `SidebarProvider.cosmos-shell` e `GlobalSidebar`, os componentes locais de `components/` (page-header, section-card, kpi-card, modal-shell, data-table, relation-chip, wizard-ui, workspace-switcher, user-button), o onboarding de empresa e de migração, `/settings/*` (workspace, members, roles, sso, audit, integrations, integrations/meeting, reports), `/produto`, `/profile` e `/`, que redireciona para `/cosmos/dashboard`;
> - `app/(unauthenticated)/**`: sign-in, sign-up, forgot-password e invite;
> - `app/onboarding/` (primeiro acesso, fora da casca autenticada) e as páginas-portão `app/{charter,signal,meridian,scaffold}-indisponivel`;
> - `app/layout.tsx` e `app/styles.css` (fontes, tema, reskin `.cosmos-shell`) e `lib/app-design.ts`.
>
> Os route groups de produto `app/(cosmos|charter|meridian|scaffold|signal)/**` e `app/meridian-responder/[token]` também caem aqui pela resolução de caminho, mas só montam a casca e as telas de `components/<produto>` e importam a folha de estilo do produto. Para o que eles renderizam, a autoridade visual é o DESIGN.md da raiz daquele produto; o do Cosmos está em `components/cosmos/DESIGN.md`. Os tokens e primitivas que a casca consome vêm de `packages/design-system` (`styles/globals.css`, `lib/fonts.ts`, `components/ui/*` do shadcn e `components/cosmos/badge.tsx`).
>
> **Origem.** Este arquivo é o antigo `DESIGN.app.md` da raiz, movido e reescrito no formato canônico em 2026-09-22 a partir do código em `main@ea512044`. Cada decisão dele foi conferida no código: o que continua valendo está marcado **(vigente)**; o que o código não sustenta mais está marcado **(obsoleto)**, com o que o substituiu. O `DESIGN.md` da raiz descreve o site (canvas `#010102`) e não é autoridade aqui.

## Overview

**Creative North Star: "A Antessala da Cadência"**

A casca é o que se atravessa para chegar a um produto: login, primeiro acesso, onboarding de empresa e de migração, configurações do workspace, o hub `/produto` e as páginas-portão que explicam por que uma porta está fechada. Ninguém trabalha aqui. A casca existe para orientar e sair do caminho, e seu único ornamento é a estrutura que o produto organiza: o trilho do login desenha as cinco iterações e a janela de IP de um PI, porque, como diz o código, desenhá-lo "diz mais sobre o produto do que ilustrar o 'cosmos' do nome" (`(unauthenticated)/layout.tsx`).

Densidade enterprise, sem enfeite de marketing **(vigente)**: tabela, formulário e cartão legíveis na primeira leitura, com a copy em PT-BR **(vigente)**. A cor segue a decisão de um acento só, lavanda, para CTA, link ativo e foco **(vigente)**, mas o código hoje renderiza três (ver Colors). Superfície em camadas, fio fino e sombra baixa fazem a profundidade **(vigente)**. O painel de marca do login é escuro nos dois temas, por decisão registrada no próprio layout.

Dois dialetos convivem, e isto é descrição, não recomendação. Um é o shadcn/ui sobre Tailwind v4, lendo os tokens semânticos em oklch (`--primary`, `--background`, `--muted-foreground`): formulários, wizards, sidebar, diálogos. O outro são os cartões portados do handoff do Cosmos (`PageHeader`, `SectionCard`, `ModalShell`, os cartões de `/settings/workspace`), em estilo inline lendo os tokens curtos (`--surface`, `--hairline`, `--ink`). `appDesign` (`lib/app-design.ts`) é a ponte: classes Tailwind apontadas para os tokens curtos.

**Key Characteristics:**
- Escura por padrão (`defaultTheme="dark"`, `enableSystem={false}`, `storageKey="cosmos-theme"`), com o tema em `data-theme` no `<html>`.
- Tokens em `packages/design-system/styles/globals.css`, mais um reskin escuro `.cosmos-shell` em `app/styles.css`, válido só dentro do `SidebarProvider`.
- Manrope como fonte padrão, Space Grotesk nos títulos e JetBrains Mono em rótulo e número.
- Navegação curta: a sidebar só lista rota que existe, e são cinco.
- Portão que explica: quem não entra lê o motivo e sabe quem resolve.
- Erro de leitura nunca vira estado vazio.

## Colors

Duas camadas de token (os tokens curtos do design system, em hex, e os semânticos do shadcn, em oklch) e um reskin escuro dentro do `SidebarProvider`. As chaves sem prefixo são o tema escuro, que é o padrão; as `light-*` são o claro. Os valores do frontmatter são os globais: no escuro, dentro do `SidebarProvider`, sete deles são sobrescritos (ver Reskin `.cosmos-shell`).

### Primary
- **Lavanda de Marca** (`accent-c`, #7c87ff no escuro; **Lavanda Linear**, #5e6ad2, no claro): o acento da decisão registrada, "um accent para CTAs, links ativos e foco, não decoração" **(vigente)**. É o `--accent-c` do Tailwind (`bg-accent-c`), o losango do login e a `theme-color` do app (`app/layout.tsx`).
- **Azul Cobalto do shadcn** (`primary`, oklch(0.55 0.22 264), ≈ #2b62ef; no claro oklch(0.52 0.2 264), ≈ #2a5cda): fundo do `Button` padrão, `text-primary` de link e destaque, `bg-primary/15` dos ícones do hub. O comentário de `globals.css` o chama de "lavender-blue", mas matiz 264 com croma 0.22 é azul, praticamente o azul de estado #2563eb.
- **Azul do Anel** (`ring`, oklch(0.5 0.16 264), ≈ #325cbd): anel de foco dos componentes shadcn (3px a 50%). O comentário "~#5e69d1" também não confere.
- **Lavanda Clara** e **Véu Lavanda** (`accent-text`, `accent-soft`): texto e fundo de acento dos cartões portados e dos chips.

### Neutral
- **Azul-Naval Profundo** (`canvas`, #070b14; **Névoa Fria**, #f4f5f8, no claro): fundo da casca autenticada, que o reskin troca no escuro (ver abaixo).
- **Preto Linear** (`background`, oklch(0.09 0.003 280), ≈ #020203; claro oklch(0.98 0 0)): fundo do `<body>`. É o que aparece atrás do login, do onboarding de primeiro acesso e das páginas-portão.
- **Casco Naval**, **Casco Elevado** e **Casco Alto** (`surface`, `surface-2`, `surface-3`; claro #fff, #f6f7f9, #eef0f4): cartões portados, cabeçalho de seção, chips e hover.
- **Grafite Profundo** (`card`, ≈ #09090b) e **Grafite** (`muted`, ≈ #111115): o `Card` e as superfícies neutras do shadcn. O `Card` do shadcn fica quase preto sobre o canvas naval.
- **Grafite de Hover** (`accent`, ≈ #1c1d21; claro oklch(0.94 0.003 280), ≈ #ebebed): hover do `ghost` e do `outline` do shadcn. É superfície, não acento (ver The Swapped-Name Rule).
- **Trilho Noturno** (`sidebar`, #0a0f1b; #fbfbfd no claro), com `sidebar-foreground` (#93a1b3) e o item ativo em `sidebar-accent` (#131b2c) e `sidebar-accent-foreground` (#eef2f8).
- **Fio de Luz**, **Fio Firme** (`hairline`, `hairline-strong`) e **Fio Grafite** (`border`, ≈ #17181c; claro ≈ #d7d7da): os dois primeiros nos cartões portados, o terceiro nos componentes shadcn.
- **Branco Gelo** (`ink`, #eef2f8) e **Cinza Gelo** (`foreground`, ≈ #e1e1e2): texto principal nos dois dialetos. **Aço Claro** (`ink-muted`, #93a1b3), **Aço Azulado Claro** (`ink-subtle`, #8fa0ba), **Aço Azulado** (`ink-faint`, #7f8ea8) e **Cinza Médio** (`muted-foreground`, ≈ #97989b): texto secundário, metadado e rótulo.
- **Painel de marca** (`brand-panel`, #0b0e17): o lado esquerdo do login, igual nos dois temas.

### Estados
Os mesmos cinco tons do Cosmos (`globals.css`), com `-soft` e `-text` para chip e texto, e o `destructive` do shadcn (≈ #bc0012 no escuro) para botão destrutivo e erro de formulário. O reskin escuro desafina o azul para #5b8def, "para que nunca leia como o acento".

> **Obsoleto (DESIGN.app.md, "Semântica SAFe"):** "WSJF alto / médio / baixo: classes `wsjf-high`, `wsjf-medium`, `muted`" e "Estados de épico: badges `outline` / `secondary` por `statusId`". Os tokens `--wsjf-*`, `--safe-*`, `--roam-*` e `--pi-*` seguem em `globals.css`, mapeados no Tailwind, mas nenhum arquivo de `apps/app` os usa [grep]. A priorização WSJF e os estados de épico saíram da casca: vivem no Cosmos, com o Badge do kit por tom (ver `components/cosmos/DESIGN.md`). O padrão de estado → variante do Badge do shadcn sobrevive em `/produto`, para o estado do contrato.

### Reskin `.cosmos-shell` (escuro, dentro do `SidebarProvider`)
`app/styles.css` chama o bloco de "COSMOS re-skin — Vega / Cosmos Black brand override". Ele vale só com `data-theme="dark"`, e só dentro do `SidebarProvider` da casca autenticada; login, onboarding de primeiro acesso e páginas-portão ficam fora dele.

| Token | Global | No reskin |
|---|---|---|
| `canvas` | #070b14 | #0a0e27 |
| `surface` / `surface-2` / `surface-3` | #0e1422 / #131b2c / #18223a | #0e1330 / #141a3d / #1a2150 |
| `surface-4` | não existe | #212865 |
| `sidebar` | #0a0f1b | #080b20 |
| `accent-c` / `accent-rgb` | #7c87ff / 124, 135, 255 | #00d4ff / 0, 212, 255 |
| `accent-soft` / `accent-text` | lavanda a 14% / #c7ccff | ciano a 14% / #7fe8ff |
| `on-accent`, `on-solid` | não existem | o canvas |
| `sidebar-primary` / `sidebar-ring` | #7c87ff / lavanda a 50% | #00d4ff / ciano a 50% |
| `blue` / `blue-text` | #60a5fa / #bfdbfe | #5b8def / #a9c4f5 |

O ciano é o acento pré-pivô do Cosmos: `apps/web` já o aposentou ("Retuned off the pre-pivot Cosmos accents (#00d4ff / #7c6cff)", `apps/web/app/[locale]/styles.css:875`). No escuro, a casca autenticada fala ciano enquanto o Cosmos, a um clique, fala lavanda, e o canvas também muda (#0a0e27 → #070b14) na passagem. **Decisão pendente:** retirar o acento do reskin (e talvez o canvas) ou reconfirmá-lo. Até lá ele não é referência para código novo.

### Named Rules
**The One Accent Rule.** (vigente; o código diverge) Um acento, lavanda, para CTA, link ativo e foco. Hoje há três: o azul do `--primary`, a lavanda do `--accent-c` e o ciano do reskin escuro. Código novo não introduz um quarto e não escreve hex: usa `bg-primary`/`text-primary` nos componentes shadcn e `var(--accent-c)` no estilo inline, para que realinhar dois tokens resolva a casca inteira.

**The Swapped-Name Rule.** `--accent` é a superfície de hover do shadcn (`oklch(0.23 0.009 280)` no escuro, `oklch(0.94 0.003 280)` no claro), não acento. Dois comentários do design system já avisam (`components/cosmos/kpi-card.tsx:45`, `cosmos-button.tsx:19`), e mesmo assim quatro lugares da casca caem nisso: o ícone do item ativo em `settings-nav.tsx:113` (≈1,1:1 no escuro, some), o avatar branco sobre `--accent` em `member-tone.ts:37` e `identity-card.tsx:74` (1,19:1 no claro) e o ícone padrão de `section-card.tsx:27`.

**The Layers Rule.** (vigente como princípio; tokens atualizados) Superfícies em camadas: `canvas` → `surface` → `surface-2`/`surface-3` no cabeçalho de seção.

> **Obsoleto (DESIGN.app.md, "Superfícies em camadas: background → card → muted/30"):** a cadeia agora é a dos tokens curtos; `muted/30` não é usado em cabeçalho de seção.
>
> **Obsoleto (DESIGN.app.md, tabela "Tokens"):** `accent` #5e6ad2 segue vigente como valor claro de `accent-c` (no escuro é #7c87ff). `accent-hover` #828fff não é usado em lugar nenhum [grep]; o hover do botão shadcn é `primary/90`. Os apelidos `ink` = `foreground`, `ink-muted` = `muted-foreground`, `surface` = `card` e `hairline` = `border` não valem mais: os tokens curtos são variáveis próprias com valores próprios (`--surface` #0e1422 contra `--card` ≈ #09090b, por exemplo).

### Contraste
Razões que o código documenta:
- `--muted-foreground` escuro subiu de 0.6 para 0.68 em oklch porque media 4,08:1 sobre `--chip-bg` (`globals.css:397`).
- No reskin, o canvas sobre o ciano dá cerca de 10,6:1, e o branco só 1,77:1; por isso `--on-accent` e `--on-solid` são o canvas lá (`app/styles.css:68-76`), e o `CosmosButton` repete o aviso (`cosmos-button.tsx:32-34`). Fora do reskin, `--on-accent` não existe, e quem o lê cai na reserva `#fff` (`audit-log-table.tsx:59`), que sobre #5e6ad2 dá 4,70:1.
- O QA de julho (`apps/app/.design-ref/QA_REPORT.md`) registrou `color-contrast` sério em 28 de 29 rotas da UI anterior ao `/cosmos`. É histórico: as rotas foram removidas.

Cálculo desta revisão (WCAG 2.x):
- No claro, os tokens curtos globais reprovam para texto: `--ink-subtle` #8b94a4 dá 3,06:1 e `--ink-faint` #aeb6c2 dá 2,04:1 sobre #fff. O `cosmos.css` corrigiu os dois só dentro de `.cosmos-root` (#5d6b80 e #656d7d), e a casca não herdou a correção. As páginas-portão escrevem `var(--ink-faint, #636c7b)` esperando cerca de 5:1 e recebem #aeb6c2.
- `primary-foreground` sobre `primary`: 4,91:1 no escuro e 5,52:1 no claro.
- `text-primary` como texto corrido: 4,05:1 sobre o `background` escuro e 3,71:1 sobre o canvas do reskin, abaixo de AA.
- `muted-foreground`: 7,19:1 no escuro e 5,66:1 no claro, sobre `background`.
- No painel de marca, o rodapé "Nebuloz · ano" (#454b5c) dá 2,22:1 sobre #0b0e17. O trilho é `aria-hidden`, mas as legendas dele (#565c6d) ficam em 2,89:1.

## Typography

**Display Font:** Space Grotesk (`--font-display` → `--font-space-grotesk`)
**Body Font:** Manrope (`font-sans` no `<html>`; `--font-sans` → `--font-manrope`, com Geist de reserva)
**Label/Mono Font:** JetBrains Mono (`--font-mono` → `--font-jetbrains-mono`)

**Character:** a mesma tríade do Cosmos, carregada por `next/font` em `packages/design-system/lib/fonts.ts`. A casca não tem escala de tamanho em token: o dialeto shadcn usa os degraus do Tailwind (`text-xs` 12px, `text-sm` 14px, `text-base` 16px, `text-2xl` 24px) e os cartões portados usam literais. A Manrope só carrega os pesos 500 a 800, então o `font-normal` (400) do shadcn renderiza em 500.

### Hierarchy
- **Display** (Space Grotesk 600, 2.1rem, 2.5rem no xl e 3rem no 2xl, entrelinha 1.08, -0.03em): só o manifesto do painel de marca do login.
- **Headline** (Space Grotesk 700, 25px, entrelinha 1.2, -0.025em): o `<h1>` do `PageHeader` da casca. O onboarding usa `text-2xl font-bold` (24px) em Manrope.
- **Title** (Space Grotesk 700, 14px, -0.01em): título do `SectionCard`. O título do cartão de produto é `text-base font-semibold` (16px).
- **Body** (Manrope 500, 14px `text-sm`, entrelinha de cerca de 1.43): corpo, campo, item de menu e botão.
- **Label** (JetBrains Mono 700, 10px, +0.14em, maiúsculas): breadcrumb do `PageHeader` e eyebrow das páginas-portão. Os rótulos da fileira de stats usam 9.5px e +0.10em.
- **Numeral** (JetBrains Mono 700, 20px, entrelinha 1, -0.02em): valor da fileira de stats do `PageHeader`.

### Named Rules
**The Mono-for-Data Rule.** Identificador, número, data e código vão em JetBrains Mono: breadcrumb, stats, eyebrow de chip e o "Cosmos" do login.

> **Obsoleto (DESIGN.app.md, tabela "Tipografia (Tailwind)"):** "Título de página `text-2xl font-bold tracking-tight`", "Subtítulo `text-sm text-muted-foreground mt-0.5`", "Título de secção `text-sm font-semibold tracking-tight`" e "Eyebrow `text-xs font-medium uppercase tracking-wide text-muted-foreground`". Nenhuma dessas classes é mais a fonte. O título real vem do componente `PageHeader` (25px, Space Grotesk), o subtítulo é 13.5px em `ink-muted`, o título de seção é o do `SectionCard` (14px, Space Grotesk) e o eyebrow é mono. `appDesign.pageTitle` virou 26px e não tem uso.

## Layout

- **Raiz:** `<html class={fonts}>` com o `DesignSystemProvider` (tema, tooltip e o `Toaster` do sonner); `body` com `min-h-[100dvh]` e `bg-background`.
- **Casca autenticada:** `SidebarProvider.cosmos-shell` → `Sidebar` do shadcn (`variant="inset"`, `collapsible="icon"`: 16rem aberta, 3rem recolhida, sheet de 18rem abaixo de 768px) + `SidebarInset`. Cada página compõe `appDesign.shell` (coluna flex) → `PageHeader` (padding de 22px 32px 20px) → `appDesign.bodyScroll` (scroll próprio, padding de 24px) → pilha `flex flex-col gap-6` (24px).
- **/settings/workspace:** grade `220px 1fr` com a navegação lateral de configurações; cartões internos em `1.3fr 1fr`.
- **/produto:** grade de 1 → 2 (md) → 3 (xl) colunas, com gap de 16px.
- **Onboarding:** o de primeiro acesso (`app/onboarding`) é uma coluna central `max-w-md` sobre `bg-background`. O de empresa e o de migração têm cabeçalho fixo "COSMOS · Setup" e conteúdo com scroll.
- **Login:** duas colunas a partir de `lg` (1.05fr / 1fr): painel de marca à esquerda (padding de 48px, 64px no xl) e formulário à direita, numa coluna de 380px. Abaixo de `lg` o painel some, e o losango com "Cosmos" sobe para o topo do formulário.
- **Páginas-portão:** um cartão de 560px, margem de 12vh, padding de 28px e raio de 18px.

Responsividade é pontual: a sidebar colapsa pelo shadcn, o login e o hub usam os breakpoints do Tailwind (md 768, lg 1024, xl 1280, 2xl 1536), e as grades das configurações (`220px 1fr`, `1.3fr 1fr`) não colapsam.

> **Vigente (DESIGN.app.md, tabela "Layout"):** "Shell de página `flex w-full min-w-0 flex-col`" (`appDesign.shell`, 15 usos) e "Corpo scroll `min-w-0 flex-1 overflow-y-auto p-6`" (`appDesign.bodyScroll`, 12 usos).
>
> **Obsoleto:** "Cabeçalho fixo `border-b border-border/80 px-6 py-4`": `appDesign.pageHeader` virou `px-6 py-5` e só o `loading.tsx` de `/settings/workspace` o usa; o cabeçalho real é o componente `PageHeader`. "Cartão de secção `rounded-lg border border-border/80 bg-card shadow-sm`": `appDesign.section` hoje é `rounded-xl border-hairline bg-surface` com `--card-shadow` (2 usos, em `/produto`); o cartão de seção real é o `SectionCard`, de 14px. "Cabeçalho de cartão `border-b border-border/60 bg-muted/30 px-5 py-3`": `appDesign.sectionHeader` virou `bg-surface-2 border-hairline` e não tem uso.

## Elevation & Depth

Dois regimes. Os componentes shadcn são chapados (no máximo `shadow-xs` em campo e botão outline). Os cartões portados carregam profundidade: cabeçalho em gradiente, fio de luz no topo e sombra escura curta.

### Shadow Vocabulary
- **Cartão em repouso** (`box-shadow: var(--card-shadow)`: claro `0 1px 2px rgba(16, 22, 40, 0.05), 0 4px 14px -8px rgba(16, 22, 40, 0.1)`; escuro `0 1px 0 rgba(255, 255, 255, 0.04) inset, 0 10px 30px -20px rgba(0, 0, 0, 0.8)`): `appDesign.section` e o cartão de produto.
- **Hover** (`box-shadow: var(--hover-shadow)`, com o tingimento de lavanda escrito como literal em `globals.css`): cartão de produto clicável, que também sobe 2px.
- **PageHeader** (`box-shadow: 0 1px 0 rgba(255, 255, 255, .08) inset, 0 18px 34px -20px rgba(0, 0, 0, .95), 0 3px 0 -1px rgba(0, 0, 0, .5)`): mais um brilho radial de lavanda embaixo (rgb literal 124, 135, 255).
- **SectionCard** (`box-shadow: 0 1px 0 rgba(255, 255, 255, .03) inset, 0 12px 28px -22px rgba(0, 0, 0, .9)`): cabeçalho com `0 1px 0 rgba(255, 255, 255, .06) inset, 0 8px 16px -12px rgba(0, 0, 0, .8)` e chip de ícone com `0 1px 0 rgba(255, 255, 255, .08) inset, 0 3px 8px -3px rgba(0, 0, 0, .8)`.
- **Campo e botão outline** (`shadow-xs`, `0 1px 2px 0 rgb(0 0 0 / 0.05)`).

As sombras dos cartões portados foram afinadas para o escuro (preto a 80–95%) e valem iguais no claro.

### Named Rules
**The Light-From-Above Rule.** Nos cartões portados, a superfície elevada tem um fio de luz de 1px no topo (inset branco de 3 a 8%, ou uma linha em gradiente no `PageHeader`). A luz vem de cima.

## Shapes

- **Escala do Tailwind**, derivada de `--radius: 0.5rem`: `sm` 4px, `md` 10px, `lg` 12px, `xl` 16px e `pill` 999px. O comentário de `globals.css` diz 8px para `--radius-md`, mas `calc(0.5rem + 2px)` resolve 10px. Botão, campo e item de menu do shadcn usam `rounded-md` (10px); `appDesign.section`, `rounded-xl` (16px); o ícone do hub, `rounded-lg` (12px); o Badge do shadcn, `rounded-full`.
- **Cartões portados:** raios literais de 14px (`SectionCard`), 18px (páginas-portão, e `--cosmos-r-xl` no `ModalShell`) e 8 a 10px em chips de ícone.
- **Marca:** o losango do login é um quadrado de 10px girado 45°, com raio de 2px, em #5e6ad2.
- **Ícones:** lucide-react importado direto (47 arquivos da casca), 16px nos menus (`[&_svg]:size-4`) e 11 a 15px nos cartões portados.

## Components

### Buttons
- **Shape:** `Button` do shadcn (`components/ui/button.tsx`), `rounded-md` (10px), alturas de 36px (default), 32px (sm) e 40px (lg); o ícone é um quadrado dessas medidas.
- **Primary:** `default` com fundo `primary`, texto `primary-foreground`, 14px em peso 500.
- **Hover / Focus:** o hover escurece o fundo para `primary/90`. O foco põe a borda em `ring` e um anel de 3px de `ring` a 50%. Desabilitado fica a 50% de opacidade, sem eventos; inválido, com anel `destructive`.
- **Secondary / Ghost / Tertiary:** `outline` (borda, `bg-background` e `shadow-xs`, hover `accent`; no escuro, `input/30` com hover `input/50`), `secondary`, `ghost` (hover na superfície `accent`), `link` (`text-primary`, sublinhado no hover) e `destructive`. A variante `glow` (anel cônico de `.btn-glow`) existe e não tem uso [grep]. O onboarding de primeiro acesso usa botões à mão: `rounded-lg bg-primary px-4 py-3 font-semibold`, hover em 90% de opacidade.

### Chips
- **Style:** o `Badge` de tom de `components/cosmos/badge.tsx` (pílula de 3px 9px, 11.5px em peso 700, +0.01em, fundo `-soft`, texto `-text`, borda do tom a 22%), usado em `/settings/workspace`; e o `Badge` do shadcn (`rounded-full`, 12px em peso 500, variantes `default`, `secondary`, `outline` e `destructive`).
- **State:** em `/produto`, o estado do contrato escolhe a variante: Ativo usa `default`, Não contratado usa `outline`, Suspenso, Cancelado e Vencido usam `destructive`, e "Em breve aqui" usa `secondary`. Nas palavras do código, `SEM_ROTA` "fica neutro de propósito: é promessa da plataforma, não pendência do cliente".
- **RelationChip:** link em pílula para entidade relacionada, em `surface-2` com fio `hairline`, 11.5px em peso 600 e `ink-muted`; eyebrow mono de 9px em maiúsculas e ícone num círculo tingido de 20px. No hover, sobe 1px e passa a `hairline-strong`, `surface-3` e `ink`.

### Cards / Containers
- **Corner Style:** 14px no `SectionCard`, 16px em `appDesign.section` e no cartão de produto, 18px nas páginas-portão.
- **Background:** `surface`. O `Card` do shadcn (3 usos) fica em `card`, quase preto no escuro, e destoa do naval.
- **Shadow Strategy:** ver Elevation & Depth.
- **Border:** `hairline`.
- **Internal Padding:** 16px no corpo do `SectionCard` (ou nenhum, com `noPadding`, para tabela), cabeçalho de 12px 16px; 20px no cartão de produto; 28px no portão.
- **SectionCard:** cabeçalho em gradiente de `surface-3` para `surface-2`, chip de ícone de 30×30 com raio de 8px (em gradiente do tom, via `accentRgb`, ou de `surface-4` para `surface-3`; como `--surface-4` só existe no reskin escuro, no claro esse fundo some), título em Space Grotesk 14px/700 e subtítulo de 11px em `ink-subtle`.
- **Cartão de produto (`/produto`):** ícone de 40px em `primary/15`, Badge do contrato, nome em 16px, resumo em `text-sm muted-foreground` e rodapé com vigência e assentos. Quando clicável, sobe 2px e ganha borda `primary/40` e `--hover-shadow`; quando não, fica a 80% de opacidade e explica o motivo no lugar do rodapé.

### Inputs / Fields
- **Style:** `Input` do shadcn: 36px de altura, `rounded-md`, borda `input`, fundo transparente (`input/30` no escuro), padding de 4px 12px, 16px (14px a partir de md), `shadow-xs` e placeholder em `muted-foreground`. `Label`, `Select`, `Textarea`, `Switch` e `Checkbox` são os do shadcn.
- **Focus:** borda `ring` e anel de 3px de `ring` a 50%.
- **Error / Disabled:** `aria-invalid` põe a borda em `destructive` (anel `destructive` no foco); a mensagem é `text-destructive text-xs` embaixo do campo. Desabilitado fica a 50% de opacidade.

### Navigation
- **Style:** `GlobalSidebar` (sidebar do shadcn, `inset`, recolhível em ícone): seletor de workspace no topo; Home (`/cosmos/dashboard`), Cosmos (`/cosmos`), Produtos, Configurações e Perfil; e, no rodapé, o usuário e o `ModeToggle`. "Só entra aqui rota que existe" (`sidebar.tsx:29`): link para tela inexistente "promete e dá 404".
- **Item:** 32px de altura, padding de 8px, gap de 8px, `rounded-md`, 14px e ícone de 16px. Hover e ativo em `sidebar-accent` com `sidebar-accent-foreground`; o ativo ganha peso 500. Foco com anel de 2px `sidebar-ring`. Recolhido, vira um quadrado de 32px.
- **Configurações:** coluna de 220px com itens de 13.5px, padding de 9px 12px e raio de 8px; o ativo vira um cartão (`surface`, `hairline`, `--card-shadow`, `ink`/600), e o ícone dele lê `var(--accent)`, que some (ver The Swapped-Name Rule).
- **Mobile:** abaixo de 768px a sidebar vira sheet.

### PageHeader (casca)
Gradiente de `surface-3` a `surface-2` (45%) e a `surface`, fio `hairline` embaixo, a sombra pesada de Elevation & Depth, fio de luz no topo e brilho radial de lavanda embaixo. Breadcrumb mono com chevron de voltar, linha de badges, `<h1>` em headline, subtítulo de até 680px em `ink-muted`, ações à direita e, opcional, a fileira de stats em mono. Nomeia as famílias por literal ('Space Grotesk', 'JetBrains Mono') em vez das variáveis de fonte.

### Modal
`ModalShell` (880px no `lg`, 520px no `md`): `surface`, raio `--cosmos-r-xl` (18px), cabeçalho de 18px 20px em gradiente, título de 17px, entrada com framer-motion e skeleton durante o carregamento. O `Dialog` do shadcn aparece em 4 arquivos. O `Sheet` entra com mola (`0.35s cubic-bezier(0.2, 0.8, 0.3, 1)`) e sai em `0.25s` (`globals.css:912-936`).

### Painel de marca e trilho de cadência (login)
- Painel #0b0e17 nos dois temas, com fio `white/8` à direita e linhas verticais a cada 96px, em branco a 4,5% ("no mesmo ritmo das iterações do rail").
- Marca: losango #5e6ad2 e "Cosmos" em mono de 13px, maiúsculas, +0.32em, #e7e9f5.
- Manifesto em display: "Cinco iterações. / Uma janela de IP. / Nenhuma decisão perdida.", com a última linha em #8b95f0.
- Trilho (`aria-hidden`): I1 a I5 e IP, marcas em branco a 30% (IP mais alta, em #8b95f0), rótulos mono de 11px com +0.12em (#6f7689; IP em #a5aef7), o segmento de IP em #5e6ad2 a 12% e as legendas "Execução" e "Inovação e planejamento" em mono de 10px. A entrada é escalonada, 500ms com atraso de 180 + 70·i ms, só com `motion-safe`.

### Páginas-portão
`charter-`, `signal-`, `meridian-` e `scaffold-indisponivel` separam os dois motivos que o usuário resolve em lugares diferentes: módulo não contratado (fale com quem administra o contrato) ou papel ausente (peça a quem atribui o papel). Eyebrow mono, título em Space Grotesk de 24px/700, texto de 14px com entrelinha de 1.65 e uma saída, "Voltar ao Cosmos".

> **Obsoleto (DESIGN.app.md, "Componentes piloto (2025)"):** Portfolio Kanban (`/portfolio`) e Priorização WSJF (`/portfolio/wsjf`) não existem mais: não há `page.tsx` sob `/portfolio` [grep], e os equivalentes são `/cosmos/kanban` e `/cosmos/wsjf`, governados por `components/cosmos/DESIGN.md`. Workspace (`/settings/workspace`) segue **vigente** e hoje é um de 15 arquivos que usam `appDesign`, em `/settings/*`, `/profile` e `/produto`.

## Do's and Don'ts

### Do:
- **Do** compor página autenticada com `appDesign.shell` → `PageHeader` → `appDesign.bodyScroll`, e empilhar as seções com `gap-6` (24px).
- **Do** escrever a copy de produto em PT-BR; metadado pode ficar em inglês **(vigente)**. Hoje escorregam o título "Settings" de `/settings/workspace` e o banner de beta ("Beta feature now available"). O `<html>` de `app/layout.tsx` e o de `app/global-error.tsx` declaram `lang="pt-BR"` desde 2026-09-23; antes o "en" fazia leitor de tela ler PT-BR com voz em inglês.
- **Do** usar token, nunca hex, fora do painel de marca: `bg-primary`/`text-primary` no shadcn, `var(--accent-c)` no estilo inline e `var(--on-accent, #fff)` sobre acento sólido.
- **Do** separar erro de vazio. Em `/produto`: "afirmar carteira vazia sobre uma consulta que falhou é mentira com cara de estado vazio".
- **Do** explicar porta fechada: o motivo e quem resolve, como nas páginas-portão e no motivo do cartão de produto.
- **Do** listar na navegação só rota que existe.
- **Do** usar seção fixa com cabeçalho para configuração que precisa ficar sempre visível **(vigente)**.
- **Do** proteger animação nova com `motion-safe:` (como o trilho de cadência) ou `useReducedMotion`; o `.cosmos-shell` já zera animação e transição sob `prefers-reduced-motion`.

### Don't:
- **Don't** usar o canvas de marketing `#010102` em página operacional; ele é do site **(vigente)**. O `--background` escuro do shadcn (≈ #020203) já está a um passo dele, e é nele que sentam o onboarding de primeiro acesso, as páginas-portão e a coluna do formulário do login.
- **Don't** usar accordion para configuração que precisa ficar sempre visível **(vigente)**. Não há accordion em `apps/app` hoje [grep].
- **Don't** fixar o room ID do Liveblocks no código; o id é `{orgId}:{surface}:{entityId}` **(vigente)**. `lib/collaboration/room-id.ts` valida o formato e `app/api/collaboration/auth/route.ts` recusa sala de outro tenant. Não há UI de Liveblocks montada em `apps/app` hoje.
- **Don't** usar `var(--accent)` como acento de marca: é a superfície de hover do shadcn.
- **Don't** propagar o ciano `#00d4ff` do reskin nem introduzir um quarto acento.
- **Don't** usar `--ink-subtle` ou `--ink-faint` para texto no tema claro (3,06:1 e 2,04:1 sobre branco).
- **Don't** usar `--surface-4` fora do escuro: ele só existe no reskin.
- **Don't** usar `text-primary` em texto corrido no escuro (4,05:1).
