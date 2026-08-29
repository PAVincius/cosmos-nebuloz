---
name: Big Bang
description: "O painel interno da Nebuloz. Densidade de ferramenta operacional sobre canvas quase-preto #07080c, com o azul-céu da marca (#5cb4e4 no escuro) como único acento cromático. Onde o Cosmos é o produto que o cliente usa, o Big Bang é a sala de máquinas: mais tabela que gráfico, mais dado que atmosfera, e um vocabulário de estado que nunca depende só de cor. Tipografia em Manrope para leitura, Space Grotesk para os poucos títulos de display e JetBrains Mono para tudo que é identificador, valor ou carimbo de tempo — o mono é o que faz um id parecer um id. Cartões são superfícies elevadas por hairline e sombra baixa, nunca por borda grossa. No escuro, uma textura de grão e uma grade de 64px dão profundidade sem competir com o conteúdo."

colors:
  accent: "#5cb4e4"
  accent-text: "#a8dbf4"
  accent-soft: "rgba(92, 180, 228, 0.14)"
  accent-fg: "#07080c"
  canvas: "#07080c"
  surface: "#0c0f17"
  surface-2: "#10131e"
  surface-3: "#181d2c"
  sidebar: "#0a0c14"
  hairline: "rgba(255, 255, 255, 0.07)"
  hairline-strong: "rgba(255, 255, 255, 0.14)"
  ink: "#f5f7fb"
  ink-muted: "#b8c0d0"
  ink-subtle: "#a2acc0"
  ink-faint: "#8b95a9"
  chip-bg: "rgba(255, 255, 255, 0.05)"
  green: "#29cc7a"
  green-text: "#7ce8ad"
  amber: "#ecd06a"
  amber-text: "#f6f2c3"
  red: "#ff5c8a"
  red-text: "#ffa3bd"
  blue: "#89cff0"
  blue-text: "#bde5f8"
  purple: "#b2a5ff"
  purple-text: "#d6cfff"
  light-canvas: "#f5f6f8"
  light-surface: "#ffffff"
  light-ink: "#0d1017"
  light-accent: "#1d6a97"
  light-accent-text: "#145275"

typography:
  display:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "21px"
    fontWeight: 700
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Manrope, sans-serif"
    fontSize: "13px"
    fontWeight: 700
  body:
    fontFamily: "Manrope, sans-serif"
    fontSize: "12.5px"
    fontWeight: 600
    lineHeight: 1.55
  label:
    fontFamily: "Manrope, sans-serif"
    fontSize: "11.5px"
    fontWeight: 600
  eyebrow:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "10px"
    fontWeight: 700
    letterSpacing: "0.12em"
  mono:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "11px"
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
  pad: "20px"

components:
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "{spacing.pad}"
  sidebar-item:
    textColor: "{colors.ink-muted}"
    rounded: "9px"
    padding: "8px 10px"
  sidebar-item-active:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-text}"
    rounded: "9px"
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-fg}"
    rounded: "{rounded.md}"
    padding: "10px 14px"
  input:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
---

# Big Bang — design do back-office

Terceira superfície do repositório, ao lado de `DESIGN.md` (marketing, identidade Linear) e `DESIGN.app.md` (Cosmos, produto do cliente). Existe pelo mesmo motivo que o segundo existe: **público diferente, tom diferente, densidade diferente**. O comentário em `apps/backoffice/app/backoffice-theme.css` resume — *"duas aplicações, dois domínios, duas pessoas diferentes"*.

Documento extraído do código em `main`, não prescrito. Descreve o que o painel **é** hoje.

## Overview

O Big Bang é operado por gente da casa — CS, RevOps, plataforma, segurança. Isso define quase tudo: quem abre esta tela abre dezenas de vezes por dia, sabe o vocabulário, e precisa de densidade em vez de acolhimento. Não há onboarding, não há ilustração, não há espaço morto decorativo.

O acento é um só e é escasso: azul-céu no estado ativo da navegação, no anel de foco e em pouca coisa mais. Cor carrega significado de estado — verde, âmbar, vermelho, azul, roxo — e **nunca aparece sozinha**: todo estado é cor mais palavra, via `Badge` ou `StatusDot`.

## Colors

Dois temas completos, trocados por `[data-theme]` no `<html>`. Escuro é o padrão (`defaultTheme="dark"`, `storageKey="nebuloz-bo-theme"`).

A paleta vive em `apps/backoffice/app/backoffice-theme.css` e **sobrescreve** a do `packages/design-system/cosmos/cosmos.css`, que traz a lavanda do protótipo do Cosmos. Só os tokens são redefinidos; as primitivas (`.kpi`, `.lift`, `.navitem`, `.btn`, `.skeleton`, animações) continuam vindo do cosmos.css e leem estas variáveis.

> **Dependência frágil que precisa estar escrita:** os dois arquivos usam o mesmo seletor (`.cosmos-root`) e a mesma especificidade. O que faz a paleta Big Bang vencer é **a ordem de import em `apps/backoffice/app/layout.tsx`** — `cosmos.css` antes, `backoffice-theme.css` depois. Inverter os dois desfaz a identidade inteira em silêncio, e não há teste nem lint protegendo isso: só um comentário.

Duas decisões de contraste que já foram tomadas e devem ser respeitadas:

- **`--accent-fg` é o canvas, não branco.** Branco sobre `#5cb4e4` dá ~1,8:1 e reprova AA; com o canvas passa de 10:1.
- **`green` e `amber` no tema claro não passam AA para texto** (3,3:1 e 3,2:1) — dívida conhecida e documentada em `cosmos.css:9-19`. Usá-los como fundo de badge com texto escuro está correto; usá-los como cor de texto sobre superfície clara, não.

## Typography

Três famílias, carregadas por `next/font`:

| Papel | Família | Onde |
|---|---|---|
| Leitura | Manrope (`--font-manrope`) | corpo, rótulos, botões |
| Display | Space Grotesk (`--font-space-grotesk`) | `.display` — wordmark, título de KPI grande |
| Dados | JetBrains Mono (`--font-jetbrains-mono`) | `.mono` — ids, valores, datas, eyebrow, códigos |

O mono não é decoração: é o que faz `P-ABC123`, `R$ 8.449,90` e `2026-08-29T14:20` parecerem o que são. Usar Manrope num id é perder essa pista.

**Não existem tokens de tamanho.** Os tamanhos são literais nos componentes, e a escala real medida no código é: **14 valores distintos entre 8,5px e 22px**, com 82% das ocorrências entre 10 e 13px, e 27% delas abaixo de 12px.

Isso é descrição, não recomendação. É provavelmente a maior dívida visual do painel: sem escala, a diferença entre um rótulo e um título é de 2,5px, e a hierarquia se sustenta em peso e cor em vez de tamanho. Um `extract` que crie a escala em token resolveria de uma vez para as 18 telas.

## Layout

Shell em grade fixa (`components/shell.tsx`):

```
gridTemplateAreas: "bar bar" / "side main"
gridTemplateColumns: 236px 1fr
gridTemplateRows: 56px 1fr
height: 100vh
```

Conteúdo com `maxWidth: 1180px` e padding de 26px. Dentro das telas, o ritmo é `var(--gap)` (16px) entre blocos e `var(--pad)` (20px) dentro de cartões — só esses dois valores.

Grades internas usam `repeat(auto-fit, minmax(210px, 1fr))` para KPIs e `minmax(150px, 1fr)` para filtros — fluidez intrínseca, sem breakpoint.

> **O back-office é desktop-only por construção.** Não há uma única `@media` de largura em todo o app; a sidebar de 236px é incondicional, sem colapso nem gaveta. Abaixo de ~600px sobram menos de 300px úteis. Isso é estado atual, não princípio — e é candidato número um a `adapt`.

## Elevation & Depth

Profundidade por camada tonal e hairline, não por borda grossa:

- `--canvas` → `--surface` → `--surface-2` → `--surface-3`, cada degrau alguns pontos mais claro
- `--hairline` (7% branco) separa; `--hairline-strong` (14%) delimita o que é interativo
- `--card-shadow` no escuro é sutil e inclui um `inset` de 4% no topo — a luz vem de cima
- `--hover-shadow` tinge a sombra com o accent, ligando elevação a interatividade

No escuro, duas texturas decorativas fora do fluxo e sem eventos: `.grain` (ruído fractal SVG, opacidade 0,035, `mix-blend-mode: overlay`) e `.bg-grid` (grade de 64px a 2,2% de branco). Existem no `sign-in` e no `seguranca`, dando peso às telas que não têm o shell.

## Shapes

Escala de raio completa e usada: `--r-xs` 6px em chips, `--r-sm` 8px em campos pequenos, `--r-md` 10px no padrão (botões, inputs), `--r-lg` 14px em cartões, `--r-xl` 18px em superfícies grandes, `--r-pill` para badges.

O item de navegação foge da escala com `borderRadius: 9` literal — entre `sm` e `md`.

## Components

O kit compartilhado é `@repo/design-system/cosmos/kit`, usado em 29 arquivos. O que o back-office de fato consome:

| Componente | Uso |
|---|---|
| `PageHeader` | todas as 18 rotas do shell, com `eyebrow` no padrão `Domínio · faceta` |
| `SectionCard` | bloco padrão de conteúdo; `title`, `subtitle`, `icon`, `action` |
| `Badge` | estado, sempre cor + palavra; `dot` quando é status vivo |
| `KpiCard` | só em `/propostas` — as demais telas montam KPI à mão |
| `Avatar`, `IconButton` | topbar e tabela de clientes |

**Padrões locais** que o kit não cobre, em `apps/backoffice/components/`:

- `campo.tsx` — `Campo`, `INPUT`, `Erro`, `BotaoPrimario`. Existe porque o kit não expõe campo de formulário. É o kit de formulário do painel.
- `chrome.tsx` — topbar e sidebar, mais um `Eyebrow` local para rótulo de seção (o único small caps do desenho).
- `write-button.tsx` — botão de escrita que, para MEMBER, renderiza desabilitado **com o motivo em `sr-only`**, não só em `title`. É o melhor exemplo de acessibilidade do painel e o padrão a seguir para qualquer ação bloqueada por papel.

Do kit, **não usados hoje**: `Button`, `Card`, `Progress`, `Tabs`, `Switch`, `Skel`, `SkeletonKpi`, `ErrorState`, `CopyId`, `ChartTip`, `GlossaryTip`. Os quatro últimos por não haver caso; `Skel` e `ErrorState` por lacuna — ver Do's and Don'ts.

## Do's and Don'ts

**Faça**

- Estado com cor **e** palavra. `Badge` com `dot` para status vivo.
- Mono para identificador, valor monetário, data e código. Sempre.
- Eyebrow no padrão `Domínio · faceta` — é o que dá lugar à tela dentro do painel.
- Empty state que explica **por que** está vazio e o que fazer, como em `/servicos`: *"Catálogo vazio. Sem serviço cadastrado, proposta vira texto livre…"*. Nunca "sem dados".
- Erro dentro da moldura do sucesso, como `clientes/[slug]/secao.tsx` faz — um parágrafo vermelho solto faz a tela parecer ter uma seção a menos, em vez de uma seção com problema.
- Motivo de bloqueio em `sr-only`, não só em `title` (`write-button.tsx`).

**Não faça**

- **Não use a lavanda `#5e6ad2` do Cosmos nem o `#010102` do marketing.** São outras superfícies.
- Não misture Tailwind/shadcn com os tokens na mesma tela. Hoje `/clientes/[slug]` faz isso e a costura aparece: o `page.tsx` usa tokens, três dos quatro filhos usam `className` utilitário.
- Não invente um quarto dialeto de erro. Hoje já há três — parágrafo inline com token, `text-destructive` do shadcn, e `border-red-500/30`. Convergir para o `ErrorState` do kit é o alvo.
- Não use `green`/`amber` como cor de texto sobre superfície clara (reprova AA).
- Não escreva `outline: none` em campo. Hoje cinco campos fazem isso e só não ficam sem foco porque o `:focus-visible` global do `cosmos.css` reintroduz o anel — funciona por acaso da cascata, não por desenho.

## Lacunas conhecidas

Registradas aqui porque um documento de design honesto inclui o que falta:

1. **Nenhum estado de carregamento.** Zero `loading.tsx`, zero `error.tsx`, zero `<Suspense>` nas 18 rotas — e 15 são `force-dynamic`. A pessoa clica e a tela anterior congela até o HTML novo chegar. `Skel` e `SkeletonKpi` existem no kit e nunca foram importados.
2. **Nenhuma responsividade.** Ver Layout.
3. **Nenhum token de tamanho de tipografia.** Ver Typography.
4. **Sem skip link** e sem `<h1>` nas telas do shell — o título vem do `PageHeader`.
