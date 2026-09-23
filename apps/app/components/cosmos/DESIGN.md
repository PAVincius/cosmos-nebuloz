---
name: Cosmos
description: "Painel de operação SAFe (portfólio, ART, time e analytics), escuro por padrão, com lavanda como único acento de marca, tons de estado reservados a dado e JetBrains Mono em todo número."
colors:
  accent: "#7c87ff"
  accent-text: "#c7ccff"
  accent-soft: "rgba(124, 135, 255, 0.14)"
  on-accent: "#070b14"
  canvas: "#070b14"
  surface: "#0e1422"
  surface-2: "#131b2c"
  surface-3: "#18223a"
  sidebar: "#0a0f1b"
  hairline: "rgba(255, 255, 255, 0.075)"
  hairline-strong: "rgba(255, 255, 255, 0.15)"
  ink: "#eef2f8"
  ink-muted: "#93a1b3"
  ink-subtle: "#8b94a4"
  ink-faint: "#8593ac"
  chip-bg: "rgba(255, 255, 255, 0.05)"
  scrim: "rgba(4, 6, 14, 0.6)"
  green: "#34d399"
  green-text: "#7ff0bf"
  green-soft: "rgba(52, 211, 153, 0.12)"
  red: "#fb7185"
  red-text: "#fda4af"
  red-soft: "rgba(251, 113, 133, 0.14)"
  amber: "#fbbf24"
  amber-text: "#fcd34d"
  amber-soft: "rgba(251, 191, 36, 0.13)"
  blue: "#60a5fa"
  blue-text: "#bfdbfe"
  blue-soft: "rgba(96, 165, 250, 0.14)"
  purple: "#a78bfa"
  purple-text: "#ddd6fe"
  purple-soft: "rgba(167, 139, 250, 0.14)"
  light-accent: "#5e6ad2"
  light-accent-text: "#4b54b8"
  light-accent-soft: "rgba(94, 106, 210, 0.1)"
  light-on-accent: "#ffffff"
  light-canvas: "#f4f5f8"
  light-surface: "#ffffff"
  light-surface-2: "#f6f7f9"
  light-surface-3: "#eef0f4"
  light-sidebar: "#fbfbfd"
  light-hairline: "#e7e9ee"
  light-hairline-strong: "#d8dbe2"
  light-ink: "#11151f"
  light-ink-muted: "#586173"
  light-ink-subtle: "#65748b"
  light-ink-faint: "#656d7d"
  light-chip-bg: "#f1f3f7"
  light-green: "#16a34a"
  light-green-text: "#15803d"
  light-red: "#e11d48"
  light-red-text: "#be123c"
  light-amber: "#d97706"
  light-amber-text: "#b45309"
  light-blue: "#2563eb"
  light-blue-text: "#1d4ed8"
  light-purple: "#7c3aed"
  light-purple-text: "#6d28d9"
typography:
  page-title:
    fontFamily: "Space Grotesk, Manrope, sans-serif"
    fontSize: "27px"
    fontWeight: 700
    letterSpacing: "-0.025em"
  display:
    fontFamily: "Space Grotesk, Manrope, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    letterSpacing: "-0.02em"
  titulo:
    fontFamily: "Space Grotesk, Manrope, sans-serif"
    fontSize: "19px"
    fontWeight: 700
    letterSpacing: "-0.02em"
  forte:
    fontFamily: "Space Grotesk, Manrope, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    letterSpacing: "-0.015em"
  base:
    fontFamily: "Manrope, system-ui, -apple-system, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.5
  nota:
    fontFamily: "Manrope, system-ui, -apple-system, sans-serif"
    fontSize: "11.5px"
    fontWeight: 500
  micro:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "10px"
    fontWeight: 700
    letterSpacing: "0.14em"
  kpi-numeral:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "37px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.02em"
rounded:
  xs: "6px"
  sm: "8px"
  md: "10px"
  lg: "14px"
  xl: "18px"
  pill: "999px"
spacing:
  gap: "16px"
  pad: "20px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.md}"
    padding: "9px 15px"
  button-primary-sm:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.md}"
    padding: "7px 12px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "9px 15px"
  button-ghost:
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.md}"
    padding: "9px 15px"
  button-soft:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent}"
    rounded: "{rounded.md}"
    padding: "9px 15px"
  icon-button:
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.md}"
    size: "34px"
  icon-button-hover:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
  badge-neutral:
    backgroundColor: "{colors.chip-bg}"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.pill}"
    padding: "3px 9px"
  badge-accent:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent}"
    rounded: "{rounded.pill}"
    padding: "3px 9px"
  badge-green:
    backgroundColor: "{colors.green-soft}"
    textColor: "{colors.green-text}"
    rounded: "{rounded.pill}"
    padding: "3px 9px"
  badge-amber:
    backgroundColor: "{colors.amber-soft}"
    textColor: "{colors.amber-text}"
    rounded: "{rounded.pill}"
    padding: "3px 9px"
  badge-red:
    backgroundColor: "{colors.red-soft}"
    textColor: "{colors.red-text}"
    rounded: "{rounded.pill}"
    padding: "3px 9px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "{spacing.pad}"
  section-card-head:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    typography: "{typography.forte}"
    padding: "13px 18px"
  kpi-card:
    typography: "{typography.kpi-numeral}"
    rounded: "{rounded.xl}"
    padding: "18px 20px"
  page-header:
    typography: "{typography.page-title}"
    rounded: "{rounded.lg}"
    padding: "22px 26px 24px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "9px 11px"
  nav-item:
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.md}"
    padding: "8px 10px"
  nav-item-hover:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
  nav-item-active:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent}"
  sidebar:
    backgroundColor: "{colors.sidebar}"
    width: "256px"
  topbar:
    backgroundColor: "{colors.canvas}"
    height: "56px"
  modal:
    backgroundColor: "{colors.surface-2}"
    rounded: "{rounded.xl}"
    width: "460px"
  tooltip:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 11px"
---

# Design System: Cosmos

> **Escopo.** Raiz Impeccable `apps/app/components/cosmos` (`.impeccable/config.json` declara `projectRoots: ["apps/app/components/*"]`). Vale para tudo sob este diretório: a casca `shell.tsx` (sidebar, topbar, gaveta), `command-palette.tsx`, `modal.tsx`, `modal-form.tsx`, `empty-state.tsx`, `entity-link-field.tsx`, `card-header-glow.tsx`, `use-action-toast.ts` e as 41 telas de `screens/registry.tsx`, servidas em `/cosmos/<id>[/<param>]`. Os arquivos de rota `apps/app/app/(cosmos)/**` (layout, page, error e actions) resolvem por caminho para `apps/app/DESIGN.md`, mas só montam `CosmosShell` e estas telas: para o que renderizam, a autoridade é este arquivo. Tokens e primitivas vêm de fora da raiz, de `packages/design-system/cosmos/{cosmos.css,kit.tsx,icons.tsx}`, e são compartilhados com Charter, Meridian, Signal, Scaffold e o back-office. Mudança ali atinge todos.
>
> **Fonte.** Extraído do código em `main@ea512044` (2026-09-22). Documentos anteriores (`docs/design/DESIGN-COSMOS-PRODUCT.md`, `docs/claude-design-prompt.md`, o antigo `DESIGN.app.md`) entram só onde o código ainda os sustenta. O `DESIGN.md` da raiz descreve o site (canvas `#010102`) e não é autoridade aqui.

## Overview

**Creative North Star: "O Painel de Sinal Vivo"**

O Cosmos é a mesa onde RTE, LPM, PO e SM operam o SAFe: portfólio, ART, time e analytics lendo o mesmo banco de fatos. O desenho é o de um painel de instrumentos, escuro por padrão (canvas azul-naval `#070b14`, não preto) e denso, com o número como protagonista e a moldura em silêncio. "Sinal vivo" é o nome que o próprio código dá à assinatura do tema escuro (`kit.tsx:867-869`): a grade de pontos e a marca-d'água gravada que acordam quando o cursor entra num KPI, e a varredura de ECG que o código desenha mas que hoje não chega à tela (ver Components, KPI Card). É também o compromisso de conteúdo do produto. Todo número é leitura derivada, e onde falta o fato a tela diz "sem sinal" em vez de desenhar um zero.

A cor fala pouco e com precisão. A lavanda é o único acento de marca e marca três coisas: onde você está (item de navegação ativo), o que fazer (CTA primário) e onde está o foco (anel de 2px). Verde, vermelho, âmbar, azul e roxo são vocabulário de dado e sempre vêm com palavra. Profundidade vem de camada tonal e de um fio de 7,5% de branco. Brilho e gradiente radial ficam restritos a superfícies de dado (KPI, cabeçalho de seção com tom, cartão de épico quente) e somem no tema claro, que é limpo por decisão.

A construção é própria: primitivas do kit (`@repo/design-system/cosmos/kit`) com estilo inline lendo as variáveis de `.cosmos-root`, mais um punhado de classes semânticas do `cosmos.css` (`mono`, `display`, `btn`, `navitem`, `lift`, `fade-in`, `chart-hit`, `scroll`). Nenhum dos 80 arquivos da raiz importa componente shadcn ou usa utility Tailwind [grep]. Rejeições confirmadas: o canvas de marketing `#010102` em tela operacional (antigo `DESIGN.app.md`); gradiente radial em navegação e formulário, tom de estado fora de superfície de dado e letterpress em ícone menor que 100px (`docs/design/DESIGN-COSMOS-PRODUCT.md`); gradiente pesado e interface "colorida demais" (restrições de `docs/claude-design-prompt.md`).

**Key Characteristics:**
- Escuro por padrão (`defaultTheme="dark"`, sem seguir o sistema). O claro é completo, com variáveis próprias, e não uma inversão.
- Um acento: lavanda `#7c87ff` no escuro, `#5e6ad2` no claro.
- Cinco tons de estado, cada um em quatro formas: sólido, `-rgb`, `-soft` e `-text`.
- Três vozes tipográficas: Manrope para ler, Space Grotesk para título, JetBrains Mono para dado.
- Densidade fixa em `--pad` (20px) e `--gap` (16px).
- Movimento funcional entre 100 e 450ms, com camadas de textura até 550ms, tudo sob `prefers-reduced-motion`.
- Vazio, erro e carregamento são estados distintos: o vazio explica por quê, e o erro nunca se disfarça de zero.

## Colors

Um azul-naval quase preto em quatro degraus, uma lavanda de sinal e cinco tons de dado, redefinidos por tema dentro de `.cosmos-root` (`cosmos.css:97-180`). As chaves sem prefixo são o tema escuro, que é o padrão; as `light-*` são o claro.

### Primary
- **Lavanda de Bordo** (#7c87ff no escuro; **Lavanda Linear**, #5e6ad2, no claro): item ativo da sidebar (fundo `accent-soft`, texto `accent`, barra de 3px), botão primário, anel de foco, seleção de texto (28% de alfa) e sublinhado de 2px da aba ativa. Nunca decoração.
- **Lavanda Clara** (#c7ccff; #4b54b8 no claro): texto de acento sobre superfície, como o eyebrow do `PageHeader`, o termo do glossário e o item selecionado da paleta ⌘K.
- **Véu Lavanda** (`accent-soft`): fundo do item ativo, do botão `soft` e do chip de acento.
- **Naval sobre Lavanda** (`on-accent`, que no escuro é o próprio canvas #070b14 e no claro é #ffffff): texto e ícone sobre acento sólido. `--accent-fg` resolve para ele.

### Neutral
- **Azul-Naval Profundo** (#070b14; **Névoa Fria**, #f4f5f8, no claro): canvas da página e fundo da topbar.
- **Casco Naval** (#0e1422; #ffffff no claro): cartões, campos e botão secundário.
- **Casco Elevado** (#131b2c; #f6f7f9): cabeçalho de `SectionCard` no escuro, hover de navegação, modal e paleta ⌘K.
- **Casco Alto** (#18223a; #eef0f4): trilho de progresso, tooltip, pílula "Em breve" e topo do gradiente do `PageHeader`.
- **Trilho Noturno** (#0a0f1b; #fbfbfd): sidebar.
- **Fio de Luz** e **Fio Firme** (branco a 7,5% e a 15%; #e7e9ee e #d8dbe2 no claro): o primeiro separa, o segundo delimita o que é interativo (campo, botão secundário, hover de cartão).
- **Branco Gelo** (#eef2f8; **Tinta Naval**, #11151f, no claro): texto principal. **Aço Claro** (#93a1b3; #586173): texto secundário e navegação em repouso. **Aço** (#8b94a4; #65748b) e **Aço Azulado** (#8593ac; #656d7d): subtítulo, metadado, rótulo de campo e ícone de apoio.
- **Chip de Vidro** (branco a 5%; #f1f3f7): fundo do Badge neutro.
- **Cortina Naval** (`scrim`): atrás da gaveta e da paleta ⌘K.

### Estados (tons de dado)
Cada tom existe como sólido (barra, ponto, trilho de progresso, ícone de KPI), `-rgb` (para `rgba()` de borda e brilho), `-soft` (fundo de chip, com 10 a 14% de alfa; no claro, 10%, e 12% no âmbar) e `-text` (texto sobre o `-soft`).
- **Verde Sinal** (#34d399; #16a34a no claro): saudável, acima da meta, concluído, prioridade baixa no kanban.
- **Rosa Alarme** (#fb7185; #e11d48): bloqueio, falha, prioridade alta e erro de carregamento (`ErrorState`).
- **Âmbar Atenção** (#fbbf24; #d97706): custo, atenção, prioridade média.
- **Azul Informação** (#60a5fa; #2563eb) e **Violeta** (#a78bfa; #7c3aed): categoria e identidade de ART ou de tema. O tom de um épico no kanban vem do ART dele (`epic.artTone`).

### Named Rules
**The One Voice Rule.** A lavanda é o único acento de marca e só marca lugar, ação e foco. Nenhum segundo acento entra no Cosmos: nem o ciano `#00d4ff` pré-pivô que ainda vive no reskin `.cosmos-shell` da casca, nem o azul do `--primary` do shadcn.

**The Tone-Plus-Word Rule.** Tom de estado nunca aparece sozinho. Vem num `Badge` com texto, ou com `dot`/`pulse` quando é status vivo. Verde, vermelho e âmbar são exclusivos de superfície de dado e não pintam navegação, formulário nem ornamento.

**The Scope Rule.** Os tokens do Cosmos só existem dentro de `.cosmos-root`. Fora dele, `--accent` é a superfície neutra do shadcn (`oklch(0.23 0.009 280)` no escuro, `oklch(0.94 0.003 280)` no claro), e `--r-*`, `--pad`, `--gap`, `--scrim`, `--on-accent` e `--fs-*` não existem. Todo portal monta sob um wrapper `.cosmos-root`, como a paleta ⌘K já faz (`command-palette.tsx:75-89`).

### Contraste
Razões que o código documenta:
- Branco sobre a lavanda clara #5e6ad2: 4,70:1 (`cosmos.css:9-13`).
- Canvas sobre a lavanda escura #7c87ff: 6,34:1, e 7,2:1 ou mais sobre todo tom escuro. Branco ali cairia a 3,10:1, e por isso `--on-accent` é o canvas no escuro (`cosmos.css:17-19`, `152-153`).

**Dívida documentada:** no claro, branco sobre verde #16a34a (3,3:1) e sobre âmbar #d97706 (3,2:1) reprova AA, e o arquivo registra isso como lacuna conhecida (`cosmos.css:9-13`). O comentário afirma que uma tinta escura também reprovaria. O cálculo desta revisão (WCAG 2.x) não confirma: #11151f sobre #16a34a dá 5,54:1, e sobre #d97706 dá 5,73:1. O que impede a troca é outro fato: `--on-solid` é um token único para todos os tons, e tinta escura reprova sobre vermelho, azul, roxo e acento claros (3,2 a 3,9:1). A saída continua sendo ajuste de paleta ou foreground por tom.

Cálculo desta revisão, para quem for mexer na escala de tinta:
- No claro, `ink-subtle` #65748b dá 4,75:1 e `ink-faint` #656d7d dá 5,20:1 sobre #ffffff. Os dois passam, mas o "faint" ficou mais escuro que o "subtle": a escala foi corrigida para AA, não para hierarquia, e os dois degraus hoje se distinguem mais por matiz que por valor.
- Fora de `.cosmos-root` valem os valores globais de `globals.css`, que no claro reprovam: `--ink-subtle` #8b94a4 dá 3,06:1 e `--ink-faint` #aeb6c2 dá 2,04:1 sobre branco. É o que um modal portado para `document.body` herda hoje (ver Components, Modal).

## Typography

**Display Font:** Space Grotesk (com Manrope e sans-serif de reserva), pela classe `.display` → `var(--font-space-grotesk)`
**Body Font:** Manrope (com system-ui), herdada de `.cosmos-root` → `var(--font-manrope)`
**Label/Mono Font:** JetBrains Mono (com ui-monospace), pela classe `.mono` → `var(--font-jetbrains-mono)`

**Character:** Manrope lê rápido em 13px sem parecer planilha. Space Grotesk dá aos títulos um corte técnico, de instrumento. JetBrains Mono é o que faz `EP-097`, `42%` e `R$ 1.250` parecerem o que são. As três fontes vêm de `next/font` no `<html>` (`packages/design-system/lib/fonts.ts`). A Manrope só carrega os pesos 500 a 800, então peso 400 cai no 500.

### Hierarchy
A escala oficial tem seis degraus (`cosmos.css:62-67`), criados em 2026-08-29 (commit `1ed1dc01`) com a regra "estes são os degraus, não uma sugestão de uso":
- **Display** (700, 22px `--fs-display`, -0.02em): título de tela sem dado ou ainda não portada (`ComingSoon`). No back-office este degrau serve a número grande; no Cosmos o número grande é mono (ver `kpi-numeral`).
- **Título** (700, 19px `--fs-titulo`, -0.02em): título de tela dentro de painel, gaveta ou detalhe.
- **Forte** (700, 15px `--fs-forte`, -0.015em): título de cartão e de estado vazio (`EmptyState`), ênfase.
- **Base** (500, 13px `--fs-base`, entrelinha 1.5): corpo, rótulo, item de navegação, rótulo de KPI.
- **Nota** (500, 11.5px `--fs-nota`): metadado, legenda, e-mail na sidebar, tooltip de gráfico. O Badge usa este tamanho em peso 700, com +0.02em.
- **Micro** (700, 10px `--fs-micro`, +0.14em, maiúsculas, mono): eyebrow do `PageHeader`, carimbo, "Preview ao vivo". É o piso, e só existe em maiúsculas com entreletra aberta.

Dois tamanhos vivem dentro do kit, fora da escala, e não se reproduzem à mão: **page-title** (Space Grotesk 700, 27px, -0.025em, o `<h1>` do `PageHeader`) e **kpi-numeral** (JetBrains Mono 700, 37px e 42px no `big`, entrelinha 1, -0.02em, o valor do `KpiCard`, com unidade a 21 ou 24px e 75% de opacidade).

### Named Rules
**The Mono-for-Data Rule.** Todo identificador, número, percentual, data e código vai em `.mono` (139 usos na raiz). Manrope num id é perder a pista de que aquilo é dado.

**The Six Steps Rule.** Tamanho novo sai da escala. Hoje nenhuma tela do Cosmos consome `var(--fs-*)` [grep]: a raiz tem 720 `fontSize` numéricos em 23 valores, 78% deles entre 11 e 13px (13, 12, 12.5, 11 e 11.5 lideram). Código novo usa os tokens. Ao tocar uma tela, migre pelo mapa do commit `1ed1dc01`: 10.5, 11 e 11.5 viram nota; 12, 12.5 e 13 viram base; 14 e 15 viram forte; 18 e 19 viram título; 21 e 22 viram display. Meio pixel não separa rótulo de título.

## Layout

Casca fixa e conteúdo fluido (`shell.tsx`, `cosmos.css:577-648`):
- `.cosmos-root` ocupa 100dvh em flex: sidebar de 256px e uma coluna com a topbar de 56px (sticky, fundo `canvas`, fio inferior) e a área de conteúdo. Ela é o único container com scroll: `section.scroll.cosmos-content`, focável (`tabIndex=0`) e rotulada "Conteúdo da tela".
- O conteúdo tem padding de 24px 28px 40px, e a topbar, de 0 22px. Não há largura máxima: a tela ocupa o que sobra da sidebar.
- Abaixo de 1024px a sidebar vira gaveta: `position: fixed`, `translateX(-100%)` e `visibility: hidden` quando fechada, para sair da ordem de foco. Vêm junto o scrim, `inert` no conteúdo, Escape e a devolução do foco ao botão. O padding cai para 16px 16px 32px e aparece o botão de menu (40×40).

Composição de tela, repetida nas 41 telas:
1. Raiz com `fade-in` (40 telas).
2. `PageHeader` com eyebrow no padrão "Domínio · faceta" ("Portfolio · Resumo executivo", "Lean Budget · Investment Horizon"), título, subtítulo de até 760px e ações à direita, com 22px de respiro abaixo.
3. Grade de KPI em `repeat(auto-fit, minmax(220px, 1fr))` com `gap: var(--gap)`.
4. `SectionCard`s em grade de duas colunas. `"1fr 1fr"` é o template mais comum (23 usos), seguido de `repeat(4, …)`, `repeat(3, …)` e `"1.4fr 1fr"`.

O ritmo é `var(--gap)` (16px) entre blocos, em 41 pontos de 15 arquivos, e `var(--pad)` (20px) dentro do `Card`. Dentro dos componentes, os gaps são literais de 6, 8, 10, 12 e 14px. O handoff do `cosmos.html` previa três densidades (compacta 16/12, regular 20/16, confortável 24/20); o port fixou a regular.

**Dívida de largura:** fora a gaveta, a raiz tem uma única `@media`, a de impressão do Board Snapshot. As grades fixas de 2, 3 e 4 colunas não colapsam: abaixo de uns 700px elas espremem em vez de empilhar.

## Elevation & Depth

Híbrido. Camada tonal e fio fazem quase todo o trabalho; a sombra é baixa e, no escuro, traz um fio de luz no topo. Brilho colorido fica reservado a dado e a estado.

### Shadow Vocabulary
- **Cartão em repouso, claro** (`box-shadow: 0 1px 2px rgba(16, 22, 40, 0.05), 0 4px 14px -8px rgba(16, 22, 40, 0.1)`): todo `Card`, `SectionCard`, `KpiCard`, `PageHeader` e cartão de épico.
- **Cartão em repouso, escuro** (`box-shadow: 0 1px 0 rgba(255, 255, 255, 0.04) inset, 0 10px 30px -20px rgba(0, 0, 0, 0.8)`): a mesma família, com a luz vindo de cima.
- **Hover** (claro `0 2px 4px rgba(16, 22, 40, 0.06), 0 18px 36px -20px rgba(var(--accent-rgb), 0.3)`; escuro `0 1px 0 rgba(255, 255, 255, 0.06) inset, 0 24px 50px -26px rgba(var(--accent-rgb), 0.5)`): a elevação tingida de lavanda liga elevação a interatividade. O `.lift` escuro usa `0 18px 40px -28px rgba(0, 0, 0, 0.9)`.
- **Brilho de KPI** (`box-shadow: 0 24px 50px -24px rgba(var(--tone-rgb), calc(0.55 * var(--fx)))`): só no escuro, no hover.
- **Botão primário** (`box-shadow: 0 1px 2px rgba(var(--accent-rgb), .4), 0 6px 16px -8px rgba(var(--accent-rgb), .6)`): o único botão com sombra.
- **Barra de tom** (`box-shadow: 0 0 10px 2px rgba(var(--tone-rgb), .7), 0 0 22px 4px rgba(var(--tone-rgb), .3)`): a barra neon de 3px à esquerda do cabeçalho de seção com tom.
- **Flutuantes**: modal `0 50px 90px -24px rgba(0, 0, 0, 0.65)`, tooltip de gráfico `0 12px 26px -10px rgba(0, 0, 0, 0.45)`, gaveta `0 0 60px -12px rgba(0, 0, 0, 0.5)`.

### Named Rules
**The Light-From-Above Rule.** No escuro, toda superfície elevada tem um fio de luz de 1px no topo: um inset de 4 a 6% de branco na sombra, ou uma linha em gradiente no `SectionCard` e no `PageHeader`. A profundidade vem de cima, nunca de sombra dura lateral.

**The Glow-Is-Data Rule.** Brilho colorido só aparece em superfície de dado (KPI, barra de tom, trilho de progresso, switch ligado, épico quente) ou no CTA primário. Nunca em navegação, campo ou texto.

**The Clean-Light Rule.** Textura (grade de pontos, marca-d'água gravada, ECG em destaque, lavagem radial de tom) é assinatura do escuro. No claro, `.kpi .wm`, `.dots` e `.sig` ficam em `display: none`, e o `SectionCard` não desenha textura.

## Shapes

Cantos suaves em escala fechada (`cosmos.css:36-41`), aplicados por papel:
- **xs** (6px): anel de foco dos alvos de gráfico.
- **sm** (8px): tile do tenant, botão de menu, chips de ícone pequenos.
- **md** (10px): o padrão. Botão, campo, item de navegação, `IconButton`, tooltip, item da paleta (103 usos de `var(--r-md)` na raiz).
- **lg** (14px): `Card`, `SectionCard`, `PageHeader`, paleta ⌘K e cartão de épico.
- **xl** (18px): `KpiCard`, modal e o ícone do `ComingSoon`.
- **pill** (999px): Badge, trilho de progresso, avatar, switch e alternador de tema. O código escreve `99` literal em 25 lugares para o mesmo efeito.

Borda é sempre de 1px: `hairline` em repouso, `hairline-strong` em campo e no hover, e `rgba(tom, .20 a .38)` quando a superfície carrega tom. Duas geometrias marcam tom sem pintar a superfície: a barra vertical de 3px à esquerda do cabeçalho de seção e a linha horizontal de 3px, em gradiente, no topo do cartão de épico. Ícone de apoio mora num quadrado tingido (34×34 no KPI, 40×40 no modal, 30×30 no `CopilotInsightBar`) com raio `md` ou 8px.

Ícones: lucide-react atrás do `Icon` do kit (`packages/design-system/cosmos/icons.tsx`), chamado por nome, com traço de 1.9 a 2.1 e 15 a 18px na interface. A marca-d'água do KPI usa o mesmo glifo a 200px, com traço de 1.15.

## Components

As primitivas vêm de `@repo/design-system/cosmos/kit`. Os padrões locais desta raiz ficam em `modal.tsx`, `modal-form.tsx`, `empty-state.tsx` e `card-header-glow.tsx`. As prévias do sidecar (`.impeccable/design.json`) embrulham cada componente num `.ds-cosmos` que redeclara os tokens do tema escuro, porque o painel renderiza fora de `.cosmos-root` (ver The Scope Rule).

### Buttons
Firmes e discretos: peso 600, sem caixa alta, ícone opcional à esquerda ou à direita.
- **Shape:** cantos suaves (`md`, 10px) e borda de 1px.
- **Primary:** fundo `accent`, texto `on-accent`, padding de 9px 15px (7px 12px no sm, 11px 18px no lg), 14px (13px no sm) e sombra lavanda.
- **Secondary / Ghost / Soft:** o secundário tem fundo `surface`, texto `ink` e borda `hairline-strong`. O ghost é transparente, com texto `ink-muted`. O soft tem fundo `accent-soft` e texto `accent` (é o botão Copilot da topbar).
- **Hover / Focus:** nenhuma variante tem hover. `.btn` declara transição de fundo, borda e sombra, mas nenhuma regra de `:hover` muda esses valores. O feedback é a pressão (`translateY(0.5px)` em 100ms) e o anel de foco de 2px em `accent`, com offset de 2px.
- **Disabled:** o kit passa o atributo `disabled` de verdade, mas o comentário de `kit.tsx:151` ("o CSS já cobre `.btn:disabled`") não se confirma. Essa regra não existe e o `cursor: pointer` é inline, então o botão desabilitado hoje é visualmente igual ao ativo.
- **IconButton:** 34×34, borda `hairline`, ícone de 17px em `ink-muted` e o hover da `.navitem` (fundo `surface-2`, texto `ink`). O `title` é obrigatório e vira `aria-label`.

### Chips
- **Style:** o Badge é uma pílula com padding de 3px 9px, 11.5px em peso 700 e +0.02em, com fundo `-soft`, texto `-text` e borda do tom a 25% (o neutro usa `chip-bg`, `ink-muted` e `hairline`). O tom `accent` usa `accent` como texto, não `accent-text`.
- **State:** `dot` acrescenta um ponto de 6px, e `dot` com `pulse` anima um anel de 1,8s para status vivo. Quando o tom muda, o chip pisca uma vez (`cosmos-badgeFlash`, 350ms). A pílula "Em breve" (mono 9px, `surface-3`, `ink-faint`) marca tela do registry ainda não portada; hoje toda entrada da navegação tem tela, então ela não aparece.

### Cards / Containers
- **Corner Style:** `lg` (14px) no `Card` e no `SectionCard`; `xl` (18px) no `KpiCard`.
- **Background:** `surface`. O cabeçalho do `SectionCard` é `surface-2` no escuro e `surface` no claro.
- **Shadow Strategy:** cartão em repouso (ver Elevation & Depth). O `.lift` ergue 2px no hover e passa a borda para `hairline-strong`.
- **Border:** `hairline`, ou o tom a 22% quando o `SectionCard` recebe `tone`.
- **Internal Padding:** o `Card` usa `--pad` (20px); o `SectionCard` tem cabeçalho de 13px 18px e corpo de 18px.
- **SectionCard com tom** (o padrão "Sangria + Sinal Vivo" de `card-header-glow.tsx`): barra neon de 3px à esquerda, ícone num quadrado tingido (fundo a 12%, borda a 25%) e, só no escuro, grade de pontos mascarada, lavagem radial do tom e fio de luz no topo. Quando o cursor entra, um pulso radial nasce no ponto de entrada, uma vez por entrada (700ms, pulado sob reduced-motion). Com `onActivate`, o cabeçalho vira `role="button"` e responde a Enter.
- **Cartão de épico** (kanban): `lift` + `card-in` com escalonamento de 40ms, raio de 14px, padding de 14px 15px 13px, linha de tom de 3px no topo, pílula de prioridade (vermelho, âmbar ou verde), título 14px/700, barra de progresso de 5px e avatares de 24px. Épico quente ganha borda e brilho no tom do ART.

### Inputs / Fields
- **Style:** `modal-form.tsx` concentra os campos que antes eram 15 cópias de `inputStyle`: fundo `surface`, borda `hairline-strong`, raio `md`, padding de 9px 11px e 13.5px. `FormField` envolve o controle com o `<label>` (rótulo 12.5px em peso 700 e `ink-subtle`, asterisco em `red-text`, dica de 11px em `ink-faint`).
- **Focus:** borda `accent` a 70% e anel de 3px de `accent` a 18%, aplicados em `onFocus`. O `outline: none` do campo tem substituto.
- **Error / Disabled:** borda `red-text` e anel de 2px de vermelho a 15%, com mensagem de 11px em peso 600, ícone de alerta em `role="alert"` e `aria-invalid` no controle.

### Navigation
- **Sidebar** (256px, fundo `sidebar`, fio à direita): seletor de tenant no topo (tile de 34×34 em `accent` com as iniciais), falso campo de busca com `⌘K`, rótulo de seção "SAFe Workspace" (10.5px, peso 700, +0.10em, maiúsculas, `ink-faint`), grupos expansíveis e rodapé com avatar, nome e e-mail.
- **Item:** 13.5px, padding de 8px 10px (filho: 7px 10px 7px 34px), raio `md`. Em repouso, `ink-muted` com peso 500. No hover, `surface-2` e `ink` em 150ms. Ativo, `accent-soft` com texto `accent` e peso 600, mais uma barra de 3px na borda esquerda (nível 1) ou de 2px recuada (filho). Grupo recolhido com filho ativo acende o próprio item.
- **Em breve:** item sem tela no registry vira linha inerte (`aria-disabled`, 55% de opacidade, sem link) com a pílula "Em breve". O roadmap fica legível sem clique morto. Hoje todas as 31 entradas da navegação têm tela, e nenhuma aparece assim.
- **Topbar:** trilha "Pai › Tela" (13.5px, pai em `ink-subtle`/500, tela em `ink`/600), alternador de tema em pílula ("Escuro" ou "Claro", com a lua em `accent-soft` ou o sol em `amber-soft`), sino e o botão `soft` do Copilot.
- **Paleta ⌘K:** 480px, `surface-2`, raio `lg` e scrim com blur de 6px. O item selecionado fica em `accent-soft` com `accent-text`, e tela não portada aparece desabilitada com "Em breve".
- **Mobile:** gaveta abaixo de 1024px (ver Layout).

### Modal
- `ModalCard` (460px, no máximo 92vw, altura até 100vh − 140px): fundo `surface-2`, borda `hairline-strong`, raio `xl` e sombra flutuante. O cabeçalho (20px 22px) tem lavagem radial no tom da entidade e ícone tingido de 40×40; o título é Space Grotesk 16.5px/700; o rodapé fixo leva as ações e a dica mono "esc cancelar · ⌘↵ salvar". `ModalSplit` põe um preview ao vivo de 300px à esquerda, sob o rótulo micro "Preview ao vivo" com ponto de acento.
- Escape, trap de Tab e devolução de foco vivem no provider. ⌘↵ ou Ctrl+Enter dispara a ação principal.
- **Dívida:** o `ModalProvider` porta para `document.body` sem o wrapper `.cosmos-root` (`modal.tsx:141-170`). Pela The Scope Rule, dentro do modal `--r-xl` e `--r-md` não existem (os cantos caem para 0), o botão primário lê o `--accent` neutro do shadcn, e `ink-subtle` e `ink-faint` voltam aos valores globais, que no claro reprovam AA. Verificado no código, não medido em tela. A paleta ⌘K já resolve isso com o wrapper, e o modal deve seguir o mesmo caminho.

### KPI Card (assinatura)
- Altura mínima de 150px (168px no `big`), padding de 18px 20px e raio `xl`. Rótulo de 13px/600 em `ink-muted` à esquerda, ícone num quadrado de 34×34 no tom à direita, valor em `kpi-numeral` e rodapé com o Badge de delta (`trendingUp`/`trendingDown`) e uma dica de 12px em `ink-subtle`.
- **Escuro:** fundo em gradiente próprio por tom (`TONES` no kit), borda do tom a 20% e quatro camadas decorativas dentro de `.kpi-clip` (overflow hidden, raio herdado): a marca-d'água gravada (letterpress), a mesma marca com glow, a grade de pontos com máscara radial e a sparkline de ECG varrendo em 3s. No hover, o cartão sobe 3px em 400ms, borda e sombra acendem no tom, a gravação apaga para 20%, o glow acende a 90%, os pontos chegam a 45% em 550ms e o ECG a 100%. Tudo é multiplicado por `--fx`.
- **Dívida verificada:** o ECG não aparece. O `linearGradient` do traço usa `x2="312"` em unidades de bounding box, que são o padrão (`kit.tsx:1016-1021`, igual ao handoff em `cosmos-kit.jsx:163`), e o traço inteiro cai no primeiro 0,3% do gradiente, onde a opacidade é 0. O mesmo SVG isolado num navegador some; com `gradientUnits="userSpaceOnUse"`, aparece. A animação roda sobre um traço invisível.
- **Claro:** superfície lisa, borda `hairline` e valor em `ink`. O "eco" de entrada que o kit calcula no claro (`echo-ping` e `kpi-echo-edge`, `kit.tsx:866-895` e `994`) não tem nenhuma regra de CSS no repositório [grep]. É fiação sem efeito visível.
- O valor conta de 0 até o número em 900ms na entrada, uma vez. Sob reduced-motion, aparece direto.

### Estados de vazio, erro e carregamento
- **Vazio** (`EmptyState`, 26 telas): círculo de 48px em acento a 12%, ícone de 22px, título em `forte`, descrição de até 320px em `ink-faint` e CTA pequeno. A copy diz por que está vazio e qual é o primeiro passo ("Nenhum ART ainda." e "O ART é o primeiro passo: dele saem os times, o PI Plan e os sprints.").
- **Erro** (`ErrorState`, 39 telas): faixa com fundo vermelho a 8%, borda a 28%, texto `red-text` e ícone de alerta. Falha de leitura nunca vira zero nem "sem dados" (commit `004e471f`). A rota tem `error.tsx` próprio, que mantém a casca montada.
- **Carregamento:** `Skel` e `SkeletonKpi`, com a forma do conteúdo real e shimmer de 1,4s.
- **Não portada** (`ComingSoon`): ícone de 64px em `accent-soft` e título em `display` (22px). A copy atual ("Tela ainda não portada. A fundação (tokens, kit, shell)…", `shell.tsx:748`) é texto de engenharia exposto ao cliente.

### Movimento
A especificação compartilhada Big Bang · Charter · Cosmos (PDF "Big Bang — PRD & SRD", agosto de 2026, micro-interações M1 a M18) confrontada com o código. Só o que está implementado é regra; o resto fica marcado como especificado.

| # | Especificado | No Cosmos |
|---|---|---|
| Tokens | `--ease-out-soft` (.2,.7,.3,1), `--ease-pulse` (.4,0,.6,1), `--dur-*`, `--fx` | As curvas existem como literais (`.kpi`, `.card-in`, `.pulse-dot`); o Tailwind expõe a primeira como `--ease-spring`. `--dur-*`: **especificado, não implementado**. `--fx`: implementado |
| M1 | Entrada de tela: opacidade 0→1 e y 7→0 em 450ms | **Parcial:** `.fade-in` move 7px em 450ms, sem opacidade e com curva `ease` |
| M2 | Lift de cartão: y −2, borda forte, 250ms | Implementado (`.lift`) |
| M3 | KPI: y −3 e quatro camadas, 400/550ms, só no escuro | Implementado, menos o ECG, que não renderiza (ver KPI Card) |
| M4 | Hover de navegação: `surface-2` e `ink`, 150ms | Implementado (`.navitem`) |
| M5 | Pressão de botão: y +0.5, 100ms | Implementado (`.btn:active`) |
| M6 | Shimmer de skeleton, 1,4s | Implementado |
| M7 | Modal: fade do backdrop, y 10→0 e escala .985→1, 180/220ms | **Parcial:** o cartão entra com y 7→0 em 180ms; o backdrop não tem fade e não há escala |
| M8 | Toast com barra até o dismiss, 200/4200ms | **Especificado, não implementado:** o toast é o `sonner` global; `cosmos-toastIn` existe no CSS sem uso |
| M9 | Flash de badge em mudança real | Implementado |
| M10 | Anel de pulso, 1,8s | Implementado (`LivePulse`, Badge com `pulse`) |
| M11 | Progresso 0→valor em cerca de 400ms | **Parcial:** 750ms, `cubic-bezier(.2,.8,.3,1)` |
| M12 | Count-up do KPI em cerca de 600ms, uma vez, recebendo número | **Parcial:** 900ms, e o kit aceita string (ver Don't) |
| M13 | Tooltip: fade e y, 120ms | Implementado (`cosmos-tipIn`) |
| M14 | Ícone de vazio pulsando devagar | **Especificado, não implementado:** `cosmos-emptyPulse` existe sem uso |
| M15 | Barra de tom de 3px com brilho; pulso radial no cursor, uma vez | Implementado, com um pulso por entrada do cursor |
| M16 | Arrasto de nó sem transição, com alternativa por teclado | Não há nó arrastável; o kanban usa drag-and-drop nativo, sem alternativa por teclado |
| M17 | Teste de conexão inline (testando → ok/falha) | **Especificado, não implementado:** o Cosmos usa toast de carregamento ("Testando conexão...") |
| M18 | Anel de foco de 2px em `accent`, offset de 2px | Implementado |

Reduced motion: o `cosmos.css` desliga o ECG, o lift, o fade-in, o card-in e a transição da gaveta; o kit pula o pulso de cabeçalho e o count-up; o `globals.css` encurta todo o resto para 0,01ms. Ressalva: `.cosmos-root` redeclara `--fx: 1` (`cosmos.css:22`), o que sombreia o `--fx: 0` que o `globals.css` aplica no `:root` sob reduced-motion.

## Do's and Don'ts

### Do:
- **Do** montar tela nova como entrada de `SCREENS` em `screens/registry.tsx`, dentro do `CosmosShell`, e compor com as primitivas do kit (`PageHeader`, `SectionCard`, `KpiCard`, `Badge`, `Button`, `EmptyState`, `ErrorState`) antes de estilizar à mão.
- **Do** usar `.mono` em todo id, número, percentual, data e código.
- **Do** escrever estado como tom mais palavra: `Badge` com texto, e `dot`/`pulse` para status vivo.
- **Do** pôr eyebrow no `PageHeader` no padrão "Domínio · faceta".
- **Do** separar vazio de erro. O vazio explica e oferece o primeiro passo; o erro de leitura vai para o `ErrorState`, nunca para um zero.
- **Do** dar `title` a todo controle só de ícone (o `IconButton` o exige e o transforma em `aria-label`).
- **Do** usar `var(--gap)` entre blocos, `var(--pad)` dentro de cartão e os tamanhos `--fs-*` em texto novo.
- **Do** guardar toda animação por gesto com `useReducedMotion`, como fazem o `SectionCard` e o `KpiCard`, e todo `@keyframes` novo com `@media (prefers-reduced-motion: reduce)`.
- **Do** montar sob `.cosmos-root` qualquer portal (modal, popover, paleta), como `command-palette.tsx` faz.

### Don't:
- **Don't** usar o canvas de marketing `#010102` em tela operacional; ele pertence ao site (decisão do antigo `DESIGN.app.md`).
- **Don't** trazer para o Cosmos o ciano `#00d4ff` do reskin `.cosmos-shell` nem o azul do `--primary` do shadcn. O acento é um só.
- **Don't** ler `var(--accent)` fora de `.cosmos-root`: lá ele é a superfície neutra do shadcn. Fora do escopo, o acento de marca é `--accent-c` (`components/cosmos/kpi-card.tsx:45`, `cosmos-button.tsx:19`).
- **Don't** usar utility Tailwind nem componente shadcn em `components/cosmos/**`. A raiz tem zero hoje, e misturar dialetos deixa a costura à mostra (é a lição de `/clientes/[slug]` registrada no DESIGN.md do back-office).
- **Don't** usar verde, vermelho ou âmbar fora de superfície de dado, nem gradiente radial em navegação ou formulário.
- **Don't** desenhar textura (pontos, marca-d'água, ECG em destaque) no tema claro.
- **Don't** aplicar letterpress em ícone menor que 100px; o efeito some.
- **Don't** pôr texto branco sobre fill sólido verde ou âmbar no claro (3,3:1 e 3,2:1).
- **Don't** criar tamanho de fonte fora dos seis degraus, e muito menos um meio pixel novo.
- **Don't** mostrar zero, média ou estimativa onde falta o fato. A tela diz "sem sinal" ou "sem dados" e explica por quê.
- **Don't** passar string formatada como `value` do `KpiCard`. O count-up lê o "." como decimal, e "1.250.000" vira "1". Passe o número: hoje `budgets.tsx:579` e `586`, `horizon-detail-client.tsx:97` e `vs-detail-client.tsx:108` e `116` passam `toLocaleString()`.
- **Don't** criar cartão clicável como `div` com `onClick`. O cartão de épico faz isso (`kanban.tsx:690-694`) e fica fora do alcance do teclado.
- **Don't** usar accordion para configuração que precisa ficar sempre visível; prefira seção fixa com cabeçalho (decisão do antigo `DESIGN.app.md`).
