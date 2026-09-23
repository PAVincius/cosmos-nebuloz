---
name: Big Bang
description: "Painel interno da Nebuloz: densidade de sala de máquinas sobre canvas quase-preto, o azul-céu da marca como único acento, dado em mono e estado sempre em cor mais palavra."

colors:
  # Tema escuro (padrão). É o que os componentes abaixo referenciam.
  accent: "#5cb4e4"
  accent-text: "#a8dbf4"
  accent-soft: "rgba(92, 180, 228, 0.14)"
  accent-fg: "#07080c"
  canvas: "#07080c"
  sidebar: "#0a0c14"
  surface: "#0c0f17"
  surface-2: "#10131e"
  surface-3: "#181d2c"
  hairline: "rgba(255, 255, 255, 0.07)"
  hairline-strong: "rgba(255, 255, 255, 0.14)"
  chip-bg: "rgba(255, 255, 255, 0.05)"
  ink: "#f5f7fb"
  ink-muted: "#b8c0d0"
  ink-subtle: "#a2acc0"
  ink-faint: "#8b95a9"
  green: "#29cc7a"
  green-text: "#7ce8ad"
  green-soft: "rgba(41, 204, 122, 0.13)"
  amber: "#ecd06a"
  amber-text: "#f6f2c3"
  amber-soft: "rgba(236, 208, 106, 0.13)"
  red: "#ff5c8a"
  red-text: "#ffa3bd"
  red-soft: "rgba(255, 92, 138, 0.14)"
  blue: "#89cff0"
  blue-text: "#bde5f8"
  blue-soft: "rgba(137, 207, 240, 0.14)"
  purple: "#b2a5ff"
  purple-text: "#d6cfff"
  purple-soft: "rgba(178, 165, 255, 0.14)"
  scrim: "rgba(4, 6, 14, 0.6)"
  texture-grid: "rgba(255, 255, 255, 0.022)"
  canvas-grid: "rgba(127, 127, 127, 0.07)"
  # Tema claro.
  light-accent: "#1d6a97"
  light-accent-text: "#145275"
  light-accent-soft: "rgba(29, 106, 151, 0.1)"
  light-canvas: "#f5f6f8"
  light-sidebar: "#fbfbfd"
  light-surface: "#ffffff"
  light-surface-2: "#f7f8fa"
  light-surface-3: "#edeff3"
  light-hairline: "#e5e7ec"
  light-hairline-strong: "#d4d8e0"
  light-chip-bg: "#eff1f5"
  light-ink: "#0d1017"
  light-ink-muted: "#565e6e"
  light-ink-subtle: "#5f6878"
  light-ink-faint: "#636c7b"
  light-green: "#12915a"
  light-green-text: "#0d7548"
  light-green-soft: "rgba(18, 145, 90, 0.1)"
  light-amber: "#9a7415"
  light-amber-text: "#805f0f"
  light-amber-soft: "rgba(154, 116, 21, 0.13)"
  light-red: "#d63a63"
  light-red-text: "#b32750"
  light-red-soft: "rgba(214, 58, 99, 0.1)"
  light-blue: "#3f8fc4"
  light-blue-text: "#2a6f9e"
  light-blue-soft: "rgba(63, 143, 196, 0.11)"
  light-purple: "#7a68d8"
  light-purple-text: "#5f4dbd"
  light-purple-soft: "rgba(122, 104, 216, 0.1)"

typography:
  display:
    fontFamily: "Space Grotesk, Manrope, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Space Grotesk, Manrope, sans-serif"
    fontSize: "19px"
    fontWeight: 700
  title:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
  body:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.55
  label:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "11.5px"
    fontWeight: 600
  eyebrow:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "10px"
    fontWeight: 700
    letterSpacing: "0.12em"
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "11.5px"
    fontWeight: 700

rounded:
  xs: "6px"
  sm: "8px"
  md: "10px"
  lg: "14px"
  xl: "18px"
  pill: "999px"

spacing:
  gap: "16px"
  stack: "18px"
  page: "26px"
  page-narrow: "16px"

components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-fg}"
    typography: "{typography.title}"
    rounded: "{rounded.md}"
    padding: "9px 15px"
  button-secondary:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "6px 11px"
  button-ghost-danger:
    textColor: "{colors.red-text}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "5px 11px"
  button-readonly:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-faint}"
    typography: "{typography.title}"
    rounded: "{rounded.md}"
    padding: "9px 15px"
  input:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
  field-label:
    textColor: "{colors.ink-faint}"
    typography: "{typography.eyebrow}"
  field-error:
    backgroundColor: "{colors.red-soft}"
    textColor: "{colors.red-text}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "9px 11px"
  confirmation:
    backgroundColor: "{colors.green-soft}"
    textColor: "{colors.green-text}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "9px 11px"
  badge:
    backgroundColor: "{colors.chip-bg}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "3px 9px"
  badge-green:
    backgroundColor: "{colors.green-soft}"
    textColor: "{colors.green-text}"
  badge-amber:
    backgroundColor: "{colors.amber-soft}"
    textColor: "{colors.amber-text}"
  badge-red:
    backgroundColor: "{colors.red-soft}"
    textColor: "{colors.red-text}"
  filter-chip:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "5px 11px"
  filter-chip-active:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-text}"
  topbar:
    backgroundColor: "{colors.sidebar}"
    height: "56px"
    padding: "0 20px"
  sidebar:
    backgroundColor: "{colors.sidebar}"
    width: "236px"
    padding: "16px 10px"
  sidebar-item:
    textColor: "{colors.ink-muted}"
    typography: "{typography.body}"
    rounded: "9px"
    padding: "8.5px 10px"
  sidebar-item-active:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-text}"
    rounded: "9px"
  tab:
    textColor: "{colors.ink-muted}"
    typography: "{typography.body}"
    padding: "8px 14px"
  tab-active:
    textColor: "{colors.ink}"
  page-header:
    backgroundColor: "{colors.surface-2}"
    rounded: "{rounded.lg}"
    padding: "22px 26px 24px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "18px"
  card-header:
    backgroundColor: "{colors.surface-2}"
    padding: "13px 18px"
  kpi-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: "18px 20px"
  table-head:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-faint}"
    typography: "{typography.eyebrow}"
    padding: "10px 16px"
  table-cell:
    typography: "{typography.body}"
    padding: "10px 16px"
  empty-state:
    textColor: "{colors.ink-subtle}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "24px"
---

# Design System: Big Bang

O back-office da Nebuloz (codinome Big Bang, `apps/backoffice`) tem design próprio, separado das outras superfícies do repositório: `apps/app/DESIGN.md` descreve o shell do app do cliente; `apps/app/components/<produto>/DESIGN.md` descreve cada produto (Charter, Cosmos, Meridian, Scaffold, Signal); o `DESIGN.md` da raiz descreve o site de marketing (identidade Linear, lavanda `#5e6ad2` sobre `#010102`) e está obsoleto. O Big Bang fica à parte pelo mesmo motivo que os outros: **público diferente, tom diferente, densidade diferente**. O comentário de `apps/backoffice/app/layout.tsx` resume: *"duas aplicações, em dois domínios, para duas pessoas diferentes"*.

Documento extraído do código em `origin/main@ea512044` (2026-09-22), não prescrito: descreve o que o painel **é**. O que o código ainda não faz aparece como lacuna ou como "especificado, não implementado", nunca como regra. A versão anterior (2026-08-29, então `DESIGN.backoffice.md` na raiz) foi atualizada no lugar; o que ela afirmava e deixou de valer está em [O que mudou desde 2026-08-29](#o-que-mudou-desde-2026-08-29). O sidecar com componentes, sombras e movimento é `apps/backoffice/.impeccable/design.json`.

## Overview

**Creative North Star: "A Sala de Máquinas"**

O cliente usa o Cosmos e os outros produtos. O Big Bang é a sala de máquinas: onde a Nebuloz provisiona, contrata, acompanha e cobra cada cliente sem abrir o banco. Quem opera é gente da casa (plataforma, CS, comercial, segurança, quem fecha o mês no Financeiro), que abre a tela dezenas de vezes por dia e já conhece o vocabulário. Isso define quase tudo: densidade em vez de acolhimento, mais tabela que gráfico, mais dado que atmosfera. Não há onboarding, ilustração nem espaço morto decorativo. São 29 telas em 8 seções de menu (Plataforma, Delivery, Growth, Comercial, Empresa, Ferramentas, Auditoria, Operações) num shell único.

O acento é um só e é escasso: o azul-céu da marca marca posição (item ativo, anel de foco), ação primária e seleção. Cor carrega estado (verde, âmbar, vermelho, azul, roxo) e **nunca aparece sozinha**: todo estado é cor mais palavra. Toda operação sem volta passa por uma barreira que escreve o alvo e a consequência, e todo resultado é dito em frase no lugar onde a ação aconteceu. O mono é o que faz um id parecer um id.

A atmosfera existe, contida, e só no escuro, que é o tema padrão: grão e grade de 64px nas telas fora do shell, e as camadas do cartão de KPI no hover. O claro é limpo por decisão. Rejeições confirmadas no código: a lavanda do Cosmos e o preto do marketing, toast, borda grossa colorida em cartão, estado só em cor e a confirmação genérica do tipo "Tem certeza?".

**Key Characteristics:**
- Escuro por padrão, com tema claro completo e trocável na topbar.
- Um acento: azul-céu no escuro, azul profundo no claro; o texto sobre ele é o canvas no escuro.
- Seis degraus de tipo em token (10 a 22px); Manrope para ler, Space Grotesk para titular, JetBrains Mono para dado.
- Profundidade por camada tonal, hairline e sombra baixa, nunca por borda grossa.
- Estado em cor mais palavra; controle bloqueado diz por quê.
- Toda leitura tem esqueleto com a forma da tela, vazio que explica e falha com "Tentar de novo".
- Um breakpoint (1023px): a sidebar vira gaveta e as grades empilham.

## Colors

Paleta fria e de pouca saturação: quase-preto azulado em quatro degraus, um único azul-céu de acento e cinco tons de estado, cada um em três versões (sólido, `-text`, `-soft`).

Dois temas completos, trocados por `[data-theme]` no `<html>` (next-themes via `DesignSystemProvider`, `defaultTheme="dark"`, `storageKey="nebuloz-bo-theme"`, sem dividir a preferência com o app do cliente). O frontmatter lista o escuro sem prefixo e o claro com `light-`. Componentes leem `var(--token)`, e o tema resolve o valor; hex em componente só nas duas exceções de Do's and Don'ts.

A paleta vive em `apps/backoffice/app/backoffice-theme.css` e **sobrescreve** a de `packages/design-system/cosmos/cosmos.css`, que traz a lavanda do protótipo do Cosmos. Só os tokens são redefinidos; as primitivas (`.kpi`, `.lift`, `.navitem`, `.btn`, `.skeleton`, `.display`, `.mono`, a gaveta, as animações) continuam vindo do cosmos.css e leem estas variáveis. A escala de tipo, `--gap`, `--scrim` e os `--on-*` também vêm de lá; os raios e `--fx` estão nos dois arquivos, com os mesmos valores. O `globals.css` do design-system define `--canvas` e `--surface` com outros valores; o escopo `.cosmos-root` (no `<body>`) vence por especificidade.

> **Dependência frágil que precisa estar escrita:** `cosmos.css` e `backoffice-theme.css` usam os mesmos seletores (`.cosmos-root`, `[data-theme="…"] .cosmos-root`) com a mesma especificidade. O que faz a paleta Big Bang vencer é **a ordem de import em `apps/backoffice/app/layout.tsx`**: `globals.css` → `cosmos.css` → `backoffice-theme.css` → CSS do bpmn-js e addons → `bpmn-estudio.css`. Trocar os dois primeiros devolve a lavanda ao painel inteiro em silêncio; trocar os do bpmn-js devolve ao canvas o tema claro de fábrica. Nenhum teste ou lint protege essa ordem: só os comentários do próprio `layout.tsx`.

### Primary
- **Azul-céu Nebuloz** (`accent`; `light-accent` no claro): item ativo da sidebar (sobre o véu), anel de foco, ação primária, filtro ligado, opção selecionada na paleta de salto, ladrilho da marca, contorno do elemento selecionado no canvas BPMN. É a ponta "sky" da rampa da marca (sky → baby `blue` → butter `amber-text`, comentário do `backoffice-theme.css`).
- **Céu de leitura** (`accent-text`): texto na cor do acento, como o item ativo, o eyebrow do `PageHeader` e o filtro ligado.
- **Véu de céu** (`accent-soft`): fundo do item ativo, do filtro ligado, da opção da paleta e da barreira em tom accent.
- **Tinta sobre o céu** (`accent-fg`): no escuro é o próprio canvas; no claro é branco. Ver a regra abaixo.
- Sem tema resolvido, a base de `.cosmos-root` usa um terceiro azul (`#2a86bb`, com branco por cima). É reserva de carregamento, não token de uso.

### Neutral
- **Quase-preto da sala de máquinas** (`canvas`): fundo da página e da área de conteúdo.
- **Grafite da moldura** (`sidebar`): topbar e sidebar, um degrau abaixo das superfícies para a moldura recuar.
- **Grafite azulado** (`surface`): cartões, diálogos, cabeçalho do cartão no claro.
- **Grafite de campo** (`surface-2`): campo de formulário, botão secundário, faixa de cabeçalho de tabela, cabeçalho de cartão no escuro.
- **Ardósia alta** (`surface-3`): topo do gradiente do `PageHeader`, esqueleto, botão do minimapa BPMN.
- **Fio** (`hairline`, 7% de branco) separa; **fio forte** (`hairline-strong`, 14%) delimita o que é interativo e desenha o tracejado de "moldura sem conteúdo".
- **Branco gelo** (`ink`) no texto principal; **névoa** (`ink-muted`) no texto secundário e no item de menu em repouso; **névoa funda** (`ink-subtle`) em subtítulo e vazio; **cinza de rótulo** (`ink-faint`) em eyebrow, rótulo de campo, cabeçalho de tabela e dica. É o texto mais claro permitido: 4,6:1 sobre `light-surface-3`, sem folga.
- **Véu neutro** (`chip-bg`, 5% de branco): chip `BIG BANG` e badge neutro.
- **Scrim** (`scrim`): atrás da gaveta de navegação.
- **Grade de textura** (`texture-grid`) desenha a `.bg-grid`; **grade de canvas** (`canvas-grid`, cinza médio a 7%, neutro para servir aos dois temas) desenha a malha do canvas BPMN. São as duas cores puramente decorativas do frontmatter.

### Semantic
Cinco tons. O sólido é ponto, preenchimento ou traço; `-text` é texto; `-soft` (10 a 14% de alfa) é fundo de badge, alerta e confirmação.
- **Verde operacional** (`green`): módulo ativo, selo ADMIN, integração OK, sucesso.
- **Âmbar manteiga** (`amber`): atenção, módulo suspenso, selo MEMBER, fila que espera alguém, a caixa "Fora deste painel".
- **Rosa-alarme** (`red`): erro, risco, módulo cancelado, barreira que destrói.
- **Azul-bebê** (`blue`): trial, contagem neutra de KPI, Diagramas.
- **Lilás de estado** (`purple`): Maturidade de IA, BPMN, plano do cliente na carteira.

### Named Rules
**A Regra do Céu Escasso.** O azul-céu marca posição, ação primária e seleção. Não vira fundo de seção, ícone decorativo nem gradiente de destaque. Fora disso, ele só aparece no halo do `PageHeader` (14%) e no ladrilho da marca.

**A Regra da Cor com Palavra.** Estado nunca é só cor, só `title` ou só posição. `Badge` e `StatusDot` levam a palavra; o desvio do Orçado ganhou "acima do orçado" e "abaixo do previsto" (`orcado.tsx`) depois de a crítica R5 pegá-lo só em cor.

**A Regra do Texto Tonal.** Texto de estado usa `-text`, nunca o sólido. Pela fórmula WCAG 2.x sobre `light-surface`, os sólidos do claro dão verde 4,0:1, âmbar 4,3:1, azul 3,5:1, roxo 4,4:1 e vermelho 4,5:1; os `-text` ficam entre 5,4:1 e 6,4:1, e acima de 4,8:1 sobre o próprio `-soft`. No escuro todos passam, mas a divisão de papéis é a mesma.

**A Regra do Canvas sobre o Céu.** Texto e ícone sobre accent sólido usam `accent-fg`. No escuro, branco sobre `#5cb4e4` dá 2,3:1 e reprova AA; o canvas dá 8,7:1. No claro, branco sobre `light-accent` dá 5,9:1. O comentário do CSS fala em "~1.8:1" e "passa dos 10:1": os números não se reproduzem pela fórmula, a decisão sim.

## Typography

**Display Font:** Space Grotesk (`--font-space-grotesk`, com Manrope e sans-serif de reserva), pela classe `.display`
**Body Font:** Manrope (`--font-manrope`, com system-ui), a fonte de todo o `.cosmos-root`
**Label/Mono Font:** JetBrains Mono (`--font-jetbrains-mono`, com ui-monospace), pela classe `.mono`

As três chegam por `next/font` como variáveis na classe `fonts` do `<html>`; sem ela, tudo cai na fonte do sistema.

**Character:** Manrope é a voz de trabalho: geométrica, compacta, lida a 13px em peso 600. Space Grotesk aparece pouco (wordmark, título de página e de cartão) e dá o recorte técnico. JetBrains Mono carrega o dado.

### Hierarchy
Seis degraus em token (`--fs-*` em `cosmos.css`), com salto perceptível entre vizinhos. São 428 usos no back-office; resta um `fontSize` numérico (13px nas abas de `clientes/[slug]/detalhe.tsx:127`). Peso 700 é o mais comum, depois 600 e 500; 800 aparece em poucos números de destaque.
- **Display** (`--fs-display`, 22px, 700): título das telas fora do shell (sign-in e segurança, em Space Grotesk) e número grande em mono (resultado do CAC, nota da maturidade, total do documento de proposta).
- **Headline** (`--fs-titulo`, 19px, 700): título das outras telas fora do shell (404 da raiz, telas de bloqueio, falha geral) e número secundário em mono.
- **Title** (`--fs-forte`, 15px, 600): texto do botão primário, título de diálogo, wordmark `NEBULOZ` (700, entreletra .1em).
- **Body** (`--fs-base`, 13px, 600; `line-height` 1,5 a 1,6 em parágrafo): corpo, célula, item de menu, campo, confirmação, barreira.
- **Label** (`--fs-nota`, 11,5px, 600 ou 700): metadado, dica, badge, botão secundário, trilha da topbar, id em linha de lista.
- **Eyebrow** (`--fs-micro`, 10px, 700, mono, `.12em`, maiúsculas): rótulo de seção, rótulo de campo, cabeçalho de tabela, chip `BIG BANG`. O piso de 10px só vale em maiúsculas com entreletra aberta.

**O kit fica fora da escala.** `PageHeader`, `SectionCard` e `KpiCard` vêm de `@repo/design-system/cosmos/kit` com literais próprios: título de página 27px (Space Grotesk 700, `-.025em`) e subtítulo 14,5px; título de cartão 14,5px (700, `-.015em`) e subtítulo 12,5px; valor de KPI 37 ou 42px em mono. Migrar o kit muda o Cosmos junto, e o commit da escala (`1ed1dc01`) registrou isso como decisão de outro tamanho. Esses valores não são degraus e não saem do kit.

**Datas** saem de `lib/data.ts` em `dd/mm/aaaa hh:mm`, no fuso `America/Sao_Paulo` (fixo: a operação é da equipe no Brasil), com "—" para vazio ou inválido. Dinheiro em pt-BR (`R$ 8.449,90`).

### Named Rules
**A Regra dos Seis Degraus.** Tamanho de fonte só por `var(--fs-*)`. Um tamanho fora deles é um degrau novo, e degrau novo é como os quinze de antes apareceram (comentário da escala em `cosmos.css`).

**A Regra do Mono.** Identificador, valor, data, código e cabeçalho de tabela vão em mono. É o que faz `P-ABC123`, `R$ 8.449,90` e `22/09/2026 14:20` parecerem o que são. Manrope num id apaga a pista.

## Layout

Shell em grade nomeada na classe `.bo-shell` (`backoffice-theme.css`), não em `style` inline, porque inline vence folha de estilo e a media query precisa poder sobrepor:

```
grid-template-areas: "bar bar" "side main"
grid-template-columns: 236px 1fr
grid-template-rows: 56px 1fr
height: 100vh
```

A topbar atravessa as duas colunas; a sidebar rola sozinha; o `<main>` tem `padding: 26px`, rola por conta própria, entra com `.fade-in` e centraliza o conteúdo em `max-width: 1180px`. Sign-in, segurança, 404 da raiz e as telas de bloqueio ficam fora do shell: um cartão central sobre o canvas.

**Ritmo.** Blocos empilhados numa tela ficam a 18px um do outro (`stack`, o espaçamento mais repetido do painel e o do esqueleto); o `PageHeader` deixa 22px abaixo de si; fileiras de placas e colunas de detalhe usam `var(--gap)` (16px); pares de campos, 10px; corpo de cartão, 18px. Densidade é a do trabalho: cartões lado a lado, tabela a 10px de célula, nada de respiro de landing page.

**Grades em classe.** Toda grade de tela mora em `backoffice-theme.css` e empilha no mesmo corte:

| Classe | Forma | Abaixo de 1024px |
|---|---|---|
| `.bo-detalhe` | `1.5fr 1fr` (detalhe de cliente e de serviço) | 1 coluna |
| `.bo-duas-colunas` | 2 × `minmax(0, 1fr)`, gap 10px | 1 coluna |
| `.bo-tres-colunas` | 3 × `minmax(0, 1fr)`, gap 12px | 1 coluna |
| `.bo-kpis` (+ `-3`, `-5`) | 4 (3, 5) placas, gap 16px | 2 colunas |
| `.bo-campos` / `.bo-campos-largos` | `auto-fit`, mínimo 150px / 220px | quebra sozinha |
| `.bo-cartoes` | `auto-fill`, mínimo 240px, gap 8px | quebra sozinha |
| `.bo-kanban` | 4 × `minmax(210px, 1fr)`, `min-width: 880px` | rola de lado num contêiner `overflow-x: auto` |

`minmax(0, 1fr)` é o que impede um valor longo de empurrar as colunas vizinhas para fora do cartão.

**Um breakpoint: `max-width: 1023px`**, o mesmo da gaveta do Cosmos de propósito, porque as classes são as mesmas (`.cosmos-sidebar`, `.cosmos-scrim`, `.cosmos-menu-btn`). Abaixo dele a coluna da sidebar some e ela vira gaveta flutuante (`visibility: hidden` fechada, fora da ordem de foco); aparece o botão de menu (36×36); o `<main>` passa a `16px 16px 32px` e a topbar a `0 12px`. A topbar solta a trilha, o chip `BIG BANG`, o texto do wordmark, o nome ao lado do avatar e o texto do atalho da paleta; o selo de permissão encolhe para o papel, porque é o único aviso de que a sessão só lê. Diálogos usam as larguras do shadcn (`sm:max-w-*`, a partir de 640px).

### Named Rules
**A Regra da Grade em Classe.** Layout de tela não usa `gridTemplateColumns` inline: inline não tem media query. As 31 grades fixas que não empilhavam viraram classes `.bo-*`; forma nova de grade entra no `backoffice-theme.css`, não no componente.

## Elevation & Depth

Híbrido. A profundidade vem da camada tonal (`canvas` → `surface` → `surface-2` → `surface-3`, cada degrau alguns pontos mais claro) e do fio; a sombra é baixa e serve para descolar o cartão, não para flutuá-lo. No escuro, a sombra de cartão traz um `inset` de 4% de branco no topo: a luz vem de cima.

O que eleva:
- **`.lift`** (linhas da carteira, pedidos de Aprovações): no hover sobe 2px em 250ms e ganha sombra; a troca para `hairline-strong` está declarada, mas não aparece nos usos atuais (Lacunas, item 1).
- **`.kpi`**: sobe 3px em 400ms (`cubic-bezier(0.2, 0.7, 0.3, 1)`). No escuro, quatro camadas acendem dentro de `.kpi-clip`: marca d'água gravada, brilho do tom, grade de pontos com máscara radial e um sinal "ECG" varrendo em 3s, dessincronizadas entre 0,4 e 0,55s e escaladas por `--fx` (1).
- **`PageHeader`**: gradiente `surface-3` → `surface-2` → `surface`, fio de luz de 1px no topo (16% de branco) e halo radial do tom a 14%.
- **Cabeçalho do `SectionCard`** no escuro: `surface-2` e fio de luz de 1px no topo.

Texturas só no escuro, fora do fluxo e sem eventos: `.grain` (ruído fractal em SVG, opacidade 0,035, `mix-blend-mode: overlay`, fixo sobre tudo) e `.bg-grid` (grade de 64px em `texture-grid`). Aparecem só nas telas sem shell (sign-in, segurança, 404 da raiz, bloqueios do guard), para dar peso a elas. O canvas BPMN tem malha própria de 24px em `canvas-grid`: é superfície de medida, não enfeite. As duas grades são os únicos achados do detector (`codex-grid-background`), ambos falsos positivos: são decisões documentadas aqui.

Camadas sobrepostas: gaveta (z 60) sobre o scrim (z 55); pergunta de descarte do shell (z 70); skip link (z 1000); diálogos do shadcn (z 50) com o overlay de fábrica (`bg-black/50`), não o `scrim`.

### Shadow Vocabulary
- **Cartão, escuro** (`box-shadow: 0 1px 0 rgba(255,255,255,.04) inset, 0 10px 30px -20px rgba(0,0,0,.9)`, `--card-shadow`): cartão, cabeçalho de página, KPI, diálogo, menu da conta.
- **Cartão, claro** (`box-shadow: 0 1px 2px rgba(9,12,20,.05), 0 4px 14px -8px rgba(9,12,20,.1)`, `--card-shadow`).
- **Hover do `.lift`, claro** (`box-shadow: 0 2px 4px rgba(9,12,20,.06), 0 18px 36px -20px rgba(var(--accent-rgb),.3)`, `--hover-shadow`). A versão escura do token (tingida a 50%) existe e ninguém a lê.
- **Hover do `.lift`, escuro** (`box-shadow: 0 18px 40px -28px rgba(0,0,0,.9)`).
- **Brilho do primário** (`box-shadow: 0 1px 2px rgba(var(--accent-rgb),.4), 0 6px 16px -8px rgba(var(--accent-rgb),.6)`): botão primário e skip link visível.
- **Brilho da marca** (`box-shadow: 0 0 18px -4px rgba(var(--accent-rgb),.7)`, 20px no sign-in): ladrilho da chave.
- **Brilho de estado** (`box-shadow: 0 0 7px 1px rgba(var(--{tom}-rgb),.5)`): o ponto do `StatusDot`.
- **Gaveta** (`box-shadow: 0 0 60px -12px rgba(0,0,0,.5)`).

### Named Rules
**A Regra da Hairline.** Cartões são superfícies elevadas por hairline e sombra baixa, nunca por borda grossa. A frase é citada por `ferramentas/processos/painel.tsx` e por `processos-painel-dominio.test.tsx`: a cor do domínio virou um ponto ao lado do rótulo.

**A Regra da Textura no Escuro.** Grão, grade e camadas de KPI existem só em `[data-theme="dark"]` e só onde já estão. O claro é limpo por decisão.

## Shapes

Cantos suaves, escalonados pelo tamanho da peça (`--r-*`): 6px (`xs`) existe na escala e só aparece no esqueleto do ícone; 8px (`sm`) em botão secundário, fantasma, botão de menu e gatilho da paleta; 10px (`md`) em botão primário, campo, alerta, confirmação, vazio e barreira; 14px (`lg`) em cartão, cabeçalho de página e diálogo; 18px (`xl`) em KPI e nos cartões centrais (sign-in, bloqueio); pílula (`999px`, escrita `99` no código) em badge, filtro e chip.

Fora da escala: o item da sidebar (9px, entre `sm` e `md`), a tecla do atalho e o selo `PENDENTE` (5px), o ladrilho da marca (8px literal). Ícones são Lucide (via `lucide-react`, nomes do protótipo), traço de 1,9 a 2,1.

Bordas sempre de 1px. O tracejado de 1px em `hairline-strong` quer dizer "moldura sem conteúdo" (`Vazio`, caixa "Fora deste painel"). Aba selecionada é sublinhado de 2px em `accent`. O anel de foco é global: `2px solid var(--accent)` com 2px de afastamento (`.cosmos-root :focus-visible`).

Faixa lateral de 3px no tom existe em dois lugares, e nos dois o estado também está escrito: o cabeçalho do `SectionCard` com `tone` (kit; 10 dos 80 cartões: erro, 404, Home, Versão, saúde de integração, fila de gates, CAC, maturidade, detalhe de serviço) e o cartão de pedido em Aprovações.

## Components

### Buttons
Firmes e sem floreio: uma ação primária por área, o resto discreto. Botão não muda de cor no hover; o retorno é o cursor, o anel de foco e o afundar de 0,5px no clique (`.btn:active`, 100ms).
- **Primário** (`BotaoPrimario`, `campo.tsx`): `accent` com borda `accent`, texto `accent-fg`, 15px/600, `9px 15px`, raio `md`, brilho do primário; desabilitado a 50% com `not-allowed`. A mesma receita está copiada no `WriteButton`, no gatilho accent da `ConfirmarAcao`, na ação das telas de bloqueio, no "Provisionar cliente" da carteira e em mais alguns lugares: mudar um é mudar todos.
- **Secundário** (`BotaoSecundario`, "Exportar CSV", "Tentar de novo"): `surface-2`, borda `hairline-strong`, `ink-muted`, 11,5px/700, `6px 11px`, raio `sm`.
- **Fantasma** ("Voltar", gatilho vermelho da `ConfirmarAcao`, `PerguntaDescartar`): sem fundo, borda `hairline`, 11,5px/600, `5px 11px`, raio `sm`; texto `red-text` quando destrói.
- **Escrita bloqueada por papel** (`WriteButton` para MEMBER): `surface-2`, borda `hairline`, `ink-faint`, opacidade 0,6, `not-allowed`. É `aria-disabled` (continua no Tab), com o motivo no DOM em `sr-only`, ligado por `aria-describedby` e repetido no `title`: *"Somente leitura: seu papel no back-office é MEMBER. Um ADMIN precisa fazer esta ação."* É o padrão para toda ação bloqueada por papel; o servidor recusa de novo.
- **Botão de ícone** (`IconButton` do kit, 34×34, raio `md`, borda `hairline`): alternador de tema. Nome acessível obrigatório.

### Chips
- **Badge** (kit, 39 arquivos): pílula 11,5px/700, `3px 9px`, fundo `-soft`, texto `-text`, borda do tom a 25%. `dot` acrescenta um ponto de 6px na cor do texto para status vivo. Pisca uma vez (`scale 1.18`, 350ms) quando o tom muda. O selo de permissão da topbar é um badge: verde "ADMIN · leitura e escrita", âmbar "MEMBER · somente leitura".
- **StatusDot** (`status-dot.tsx`): ponto de 7px com o brilho do tom, mais a palavra em `ink-muted` 11,5px/600. Serve quando o estado acompanha um nome e a pílula competiria com ele.
- **Filtro por pílulas** (`FiltroChips`): `5px 11px`, 11,5px/700; desligado em `surface-2` + `hairline` + `ink-muted`, ligado em `accent-soft` + borda do accent a 45% + `accent-text`. `aria-pressed`, não `role="tab"`: filtra no lugar, não troca de painel.
- **Chip `BIG BANG`**: mono 10px/700 `.12em`, pílula `chip-bg` com `hairline`, `ink-subtle`.

### Cards / Containers
- **Cartão de seção** (`Secao` → `SectionCard` do kit): `surface`, borda `hairline`, raio `lg`, sombra de cartão, `overflow: hidden`. Cabeçalho `13px 18px` com fio inferior (e `surface-2` no escuro), título em `h2` (`h3` só quando aninhado); corpo `18px`. No mouseenter do cabeçalho, um pulso radial nasce no cursor uma vez (700ms), desligado por `prefers-reduced-motion`.
- **Cabeçalho de página** (`PageHeader` do kit, em todas as telas do shell): eyebrow mono 10px `.14em` na cor `-text` do tom, `h1` em Space Grotesk, subtítulo em `ink-subtle` com até 760px, ações à direita. O eyebrow segue `Seção · faceta`, com a seção lida do menu por `secaoDaRota` (`Plataforma · carteira`, `Comercial · funil`); telas de detalhe usam `entidade · id` (`cliente · vanta-saude`). O tom padrão é `accent`; Funil, Aprovações e o 404 usam âmbar, Maturidade de IA e BPMN usam roxo, Diagramas usa azul, o erro usa vermelho e o detalhe de serviço usa o tom da trilha. Não há regra escrita para esse mapeamento.
- **Cartão de KPI** (`KpiCard` do kit, 11 arquivos, dentro de `.bo-kpis`): raio `xl`, `18px 20px`, altura mínima de 150px; rótulo 13px/600 `ink-muted`, ladrilho de ícone 34×34 no tom, valor em mono 700 que conta de 0 ao número em 900ms (direto sob `prefers-reduced-motion`). No escuro, fundo em gradiente do tom e borda do tom a 20%. KPI clicável vira filtro (`Exigem atenção` na carteira).
- **Diálogo**: `Dialog` do shadcn (Radix: foco preso, Esc, overlay) repintado inline com `surface`, `hairline` e raio `lg`; título 15px; todo diálogo tem descrição, visível ou `sr-only`. Diálogo com rascunho pergunta antes de descartar.

### Inputs / Fields
- **Campo** (`Campo` + `INPUT`, `campo.tsx`): rótulo visível em mono 10px/700 maiúsculo `ink-faint` com `<label for>`; controle em `surface-2`, borda `hairline`, raio `md`, `10px 12px`, 13px/600 `ink`, largura total; dica 11,5px `ink-faint`; erro (`Erro`) em bloco `red-soft`, borda do vermelho a 30%, `red-text` 13px/600, `role="alert"`. Dica e erro chegam ao controle por `aria-describedby`, e o erro liga `aria-invalid`.
- **Foco**: o anel global. Nenhum campo escreve `outline` inline (`foco-visivel.test.tsx`).
- **Busca** (`busca.tsx`): o mesmo `INPUT` a `8px 10px`, rótulo visível, "Limpar" só quando há o que limpar e contador de quantos sobraram; o termo mora na URL.
- **Submit incompleto** diz o que falta ao lado (`OQueFalta`: "Para criar: código, nome e cliente.").
- Seletor de período e entrada de data usam `Popover` e `Calendar` do shadcn repintados na paleta do painel.

### Navigation
- **Topbar** (56px, `sidebar`, fio inferior): ladrilho da marca 28×28 (gradiente do accent, chave em `accent-fg`, brilho), wordmark `NEBULOZ` em Space Grotesk que leva à Home (`/`), chip `BIG BANG`, trilha mono `Seção › Tela`, gatilho da paleta, selo de permissão, tema, menu da conta.
- **Sidebar** (236px, `sidebar`, `16px 10px`, grupos a 20px): eyebrow por seção; item com ícone de 15,5px, 13px, `8.5px 10px`, raio 9px. Em repouso, `ink-muted`/600 e traço 1,9; ativo, `accent-soft` + `accent-text`/700, traço 2,1 e `aria-current="page"`. O ativo é o item mais específico da rota, pela mesma função que monta a trilha. No pé, a caixa tracejada "Fora deste painel", com eyebrow âmbar.
- **Gaveta** (abaixo de 1024px): abre pelo botão de menu com `aria-expanded`, o foco entra na nav, Esc e scrim fecham, o foco volta ao botão; topbar e `<main>` ficam `inert` enquanto ela está aberta.
- **Skip link** "Pular para o conteúdo": primeiro foco do documento; aparece no Tab com o visual do primário e pousa no `<main id="conteudo">`.
- **Paleta de salto** (Ctrl/⌘+K): gatilho de 36px com o atalho escrito ("Ir para…" e `⌘K` ou `Ctrl K`; só a lupa abaixo de 1024px). Abre um diálogo a 12vh do topo com combobox: as telas do menu e, a partir de duas letras, clientes. Opção ativa em `accent-soft`/`accent-text`. Não dispara dentro de campo.
- **Abas**: `role="tab"` com foco itinerante; a selecionada tem sublinhado `accent` de 2px e `ink`, as outras `ink-muted`; a contagem vai no rótulo ("Usuários · 3"). Quando a leitura falha, a aba da Trilha mostra "—" com o motivo; Usuários e Integrações ainda mostram "0" (crítica R6, P1). No Financeiro, as sete abas são links.
- Menu, wordmark e paleta passam pela guarda de rascunho: com edição pendente, a pergunta de descarte aparece fixa abaixo da topbar. O "Sair" do menu da conta ainda não passa.

### Tables
`<table>` de verdade, com `scope="col"`, cabeçalho em mono 10px/700 maiúsculo `ink-faint` e fio `hairline` entre linhas. Dois dialetos convivem. O componente `Tabela` (`components/tabela.tsx`, 10 arquivos: Financeiro, CAC, Funil, Fornecedores, Versão, fila de gates) usa `table-layout: fixed` com larguras em `<colgroup>`, faixa de cabeçalho `surface-2` e células `10px 16px`. As tabelas escritas à mão (carteira, Trilha, Benchmark, Orçado, Caixa, Maturidade, módulos e observabilidade do cliente) têm cabeçalho sem faixa e células `11px 14px`. O componente `Tabela` não embrulha em `overflow-x`; algumas telas embrulham por fora, outras não.

### Leitura, vazio, falha e sucesso
O painel nunca fica mudo: toda tela diz que está carregando, que está vazia e por quê, que falhou e como sair, e que deu certo.
- **Carregando** (`carregando.tsx`, nos 30 `loading.tsx`): esqueleto com a geometria real do kit (cabeçalho com duas linhas de subtítulo; corpo em forma de cartões, KPIs, tabela, documento ou cartão central) e shimmer de 1,4s, dentro de `<output aria-busy>` rotulado "Carregando". Um pulo quando os dados chegam é pior que a espera.
- **Vazio** (`Vazio`): parágrafo centrado, tracejado `hairline-strong`, raio `md`, `24px`, 13px/500 `ink-subtle`, dizendo por que está vazio e o que fazer. Exemplo em `/servicos`: *"Catálogo vazio. Sem serviço cadastrado, proposta vira texto livre e o Benchmark fica sem eixo de comparação."*
- **Falha ao carregar** (`FalhaAoCarregar`, em 28 arquivos): bloco `red-soft`, borda do vermelho a 30%, `role="alert"`, título colado no primeiro motivo do servidor (uma linha por leitura que falhou, sem repetir), nota opcional e "Tentar de novo" (`router.refresh()`, sem perder shell nem rolagem). Fica sob o `PageHeader`: erro dentro da moldura do sucesso. Erro de rota e endereço inexistente também ficam dentro da casca (`(staff)/error.tsx`, `not-found.tsx`), com saída para a Home.
- **Confirmação** (`Confirmacao`): `<output aria-live="polite">` em `green-soft` com `green-text` 13px/600 (ou neutro, para "nada mudou"), nascida junto do controle que agiu e nomeando o alvo.
- **Barreira** (`ConfirmarAcao`, 20 usos): antes de operação sem volta, o gatilho vira um `fieldset` inline com o rótulo em imperativo e o alvo em mono ("Cancelar COSMOS — vanta-saude"), a consequência em prosa e dois botões, "Voltar" primeiro e "Confirmar" depois: a confirmação não nasce sob o cursor. Tom `red` quando destrói, `accent` quando é a ação primária sem volta (provisionar, enviar proposta). Esc volta, o foco entra em "Voltar" e retorna ao gatilho.
- **Tela de bloqueio** (`TelaDeBloqueio`): cartão central de raio `xl` sobre canvas com grão e grade, ladrilho de ícone no tom, título 19px em Space Grotesk e a saída certa para cada recusa do guard (cadastrar o segundo fator, esperar o teto, trocar de conta).

### Listas com teto
Nenhuma lista sai do banco sem `take`: `TETO_DA_LISTA` é 100 (`lib/paginacao.ts`). Lista que cresce no cliente mostra "Mostrar mais 100"; tela que lê a página no servidor (Saúde e renovação, Benchmark, Trilha) usa `PaginacaoEmLinks` (`?pagina=N`, sem link na borda). "Exportar CSV" é link com o filtro da tela, na Trilha e nos Títulos.

### Estúdio BPMN
`bpmn-estudio.css` repinta o bpmn-js com os tokens: canvas em `surface` com a malha de 24px, formas com traço `ink-subtle` e preenchimento `surface-2`, texto `ink`, seleção e hover em `accent`; paleta e context pad em `surface-2` com hover em `accent-soft`; painel de propriedades pelas variáveis `--bio-properties-panel-*`. O editor Mermaid segue o tema resolvido.

## Do's and Don'ts

### Do:
- **Use** cor e palavra para todo estado: `Badge` com `dot` para status vivo, `StatusDot` quando o estado acompanha um nome, veredito escrito ao lado de qualquer cor.
- **Use** mono para identificador, valor, data, código e cabeçalho de tabela, e datas por `lib/data.ts` (`dd/mm/aaaa hh:mm`, fuso de São Paulo, "—" quando vazia).
- **Escreva** o eyebrow como `Seção · faceta`, com a seção de `secaoDaRota`; em tela de detalhe, `entidade · id`.
- **Use** `var(--fs-*)` para tamanho e `var(--token)` para cor. Hex literal só nas duas exceções escritas no código: a reserva do `var()` em `falha-geral.tsx` e as cores do `.canvas` exportado em `processos-canvas.ts`.
- **Monte** grade de tela com as classes `.bo-*`; forma nova entra no `backoffice-theme.css`.
- **Abra** cada seção com `Secao` (título em `h2`); `h3` só para cartão aninhado.
- **Entregue** a leitura completa: `loading.tsx` com `Carregando` na forma da tela, `Vazio` que diz por que e o que fazer, `FalhaAoCarregar` com "Tentar de novo" dentro da moldura.
- **Diga** o sucesso em frase, no lugar: `Confirmacao` junto do controle que agiu, nomeando o alvo.
- **Ponha** `ConfirmarAcao` antes de toda operação sem volta: alvo escrito, consequência em prosa, "Voltar" antes de "Confirmar".
- **Explique** todo controle bloqueado: `WriteButton` (aria-disabled e motivo no DOM) quando depende de papel, `OQueFalta` ao lado de submit incompleto.
- **Limite** toda lista: `take` até 100 com "Mostrar mais", ou `PaginacaoEmLinks` quando a página vem do servidor.

### Don't:
- **Não use** a lavanda do Cosmos (`#5e6ad2`, `#7c87ff` no escuro) nem o `#010102` do marketing: são outras superfícies.
- **Não ponha** `data-theme` em nó interno: reativa as regras do `globals.css` e troca o `--accent` pelo valor do design-system sem parecer quebrado (medido no sign-in: `lab(10.6% .65 -3.3)` dentro do cartão). O tema vem só do `<html>`.
- **Não inverta** a ordem de import do `layout.tsx` (`cosmos.css` antes de `backoffice-theme.css`, CSS do bpmn-js antes de `bpmn-estudio.css`).
- **Não escreva** texto com o sólido de um tom: no claro ele fica entre 3,5:1 e 4,5:1; texto de estado é `-text`.
- **Não ponha** branco sobre o accent no escuro (2,3:1): use `accent-fg`.
- **Não clareie** `ink-faint`: ele carrega os rótulos de 10px e está a 4,6:1 sobre `light-surface-3` (NFR-2 do handoff pede o mesmo).
- **Não use** borda grossa colorida em cartão: o `borderLeft: 3px` de `processos/painel.tsx` foi o warning do detector e virou um ponto de 7px ao lado do rótulo, com teste.
- **Não use** toast para dizer que deu certo: o painel é sem toast por decisão (spec do funil v2), e o teste `sucesso-no-lugar` cobra a frase junto do controle.
- **Não pergunte** "Tem certeza?" nem use `window.confirm`: a barreira escreve alvo e consequência.
- **Não desabilite** em silêncio, nem use opacidade, `title` ou posição como único sinal de estado.
- **Não use** placeholder como rótulo: some ao digitar e não é rótulo para leitor de tela.
- **Não escreva** `fontSize` numérico nem crie degrau novo, e não copie os literais do kit (27px, 14,5px) para fora dele.
- **Não escreva** `gridTemplateColumns` inline para layout de tela.
- **Não pinte** com utilitário do Tailwind ou do shadcn (`bg-primary`, `text-muted-foreground`, `text-destructive`, `border-red-500/30`): eles leem a régua do `globals.css`, não a do Big Bang. Tailwind fica para largura e posição de diálogo e para `sr-only`.
- **Não escreva** `outline: none` nem `outline` inline: o anel global é o foco do painel.
- **Não leve** textura (grão, grade de 64px) para o tema claro nem para telas do shell.
- **Não copie** a receita do botão primário para mais um arquivo: use `BotaoPrimario`, ou `WriteButton` quando depende de papel.
- **Não cubra** nem restile o `.bjs-powered-by` do canto inferior direito do canvas BPMN: a licença bpmn.io exige o watermark visível e sem sobreposição.

## Lacunas conhecidas

Registradas aqui porque um documento de design honesto inclui o que falta.

1. **Hovers que o inline anula.** O cosmos.css declara hover para `.navitem` (fundo `surface-2`, tinta `ink`), para a borda e o brilho do `.kpi` e para a borda do `.lift`. Nos três casos o componente escreve `background`, `color`, `border` ou `boxShadow` inline, e inline vence a folha. Resultado: item da sidebar, botão de menu e `IconButton` não reagem ao hover; o KPI sobe sem acender a borda; o pedido de aprovação sobe sem trocar a borda. É a mesma armadilha que já tirou o grid e os paddings do `style`.
2. **O kit fora da paleta.** O `KpiCard` pinta o fundo escuro com gradientes fixos (`TONES` em `kit.tsx`) calculados sobre a paleta do Cosmos: o tom `accent` leva lavanda (`rgba(124,135,255,.14)`) e o verde leva `#34d399`. Carteira, Funil e Biblioteca de IP usam KPI em `accent`. O tom `neutral` não existe como token (`--neutral`, `--neutral-rgb`), e o KPI de Fornecedores que o usa perde borda e fundo tonal.
3. **Movimento reduzido incompleto.** Desligam com `prefers-reduced-motion`: sinal ECG, `.lift`, entrada de tela, gaveta, chevron, pulso do cabeçalho, contagem do KPI. Não desligam: shimmer do esqueleto, subida de 3px do KPI, piscada do badge e o anel pulsante (este sem uso no painel).
4. **Responsivo pela metade.** Tabelas sem `overflow-x` abaixo de 1024px; três editores com grade fixa inline (BPMN `1fr 300px`, Mermaid, registrar ativo de IP); restam 9 `gridTemplateColumns` inline. "Abaixo de 1024px é requisito ou cortesia?" segue sem resposta do dono.
5. **Consolidação pela metade.** Botão primário copiado em vários arquivos, dois dialetos de tabela, estilo de diálogo repetido por arquivo, eyebrows fora do padrão (`Growth · maturidade de IA` escrito à mão, `Nebuloz · erro`) e um `fontSize` numérico.
6. **Token fantasma.** `PerguntaDescartar` pede `--red-border`, que não existe; cai em `hairline-strong`, e a pergunta de descarte sai sem o vermelho da barreira.
7. **Branco sobre sólido no claro.** A inicial do nó no Mapa de processos usa `--on-solid` (branco no claro) sobre o sólido do tom: 3,5:1 a 4,5:1. É a única peça que escreve sobre sólido de tom.
8. **Texto pequeno continua pequeno.** A escala consertou o vocabulário, não o piso: quando ela entrou, as ocorrências em 11,5px ou menos continuaram 73. Subir o piso mexe na densidade de um painel que existe para ser denso; é decisão pendente.
9. **O detector quase não vê este painel.** Cerca de 85% do estilo é inline (laudo de 2026-08-29), e as regras de sistema do detector só leem literais entre aspas. Verde no hook não prova conformidade: meça no navegador, achatando o alfa dos `-soft` contra o fundo antes de calcular contraste.
10. **Overlay em dois dialetos.** A gaveta usa `--scrim`; os diálogos, o `bg-black/50` do shadcn.

## Especificado, não implementado

O PRD e SRD do handoff (agosto de 2026) e o anexo "Micro-interações (Big Bang · Charter · Cosmos)" pedem mais do que o código faz. Nada disto é regra até existir no código.

- **Tokens de movimento** `--ease-out-soft`, `--ease-pulse`, `--dur-tap`, `--dur-hover`, `--dur-lift`, `--dur-kpi`, `--dur-texture`, `--dur-screen`: só `--fx` existe. Os valores vivem literais no cosmos.css e batem com a tabela (100, 150, 250, 400, 450 e 550ms; `cubic-bezier(.2,.7,.3,1)`), com uma exceção: a contagem do KPI dura 900ms, não cerca de 600.
- **M1, entrada de tela:** implementada só como deslocamento de 7px em 450ms, sem o fade de opacidade.
- **M7, modal:** o diálogo anima como o shadcn, não com `y 10→0` e `scale .985→1`.
- **M8, toast com o efeito colateral:** não existe, e a direção tomada é a oposta (sucesso no lugar).
- **M10, ponto pulsante:** `LivePulse` e `Badge pulse` existem no kit, sem uso no painel.
- **M14, ícone pulsando no vazio:** o `Vazio` não tem ícone; a keyframe `cosmos-emptyPulse` está sem uso.
- **M17, teste de conexão inline:** não há tela de integração com teste.
- **NFR-3:** tabela virtualizada acima de 200 linhas e esqueleto só depois de 300ms. O painel usa teto de 100 com "Mostrar mais" e mostra o esqueleto de imediato.

## O que mudou desde 2026-08-29

Afirmações da versão anterior que o código não sustenta mais. A decisão por trás de cada uma, quando havia, continua acima.

| Afirmação anterior | Hoje | Desde |
|---|---|---|
| "Não existem tokens de tamanho": 14 valores entre 8,5 e 22px | Escala `--fs-*` de seis degraus, 428 usos, 1 literal | `1ed1dc01` |
| "Desktop-only por construção", sem nenhuma `@media` | Breakpoint de 1023px, gaveta, grades que empilham | `168fb35c`, `02be7d54`, `366a7503` |
| Grade do shell inline em `shell.tsx` | Classe `.bo-shell`; `shell.tsx` é um Server Component fino e o chrome é o `ShellChrome` | `168fb35c` |
| KPIs em `auto-fit, minmax(210px, 1fr)` | `.bo-kpis` com 4, 3 ou 5 colunas, 2 no estreito | `02be7d54` |
| Ritmo de dois valores: `--gap` entre blocos, `--pad` dentro de cartões | 18px entre blocos e no corpo do cartão; o back-office não lê `--pad` | — |
| Nenhum `loading.tsx`, `error.tsx` ou `Suspense`; `Skel` e `SkeletonKpi` nunca importados | 30 `loading.tsx` com `Carregando` (que usa os dois), `error.tsx`, `not-found.tsx` e `global-error.tsx`; `Suspense` por aba no Financeiro | `ad664b36`, `8b170b19`, `56dbece6`, `6dfd47ad` |
| Sem skip link | "Pular para o conteúdo" | `1c67ce59` |
| 18 telas; `PageHeader` nas 18 | 29 telas em 8 seções; `PageHeader` em todas as do shell | — |
| `KpiCard` só em `/propostas`; kit em 29 arquivos; `Button`, `Card`, `Progress`, `Skel`, `SkeletonKpi` sem uso | `KpiCard` em 11 arquivos; kit importado por 69; `Button` e `Card` na fila de gates, `Progress` em dois. Seguem sem uso: `Tabs`, `Switch`, `ErrorState`, `CopyId`, `ChartTip`, `GlossaryTip`, `LivePulse` | — |
| Três dialetos de erro; o alvo era o `ErrorState` do kit | Convergiu para `Erro` (bloco inline) e `FalhaAoCarregar` (leitura com saída). O `ErrorState` perdeu: tem `fontSize` literal, não tem `role="alert"` nem saída | `34c150bb`, `56dbece6`, `8b170b19` |
| `/clientes/[slug]` mistura Tailwind e tokens | Zero classes e zero imports de `components/ui/` ali; no painel, Tailwind resta em largura e posição de diálogo e em `sr-only` | `34c150bb` |
| Cinco campos escrevem `outline: none` | Nenhum, com teste | `7df97cf8` |
| `green` e `amber` no claro dão 3,3:1 e 3,2:1 (`cosmos.css:9-19`) | Esses números são do Cosmos. No back-office o claro dá verde 4,0:1, âmbar 4,3:1, azul 3,5:1, roxo 4,4:1; a regra continua, estendida aos quatro | — |
| Branco sobre `#5cb4e4` dá ~1,8:1; o canvas passa de 10:1 | 2,3:1 e 8,7:1 pela fórmula WCAG; a decisão continua | — |
| `--hover-shadow` tinge a elevação com o accent | Só no `.lift` do claro; o token escuro não é lido | — |
| Eyebrow `Domínio · faceta` | `Seção · faceta`, com a seção lida do menu | `3be468ec` |
| Grão e grade no sign-in e na segurança | Também no 404 da raiz e nas telas de bloqueio | — |
| Data em mono como `2026-08-29T14:20` | `dd/mm/aaaa hh:mm`, fuso de São Paulo | `6dfbf44b` |
| `WriteButton` renderiza desabilitado | `aria-disabled`: continua no Tab e anuncia o motivo | `79067340` |
| Frontmatter com display 21px, title 13px, body 12,5px, mono 11px; primário `10px 14px` | Papéis sobre os seis degraus; primário `9px 15px` em 15px/600 | `1ed1dc01` |
