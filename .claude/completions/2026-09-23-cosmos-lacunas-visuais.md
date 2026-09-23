# Lacunas visuais do Cosmos — fechadas, com prova no navegador

**Data:** 2026-09-23 · **Branch:** `claude/reverent-satoshi-38612c`, empilhada
sobre `docs/kb-consolidacao` (PR #243, que traz o DESIGN.md e o PRODUCT.md do
Cosmos). Nada foi enviado ao remoto.

Origem: pedido do dono — com `/impeccable` e `apps/app/components/cosmos` como
alvo, fechar as lacunas que o DESIGN.md do Cosmos registrava: a varredura de
ECG do KPI (e conferir a textura do escuro), o modal portado fora de
`.cosmos-root`, telas sem `var(--fs-*)`, `KpiCard` recebendo string formatada e
`<html lang="en">`. Verificar no navegador, claro e escuro.

## O que mudou (6 commits)

1. `refactor(cosmos)` — as 11 telas tocadas usam a escala: 167 literais viram
   `var(--fs-*)` pelo mapa do `1ed1dc01`. Fora do mapa: 9 → micro; 13.5 →
   base; 14.5, 15.5 e 17 → forte. O WSJF de 30px mono do preview do épico fica
   fora (numeral de dado). Commit mecânico, montado no índice a partir do HEAD.
2. `fix(design-system)` — ECG com `gradientUnits="userSpaceOnUse"` (o traço
   caía no primeiro 0,3% do gradiente, opacidade zero). `KpiCard` só conta
   número, formata em pt-BR com o novo `decimals`; string sai como veio.
   Chamadores: 8 telas do Cosmos e o funil do back-office. WSJF médio de
   backlog vazio deixa de mostrar "0.0" e mostra "—".
3. `fix(cosmos)` — `CosmosPortal` (`.cosmos-root` com `display: contents`) no
   modal e nos popovers de filtro de Kanban, Times e Dependências.
4. `fix(app)` — `lang="pt-BR"` em `app/layout.tsx` e `app/global-error.tsx`
   (copy deste traduzida: "Algo quebrou" / "Tentar de novo").
5. `fix(design-system)` — achado na verificação: `useThemeName` lia o tema na
   hidratação, e no primeiro carregamento em claro o KPI renderizado no
   servidor ficava com fundo escuro para sempre. Agora devolve escuro só
   enquanto hidrata (`useSyncExternalStore`).
6. `docs(cosmos)` — DESIGN.md descreve o estado atual e registra o que a
   verificação achou.

**Grão do escuro:** o Cosmos nunca teve (nem `cosmos.css`, nem o histórico,
nem o handoff). Nos outros quatro produtos o `.grain::after` não renderiza —
o seletor pede `.grain` descendente da raiz e as cascas põem as duas classes
no mesmo nó (já registrado no DESIGN.md do Charter).

## Achados que ficaram fora (follow-up)

- Hover do KPI: borda e sombra no tom não acendem, porque `border`/`boxShadow`
  inline vencem o `:hover` do CSS. Mesma raiz do lampejo escuro que sobra no
  SSR em tema claro. Correção: levar o visual por tema do `KpiCard` para CSS,
  nas cinco folhas (cosmos, charter, meridian, signal, scaffold).
- `ink-subtle` claro (#65748b) reprova AA fora do branco: 4,43:1 sobre
  `surface-2` (subtítulo do modal), 4,35:1 sobre `canvas`, 4,27:1 sobre
  `chip-bg`, 4,16:1 sobre `surface-3`. #5d6b80 passa em todas; o token vem do
  `cosmos.css`, que o back-office também importa — decisão do dono.
- Decimal com ponto fora do `KpiCard`: tabela do WSJF (`toFixed(1)`), "Placar
  3.7 de 5" no PI Planning, WSJF do preview do épico (`toFixed(2)`).
- Sidecar `.impeccable/design.json` do Cosmos mais velho que o DESIGN.md
  (`/impeccable document` regenera).
- 548 `fontSize` literais em 21 valores nas telas não tocadas; o kit segue fora
  da escala por decisão do `1ed1dc01`.

## Verificação

- Vitest: `apps/app` (screens, components, charter) 766/766; `apps/backoffice`
  inteiro 1735/1735. Teste novo `__tests__/components/kpi-card.test.tsx`, 4
  casos, RED contra o kit antigo e GREEN no novo.
- `tsc` em `apps/app`: 44 erros, a mesma linha de base de worktree novo;
  nenhum em linha tocada (`app/layout.tsx:30` é o `ThemeProvider`).
- Biome só nos arquivos tocados; detector do Impeccable: 1 achado,
  pré-existente e intencional (base da barra de Flow Velocity).
- Navegador: a worktree não tem `.env` (ler ou copiar foi bloqueado), então o
  app subiu com `SKIP_ENV_VALIDATION=true` e valores públicos fictícios, numa
  página-harness temporária, não commitada, que monta o `KpiCard`, o
  `ModalProvider` real e um popover pelo `CosmosPortal`. As telas reais do
  Cosmos, que pedem sessão e banco, não foram abertas.
- Medido: `lang="pt-BR"`; KPIs "1.250.000", "3,7", "2,4" e a string verbatim;
  ECG a 30% em repouso e a 100% com brilho no hover; modal com canto 18px,
  título 15px, subtítulo 13px, primário `#7c87ff`/`#5e6ad2`, cortina `--scrim`;
  no claro, dica `ink-faint` a 4,85:1 e primário a 4,70:1; popover com canto
  10px e 77px de altura; "antes" (portal sem escopo): canto 0, `--fs-*` a
  16px, primário cinza do shadcn, `ink-faint` a 2,04:1; primeiro carregamento
  em claro sem divergência de hidratação; 390px sem rolagem horizontal.
