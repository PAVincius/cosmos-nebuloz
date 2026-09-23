---
name: Scaffold
description: Framework de adoção em trilhas guiadas da Nebuloz — quatro fases, gates bloqueantes e caso de negócio versionado, no observatório noturno da suíte.
colors:
  # tema claro
  canvas: "#f5f6f8"
  surface: "#fff"
  surface-2: "#f7f8fa"
  surface-3: "#edeff3"
  sidebar: "#fbfbfd"
  hairline: "#e5e7ec"
  hairline-strong: "#d4d8e0"
  ink: "#0d1017"
  ink-muted: "#565e6e"
  ink-subtle: "#5f6878"
  ink-faint: "#636c7b"
  chip-bg: "#eff1f5"
  accent: "#1d6a97"
  accent-soft: "rgba(29, 106, 151, 0.1)"
  accent-text: "#145275"
  accent-fg: "#fff"
  blue: "#3f8fc4"
  blue-soft: "rgba(63, 143, 196, 0.11)"
  blue-text: "#276592"
  purple: "#7a68d8"
  purple-soft: "rgba(122, 104, 216, 0.1)"
  purple-text: "#5f4dbd"
  green: "#12915a"
  green-soft: "rgba(18, 145, 90, 0.1)"
  green-text: "#0c6941"
  amber: "#9a7415"
  amber-soft: "rgba(154, 116, 21, 0.13)"
  amber-text: "#76570e"
  red: "#d63a63"
  red-soft: "rgba(214, 58, 99, 0.1)"
  red-text: "#a7244a"
  neutral: "#8a93a3"
  neutral-soft: "rgba(138, 147, 163, 0.12)"
  neutral-text: "#596170"
  # tema escuro
  canvas-dark: "#07080c"
  surface-dark: "#0c0f17"
  surface-2-dark: "#10131e"
  surface-3-dark: "#181d2c"
  sidebar-dark: "#0a0c14"
  hairline-dark: "rgba(255, 255, 255, 0.07)"
  hairline-strong-dark: "rgba(255, 255, 255, 0.14)"
  ink-dark: "#f5f7fb"
  ink-muted-dark: "#b8c0d0"
  ink-subtle-dark: "#a2acc0"
  ink-faint-dark: "#8b95a9"
  chip-bg-dark: "rgba(255, 255, 255, 0.05)"
  accent-dark: "#5cb4e4"
  accent-soft-dark: "rgba(92, 180, 228, 0.14)"
  accent-text-dark: "#a8dbf4"
  accent-fg-dark: "#07080c"
  blue-dark: "#89cff0"
  blue-soft-dark: "rgba(137, 207, 240, 0.14)"
  blue-text-dark: "#bde5f8"
  purple-dark: "#b2a5ff"
  purple-soft-dark: "rgba(178, 165, 255, 0.14)"
  purple-text-dark: "#d6cfff"
  green-dark: "#29cc7a"
  green-soft-dark: "rgba(41, 204, 122, 0.13)"
  green-text-dark: "#7ce8ad"
  amber-dark: "#ecd06a"
  amber-soft-dark: "rgba(236, 208, 106, 0.13)"
  amber-text-dark: "#f6f2c3"
  red-dark: "#ff5c8a"
  red-soft-dark: "rgba(255, 92, 138, 0.14)"
  red-text-dark: "#ffa3bd"
  neutral-dark: "#6b7688"
  neutral-soft-dark: "rgba(107, 118, 136, 0.16)"
  neutral-text-dark: "#a2acc0"
typography:
  micro:
    fontFamily: "Manrope, sans-serif"
    fontSize: "10px"
  nota:
    fontFamily: "Manrope, sans-serif"
    fontSize: "11.5px"
  base:
    fontFamily: "Manrope, sans-serif"
    fontSize: "13px"
  forte:
    fontFamily: "Manrope, sans-serif"
    fontSize: "15px"
    fontWeight: 700
  titulo:
    fontFamily: "Space Grotesk, Inter Tight, Inter, sans-serif"
    fontSize: "19px"
    fontWeight: 700
    letterSpacing: "-0.02em"
  display:
    fontFamily: "Space Grotesk, Inter Tight, Inter, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    letterSpacing: "-0.035em"
  eyebrow:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "10px"
    fontWeight: 700
    letterSpacing: "0.12em"
    fontFeature: "'tnum' 1"
  page-title:
    fontFamily: "Space Grotesk, Inter Tight, Inter, sans-serif"
    fontSize: "27px"
    fontWeight: 700
    letterSpacing: "-0.025em"
  section-title:
    fontFamily: "Space Grotesk, Inter Tight, Inter, sans-serif"
    fontSize: "14.5px"
    fontWeight: 700
    letterSpacing: "-0.015em"
  kpi-value:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "37px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontFeature: "'tnum' 1"
  button:
    fontFamily: "Manrope, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "0.005em"
  badge:
    fontFamily: "Manrope, sans-serif"
    fontSize: "11.5px"
    fontWeight: 700
    letterSpacing: "0.02em"
rounded:
  r-xs: "6px"
  r-sm: "8px"
  r-md: "10px"
  r-lg: "14px"
  r-xl: "18px"
  r-pill: "999px"
spacing:
  pad: "20px"
  gap: "16px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-fg}"
    typography: "{typography.button}"
    rounded: "{rounded.r-md}"
    padding: "9px 15px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.r-md}"
    padding: "9px 15px"
  icon-button:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.r-md}"
    size: "34px"
  badge-neutral:
    backgroundColor: "{colors.chip-bg}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.badge}"
    rounded: "{rounded.r-pill}"
    padding: "3px 9px"
  badge-green:
    backgroundColor: "{colors.green-soft}"
    textColor: "{colors.green-text}"
    typography: "{typography.badge}"
    rounded: "{rounded.r-pill}"
    padding: "3px 9px"
  badge-amber:
    backgroundColor: "{colors.amber-soft}"
    textColor: "{colors.amber-text}"
    typography: "{typography.badge}"
    rounded: "{rounded.r-pill}"
    padding: "3px 9px"
  badge-red:
    backgroundColor: "{colors.red-soft}"
    textColor: "{colors.red-text}"
    typography: "{typography.badge}"
    rounded: "{rounded.r-pill}"
    padding: "3px 9px"
  filter-chip:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    typography: "{typography.nota}"
    rounded: "{rounded.r-pill}"
    padding: "5px 11px"
  filter-chip-selected:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-text}"
    typography: "{typography.nota}"
    rounded: "{rounded.r-pill}"
    padding: "5px 11px"
  input:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    typography: "{typography.base}"
    rounded: "{rounded.r-sm}"
    padding: "9px 11px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.r-lg}"
    padding: "{spacing.pad}"
  section-card-head:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.section-title}"
    padding: "13px 18px"
  kpi-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.r-xl}"
    padding: "18px 20px"
  page-header:
    textColor: "{colors.ink}"
    typography: "{typography.page-title}"
    rounded: "{rounded.r-lg}"
    padding: "22px 26px 24px"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    typography: "{typography.base}"
    rounded: "{rounded.r-sm}"
    padding: "7px 10px"
  nav-item-active:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-text}"
    typography: "{typography.base}"
    rounded: "{rounded.r-sm}"
    padding: "7px 10px"
  table-head:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-faint}"
    typography: "{typography.eyebrow}"
    padding: "9px 16px"
  table-row:
    textColor: "{colors.ink}"
    typography: "{typography.base}"
    padding: "11px 16px"
  modal:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.r-xl}"
    width: "880px"
  phase-node:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-faint}"
    rounded: "{rounded.r-pill}"
    size: "32px"
  phase-node-done:
    backgroundColor: "{colors.green-soft}"
    textColor: "{colors.green-text}"
    rounded: "{rounded.r-pill}"
    size: "32px"
  gate-diamond:
    backgroundColor: "{colors.amber-soft}"
    textColor: "{colors.amber-text}"
    rounded: "7px"
    size: "26px"
  gate-diamond-locked:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-faint}"
    rounded: "7px"
    size: "26px"
  phase-card:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.r-md}"
    padding: "12px 13px"
  phase-card-active:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.r-md}"
    padding: "12px 13px"
  stall-card:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.r-md}"
    padding: "12px 13px"
---

# Design System: Scaffold

## Overview

**Creative North Star: "O Observatório Noturno"**

O sistema é um observatório: canvas quase preto, instrumentos que só acendem quando alguém os observa e cada leitura catalogada com a sua origem. O escuro é a assinatura — é o tema padrão da plataforma (`defaultTheme="dark"`) e o único com textura; o claro é o mesmo observatório de dia, limpo por decisão e com a tinta calibrada contra as seis superfícies reais. A densidade é de instrumento de trabalho: tabela, painel e formulário para quem decide, nunca vitrine.

A cor não decora. Accent, blue e purple nomeiam ação e categoria; vermelho, âmbar e verde só aparecem quando há um fato negativo, de atenção ou positivo a mostrar, e sempre ao lado de uma palavra ou de um número. Todo identificador e toda medida saem em mono. O movimento informa estado e cabe em 450ms; o que passa disso é laço (pulso, varredura, shimmer) ou dívida registrada.

**Base compartilhada.** Charter, Meridian, Scaffold e Signal usam a mesma paleta (sky `#5CB4E4` → baby `#89CFF0` → butter `#F6F2C3` sobre canvas `#07080c`), a mesma escala de raio, as mesmas sombras de cartão e as mesmas primitivas: `@repo/design-system/cosmos/kit` e `components/charter/base.tsx`, que Meridian, Scaffold e Signal reexportam. Cada produto tem raiz escopada própria (`.charter-root`, `.meridian-root`, `.scaffold-root`, `.signal-root`) e um `.css` próprio — o do Meridian é cópia reescopada do Charter, o do Signal é cópia do Meridian, o do Scaffold foi portado do próprio handoff. Não existe arquivo comum (dívida registrada em `signal.css:11-14` e em `specs/003-signal-measure/plan.md`). **Mudar um token exige mudar os quatro `.css`** (`charter.css`, `meridian.css`, `scaffold.css`, `signal.css`). As cópias já divergem; cada divergência está marcada neste arquivo como tal e não deve ser propagada sem decisão.

No frontmatter, a chave é o nome da custom property sem o `--`. Sem sufixo, é o valor do tema claro; o sufixo `-dark` marca o mesmo token no tema escuro.

**No Scaffold**, o observatório acompanha o trajeto: quatro fases num trilho, com o gate desenhado como losango entre elas — "a fase não avança sem passar por aqui" vira imagem em vez de texto. O `scaffold.css` foi portado do próprio handoff (`scaffold.html`, projeto Claude Design `691f7fe5`) e é a cópia mais enxuta da família: sem as camadas do KPI, sem `:focus-visible`, sem tooltip, sem `--on-accent` e sem `--scrim`. Em troca, é o único que declara curvas de easing (`--ease-out`, `--ease-io`) e, com o Signal, o único com alvo de 44px em ponteiro grosso.

**Key Characteristics:**
- Escuro por padrão, claro limpo: a textura (grade de 64px e camadas do KPI) só existe no escuro.
- Neutros frios em cinco degraus de superfície; tinta clara calibrada a no mínimo 4.60:1 nas seis superfícies claras.
- Um único accent que troca de polaridade: `#1d6a97` com tinta branca no claro, sky `#5cb4e4` com tinta canvas no escuro.
- Cor de estado sempre com palavra ou número; categoria em accent, blue ou purple.
- JetBrains Mono para identificador, contagem, data, versão e medida.
- Raio suave e constante (6 → 18px, pílula em chip e badge); cartão com sombra mínima que só se aprofunda no hover.
- Trilho de fases com nós de 32px e losangos de gate de 26px girados 45°; só o gate pronto para decisão pulsa.
- A estagnação da carteira fica na casca, no rodapé da sidebar, para ser vista "sem ninguém procurar".
- Tema guardado no próprio elemento (`scaffold.theme`), escuro por padrão, e mono com algarismos tabulares.

## Colors

Neutros frios em camadas, um accent azul-céu que troca de polaridade entre os temas e tons semânticos de quatro slots (`--x`, `--x-rgb`, `--x-soft`, `--x-text`). Cada par abaixo é claro / escuro.

### Primary
- **Cerúleo Profundo / Sky** (#1d6a97 / #5cb4e4): ação primária, seleção, item de navegação ativo, barra da tab ativa, anel de foco e neutro informativo. É o único accent: no claro é escuro para aguentar tinta branca; no escuro é o sky da marca.
- **Cerúleo Noturno / Sky Claro** (#145275 / #a8dbf4): o accent como texto — item ativo, contador ativo, rótulo selecionado.
- **Véu Cerúleo / Véu Sky** (rgba(29, 106, 151, 0.1) / rgba(92, 180, 228, 0.14)): fundo de item ativo, de chip e segmento selecionados e do botão `soft`.
- **Tinta sobre Accent / Canvas sobre Sky** (#fff / #07080c): `--accent-fg`, declarado literal em cada tema — o Scaffold não declara `--on-accent` nem `--on-solid`. Glifo e texto sobre preenchimento sólido de accent ou de tom.

### Secondary
Categoria — papel, tipo, origem —, nunca estado.
- **Azul Baby Profundo / Baby** (#3f8fc4 / #89cff0): categoria; no escuro é o baby da marca. Texto em `--blue-text`.
- **Lilás Frio / Lilás Estelar** (#7a68d8 / #b2a5ff): segunda categoria. Texto em `--purple-text`.

No Scaffold, blue também marca a fase em "Observação 30d" (`PHASE_STATE`): estado informativo, sem juízo de bom ou ruim.

### Semantic
Reservados a fato.
- **Verde Confirmação / Verde Sinal** (#12915a / #29cc7a): fato positivo — concluído, no prazo, fechado, acima da meta.
- **Ocre / Butter Dourado** (#9a7415 / #ecd06a): atenção, prazo perto, dinheiro. No escuro, o butter da marca.
- **Framboesa / Rosa Alerta** (#d63a63 / #ff5c8a): negativo, crítico, bloqueado, vencido.

No Scaffold, a fase segue a regra: não iniciada em neutral, em andamento em accent, gate pronto e reaberta em âmbar, bloqueada em vermelho, fechada em verde (`lib/scaffold/phases.ts`). A estagnação da carteira sai em vermelho no rodapé da sidebar; sem estagnação, em verde.

### Neutral
- **Papel Frio / Preto Nebuloz** (#f5f6f8 / #07080c): canvas, o fundo da página; no escuro, a assinatura da marca.
- **Branco de Leitura / Noite Tinta** (#ffffff / #0c0f17): `surface` — cartão, modal, base do gradiente do `PageHeader`.
- **Branco Gelo / Noite Índigo** (#f7f8fa / #10131e): `surface-2` — cabeçalho de tabela, rodapé de modal, input do `base.tsx`, hover de item de navegação.
- **Cinza Gelo / Ardósia Noturna** (#edeff3 / #181d2c): `surface-3` — trilho de progresso e de segmented, tooltip de gráfico, skeleton. É onde a tinta clara tem a menor margem.
- **Branco de Margem / Margem Noturna** (#fbfbfd / #0a0c14): sidebar e topbar.
- **Fio Claro / Fio de Luz** (#e5e7ec / rgba(255, 255, 255, 0.07)): `hairline` — divisor e borda de cartão.
- **Fio Firme / Fio de Luz Firme** (#d4d8e0 / rgba(255, 255, 255, 0.14)): `hairline-strong` — borda de controle, hover, popover, modal.
- **Nanquim / Branco Estelar** (#0d1017 / #f5f7fb): `ink`, a tinta principal.
- **Grafite / Prata** (#565e6e / #b8c0d0): `ink-muted` — texto secundário, item de navegação inativo, rótulo de campo.
- **Grafite Médio / Prata Fosca** (#5f6878 / #a2acc0): `ink-subtle` — subtítulo e dica longa.
- **Ardósia Calibrada / Cinza Lunar** (#636c7b / #8b95a9): `ink-faint` — eyebrow, cabeçalho de tabela, meta. Carrega rótulos de 10px: não clarear sem remedir.
- **Cinza de Chip / Véu de Chip** (#eff1f5 / rgba(255, 255, 255, 0.05)): `chip-bg` — badge neutro, contador inativo, tecla.
- **Cinza Neutro / Cinza Neutro Noturno** (#8a93a3 / #6b7688): `--neutral` — fase não iniciada, gate futuro, nó de fase pendente. Texto em `--neutral-text`; como texto no claro, o sólido dá 2.69:1, então só traço e preenchimento.

O Scaffold não declara `--scrim`. Hoje sem efeito, porque as telas não montam o `ModalProvider` (ver Modal).

### Contraste medido
Razões que o código documenta (comentários de `charter.css`, `meridian.css` e `signal.css`) e que a especificação visual do Charter repete:
- `ink-faint` sobre `surface-3` no claro: **4.60:1**, a menor razão da tinta medida contra as seis superfícies claras (canvas, surface, surface-2, surface-3, sidebar, chip-bg).
- Canvas sobre o sky no escuro: **8.68:1**; branco no mesmo lugar cairia para **2.2:1**.
- Branco sobre o accent claro: o comentário registra **4.62:1**; o recálculo WCAG 2.x desta extração dá **5.90:1** para o accent atual. O comentário está desatualizado ou foi medido contra outro valor — os dois passam AA.

Recalculado nesta extração (WCAG 2.x), para as dívidas:
- Glifo branco sobre tom sólido no claro: verde 4.02:1, âmbar 4.30:1, lilás 4.38:1, azul 3.54:1. Passa o 3:1 de componente não textual (ícone, check), não passa o 4.5:1 de texto — nenhum texto sobre preenchimento de tom no claro.
- No escuro, a tinta canvas sobre tom sólido fica entre 6.82:1 (vermelho) e 13.15:1 (butter), e `ink-faint` dá 5.57:1 sobre `surface-3`.
- No Scaffold, os `-text` claros de verde, âmbar, vermelho e azul são mais escuros que os do Charter e do Meridian: sobre o próprio `-soft` em `surface-3` ficam em 5.25, 5.02, 5.35 e 4.85:1, onde os do Charter e do Meridian caem para 4.47, 4.42, 4.82 e 4.22:1. `--neutral-text` dá 5.42:1 sobre `surface-3`.

### Named Rules
**The Colored Fact Rule.** Vermelho, âmbar e verde são reservados a informação de fato: negativo, crítico ou bloqueado; atenção ou dinheiro; positivo. Categoria, papel e decoração usam accent, blue ou purple. O código já recusa o atalho: o tom de papel do Charter é "Categoria, não estado — por isso nada de verde, âmbar ou vermelho" (`packages/rbac/src/charter-matrix.ts:71-72`).

**The Color-Plus-Word Rule.** Estado nunca vai só na cor: `StatusDot` leva rótulo, célula de mapa de calor leva o número, prazo vencido escreve "vencido", gráfico leva legenda. É requisito de acessibilidade (NFR-2), não escolha estética.

**The Four-Slot Rule.** Todo tom existe como `--x`, `--x-rgb`, `--x-soft` e `--x-text`. Texto colorido usa `-text`; fundo usa `-soft`; borda usa `rgba(var(--x-rgb), .2–.35)`; o tom sólido fica para ponto, barra, traço e preenchimento. No claro, o tom sólido como texto reprova AA — verde 3.49:1, âmbar 3.74:1, vermelho 3.93:1 sobre `surface-3`.

**The Polarity Rule.** Glifo sobre preenchimento sólido usa a tinta do tema (`--accent-fg`): branco no claro, canvas no escuro. Branco sobre o sky cai para 2.2:1, e um check branco sobre o butter some.

## Typography

**Display Font:** Space Grotesk (with Inter Tight, Inter, sans-serif)
**Body Font:** Manrope (with sans-serif)
**Label/Mono Font:** JetBrains Mono (with ui-monospace, monospace)

**Character:** O mesmo par do Charter, apertado: `.display` com entreletra -.035em onde o componente não fixa a sua, e `.mono` com algarismos tabulares (`tnum`), para colunas de número alinharem. O corpo não é declarado na raiz: vem do `font-sans` do `<html>`, que resolve para Manrope.

### Hierarchy
- **Display** (display, 700, 22px): contagem grande e título de tela "Em breve" — `--fs-display`.
- **Título** (display, 700, 19px, entreletra -.02em): título de modal — `--fs-titulo`.
- **Forte** (corpo, 700, 15px): número-chave, título de estado vazio e de erro — `--fs-forte`.
- **Base** (corpo, 500 a 700, 13px, entrelinha 1.55 a 1.6 em prosa): corpo, rótulo, tab, input, botão do `base.tsx` — `--fs-base`.
- **Nota** (corpo, 600 a 700, 11.5px): meta, dica, legenda, contador, chip de filtro, rótulo de campo — `--fs-nota`.
- **Micro** (mono, 700, 10px, entreletra .06 a .18em, caixa alta): eyebrow e carimbo mono — `--fs-micro`. O piso é 10px e só se sustenta em caixa alta com entreletra aberta.
- **Page Title** (display, 700, 27px, entreletra -.025em): título do `PageHeader` — fora da escala.
- **Section Title** (display, 700, 14.5px, entreletra -.015em): cabeçalho de `SectionCard` — fora da escala.
- **KPI Value** (mono, 700, 37px, 42px em big, entrelinha 1, entreletra -.02em): valor do `KpiCard` — fora da escala.
- **Button** (corpo, 600, 14px, 13px em sm, entrelinha 1.1): `Button` do kit — fora da escala.
- **Label** (corpo, 700, 11.5px, entreletra .02em): texto de `Badge` — na escala, degrau `nota`.

### Estado da escala
**Dívida (código, 2026-09-22).** Os seis degraus são declarados só em `.cosmos-root` (`packages/design-system/cosmos/cosmos.css:62-67`), e nenhum dos quatro `.css` declara `--fs-*`. Onde `FS.*` aparece sob estas raízes — telas do Charter e as primitivas compartilhadas de `charter/base.tsx`, `charter/modal.tsx` e `charter/form-kit.tsx` — a variável não resolve e o texto herda o tamanho do pai (16px na raiz; nem o `body` nem a raiz definem `font-size`). A escala vale como norma; em pixel, só passa a valer quando os seis `--fs-*` forem declarados na raiz de cada produto. Leitura de código, não verificada em tela.

**Especificado, não implementado.** A especificação visual do Charter (projeto de design, ago/2026), cujo `charter-base.jsx` as três portas seguintes também importam, pede KPI em Space Grotesk 30–34px/700, título de página em Manrope 21px/700 e título de cartão em Manrope 13.5px/700. O kit renderiza o valor do KPI em JetBrains Mono 37px (42px em `big`), o título do `PageHeader` em `.display` 27px e o do `SectionCard` em `.display` 14.5px. Vale o código até haver decisão.

No Scaffold, as telas ainda usam 101 literais de `fontSize` em 12 tamanhos (10.5 a 26px); só as primitivas compartilhadas passam pela escala. O wordmark "Scaffold" sai em `.display` 15.5px com entreletra -.03em.

### Named Rules
**The Mono-for-Measure Rule.** Todo identificador e toda medida — código de caso, iniciativa, trilha ou fornecedor, contagem, data, versão, percentual — saem em JetBrains Mono (`.mono`); prosa nunca sai em mono. É a regra da especificação visual do Charter, e as primitivas a seguem: `MetaCell mono`, contador de navegação e de tab, cabeçalho de tabela, valor de `BarRow`.

**The Six-Step Rule.** Tamanho de texto só nos seis degraus da suíte: `--fs-micro` 10px, `--fs-nota` 11.5px, `--fs-base` 13px, `--fs-forte` 15px, `--fs-titulo` 19px, `--fs-display` 22px. Tamanho novo é degrau novo, "e degrau novo é como os quinze apareceram" (`cosmos.css:60-61`). Ao migrar um literal: degrau mais próximo, empate para baixo.

**The Single-Uppercase Rule.** Caixa alta só no `Eyebrow` e nos carimbos mono (cabeçalho de tabela, chip de versão), sempre com entreletra aberta; "qualquer outro uso de uppercase na UI é erro de porte" (`components/charter/base.tsx:38-39`). O wordmark do produto é a exceção de marca.

## Layout

Casca de ferramenta: sidebar fixa à esquerda com seções rotuladas por eyebrow, topbar de 56px e uma região de conteúdo rolável que carrega a grade de fundo (`.bg-grid`) e recebe foco de teclado. Dentro dela, a tela empilha `PageHeader`, faixas de KPI, `SectionCard`s e tabelas em grades de 2 a 4 colunas. Tabela é grid CSS: cabeçalho e linha compartilham um único `cols`.

Ritmo: `--pad` (20px) é o respiro do `Card` e `--gap` (16px) separa tab e conteúdo; o resto é literal nos componentes, entre 7 e 26px — cabeçalho de `SectionCard` 13×18px e corpo 18px, `KpiCard` 18×20px, `PageHeader` 22×26×24px com 22px abaixo, linha de tabela 11×16px e cabeçalho 9×16px, modal 20×22px no cabeçalho e 14×20px no rodapé. A densidade é alta de propósito: 13px no corpo, 11.5px na meta.

No Scaffold, a casca é um grid (`"bar bar" 56px "side main" 1fr / 248px 1fr`). O topbar traz o wordmark, o breadcrumb seção › tela, a organização e o tema — sem avatar e sem switcher de módulos. A sidebar tem 248px (14×12px, 18px entre seções) e leva no rodapé o cartão de estagnação — `StatusDot` vermelho ou verde, "n de m trilhas" em mono 15px/800 e o limiar em dias — e a identidade. O conteúdo tem 24×28×48px e largura máxima de 1420px. Não há gaveta: a sidebar fica fixa em qualquer largura. Em ponteiro grosso, todo `.btn`, `button`, `[role="button"]` e link de navegação ganha altura mínima de 44px (WCAG 2.5.8).

**The One-Cols Rule.** Cabeçalho e linha de tabela compartilham um único `cols` — sem isso, "a coluna do header desliza em relação à da linha no primeiro ajuste" (`components/charter/base.tsx:454-455`). Linha clicável é `<button>`, com "Abrir X" em `.sr-only` antes do conteúdo das células.

## Elevation & Depth

Híbrido. A profundidade vem primeiro da camada tonal — canvas, sidebar, surface, surface-2, surface-3 —, depois de sombra curta e difusa no claro e, no escuro, de sombra profunda com espalhamento negativo mais um fio de luz inset de 1px no topo. O brilho é estado: a barra de tom, o ponto de status e o botão primário brilham na cor do tom; em repouso, nada flutua.

### Shadow Vocabulary
- **Card rest light** (`0 1px 2px rgba(9, 12, 20, 0.05), 0 4px 14px -8px rgba(9, 12, 20, 0.1)`): `--card-shadow` no claro, em todo cartão.
- **Card rest dark** (`0 1px 0 rgba(255, 255, 255, 0.04) inset, 0 10px 30px -20px rgba(0, 0, 0, 0.9)`): `--card-shadow` no escuro.
- **Hover light** (`0 2px 4px rgba(9, 12, 20, 0.06), 0 18px 36px -20px rgba(var(--accent-rgb), 0.3)`): `--hover-shadow` no claro; só o claro põe accent na sombra.
- **Hover dark** (`0 1px 0 rgba(255, 255, 255, 0.06) inset, 0 24px 50px -26px rgba(var(--accent-rgb), 0.5)`): `--hover-shadow` no escuro.
- **Modal** (`0 50px 90px -24px rgba(0, 0, 0, 0.7)`): `ModalShell`.
- **Confirmação** (`0 24px 48px -16px rgba(0, 0, 0, 0.6)`): `alertdialog` de descarte.
- **Primary glow** (`0 1px 2px rgba(var(--accent-rgb), 0.4), 0 6px 16px -8px rgba(var(--accent-rgb), 0.6)`): botão primário do kit.
- **Tone bar glow** (`0 0 10px 2px rgba(var(--tone-rgb), 0.7), 0 0 22px 4px rgba(var(--tone-rgb), 0.3)`): barra de 3px do cabeçalho de `SectionCard` com tom.
- **Status glow** (`0 0 8px rgba(var(--tone-rgb), 0.6)`): ponto do `StatusDot`.
- **Lift dark** (`0 18px 40px -28px rgba(0, 0, 0, 0.9)`): `.lift:hover` no escuro; no claro, o hover usa `--hover-shadow`.
- **Current phase** (`0 0 0 4px rgba(var(--tone-rgb), 0.12), 0 0 16px rgba(var(--tone-rgb), 0.4)`): nó da fase corrente no trilho.
- **Gate glow** (`0 0 12px rgba(var(--tone-rgb), 0.35)`): losango de gate decidido, pronto ou bloqueado.

### Notas e dívidas
**Dívida (código, 2026-09-22).** O grão não renderiza em nenhum dos quatro produtos: o seletor pede `.grain` descendente da raiz do produto, e as quatro cascas põem as duas classes no mesmo elemento (`className="<produto>-root grain"`). A grade renderiza — `.bg-grid` fica na região de conteúdo. O detector do Impeccable acusa a grade (`codex-grid-background`): é decisão comentada, falso positivo deliberado.

No Scaffold, o `scaffold.css` não declara `.kpi` nem `.chart-tip`: o brilho do KPI no escuro e a sombra de tooltip não existem aqui (ver Cards / Containers).

### Named Rules
**The Responding-Glow Rule.** Em repouso, cartão só tem `--card-shadow`. A profundidade extra — subir 2px (`.lift`) ou 3px (`.kpi`), `--hover-shadow`, brilho do tom — é resposta a hover, e as camadas decorativas do KPI só acordam no escuro.

**The Night-Texture Rule.** Grão fractal (`feTurbulence`, opacidade .035, `mix-blend-mode: overlay`, fixo no viewport) e grade de 64px (`rgba(255, 255, 255, 0.022)`) existem só no escuro; no claro "viram sujeira, não textura" (`scaffold.css:131`). A intensidade global de efeito é `--fx` (0 a 1.6, padrão 1).

## Shapes

Cantos suaves e constantes, nunca vivos: 6px (`--r-xs`) no segmento interno do `Segmented`; 8px (`--r-sm`) em input, item de navegação, `GatedButton` e skeleton; 10px (`--r-md`) em botão, icon button e tile de ícone; 14px (`--r-lg`) em `Card`, `SectionCard`, `PageHeader` e tile de estado vazio; 18px (`--r-xl`) em `KpiCard` e modal; pílula (999px) em badge, chip de filtro, contador, avatar, ponto de status e trilho de progresso. Borda é fio de 1px — `hairline` no repouso, `hairline-strong` em controle, hover, popover e modal —; 1.5px só em controle selecionado. Tracejado tem sentido: origem externa, futuro ou pendente, e, em fio fino, a divisória do bloco de apoio dentro de um cartão. A barra luminosa de 3px à esquerda marca o ativo e o tom de um cabeçalho.

No Scaffold, o losango de gate é um quadrado de 26px com cantos de 7px girado 45°, com o ícone contra-girado; a borda é de 1.5px sólida no tom a 55% ou tracejada em `hairline-strong` no gate futuro. O nó de fase é pílula de 32px com borda de 1.5px. O trilho entre fases é linha de 2px — gradiente verde quando percorrido, tracejado em `hairline-strong` quando não —, e o critério do gate no card de fase fica sob um fio tracejado.

**The Gate-on-the-Rail Rule.** O gate é losango no trilho, entre as fases — nunca rótulo dentro do card. Desenhá-lo como parte do trilho "é o que faz 'a fase não avança sem passar por aqui' virar imagem em vez de texto" (`components/scaffold/phase-stepper.tsx:3-6`).

## Components

Duas camadas, reusadas tal e qual: o kit (`@repo/design-system/cosmos/kit.tsx` — Button, Badge, Card, SectionCard, KpiCard, Progress, PageHeader, Tabs, Avatar, IconButton, Switch, skeletons) e as primitivas do Charter (`components/charter/base.tsx` e `modal.tsx` — Eyebrow, MetaCell, FilterChips, Legend, BarRow, StatusDot, TableHead/TableRow, Field/Input/Select/Textarea, Segmented, estados de tela, GatedButton, ModalShell). Os componentes leem tokens por custom property e dependem dos nomes de classe `.btn`, `.navitem`, `.lift`, `.kpi`, `.skeleton`, `.scroll`, `.mono` e `.display`, definidos sob cada raiz.

### Buttons
- **Shape:** cantos de 10px (`--r-md`); tamanho pelo padding — 7×12px (`sm`), 9×15px (`md`), 11×18px (`lg`).
- **Primary:** fundo e borda `accent`, tinta `--accent-fg`, brilho do accent em duas camadas; texto 14px/600 (13px no `sm`), ícone de 16px (15px no `sm`) com traço 2.1.
- **Secondary:** `surface`, tinta `ink`, borda `hairline-strong`.
- **Ghost / Soft:** ghost é transparente com tinta `ink-muted`; soft é `accent-soft` com tinta `accent`.
- **Hover / Focus:** `.btn` não tem `:hover` em nenhum produto — decisão do sistema, registrada na onda 6 do Charter; o retorno é o `:active`. Foco é o anel de `:focus-visible` da raiz (ver Navigation).
- **Disabled:** atributo `disabled` real — sem ele, "o teclado continua alcançando um controle inerte" (kit).
- **GatedButton:** ação que a matriz de permissões nega. `disabled` real, opacidade .5, motivo no `title` e, nos modais, em texto visível no rodapé. Primary (`accent`), secondary (`surface-2` + `hairline-strong`) e danger (`red-soft` + `red-text` + borda `rgba(red, .35)`); 8×14px, cantos de 8px, 13px/700.

No Scaffold, `.btn:active` encolhe para `scale(.985)` em 60ms com `--ease-io`, e as transições de 150ms usam `--ease-out`; `.btn:disabled` tem opacidade .45 e `not-allowed`. Em ponteiro grosso, o padding vertical do `.btn` cresce até a altura de 44px. As telas usam o primário e o secundário.

### Chips / Badges
- **Style:** `Badge` é pílula de 3×9px, 11.5px/700, entreletra .02em — fundo `-soft`, tinta `-text`, borda `rgba(tom, .25)`; o neutro usa `chip-bg`, `ink-muted` e `hairline`. Aceita ponto de 6px (com pulso opcional) e ícone de 12px.
- **FilterChips:** pílulas de 5×11px, `--fs-nota`/700, num `<fieldset>` com `<legend>` oculta obrigatória; inativa transparente com `hairline` e `ink-muted`, ativa em `-soft` + `-text` + borda `rgba(tom, .35)`; contagem em mono a 75%.
- **Segmented:** 2 a 4 opções sempre visíveis num trilho `surface-3` com 3px de respiro; a ativa ganha `-soft`, `-text` e anel inset de 1px. Prefira à `Select` quando ver as alternativas muda a decisão.
- **State:** seleção por `aria-pressed`. A troca de tom de um `Badge` pede um flash de 350ms (`cosmos-badgeFlash`), keyframe que só `cosmos.css` declara — sob estas raízes ele só roda se o `cosmos.css` já estiver carregado na sessão.

No Scaffold, a métrica do caso de negócio usa a `ConfPill` do Meridian (Medido / Estimado / Declarado) sem redefinir a escala.

### Cards / Containers
- **Corner Style:** 14px em `Card`, `SectionCard` e `PageHeader`; 18px no `KpiCard`.
- **Background:** `surface`. O cabeçalho do `SectionCard` é `surface-2` no escuro (com fio de luz de 1px no topo) e `surface` no claro.
- **Shadow Strategy:** `--card-shadow` em repouso (ver Elevation & Depth).
- **Border:** `hairline`; com tom, `rgba(tom, .22)` e barra luminosa de 3px à esquerda do cabeçalho.
- **Internal Padding:** `Card` 20px (`--pad`); `SectionCard` 13×18px no cabeçalho e 18px no corpo; `KpiCard` 18×20px.
- **SectionCard:** título `.display` 14.5px/700 (como `h2` ou `h3` quando a tela precisa de esqueleto de títulos), subtítulo 12.5px em `ink-subtle`, ação à direita. Com `onActivate`, o cabeçalho vira botão e solta um pulso radial único a partir do cursor (700ms, desligado em reduced motion).
- **PageHeader:** gradiente `surface-3` → `surface-2` → `surface`, halo radial do tom a 14%, eyebrow mono 10px/700 (.14em) no `-text` do tom, título 27px, subtítulo 14.5px até 760px, ações à direita.
- **KpiCard:** rótulo 13px/600 em `ink-muted`, tile de ícone de 34px no `-soft` do tom, valor mono 37px, delta em `Badge` com seta e dica 12px em `ink-subtle`; mínimo de 150px (168px em `big`). No escuro o fundo vira gradiente do tom e quatro camadas acordam no hover — marca d'água gravada de 200px, brilho da marca, grade de pontos com máscara radial e o traço "ECG" em varredura de 3s — dentro de `.kpi-clip` (`overflow: hidden`, raio herdado) e escaladas por `--fx`. No claro as camadas somem por regra, e isso não é bug.

No Scaffold, `.lift` sobe 2px em 250ms (cards de fase); no claro ganha `--hover-shadow` e borda `hairline-strong`, no escuro a sombra de lift.

**Dívida (código, 2026-09-22).** O `scaffold.css` não declara `.kpi`, `.kpi-clip`, `.wm`, `.dots` nem `.sig`. O `KpiCard` do kit, usado 12 vezes nas telas, renderiza as camadas decorativas sem posição e sem a regra que as esconde no claro: a marca d'água de 200px e o traço do ECG entram no fluxo do cartão, nos dois temas. Leitura de código, não verificada em tela.

### Inputs / Fields
- **Style:** `Input`, `Select` e `Textarea` do `base.tsx`: `surface-2`, fio `hairline`, cantos de 8px, 9×11px, `--fs-base`/600 (`Textarea` 500, entrelinha 1.55, mínimo de 84px).
- **Label:** `Field` com rótulo `--fs-nota`/700 em `ink-muted`, asterisco em `red-text` no obrigatório e dica `--fs-nota` em `ink-faint`.
- **Focus:** o anel de `:focus-visible` da raiz; nenhum `outline: none` inline (a onda 6 tirou três que escondiam o foco em todo formulário que reusa `base.tsx`).
- **Error / Disabled:** borda `red` e `aria-invalid`; o erro substitui a dica ("quando os dois existem, o erro é o que importa"). Opção de `Select` pode vir desabilitada — explicar antes em vez de deixar o servidor recusar depois.

### Navigation
- **Style:** sidebar com seções sob eyebrow mono e itens de 13px com ícone de 15 a 15.5px; inativo em `ink-muted`, ativo em `accent-soft` com tinta `accent-text`/700 e `aria-current="page"`. Hover em `surface-2` + `ink` (`.navitem`, 150ms). Contador em mono numa pílula.
- **Topbar:** 56px sobre `sidebar`, fio `hairline` embaixo; marca à esquerda, contexto (breadcrumb) e, à direita, as ações de sessão — tema, identidade e, onde o produto tem, o switcher de módulos contratados, que some quando há um módulo só.

No Scaffold, o item tem 7×10px e cantos de 8px; ativo, ganha borda `rgba(accent, .18)` e a barra luminosa de 3px à esquerda. O contador sai em `chip-bg`/`ink-faint` (ativo em `rgba(accent, .25)`). Item sem tela não aparece na navegação — é filtrado, não desabilitado.
- **Focus:** o `scaffold.css` não declara `:focus-visible` — vale o anel padrão do navegador, fora do accent. É a única das quatro raízes sem anel próprio.
- **Theme:** o Scaffold guarda o tema no próprio elemento (`data-theme` na raiz, `localStorage` `scaffold.theme`, escuro por padrão), mas o `<html>` também carrega `data-theme` (next-themes, escuro por padrão). Os seletores `.scaffold-root[data-theme=…]` e `[data-theme=…] .scaffold-root` têm a mesma especificidade e o bloco escuro vem depois no arquivo: com o `<html>` escuro, o botão de tema claro não troca os tokens. E o kit decide o modo do `KpiCard` e do `SectionCard` pelo next-themes, não pela raiz. Dívida de código, não verificada em tela.

### Tables
- **Style:** `TableHead` em `surface-2`, 9×16px, rótulos mono `--fs-micro`/700 em caixa alta (.06em) e `ink-faint`; `TableRow` 11×16px com fio `hairline` entre linhas.
- **State:** linha clicável é `<button class="navitem btn">` — hover `surface-2` —, com "Abrir X" em `.sr-only`; o skeleton é `SkeletonRows` com o mesmo `cols`.

### Modal
- **Shape:** `ModalShell` de 880px por padrão (máximo 94vw × 88vh), `surface`, fio `hairline-strong`, cantos de 18px, sombra de modal.
- **Header:** 20×22px sobre `surface-2` com halo radial do tom a 13%, tile de ícone de 40px, título `.display` em `--fs-titulo`, subtítulo `--fs-base` e fechar em `IconButton` de 30px.
- **Body / Footer:** corpo rolável; rodapé fixo de 14×20px em `surface-2`, dica de teclado (`Kbd`) à esquerda, ações à direita. `ModalSplit` põe à direita um trilho de 300px que mostra a consequência enquanto se preenche.
- **Host:** `ModalProvider` monta em portal com scrim `--scrim` e blur de 6px, trava o scroll do fundo, prende o Tab, fecha no Esc e, com formulário sujo, pergunta antes de descartar (`alertdialog` "Descartar alterações?" sobre `surface-3`).

**Dívida (código, 2026-09-22).** No Scaffold, as telas renderizam `ModalShell` direto (criar trilha, assinar e contestar caso de negócio, override, reabertura e cancelamento de trilha) e não montam `ModalProvider`: o diálogo entra no fluxo da página, sem portal, sem scrim, sem trava de scroll, sem trap de Tab e sem Esc.

### Estados de tela
- **Loading:** skeleton com a forma do conteúdo (`SkeletonKpi`, `SkeletonCard`, `SkeletonRows`), shimmer de `surface-3` a `surface-2` em 1.4s, só depois de 300ms de espera (`useScreenLoad`) para não piscar. Sem spinner.
- **Empty:** `SmartEmptyState` — tile de 44px no tom, título `--fs-forte`, texto de até 400px e um CTA que resolve o vazio.
- **Error:** `ScreenError` com `role="alert"`, tile vermelho, a mensagem e "Tentar de novo".

### Primitivas de dado
- **StatusDot:** ponto de 7px no tom com brilho de 8px, sempre com rótulo `--fs-nota`/600 em `ink`.
- **Legend:** centralizada sob o gráfico, 16px entre itens, marcador de 9px (redondo, quadrado ou tracejado para série de referência).
- **BarRow / Progress:** trilho `surface-3` em pílula, preenchimento no tom com brilho de 10px, crescendo em 750ms; valor mono no `-text` do tom; `BarRow` clicável é `<button>`.
- **MetaCell:** eyebrow acima do valor (`--fs-base`/700, mono opcional) — usado "em vez de sopa de badges".

### PhaseStepper
Assinatura do Scaffold (`phase-stepper.tsx`): "a leitura do produto num relance: nó de fase, gate, nó, gate".
- **Nó de fase:** pílula de 32px — feita em `green-soft` com check verde, corrente no `-soft` do estado com anel de 4px a 12% e brilho, futura em `surface-2` com o número em mono 13px/800.
- **Gate:** entre dois nós, segmento de trilho, losango e segmento. Fechado em verde (check), pronto em âmbar (escudo, pulsando), bloqueado em vermelho (x), futuro neutro e tracejado — sempre com `role="img"` e `aria-label`.
- **Cards de fase:** grade de quatro `.btn.lift` de 12×13px e cantos de 10px, com título `.display` 14px, `StatusDot` do estado, a descrição em 11px e o critério do gate sob um fio tracejado. O ativo ganha `surface-2`, borda do tom a 45%, barra de 3px e sombra do tom.

### GatePanel
- **Style:** `SectionCard` com tom — âmbar enquanto decidível, vermelho bloqueado, verde decidido —, critérios com checkbox nativo em `accent-color` verde e a contagem "n/m atendidos" em mono.
- **State:** a recusa do servidor fica dentro do painel (`red-soft`, `role="alert"`, a lista de bloqueadores); o override só aparece depois de tentar fechar, e o override registrado fica em `amber-soft` com o eyebrow "Override registrado · imutável (SG-07)". Decidido, o painel mostra o snapshot congelado dos critérios, nunca o template de hoje.

### Caso de negócio e trilha
- **MetricRow:** linha de base, meta, delta derivado (nunca armazenado) e confiança em `ConfPill`.
- **SignalContractCard:** o que atravessa a fronteira para o Signal, e por quanto tempo, mostrado no ponto de emissão — versão vigente separada da versão em edição.
- **VersionTrail / StepList:** versão assinada é imutável e cada alteração cria versão, com quem assinou; cada passo de fase produz um artefato esperado, que quem executa marca, anexa e abre.

### Motion
- **Entrada de tela:** `.fade-in` de 450ms, subindo 7px.
- **Hover:** item de navegação e botão em 150ms; `.lift` sobe 2px em 250ms; `.kpi` sobe 3px em 400ms com `cubic-bezier(0.2, 0.7, 0.3, 1)`, e as camadas do KPI respondem entre 500 e 550ms.
- **Laços:** shimmer de skeleton em 1.4s, anel de pulso em 1.8s (`cubic-bezier(0.4, 0, 0.6, 1)`), varredura do ECG em 3s linear.
- **Tooltip:** `.chart-tip` entra em 120ms.
- **Kit:** contagem do KPI de 0 ao valor em 900ms (ease-out cúbico; direto sob reduced motion), `Progress` em 750ms, pulso radial do cabeçalho em 700ms.
- **Especificado, não implementado:** a especificação de motion da casa (PDF "Micro-interações — Big Bang · Charter · Cosmos", ago/2026) pede entrada de modal com fade do scrim, y de 10 a 0 e escala de .985 a 1 (180/220ms); toast com barra até o dismiss (200/4200ms) — os toasts do app vêm do `sonner`, fora destes tokens —; ícone de vazio pulsando devagar; contagem do KPI em cerca de 600ms; e os tokens `--ease-out-soft`, `--ease-pulse` e `--dur-*`. Nenhum desses nomes existe nestas raízes.

No Scaffold, a entrada `scaffoldFadeIn` vai da opacidade 0 a 1 e usa `--ease-out` (`cubic-bezier(0.16, 1, 0.3, 1)`); `--ease-io` é `cubic-bezier(0.4, 0, 0.2, 1)`. Nenhuma das duas é o `--ease-out-soft` `(0.2, 0.7, 0.3, 1)` da especificação. O anel de pulso roda no losango do gate pronto. Sob `prefers-reduced-motion`, o `scaffold.css` desliga pulso, shimmer e entrada (a contagem do KPI e o pulso do cabeçalho respeitam a preferência no próprio kit).

## Do's and Don'ts

### Do:
- **Do** escrever estado como cor + palavra ou número: `StatusDot` com rótulo, célula com contagem, "vencido" por extenso.
- **Do** pôr todo identificador, contagem, data, versão e medida em JetBrains Mono (`.mono`); prosa fica no corpo.
- **Do** usar o tom pelos quatro slots: texto em `--x-text`, fundo em `--x-soft`, borda em `rgba(var(--x-rgb), .2–.35)`, sólido só em ponto, barra, traço e preenchimento.
- **Do** usar `--accent-fg` para glifo sobre preenchimento sólido — branco no claro, canvas no escuro.
- **Do** desabilitar a ação sem permissão com `disabled` real e o motivo escrito ("Requer papel X — ação"), no rodapé quando for modal.
- **Do** mostrar skeleton com a forma do conteúdo real, só depois de 300ms, e vazio com um CTA que resolve o vazio.
- **Do** dar a todo gráfico legenda centralizada e `role="img"` com `aria-label` que diga os números.
- **Do** manter o anel de foco de 2px em accent e marcar seleção com `box-shadow`, que não apaga o anel.
- **Do** respeitar `prefers-reduced-motion`: desligar varredura, shimmer, pulso e translate e manter o fade.
- **Do** desenhar o gate como losango no trilho, entre as fases, e pulsar só o gate pronto para decisão.
- **Do** mostrar o snapshot congelado do gate decidido — nunca os critérios de hoje sobre uma decisão passada (SG-07).
- **Do** manter na casca o que precisa ser visto sem procurar, como a estagnação da carteira no rodapé da sidebar.

### Don't:
- **Don't** usar vermelho, âmbar ou verde como categoria, papel ou decoração — são fato; categoria usa accent, blue ou purple.
- **Don't** comunicar estado só com cor, nem deixar a justificativa só no hover: motivo de bloqueio e "por que isso importa" ficam na tela (`Callout`, rodapé do modal), não em `title`.
- **Don't** pôr grão, grade ou camadas do KPI no tema claro.
- **Don't** animar entrada ou transição acima de 450ms fora de laço; as exceções do kit (contagem do KPI em 900ms, `Progress` em 750ms, pulso do cabeçalho em 700ms) são dívida, não precedente.
- **Don't** escrever `outline: none` inline num controle, nem usar `outline` como anel de seleção.
- **Don't** criar tamanho de fonte fora dos seis degraus.
- **Don't** usar caixa alta fora do `Eyebrow` e dos carimbos mono.
- **Don't** pôr branco sobre o sky ou sobre qualquer tom sólido no escuro (2.2:1 no sky; some no butter).
- **Don't** mostrar zero no lugar de ausência: número que não existe aparece como "—", "aguardando" ou tachado com o motivo — zero num painel se lê como "medimos e deu zero".
- **Don't** gatear com `span` de opacidade ou `pointer-events: none`, que não impede Tab + Enter, nem esconder o controle que o papel não permite.
- **Don't** trazer o lavanda do Cosmos (`#5e6ad2`) nem importar `cosmos.css` nestas raízes: cada raiz é autossuficiente (ADR-0010).
- **Don't** portar o seletor de persona do protótipo: o papel vem da sessão, e trocar de papel no topbar seria escalada de privilégio (ADR-0004).
- **Don't** usar spinner para carregar tela.
- **Don't** escrever o gate como rótulo dentro do card de fase.
- **Don't** abrir `ModalShell` fora do `ModalProvider`: sem o host não há portal, scrim, trap de foco nem Esc — é como o Scaffold está hoje.
- **Don't** trocar o tema só no atributo da raiz enquanto o `<html>` carrega outro `data-theme`: a cascata escolhe o bloco escuro e o kit continua lendo o next-themes.
