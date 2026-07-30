# ADR-0010 — Tema próprio do Charter reusando o kit do Cosmos

**Status**: Accepted
**Data**: 2026-07-28
**Contexto de origem**: `DESIGN.md §1` (paleta do Charter) vs `cosmos.css`

## Contexto

`DESIGN.md` do Charter define uma paleta diferente da do Cosmos:

| Token | Cosmos | Charter |
|---|---|---|
| `--accent` (dark) | `#5e6ad2` lavanda | `#5cb4e4` sky |
| `--red` | `#e11d48` | `#ff5c8a` |
| `--amber` | `#d97706` | `#ecd06a` butter |

Um tenant pode ter os dois módulos, então as duas paletas coexistem na mesma
sessão e não podem vazar uma na outra.

## Decisão

`charter.css` escopado em `.charter-root`, mesmo padrão de `.cosmos-root`, com
tema por `[data-theme="light|dark"] .charter-root`.

**As primitivas de `components/cosmos/kit.tsx` são reusadas sem cópia.** Elas
renderizam nomes de classe (`kpi`, `lift`, `btn`, `mono`, `display`) e leem
tokens por CSS var — trocar o escopo troca a paleta inteira sem tocar em um
componente. `charter.css` redefine os mesmos seletores sob a sua raiz, e os
`@keyframes` são renomeados (`charter-fadeIn`, `charter-shimmer`, …) para que
cada arquivo seja autossuficiente: um tenant que só tem Charter não carrega
`cosmos.css`.

O que o Charter constrói próprio (`components/charter/base.tsx`) é o que o kit do
Cosmos não tem: `Field`/`Input`/`Select`/`Textarea`/`Segmented` (o Cosmos resolve
com `<input>` cru espalhado pelas telas — o Charter não pode, o intake é a tela
mais importante do produto), mais `Eyebrow`, `MetaCell`, `FilterChips`, `Legend`,
`BarRow`, `StatusDot`, `TableHead`/`TableRow`, `ModalShell`, `SmartEmptyState`,
`ScreenError`, `GatedButton`.

## Alternativas consideradas

**Reusar os tokens do Cosmos.** Um tema só para a plataforma inteira, mais coeso
para quem contrata combo. Rejeitada: ignora o `DESIGN.md` do Charter, que
calibrou contraste AA contra as seis superfícies claras reais da própria paleta.

**Accent por módulo via `data-module` num CSS único.** Menos duplicação.
Rejeitada: exigiria remedir contraste AA a cada accent, e `--accent-fg` já
difere entre os dois (`#07080c` sobre o sky do Charter, branco sobre o lavanda do
Cosmos). Um token que muda de polaridade não é o mesmo token.

**Copiar `kit.tsx` para `components/charter/`.** Rejeitada: dois lugares para
corrigir o mesmo bug.

## Consequências

- Identidade visual própria por módulo, sem vazamento, sem duplicar componente.
- **Dívida registrada**: as primitivas puras vivem em `components/cosmos/`
  servindo dois produtos, o que contraria a regra de ADR-0001 ("nenhum código do
  Charter importa de `components/cosmos/`"). É exceção consciente e limitada a
  componentes sem lógica de domínio. Extrair `packages/ui-kit` é refactor de
  escopo próprio.
- `charter.css` e `cosmos.css` compartilham a estrutura. Melhoria numa primitiva
  precisa ser espelhada — até a extração do pacote.
- Fontes vêm de `@repo/design-system/lib/fonts`, já no `<html>`. Sem `next/font`
  duplicado.
