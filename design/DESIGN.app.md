# COSMOS — Design system (aplicação autenticada)

Documento separado do `DESIGN.md` (marketing / site). Define tokens e padrões da **UI operacional** SAFe.

## Princípios

- Densidade **enterprise**: tabelas, kanbans e formulários legíveis sem “marketing fluff”.
- **Um accent** (`#5e6ad2`, lavender Linear) para CTAs, links ativos e foco — não decoração.
- Superfícies em camadas: `background` → `card` → `muted/30` em cabeçalhos de secção.
- Português (PT-BR) em copy de produto; metadata pode ficar EN.

## Tokens (referência)

| Token | Valor | Uso |
|--------|--------|-----|
| `accent` | `#5e6ad2` | CTA primário, barra de secção, links de ação |
| `accent-hover` | `#828fff` | hover em botões primários |
| `ink` | `foreground` | Títulos |
| `ink-muted` | `muted-foreground` | Subtítulos, hints |
| `surface` | `card` | Painéis |
| `hairline` | `border` / `border-border/80` | Divisores |

## Tipografia (Tailwind)

| Papel | Classes |
|--------|---------|
| Título de página | `text-2xl font-bold tracking-tight` |
| Subtítulo | `text-sm text-muted-foreground mt-0.5` |
| Título de secção | `text-sm font-semibold tracking-tight` |
| Eyebrow | `text-xs font-medium uppercase tracking-wide text-muted-foreground` |

## Layout

| Papel | Classes |
|--------|---------|
| Shell de página | `flex w-full min-w-0 flex-col` |
| Cabeçalho fixo | `border-b border-border/80 px-6 py-4` |
| Corpo scroll | `min-w-0 flex-1 overflow-y-auto p-6` |
| Cartão de secção | `rounded-lg border border-border/80 bg-card shadow-sm` |
| Cabeçalho de cartão | `border-b border-border/60 bg-muted/30 px-5 py-3` |

## Componentes piloto (2025)

Telas que adoptam `appDesign` (`apps/app/lib/app-design.ts`):

- Portfolio Kanban (`/portfolio`)
- Priorização WSJF (`/portfolio/wsjf`)
- Workspace (`/settings/workspace`)

## Semântica SAFe (cores utilitárias existentes)

- WSJF alto / médio / baixo: classes `wsjf-high`, `wsjf-medium`, `muted`
- Estados de épico: badges `outline` / `secondary` por `statusId`

## Não fazer na app

- Canvas marketing `#010102` em páginas operacionais (reservado ao site).
- Accordions para configuração sempre visível (preferir secção fixa com cabeçalho).
- Room IDs Liveblocks hardcoded — usar `tenantId` / `orgId` no id da sala.
